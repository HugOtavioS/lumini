/**
 * SCRUM-87 — limite de armazenamento local e limpeza de propostas antigas já
 * sincronizadas.
 *
 * O RNF14 proíbe limitar o trabalho offline: o técnico pode gerar quantas
 * propostas o aparelho aguentar. Por isso o limite daqui não bloqueia nada.
 * Ele é o ponto em que o app começa a avisar e a sugerir limpeza, e a limpeza
 * só acontece quando o técnico confirma.
 *
 * - **Limite:** 500 MB para o Lumini (banco + PDFs + imagens). Aviso discreto
 *   a partir de 80 %; aviso destacado ao passar do limite.
 * - **Aparelho quase cheio:** com menos de 300 MB livres, aviso destacado,
 *   porque aí o risco é não conseguir gravar o PDF.
 * - **O que pode ser liberado:** só os arquivos (PDF e imagens) de propostas
 *   já sincronizadas, sem nada na fila, fora dos status em que o técnico
 *   edita ("Em elaboração" e "Reaberta") e sem alteração há mais de 90 dias
 *   (30 dias para propostas aprovadas ou recusadas). Os dados da proposta
 *   continuam no aparelho e no servidor; o PDF pode ser gerado de novo pelo
 *   histórico (RF13, 4a).
 * - **Nada é apagado sem aviso:** `planejarLimpeza` só monta a lista; a
 *   remoção exige a confirmação do técnico para aquela lista
 *   (`confirmarPlano`), e o que mudou depois da confirmação fica de fora.
 */
import type { StatusProposta } from '../contrato';
import { ErroValidacao } from '../erros';
import type { SyncStatus } from '../fila/fila';
import { descreverErro, gerarIdPadrao, isoDeMs, jsonEstavel, msDeIso } from '../util';

export const KB = 1024;
export const MB = 1024 * KB;
export const GB = 1024 * MB;
const DIA_MS = 24 * 60 * 60_000;

export interface PoliticaArmazenamento {
  /** Espaço que o Lumini pode ocupar com propostas antes de pedir limpeza. */
  limiteBytes: number;
  /** Percentual do limite a partir do qual aparece o aviso discreto. */
  avisoPerc: number;
  /** Espaço livre mínimo no aparelho; abaixo disso, aviso destacado. */
  espacoLivreMinimoBytes: number;
  /** Folga exigida, além do tamanho do arquivo, antes de gravar um PDF. */
  folgaGravacaoBytes: number;
  /** Dias sem alteração para uma proposta sincronizada poder ter os arquivos removidos. */
  retencaoDias: number;
  /** O mesmo, para propostas encerradas (Aprovada ou Recusada). */
  retencaoEncerradasDias: number;
}

export const POLITICA_ARMAZENAMENTO_PADRAO: Readonly<PoliticaArmazenamento> = Object.freeze({
  limiteBytes: 500 * MB,
  avisoPerc: 80,
  espacoLivreMinimoBytes: 300 * MB,
  folgaGravacaoBytes: 50 * MB,
  retencaoDias: 90,
  retencaoEncerradasDias: 30,
});

/** Status em que o técnico está editando: os arquivos nunca são removidos. */
const STATUS_EM_EDICAO: readonly StatusProposta[] = ['Em elaboração', 'Reaberta'];
const STATUS_ENCERRADOS: readonly StatusProposta[] = ['Aprovada', 'Recusada'];

/** O que o app sabe de cada proposta guardada no aparelho. */
export interface PropostaArmazenada {
  idProposta: string;
  /** Texto para a lista mostrada ao técnico (ex.: "Maria Souza · 4,4 kWp · 12/05/2026"). */
  descricao?: string;
  statusProposta: StatusProposta;
  syncStatus: SyncStatus;
  /** Ainda há alteração desta proposta (ou dos itens) na fila. */
  temPendencia: boolean;
  /** `updated_at` da proposta (ISO 8601). */
  atualizadoEm: string;
  /** Tamanho dos arquivos locais da proposta: PDF, imagens e capturas. */
  bytesArquivos: number;
}

export type NivelArmazenamento = 'ok' | 'atencao' | 'limite' | 'critico';

export interface SituacaoArmazenamento {
  nivel: NivelArmazenamento;
  usoBytes: number;
  limiteBytes: number;
  usoPerc: number;
  espacoLivreAparelhoBytes: number | null;
  /** Quanto dá para liberar agora com a limpeza. */
  liberavelBytes: number;
  qtdPropostasLiberaveis: number;
  /** `true` em "limite" e "critico": mostrar ao abrir o app e antes de gerar PDF. */
  avisoDestacado: boolean;
  mensagem: string;
}

export interface ItemPlanoLimpeza {
  idProposta: string;
  descricao: string | null;
  bytes: number;
  atualizadoEm: string;
  motivo: string;
}

export interface PlanoLimpeza {
  idPlano: string;
  criadoEm: string;
  itens: ItemPlanoLimpeza[];
  totalBytes: number;
  /** Texto para a tela de confirmação. */
  resumo: string;
}

export interface ConfirmacaoLimpeza {
  idPlano: string;
  assinatura: string;
  confirmadoEm: string;
}

export interface ResultadoLimpeza {
  removidas: string[];
  ignoradas: { idProposta: string; motivo: string }[];
  bytesLiberados: number;
}

/** "850 KB", "210 MB", "1,2 GB". */
export function formatarBytes(bytes: number): string {
  const virgula = (n: number, casas: number) => n.toFixed(casas).replace('.', ',');
  if (bytes >= GB) return `${virgula(bytes / GB, 1)} GB`;
  if (bytes >= MB) return `${Math.round(bytes / MB)} MB`;
  if (bytes >= KB) return `${Math.round(bytes / KB)} KB`;
  return `${Math.max(0, Math.round(bytes))} bytes`;
}

function politicaCompleta(parcial?: Partial<PoliticaArmazenamento>): PoliticaArmazenamento {
  const p = { ...POLITICA_ARMAZENAMENTO_PADRAO, ...parcial };
  const erros: string[] = [];
  if (!(p.limiteBytes > 0)) erros.push('O limite deve ser maior que zero.');
  if (!(p.avisoPerc > 0 && p.avisoPerc <= 100)) erros.push('O percentual de aviso deve estar entre 0 e 100.');
  if (!(p.espacoLivreMinimoBytes >= 0 && p.folgaGravacaoBytes >= 0)) erros.push('Espaço livre mínimo e folga não podem ser negativos.');
  if (!(p.retencaoDias >= 0 && p.retencaoEncerradasDias >= 0)) erros.push('Os prazos de retenção não podem ser negativos.');
  if (erros.length > 0) throw new ErroValidacao(erros.map((mensagem) => ({ campo: 'politica', mensagem })));
  return p;
}

function paraMs(agora: Date | string | number | undefined): number {
  if (agora === undefined) return Date.now();
  if (agora instanceof Date) return agora.getTime();
  if (typeof agora === 'number') return agora;
  const ms = msDeIso(agora);
  if (ms === null) throw new ErroValidacao([{ campo: 'agora', mensagem: 'Data inválida.' }]);
  return ms;
}

/**
 * Por que os arquivos desta proposta podem ser removidos, ou `null` se não
 * podem. É a regra única usada no plano e de novo na hora de executar.
 */
export function motivoParaLiberar(proposta: PropostaArmazenada, agoraMs: number, politica: PoliticaArmazenamento): string | null {
  if (proposta.temPendencia || proposta.syncStatus !== 'Sincronizado') return null;
  if (STATUS_EM_EDICAO.includes(proposta.statusProposta)) return null;
  if (!(proposta.bytesArquivos > 0)) return null;
  const atualizado = msDeIso(proposta.atualizadoEm);
  if (atualizado === null) return null;
  const encerrada = STATUS_ENCERRADOS.includes(proposta.statusProposta);
  const prazo = encerrada ? politica.retencaoEncerradasDias : politica.retencaoDias;
  const dias = Math.floor((agoraMs - atualizado) / DIA_MS);
  if (dias < prazo) return null;
  return encerrada
    ? `${proposta.statusProposta.toLowerCase()} e sem alteração há ${dias} dias`
    : `sincronizada e sem alteração há ${dias} dias`;
}

function candidatas(propostas: readonly PropostaArmazenada[], agoraMs: number, politica: PoliticaArmazenamento): ItemPlanoLimpeza[] {
  return propostas
    .map((p) => ({ p, motivo: motivoParaLiberar(p, agoraMs, politica) }))
    .filter((x): x is { p: PropostaArmazenada; motivo: string } => x.motivo !== null)
    .sort((a, b) => (msDeIso(a.p.atualizadoEm) ?? 0) - (msDeIso(b.p.atualizadoEm) ?? 0) || a.p.idProposta.localeCompare(b.p.idProposta))
    .map(({ p, motivo }) => ({
      idProposta: p.idProposta,
      descricao: p.descricao ?? null,
      bytes: p.bytesArquivos,
      atualizadoEm: p.atualizadoEm,
      motivo,
    }));
}

function plural(n: number, singular: string, pluralTexto: string): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

/**
 * Situação do armazenamento para os avisos (SCRUM-87). Não bloqueia nada
 * (RNF14): só diz o que mostrar.
 */
export function avaliarArmazenamento(entrada: {
  propostas: readonly PropostaArmazenada[];
  /** Tamanho do arquivo do banco SQLite (o app lê com o FileSystem). */
  bytesBanco?: number;
  /** Espaço livre do aparelho (ex.: `getFreeDiskStorageAsync` do expo-file-system). */
  espacoLivreAparelhoBytes?: number | null;
  agora?: Date | string | number;
  politica?: Partial<PoliticaArmazenamento>;
}): SituacaoArmazenamento {
  const politica = politicaCompleta(entrada.politica);
  const agoraMs = paraMs(entrada.agora);
  const usoBytes = Math.max(0, entrada.bytesBanco ?? 0) + entrada.propostas.reduce((s, p) => s + Math.max(0, p.bytesArquivos), 0);
  const usoPerc = Math.round((usoBytes / politica.limiteBytes) * 1000) / 10;
  const livre = entrada.espacoLivreAparelhoBytes ?? null;
  const liberaveis = candidatas(entrada.propostas, agoraMs, politica);
  const liberavelBytes = liberaveis.reduce((s, i) => s + i.bytes, 0);
  const pendentes = entrada.propostas.filter((p) => p.temPendencia || p.syncStatus !== 'Sincronizado').length;

  let nivel: NivelArmazenamento = 'ok';
  if (livre !== null && livre < politica.espacoLivreMinimoBytes) nivel = 'critico';
  else if (usoBytes >= politica.limiteBytes) nivel = 'limite';
  else if (usoPerc >= politica.avisoPerc) nivel = 'atencao';

  const uso = `O Lumini está usando ${formatarBytes(usoBytes)} de ${formatarBytes(politica.limiteBytes)}`;
  const comoLiberar =
    liberaveis.length > 0
      ? `Dá para liberar ${formatarBytes(liberavelBytes)} removendo os arquivos de ${plural(liberaveis.length, 'proposta antiga', 'propostas antigas')} que já ${liberaveis.length === 1 ? 'está' : 'estão'} no servidor. Elas continuam no histórico, e o PDF pode ser gerado de novo.`
      : pendentes > 0
        ? `Ainda não há o que liberar: ${plural(pendentes, 'proposta está pendente', 'propostas estão pendentes')} de sincronização, e só dá para liberar espaço de propostas que já estão no servidor.`
        : 'Ainda não há propostas antigas o bastante para liberar espaço.';

  let mensagem: string;
  switch (nivel) {
    case 'critico':
      mensagem = `O celular está com pouco espaço livre (${formatarBytes(livre ?? 0)}). Libere espaço para não correr o risco de o PDF não ser gravado. ${comoLiberar}`;
      break;
    case 'limite':
      mensagem = `${uso}, o limite recomendado. ${comoLiberar}`;
      break;
    case 'atencao':
      mensagem = `${uso} (${String(usoPerc).replace('.', ',')}%). ${comoLiberar}`;
      break;
    default:
      mensagem = `${uso}.`;
  }

  return {
    nivel,
    usoBytes,
    limiteBytes: politica.limiteBytes,
    usoPerc,
    espacoLivreAparelhoBytes: livre,
    liberavelBytes,
    qtdPropostasLiberaveis: liberaveis.length,
    avisoDestacado: nivel === 'limite' || nivel === 'critico',
    mensagem,
  };
}

/**
 * Monta a lista do que pode ser removido, da proposta mais antiga para a mais
 * recente. Não remove nada. Com `alvoBytes`, para quando chegar nesse total.
 */
export function planejarLimpeza(entrada: {
  propostas: readonly PropostaArmazenada[];
  agora?: Date | string | number;
  politica?: Partial<PoliticaArmazenamento>;
  alvoBytes?: number;
  gerarId?: () => string;
}): PlanoLimpeza {
  const politica = politicaCompleta(entrada.politica);
  const agoraMs = paraMs(entrada.agora);
  let itens = candidatas(entrada.propostas, agoraMs, politica);
  if (entrada.alvoBytes !== undefined) {
    const escolhidos: ItemPlanoLimpeza[] = [];
    let soma = 0;
    for (const item of itens) {
      if (soma >= entrada.alvoBytes) break;
      escolhidos.push(item);
      soma += item.bytes;
    }
    itens = escolhidos;
  }
  const totalBytes = itens.reduce((s, i) => s + i.bytes, 0);
  const resumo =
    itens.length === 0
      ? 'Nenhuma proposta pode ter os arquivos removidos agora.'
      : `Remover o PDF e as imagens de ${plural(itens.length, 'proposta', 'propostas')} libera ${formatarBytes(totalBytes)}. ` +
        `${itens.length === 1 ? 'Ela continua' : 'Elas continuam'} no histórico e no servidor, e o PDF pode ser gerado de novo quando precisar. Deseja continuar?`;
  return { idPlano: (entrada.gerarId ?? gerarIdPadrao)(), criadoEm: isoDeMs(agoraMs), itens, totalBytes, resumo };
}

function assinaturaDo(plano: PlanoLimpeza): string {
  return jsonEstavel(plano.itens.map((i) => [i.idProposta, i.atualizadoEm, i.bytes]));
}

/** Registra que o técnico viu a lista e confirmou. Só uma confirmação libera `executarLimpeza`. */
export function confirmarPlano(plano: PlanoLimpeza, agora?: Date | string | number): ConfirmacaoLimpeza {
  return { idPlano: plano.idPlano, assinatura: assinaturaDo(plano), confirmadoEm: isoDeMs(paraMs(agora)) };
}

/**
 * Remove os arquivos das propostas do plano, se — e só se — o técnico
 * confirmou este plano. Cada proposta é conferida de novo: se mudou depois da
 * confirmação (voltou para a fila, foi reaberta, foi editada), fica de fora.
 */
export async function executarLimpeza(entrada: {
  plano: PlanoLimpeza;
  confirmacao: ConfirmacaoLimpeza | null | undefined;
  /** Estado atual das propostas no aparelho. */
  propostasAtuais: readonly PropostaArmazenada[];
  /** Apaga o PDF e as imagens da proposta; pode devolver os bytes liberados. */
  removerArquivos: (idProposta: string) => Promise<number | void>;
  agora?: Date | string | number;
  politica?: Partial<PoliticaArmazenamento>;
}): Promise<ResultadoLimpeza> {
  const { plano, confirmacao } = entrada;
  if (!confirmacao || confirmacao.idPlano !== plano.idPlano || confirmacao.assinatura !== assinaturaDo(plano)) {
    throw new ErroValidacao([
      { campo: 'confirmacao', mensagem: 'Nada foi apagado: a limpeza precisa da confirmação do técnico para esta lista de propostas.' },
    ]);
  }
  const politica = politicaCompleta(entrada.politica);
  const agoraMs = paraMs(entrada.agora);
  const atuais = new Map(entrada.propostasAtuais.map((p) => [p.idProposta, p]));
  const resultado: ResultadoLimpeza = { removidas: [], ignoradas: [], bytesLiberados: 0 };

  for (const item of plano.itens) {
    const atual = atuais.get(item.idProposta);
    if (!atual) {
      resultado.ignoradas.push({ idProposta: item.idProposta, motivo: 'A proposta não está mais no aparelho.' });
      continue;
    }
    if (atual.atualizadoEm !== item.atualizadoEm || motivoParaLiberar(atual, agoraMs, politica) === null) {
      resultado.ignoradas.push({ idProposta: item.idProposta, motivo: 'A proposta mudou depois da confirmação; os arquivos foram mantidos.' });
      continue;
    }
    try {
      const liberados = await entrada.removerArquivos(item.idProposta);
      resultado.removidas.push(item.idProposta);
      resultado.bytesLiberados += typeof liberados === 'number' ? liberados : item.bytes;
    } catch (erro) {
      resultado.ignoradas.push({ idProposta: item.idProposta, motivo: `Não foi possível remover os arquivos: ${descreverErro(erro)}` });
    }
  }
  return resultado;
}

/**
 * Antes de gravar um PDF: há espaço livre suficiente? É o "tratamento
 * controlado" do RNF14 — se não houver, o app avisa e não começa a gravação;
 * os dados da proposta já estão salvos no banco.
 */
export function verificarEspacoParaGravar(entrada: {
  espacoLivreAparelhoBytes: number;
  bytesNecessarios: number;
  politica?: Partial<PoliticaArmazenamento>;
}): { pode: boolean; mensagem: string | null } {
  const politica = politicaCompleta(entrada.politica);
  const precisa = Math.max(0, entrada.bytesNecessarios) + politica.folgaGravacaoBytes;
  if (entrada.espacoLivreAparelhoBytes >= precisa) return { pode: true, mensagem: null };
  return {
    pode: false,
    mensagem:
      `Não há espaço livre suficiente para gerar o PDF agora (precisa de ${formatarBytes(precisa)}, há ${formatarBytes(entrada.espacoLivreAparelhoBytes)}). ` +
      'A proposta já está salva: libere espaço e gere o PDF pelo histórico.',
  };
}
