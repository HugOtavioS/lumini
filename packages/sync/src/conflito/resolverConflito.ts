/**
 * SCRUM-83 — resolução de conflito quando o mesmo registro é editado offline
 * em dois aparelhos (DAS 4.3; RF15, 4b).
 *
 * Roda no servidor, a cada operação do push. Os passos:
 *
 * 1. **Relógio adiantado:** um `updated_at` mais de 2 min à frente da hora do
 *    servidor é trocado pela hora do servidor. Sem isso, um celular com a data
 *    errada venceria todos os conflitos daquele registro para sempre.
 * 2. **Registro novo:** grava.
 * 3. **Reenvio:** mesmo conteúdo e mesmo autor do que já está no servidor →
 *    nada muda (o aparelho não recebeu a confirmação e mandou de novo).
 * 4. **Edição normal:** o aparelho editou exatamente a versão que está no
 *    servidor (versão-base igual ao `updated_at` atual) → aplica, sem
 *    conflito. Aqui a ordem dos fatos é conhecida, então o relógio do aparelho
 *    não decide nada.
 * 5. **Edição concorrente:** o registro mudou no servidor depois que o
 *    aparelho o baixou → **last-write-wins**: vence o `updated_at` mais
 *    recente; no empate, fica a versão do servidor. Cada campo sobrescrito
 *    vira uma linha no Log de Auditoria — inclusive quando a alteração que
 *    chegou é a descartada, para que os valores perdidos fiquem registrados —
 *    e quem perdeu a alteração recebe um aviso.
 *
 * A regra de quem pode editar em cada status (RN11, NOVO-106) é verificada
 * antes desta função, quando for implementada na API.
 */
import type {
  AvisoSobrescrita,
  EntidadeSincronizavel,
  RegistroAuditoria,
  VersaoRegistro,
} from '../contrato';
import { ErroValidacao } from '../erros';
import { gerarIdPadrao, isoDeMs, jsonEstavel, msDeIso } from '../util';
import { listarDiferencas, type Diferenca } from './diferencas';

/** Quanto o relógio do aparelho pode estar à frente do servidor sem correção. */
export const TOLERANCIA_RELOGIO_PADRAO_MS = 2 * 60_000;

export type DecisaoConflito = 'criar' | 'atualizar' | 'repetida' | 'sobrescrever' | 'manter';

export interface EntradaConflito {
  entidade: EntidadeSincronizavel;
  /** Versão guardada no servidor; `null` se o registro ainda não existe. */
  atual: VersaoRegistro | null;
  /** Versão que acabou de chegar. */
  recebida: VersaoRegistro;
  /** `updated_at` que o aparelho conhecia antes de editar (`OperacaoSync.baseUpdatedAt`). */
  baseUpdatedAt: string | null;
  /** Hora do servidor. */
  agora: Date | string | number;
  /** De onde veio a versão recebida. */
  origem: 'Mobile' | 'Web';
  toleranciaRelogioMs?: number;
  gerarId?: () => string;
}

export interface ResultadoConflito {
  decisao: DecisaoConflito;
  /** `true` quando houve edição concorrente (passo 5). */
  conflito: boolean;
  /** Versão que fica valendo no servidor. */
  vencedora: VersaoRegistro;
  /** Linhas para o Log de Auditoria: uma por campo sobrescrito. Vazio quando não houve conflito. */
  auditoria: RegistroAuditoria[];
  /** Aviso para quem teve a alteração sobrescrita. */
  aviso: AvisoSobrescrita | null;
  /** Observações para o técnico (ex.: relógio do aparelho corrigido). */
  observacoes: string[];
}

const ONDE: Readonly<Record<EntidadeSincronizavel, string>> = {
  Cliente: 'no cadastro do cliente',
  Instalacao: 'na instalação',
  Medicao: 'na medição do telhado',
  SimulacaoSombreamento: 'na simulação de sombreamento',
  Proposta: 'na proposta',
  SolicitacaoUpgrade: 'na solicitação de upgrade',
};

/** Data e hora de Brasília (UTC−3, sem horário de verão desde 2019), ex.: "18/10/2026 às 09:05". */
export function formatarDataHoraBrasilia(ms: number): string {
  const d = new Date(ms - 3 * 3_600_000);
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${dois(d.getUTCDate())}/${dois(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} às ${dois(d.getUTCHours())}:${dois(d.getUTCMinutes())}`;
}

function paraMs(agora: Date | string | number): number {
  if (agora instanceof Date) return agora.getTime();
  if (typeof agora === 'number') return agora;
  const ms = msDeIso(agora);
  if (ms === null) throw new ErroValidacao([{ campo: 'agora', mensagem: 'Hora do servidor inválida.' }]);
  return ms;
}

function comUpdatedAt(versao: VersaoRegistro, ms: number): VersaoRegistro {
  return msDeIso(versao.updatedAt) === ms ? versao : { ...versao, updatedAt: isoDeMs(ms) };
}

export function resolverConflito(entrada: EntradaConflito): ResultadoConflito {
  const { entidade, atual, recebida } = entrada;
  const agoraMs = paraMs(entrada.agora);
  const tolerancia = entrada.toleranciaRelogioMs ?? TOLERANCIA_RELOGIO_PADRAO_MS;
  const gerarId = entrada.gerarId ?? gerarIdPadrao;
  const observacoes: string[] = [];

  let recebidaMs = msDeIso(recebida.updatedAt);
  if (recebidaMs === null) {
    throw new ErroValidacao([{ campo: 'updatedAt', mensagem: 'A versão recebida não tem um updated_at válido.' }]);
  }

  // 1. Relógio adiantado
  if (recebidaMs > agoraMs + tolerancia) {
    observacoes.push(
      `O relógio do aparelho estava adiantado (${formatarDataHoraBrasilia(recebidaMs)}); a alteração foi registrada com a hora do servidor.`,
    );
    recebidaMs = agoraMs;
  }

  // 2. Registro novo
  if (!atual) {
    return { decisao: 'criar', conflito: false, vencedora: comUpdatedAt(recebida, recebidaMs), auditoria: [], aviso: null, observacoes };
  }
  const atualMs = msDeIso(atual.updatedAt);
  if (atualMs === null) {
    throw new ErroValidacao([{ campo: 'atual.updatedAt', mensagem: 'A versão do servidor não tem um updated_at válido.' }]);
  }

  // 3. Reenvio do mesmo conteúdo
  if (recebida.updatedBy === atual.updatedBy && jsonEstavel(recebida.dados) === jsonEstavel(atual.dados)) {
    return { decisao: 'repetida', conflito: false, vencedora: atual, auditoria: [], aviso: null, observacoes };
  }

  // 4. Edição sobre a versão que está no servidor
  const baseMs = entrada.baseUpdatedAt === null ? null : msDeIso(entrada.baseUpdatedAt);
  if (baseMs !== null && baseMs === atualMs) {
    if (recebidaMs <= atualMs) {
      observacoes.push('O relógio do aparelho estava atrasado; a alteração foi registrada logo depois da versão anterior.');
      recebidaMs = atualMs + 1;
    }
    return { decisao: 'atualizar', conflito: false, vencedora: comUpdatedAt(recebida, recebidaMs), auditoria: [], aviso: null, observacoes };
  }

  // 5. Edição concorrente: last-write-wins por updated_at
  const recebidaCorrigida = comUpdatedAt(recebida, recebidaMs);
  const quando = formatarDataHoraBrasilia;
  const dataHora = isoDeMs(agoraMs);
  const paraAuditoria = (diferencas: Diferenca[], idUsuario: string, origem: RegistroAuditoria['origem'], motivo: string) =>
    diferencas.map<RegistroAuditoria>((d) => ({
      idLog: gerarId(),
      idEmpresa: atual.idEmpresa,
      entidade: d.entidade,
      idRegistro: d.idRegistro,
      campo: d.campo,
      valorAnterior: d.valorAnterior,
      valorNovo: d.valorNovo,
      idUsuario,
      origem,
      dataHora,
      motivo,
    }));

  if (recebidaMs > atualMs) {
    const motivo = `Conflito de sincronização (last-write-wins): a versão de ${quando(recebidaMs)} substituiu a de ${quando(atualMs)}.`;
    return {
      decisao: 'sobrescrever',
      conflito: true,
      vencedora: recebidaCorrigida,
      auditoria: paraAuditoria(listarDiferencas(entidade, atual, recebidaCorrigida), recebida.updatedBy, entrada.origem, motivo),
      aviso: {
        idAviso: gerarId(),
        idUsuario: atual.updatedBy,
        entidade,
        idRegistro: atual.id,
        sobrescritoPor: recebida.updatedBy,
        em: dataHora,
        mensagem:
          `Sua alteração ${ONDE[entidade]}, feita em ${quando(atualMs)}, foi substituída por uma versão mais recente, ` +
          `de ${quando(recebidaMs)}, feita em outro aparelho. Os valores anteriores ficaram no log de auditoria.`,
      },
      observacoes,
    };
  }

  const empate = recebidaMs === atualMs;
  const motivo = empate
    ? `Conflito de sincronização (last-write-wins): empate em ${quando(atualMs)}; ficou a versão do servidor e a alteração recebida foi descartada.`
    : `Conflito de sincronização (last-write-wins): a alteração de ${quando(recebidaMs)} foi descartada porque o servidor já tinha uma versão mais recente, de ${quando(atualMs)}.`;
  return {
    decisao: 'manter',
    conflito: true,
    vencedora: atual,
    // No aparelho, a versão do servidor toma o lugar da alteração descartada:
    // o log guarda os valores que se perderam.
    auditoria: paraAuditoria(listarDiferencas(entidade, recebidaCorrigida, atual), atual.updatedBy, 'API', motivo),
    aviso: {
      idAviso: gerarId(),
      idUsuario: recebida.updatedBy,
      entidade,
      idRegistro: atual.id,
      sobrescritoPor: atual.updatedBy,
      em: dataHora,
      mensagem:
        `Sua alteração ${ONDE[entidade]}, feita em ${quando(recebidaMs)}, não foi aplicada porque já havia uma versão ` +
        `${empate ? 'do mesmo horário' : 'mais recente'} no servidor, de ${quando(atualMs)}. O aparelho recebeu essa versão; ` +
        'o que você tinha alterado ficou no log de auditoria.',
    },
    observacoes,
  };
}
