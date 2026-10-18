/**
 * SCRUM-82 — fila de sincronização persistente, com retentativa automática e
 * backoff exponencial em falha de rede.
 *
 * - **Persistente:** cada alteração pendente é uma linha da tabela
 *   `fila_sincronizacao`, no SQLite do app. Fechar o app (ou o sistema matar o
 *   processo) não perde nada: ao abrir de novo, a fila continua de onde parou.
 * - **Uma linha por registro:** editar de novo um registro que ainda não subiu
 *   só troca o conteúdo da linha (a última versão é a que vale). A versão-base,
 *   usada para detectar conflito (SCRUM-83), é a de antes da primeira edição.
 * - **Ordem de dependência (DAS 4.1):** cliente → instalação → medição →
 *   simulação → proposta (com os itens) → solicitação de upgrade.
 * - **RN07:** proposta "Em elaboração" (ou "Reaberta", em edição pelo técnico)
 *   não entra na fila.
 * - **Falhas:** sem rede, tempo esgotado ou API fora do ar → o item fica com
 *   `sync_status = Erro` e nova tentativa automática após uma espera que dobra a
 *   cada falha (2 s, 4 s, 8 s ... até 10 min, com sorteio). Quando a conexão
 *   volta, envia na hora, sem esperar. Se o servidor recusar o registro (dados
 *   inválidos, por exemplo), o item fica em "Erro" aguardando ação do técnico.
 * - **Edição durante o envio:** se o técnico mudar o registro enquanto o lote
 *   está a caminho, a nova versão não se perde (controle por `revisao`).
 */
import {
  ENTIDADES_SINCRONIZAVEIS,
  ORDEM_DEPENDENCIA,
  STATUS_QUE_SINCRONIZAM,
  ehEntidadeSincronizavel,
  idOperacaoDe,
  type EntidadeSincronizavel,
  type OperacaoSync,
  type RespostaPush,
  type ResultadoOperacao,
  type VersaoRegistro,
} from '../contrato';
import { garantirSemErros, type ErroCampo } from '../erros';
import { Trava, type BancoSql, type ValorSql } from '../sql';
import { ErroHttp, falhaRetentavel, type TransporteSync } from '../transporte';
import { descreverErro, gerarIdPadrao, isoDeMs, msDeIso } from '../util';
import { POLITICA_RETENTATIVA_PADRAO, calcularEspera, validarPolitica, type PoliticaRetentativa } from './backoff';
import { MIGRACOES_FILA } from './migracoes';

export type SituacaoItemFila = 'Pendente' | 'Erro';

/** `sync_status` de um registro, como a UI mostra (RF16). */
export type SyncStatus = 'Pendente' | 'Sincronizado' | 'Erro';

export interface ItemFila {
  idOperacao: string;
  entidade: EntidadeSincronizavel;
  idRegistro: string;
  prioridade: number;
  versao: VersaoRegistro;
  baseUpdatedAt: string | null;
  situacao: SituacaoItemFila;
  retentarAutomaticamente: boolean;
  tentativas: number;
  proximaTentativaEm: number;
  ultimaTentativaEm: number | null;
  ultimoErro: string | null;
  revisao: number;
  criadoEm: number;
  atualizadoEm: number;
}

export interface EntradaFila {
  entidade: EntidadeSincronizavel;
  versao: VersaoRegistro;
  /**
   * `updated_at` da versão do servidor que o aparelho tinha antes desta edição
   * (o `updated_at` do registro quando ele estava "Sincronizado"). Omita para
   * registros criados no aparelho. Se o registro já estiver na fila, a base
   * original é mantida.
   */
  baseUpdatedAt?: string | null;
}

/** Avisos da fila para o app atualizar o `sync_status` e os registros locais. */
export type EventoFila =
  | {
      tipo: 'sincronizado';
      entidade: EntidadeSincronizavel;
      idRegistro: string;
      /** Versão que ficou no servidor: grave o `updatedAt` dela no registro local. */
      versaoAceita: VersaoRegistro;
      /** A versão enviada sobrescreveu uma alteração concorrente (SCRUM-83). */
      conflito: boolean;
      avisos: string[];
      /** O técnico editou de novo durante o envio: o registro continua "Pendente". */
      aindaPendente: boolean;
    }
  | {
      tipo: 'substituido';
      entidade: EntidadeSincronizavel;
      idRegistro: string;
      /** O servidor tinha uma versão mais recente: substitua o registro local por esta. */
      versaoServidor: VersaoRegistro;
      mensagem: string;
      /** O técnico editou de novo durante o envio: mantenha a edição local, que volta a subir. */
      aindaPendente: boolean;
    }
  | {
      tipo: 'erro';
      entidade: EntidadeSincronizavel;
      idRegistro: string;
      mensagem: string;
      /** `true`: a fila tenta de novo sozinha. `false`: precisa de ação do técnico. */
      retentavel: boolean;
      tentativas: number;
      proximaTentativaEm: number | null;
    };

/** Uma tentativa de envio, para o Log de Sincronização (RNF11). */
export interface TentativaSync {
  dataHora: string;
  tipo: 'Push';
  /** "Sucesso" quando a API respondeu o lote (mesmo recusando algum registro); "Falha" quando o lote não chegou. */
  status: 'Sucesso' | 'Falha';
  /** Registros enviados na tentativa. */
  qtdRegistros: number;
  mensagemErro: string | null;
}

export interface ResultadoRodada {
  motivo: 'ok' | 'offline' | 'vazia' | 'falha';
  /** Operações enviadas à API nesta rodada (com ou sem sucesso). */
  enviadas: number;
  aplicadas: number;
  substituidas: number;
  rejeitadas: number;
  /** Mensagem da falha de envio, quando o lote não chegou a ser processado. */
  falhaDeEnvio: string | null;
  proximaTentativaEm: number | null;
}

export interface ResumoFila {
  total: number;
  pendentes: number;
  comErro: number;
  /** Itens recusados pelo servidor, que só voltam a subir com ação do técnico. */
  aguardandoAcao: number;
  /** Para o alerta destacado do RF16 (1a). */
  falhaPersistente: boolean;
  proximaTentativaEm: number | null;
  ultimaTentativaEm: number | null;
  ultimoErro: string | null;
}

export interface Conectividade {
  estaOnline(): boolean | Promise<boolean>;
}

export interface OpcoesFila {
  banco: BancoSql;
  transporte: TransporteSync;
  /** Identificador da instalação do app. */
  idDispositivo: string;
  /** Técnico logado; quando informado, cada tentativa vai para a tabela `log_sincronizacao`. */
  idUsuario?: string;
  conectividade?: Conectividade;
  politica?: Partial<PoliticaRetentativa>;
  /** Operações por requisição (padrão 50). */
  tamanhoLote?: number;
  /** Depois de enfileirar, espera este tempo e envia (RF15: escrita dispara o push). `null` desliga. Padrão 1,5 s. */
  esperaAposEnfileirarMs?: number | null;
  aoResultado?: (evento: EventoFila) => void | Promise<void>;
  aoTentar?: (tentativa: TentativaSync) => void | Promise<void>;
  relogio?: () => number;
  aleatorio?: () => number;
  agendar?: (tarefa: () => void, ms: number) => unknown;
  cancelar?: (id: unknown) => void;
  gerarId?: () => string;
}

interface LinhaFila {
  id_operacao: string;
  entidade: string;
  id_registro: string;
  prioridade: number;
  payload: string;
  base_updated_at: string | null;
  situacao: string;
  retentar_automaticamente: number;
  tentativas: number;
  proxima_tentativa_em: number;
  ultima_tentativa_em: number | null;
  ultimo_erro: string | null;
  revisao: number;
  criado_em: number;
  atualizado_em: number;
}

function paraItem(linha: LinhaFila): ItemFila {
  return {
    idOperacao: linha.id_operacao,
    entidade: linha.entidade as EntidadeSincronizavel,
    idRegistro: linha.id_registro,
    prioridade: Number(linha.prioridade),
    versao: JSON.parse(linha.payload) as VersaoRegistro,
    baseUpdatedAt: linha.base_updated_at,
    situacao: linha.situacao === 'Erro' ? 'Erro' : 'Pendente',
    retentarAutomaticamente: Number(linha.retentar_automaticamente) === 1,
    tentativas: Number(linha.tentativas),
    proximaTentativaEm: Number(linha.proxima_tentativa_em),
    ultimaTentativaEm: linha.ultima_tentativa_em === null ? null : Number(linha.ultima_tentativa_em),
    ultimoErro: linha.ultimo_erro,
    revisao: Number(linha.revisao),
    criadoEm: Number(linha.criado_em),
    atualizadoEm: Number(linha.atualizado_em),
  };
}

function paraOperacao(item: ItemFila): OperacaoSync {
  return { idOperacao: item.idOperacao, entidade: item.entidade, baseUpdatedAt: item.baseUpdatedAt, versao: item.versao };
}

/** RN07 e consistência mínima da versão. Devolve a lista de problemas (vazia = pode entrar na fila). */
export function validarEntradaFila(entrada: EntradaFila): ErroCampo[] {
  const erros: ErroCampo[] = [];
  if (!ehEntidadeSincronizavel(entrada.entidade)) {
    erros.push({ campo: 'entidade', mensagem: `Entidade inválida. Use: ${ENTIDADES_SINCRONIZAVEIS.join(', ')}.` });
  }
  const v = entrada.versao;
  if (!v || typeof v !== 'object') {
    erros.push({ campo: 'versao', mensagem: 'Informe a versão do registro.' });
    return erros;
  }
  if (typeof v.id !== 'string' || v.id.trim() === '') erros.push({ campo: 'versao.id', mensagem: 'O registro precisa do UUID gerado no aparelho.' });
  if (typeof v.idEmpresa !== 'string' || v.idEmpresa.trim() === '') erros.push({ campo: 'versao.idEmpresa', mensagem: 'Informe a empresa do registro.' });
  if (msDeIso(v.updatedAt) === null) erros.push({ campo: 'versao.updatedAt', mensagem: 'updated_at inválido.' });
  if (typeof v.updatedBy !== 'string' || v.updatedBy.trim() === '') erros.push({ campo: 'versao.updatedBy', mensagem: 'Informe quem alterou (updated_by).' });
  if (!v.dados || typeof v.dados !== 'object' || Array.isArray(v.dados)) erros.push({ campo: 'versao.dados', mensagem: 'Os dados do registro devem ser um objeto.' });
  if (entrada.baseUpdatedAt != null && msDeIso(entrada.baseUpdatedAt) === null) {
    erros.push({ campo: 'baseUpdatedAt', mensagem: 'Versão-base inválida.' });
  }
  if (entrada.entidade === 'Proposta' && v.dados && typeof v.dados === 'object') {
    const status = (v.dados as Record<string, unknown>).status_proposta;
    if (!(STATUS_QUE_SINCRONIZAM as readonly unknown[]).includes(status)) {
      erros.push({
        campo: 'status_proposta',
        mensagem: `RN07: só sobem propostas ${STATUS_QUE_SINCRONIZAM.join(', ')}; "${String(status)}" fica só no aparelho.`,
      });
    }
  }
  return erros;
}

/** `true` quando o registro pode entrar na fila (RN07 e dados mínimos). */
export function podeEntrarNaFila(entrada: EntradaFila): boolean {
  return validarEntradaFila(entrada).length === 0;
}

export class FilaSincronizacao {
  private readonly banco: BancoSql;
  private readonly transporte: TransporteSync;
  private readonly idDispositivo: string;
  private readonly idUsuario: string | null;
  private readonly conectividade: Conectividade | null;
  private readonly politica: PoliticaRetentativa;
  private readonly tamanhoLote: number;
  private readonly esperaAposEnfileirarMs: number | null;
  private readonly aoResultado: OpcoesFila['aoResultado'];
  private readonly aoTentar: OpcoesFila['aoTentar'];
  private readonly relogio: () => number;
  private readonly aleatorio: () => number;
  private readonly agendarFn: (tarefa: () => void, ms: number) => unknown;
  private readonly cancelarFn: (id: unknown) => void;
  private readonly gerarId: () => string;
  private readonly trava = new Trava();

  private rodadaAtual: Promise<ResultadoRodada> | null = null;
  private outraRodada: { ignorarEspera: boolean } | null = null;
  private idTimer: unknown = null;
  private alvoTimer: number | null = null;
  private parada = true;

  private constructor(opcoes: OpcoesFila) {
    this.banco = opcoes.banco;
    this.transporte = opcoes.transporte;
    this.idDispositivo = opcoes.idDispositivo;
    this.idUsuario = opcoes.idUsuario ?? null;
    this.conectividade = opcoes.conectividade ?? null;
    this.politica = { ...POLITICA_RETENTATIVA_PADRAO, ...opcoes.politica };
    this.tamanhoLote = opcoes.tamanhoLote ?? 50;
    this.esperaAposEnfileirarMs = opcoes.esperaAposEnfileirarMs === undefined ? 1_500 : opcoes.esperaAposEnfileirarMs;
    this.aoResultado = opcoes.aoResultado;
    this.aoTentar = opcoes.aoTentar;
    this.relogio = opcoes.relogio ?? (() => Date.now());
    this.aleatorio = opcoes.aleatorio ?? Math.random;
    this.agendarFn = opcoes.agendar ?? ((tarefa, ms) => setTimeout(tarefa, ms));
    this.cancelarFn = opcoes.cancelar ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
    this.gerarId = opcoes.gerarId ?? gerarIdPadrao;
  }

  /** Cria as tabelas (se ainda não existirem) e devolve a fila, ainda parada. Chame `iniciar()` em seguida. */
  static async abrir(opcoes: OpcoesFila): Promise<FilaSincronizacao> {
    const erros: ErroCampo[] = [];
    if (typeof opcoes.idDispositivo !== 'string' || opcoes.idDispositivo.trim() === '') {
      erros.push({ campo: 'idDispositivo', mensagem: 'Informe o identificador do aparelho.' });
    }
    const politica = { ...POLITICA_RETENTATIVA_PADRAO, ...opcoes.politica };
    for (const mensagem of validarPolitica(politica)) erros.push({ campo: 'politica', mensagem });
    if (opcoes.tamanhoLote !== undefined && !(Number.isInteger(opcoes.tamanhoLote) && opcoes.tamanhoLote >= 1)) {
      erros.push({ campo: 'tamanhoLote', mensagem: 'O tamanho do lote deve ser um inteiro positivo.' });
    }
    garantirSemErros(erros);
    for (const sql of MIGRACOES_FILA) await opcoes.banco.executar(sql);
    return new FilaSincronizacao(opcoes);
  }

  // -------------------------------------------------------------------------
  // Ciclo de vida
  // -------------------------------------------------------------------------

  /** Liga o envio automático (ao abrir o app ou voltar do segundo plano) e já tenta enviar. */
  async iniciar(): Promise<ResultadoRodada> {
    this.parada = false;
    return this.processar();
  }

  /**
   * Desliga o envio automático (app indo para segundo plano ou logout). A fila
   * continua salva, e chamadas explícitas (`processar`, `retentarAgora`) ainda funcionam.
   */
  parar(): void {
    this.parada = true;
    this.cancelarTimer();
  }

  /** Avise a fila quando a conexão mudar (ex.: NetInfo). Ao voltar, envia na hora, sem esperar o backoff. */
  async aoMudarConexao(online: boolean): Promise<ResultadoRodada | null> {
    if (!online) return null;
    return this.processar({ ignorarEspera: true });
  }

  // -------------------------------------------------------------------------
  // Escrita
  // -------------------------------------------------------------------------

  /**
   * Coloca (ou atualiza) um registro na fila. Lança `ErroValidacao` quando o
   * registro não pode subir (RN07 ou dados incompletos).
   */
  async enfileirar(entrada: EntradaFila): Promise<ItemFila> {
    garantirSemErros(validarEntradaFila(entrada));
    const agora = this.relogio();
    const idOperacao = idOperacaoDe(entrada.entidade, entrada.versao.id);
    const item = await this.trava.executar(async () => {
      // Edição nova: se o item estava recusado (aguardando ação), volta a tentar do zero.
      await this.banco.executar(
        `INSERT INTO fila_sincronizacao (
           id_operacao, entidade, id_registro, prioridade, payload, base_updated_at,
           situacao, retentar_automaticamente, tentativas, proxima_tentativa_em,
           revisao, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, 'Pendente', 1, 0, ?, 1, ?, ?)
         ON CONFLICT (entidade, id_registro) DO UPDATE SET
           payload = excluded.payload,
           atualizado_em = excluded.atualizado_em,
           revisao = fila_sincronizacao.revisao + 1,
           situacao = CASE WHEN fila_sincronizacao.retentar_automaticamente = 0 THEN 'Pendente' ELSE fila_sincronizacao.situacao END,
           tentativas = CASE WHEN fila_sincronizacao.retentar_automaticamente = 0 THEN 0 ELSE fila_sincronizacao.tentativas END,
           proxima_tentativa_em = CASE WHEN fila_sincronizacao.retentar_automaticamente = 0 THEN excluded.proxima_tentativa_em ELSE fila_sincronizacao.proxima_tentativa_em END,
           retentar_automaticamente = 1`,
        [
          idOperacao,
          entrada.entidade,
          entrada.versao.id,
          ORDEM_DEPENDENCIA[entrada.entidade],
          JSON.stringify(entrada.versao),
          entrada.baseUpdatedAt ?? null,
          agora,
          agora,
          agora,
        ],
      );
      return this.lerItem(idOperacao);
    });
    if (!item) throw new Error('Falha ao gravar o item na fila.');
    if (this.esperaAposEnfileirarMs !== null && !this.parada) {
      this.agendarEm(Math.max(item.proximaTentativaEm, agora + this.esperaAposEnfileirarMs));
    }
    return item;
  }

  /** Tira um registro da fila (ex.: o técnico descartou um rascunho que ainda não tinha subido). */
  async remover(entidade: EntidadeSincronizavel, idRegistro: string): Promise<boolean> {
    const r = await this.trava.executar(() =>
      this.banco.executar('DELETE FROM fila_sincronizacao WHERE id_operacao = ?', [idOperacaoDe(entidade, idRegistro)]),
    );
    return r.alteradas > 0;
  }

  // -------------------------------------------------------------------------
  // Leitura (UI: RF13, RF16)
  // -------------------------------------------------------------------------

  async listar(): Promise<ItemFila[]> {
    const linhas = await this.trava.executar(() =>
      this.banco.consultar<LinhaFila>('SELECT * FROM fila_sincronizacao ORDER BY prioridade, criado_em, id_operacao'),
    );
    return linhas.map(paraItem);
  }

  async obter(entidade: EntidadeSincronizavel, idRegistro: string): Promise<ItemFila | null> {
    return this.trava.executar(() => this.lerItem(idOperacaoDe(entidade, idRegistro)));
  }

  /** `sync_status` do registro: sem linha na fila = "Sincronizado". */
  async syncStatusDe(entidade: EntidadeSincronizavel, idRegistro: string): Promise<SyncStatus> {
    const item = await this.obter(entidade, idRegistro);
    return item ? item.situacao : 'Sincronizado';
  }

  async resumo(): Promise<ResumoFila> {
    const itens = await this.listar();
    const automaticos = itens.filter((i) => i.retentarAutomaticamente);
    const comErro = itens.filter((i) => i.situacao === 'Erro');
    const ultima = itens.reduce<ItemFila | null>(
      (maior, i) => (i.ultimaTentativaEm !== null && (maior === null || i.ultimaTentativaEm > (maior.ultimaTentativaEm ?? -1)) ? i : maior),
      null,
    );
    return {
      total: itens.length,
      pendentes: itens.filter((i) => i.situacao === 'Pendente').length,
      comErro: comErro.length,
      aguardandoAcao: itens.filter((i) => !i.retentarAutomaticamente).length,
      falhaPersistente: itens.some((i) => !i.retentarAutomaticamente || i.tentativas >= this.politica.tentativasAteAlerta),
      proximaTentativaEm: automaticos.length > 0 ? Math.min(...automaticos.map((i) => i.proximaTentativaEm)) : null,
      ultimaTentativaEm: ultima?.ultimaTentativaEm ?? null,
      ultimoErro: ultima?.ultimoErro ?? null,
    };
  }

  // -------------------------------------------------------------------------
  // Envio
  // -------------------------------------------------------------------------

  /**
   * "Forçar sincronização agora" (NOVO-76; RF13 4.1; RF16 3.1). Sem alvo,
   * tenta tudo, inclusive itens recusados que aguardavam ação.
   */
  async retentarAgora(alvo?: { entidade: EntidadeSincronizavel; idRegistro: string }): Promise<ResultadoRodada> {
    const agora = this.relogio();
    await this.trava.executar(async () => {
      if (alvo) {
        await this.banco.executar(
          'UPDATE fila_sincronizacao SET retentar_automaticamente = 1, proxima_tentativa_em = ? WHERE id_operacao = ?',
          [agora, idOperacaoDe(alvo.entidade, alvo.idRegistro)],
        );
      } else {
        await this.banco.executar('UPDATE fila_sincronizacao SET retentar_automaticamente = 1, proxima_tentativa_em = ?', [agora]);
      }
    });
    return this.processar();
  }

  /**
   * Envia os itens que já podem ir. Só uma rodada por vez: se for chamada
   * durante outra, agenda uma nova rodada logo em seguida.
   */
  processar(opcoes: { ignorarEspera?: boolean } = {}): Promise<ResultadoRodada> {
    const ignorarEspera = opcoes.ignorarEspera ?? false;
    if (this.rodadaAtual) {
      this.outraRodada = { ignorarEspera: ignorarEspera || (this.outraRodada?.ignorarEspera ?? false) };
      return this.rodadaAtual;
    }
    const rodada = this.executarRodada(ignorarEspera).finally(() => {
      this.rodadaAtual = null;
      const proxima = this.outraRodada;
      this.outraRodada = null;
      if (proxima && !this.parada) void this.processar(proxima);
    });
    this.rodadaAtual = rodada;
    return rodada;
  }

  private async executarRodada(ignorarEspera: boolean): Promise<ResultadoRodada> {
    const resultado: ResultadoRodada = {
      motivo: 'ok',
      enviadas: 0,
      aplicadas: 0,
      substituidas: 0,
      rejeitadas: 0,
      falhaDeEnvio: null,
      proximaTentativaEm: null,
    };
    let online = true;
    try {
      online = this.conectividade ? await this.conectividade.estaOnline() : true;
    } catch {
      online = false;
    }
    if (!online) {
      // Sem conexão não há tentativa: a reconexão (aoMudarConexao) dispara o envio.
      resultado.motivo = 'offline';
      return resultado;
    }

    const elegiveis = await this.trava.executar(() => this.selecionarElegiveis(this.relogio(), ignorarEspera));
    if (elegiveis.length === 0) {
      resultado.motivo = 'vazia';
      resultado.proximaTentativaEm = await this.agendarProxima();
      return resultado;
    }

    for (let i = 0; i < elegiveis.length; i += this.tamanhoLote) {
      const lote = elegiveis.slice(i, i + this.tamanhoLote);
      let resposta: RespostaPush;
      try {
        resposta = await this.transporte.enviar({ idDispositivo: this.idDispositivo, operacoes: lote.map(paraOperacao) });
      } catch (erro) {
        resultado.enviadas += lote.length;
        resultado.motivo = 'falha';
        resultado.falhaDeEnvio = descreverErro(erro);
        const eventos = await this.trava.executar(() => this.registrarFalhaDoLote(lote, erro, this.relogio()));
        await this.registrarTentativa('Falha', lote.length, descreverErro(erro));
        await this.emitir(eventos);
        break;
      }
      resultado.enviadas += lote.length;
      const { eventos, aplicadas, substituidas, rejeitadas } = await this.trava.executar(() =>
        this.aplicarResultados(lote, resposta.resultados, this.relogio()),
      );
      resultado.aplicadas += aplicadas;
      resultado.substituidas += substituidas;
      resultado.rejeitadas += rejeitadas;
      await this.registrarTentativa(
        'Sucesso',
        lote.length,
        rejeitadas > 0 ? `${rejeitadas} ${rejeitadas === 1 ? 'registro recusado' : 'registros recusados'} pela API.` : null,
      );
      await this.emitir(eventos);
    }
    resultado.proximaTentativaEm = await this.agendarProxima();
    return resultado;
  }

  // -------------------------------------------------------------------------
  // Internos (sempre chamados dentro da trava)
  // -------------------------------------------------------------------------

  private async lerItem(idOperacao: string): Promise<ItemFila | null> {
    const [linha] = await this.banco.consultar<LinhaFila>('SELECT * FROM fila_sincronizacao WHERE id_operacao = ?', [idOperacao]);
    return linha ? paraItem(linha) : null;
  }

  private async selecionarElegiveis(agora: number, ignorarEspera: boolean): Promise<ItemFila[]> {
    const linhas = await this.banco.consultar<LinhaFila>(
      `SELECT * FROM fila_sincronizacao
       WHERE retentar_automaticamente = 1 AND (? = 1 OR proxima_tentativa_em <= ?)
       ORDER BY prioridade, criado_em, id_operacao`,
      [ignorarEspera ? 1 : 0, agora],
    );
    return linhas.map(paraItem);
  }

  private async registrarFalhaDoLote(lote: ItemFila[], erro: unknown, agora: number): Promise<EventoFila[]> {
    const retentavel = falhaRetentavel(erro);
    const mensagem = descreverErro(erro);
    const falhas = Math.max(...lote.map((i) => i.tentativas + 1));
    const esperaServidor = erro instanceof ErroHttp ? erro.esperaSugeridaMs ?? 0 : 0;
    const espera = Math.max(calcularEspera(falhas, this.politica, this.aleatorio), esperaServidor);
    const proxima = agora + espera;
    const eventos: EventoFila[] = [];
    await this.banco.emTransacao(async () => {
      for (const item of lote) {
        await this.banco.executar(
          `UPDATE fila_sincronizacao SET situacao = 'Erro', tentativas = tentativas + 1, ultima_tentativa_em = ?,
             ultimo_erro = ?, retentar_automaticamente = ?, proxima_tentativa_em = ?
           WHERE id_operacao = ?`,
          [agora, mensagem, retentavel ? 1 : 0, proxima, item.idOperacao],
        );
        eventos.push({
          tipo: 'erro',
          entidade: item.entidade,
          idRegistro: item.idRegistro,
          mensagem,
          retentavel,
          tentativas: item.tentativas + 1,
          proximaTentativaEm: retentavel ? proxima : null,
        });
      }
      if (retentavel) {
        // A rede (ou a API) está com problema para todos: o resto da fila espera junto,
        // em vez de ser tentado logo em seguida.
        await this.banco.executar(
          'UPDATE fila_sincronizacao SET proxima_tentativa_em = MAX(proxima_tentativa_em, ?) WHERE retentar_automaticamente = 1',
          [proxima],
        );
      }
    });
    return eventos;
  }

  private async aplicarResultados(
    lote: ItemFila[],
    resultados: readonly ResultadoOperacao[],
    agora: number,
  ): Promise<{ eventos: EventoFila[]; aplicadas: number; substituidas: number; rejeitadas: number }> {
    const porOperacao = new Map(resultados.map((r) => [r.idOperacao, r]));
    const eventos: EventoFila[] = [];
    let aplicadas = 0;
    let substituidas = 0;
    let rejeitadas = 0;

    await this.banco.emTransacao(async () => {
      for (const enviado of lote) {
        const atual = await this.lerItem(enviado.idOperacao);
        const editadoDuranteEnvio = atual !== null && atual.revisao !== enviado.revisao;
        const r = porOperacao.get(enviado.idOperacao);
        const base = { entidade: enviado.entidade, idRegistro: enviado.idRegistro };

        if (r?.situacao === 'aplicada') {
          aplicadas += 1;
          if (editadoDuranteEnvio) {
            // O servidor guardou a versão enviada; a edição nova parte dela.
            await this.banco.executar(
              `UPDATE fila_sincronizacao SET base_updated_at = ?, situacao = 'Pendente', tentativas = 0,
                 ultimo_erro = NULL, ultima_tentativa_em = ?, proxima_tentativa_em = ?
               WHERE id_operacao = ?`,
              [r.versaoAceita.updatedAt, agora, agora, enviado.idOperacao],
            );
          } else {
            await this.banco.executar('DELETE FROM fila_sincronizacao WHERE id_operacao = ?', [enviado.idOperacao]);
          }
          eventos.push({ tipo: 'sincronizado', ...base, versaoAceita: r.versaoAceita, conflito: r.conflito, avisos: r.avisos, aindaPendente: editadoDuranteEnvio });
          continue;
        }

        if (r?.situacao === 'descartada') {
          substituidas += 1;
          if (editadoDuranteEnvio) {
            // A edição feita durante o envio continua valendo e sobe de novo;
            // o servidor resolve o conflito com a versão dele (SCRUM-83).
            await this.banco.executar(
              `UPDATE fila_sincronizacao SET situacao = 'Pendente', tentativas = 0, ultimo_erro = NULL,
                 ultima_tentativa_em = ?, proxima_tentativa_em = ? WHERE id_operacao = ?`,
              [agora, agora, enviado.idOperacao],
            );
          } else {
            await this.banco.executar('DELETE FROM fila_sincronizacao WHERE id_operacao = ?', [enviado.idOperacao]);
          }
          eventos.push({ tipo: 'substituido', ...base, versaoServidor: r.versaoServidor, mensagem: r.mensagem, aindaPendente: editadoDuranteEnvio });
          continue;
        }

        // Recusada pelo servidor ou sem resposta para esta operação.
        rejeitadas += 1;
        const mensagem = r?.situacao === 'rejeitada' ? r.mensagem : 'A API não devolveu resultado para este registro.';
        const retentavel = r?.situacao === 'rejeitada' ? r.retentavel : true;
        if (editadoDuranteEnvio) {
          // A versão nova pode corrigir o problema: sobe na próxima rodada.
          await this.banco.executar(
            `UPDATE fila_sincronizacao SET situacao = 'Pendente', tentativas = 0, retentar_automaticamente = 1,
               ultimo_erro = ?, ultima_tentativa_em = ?, proxima_tentativa_em = ? WHERE id_operacao = ?`,
            [mensagem, agora, agora, enviado.idOperacao],
          );
          continue;
        }
        const tentativas = enviado.tentativas + 1;
        const proxima = retentavel ? agora + calcularEspera(tentativas, this.politica, this.aleatorio) : agora;
        await this.banco.executar(
          `UPDATE fila_sincronizacao SET situacao = 'Erro', tentativas = ?, ultima_tentativa_em = ?, ultimo_erro = ?,
             retentar_automaticamente = ?, proxima_tentativa_em = ? WHERE id_operacao = ?`,
          [tentativas, agora, mensagem, retentavel ? 1 : 0, proxima, enviado.idOperacao],
        );
        eventos.push({ tipo: 'erro', ...base, mensagem, retentavel, tentativas, proximaTentativaEm: retentavel ? proxima : null });
      }
    });
    return { eventos, aplicadas, substituidas, rejeitadas };
  }

  private async registrarTentativa(status: 'Sucesso' | 'Falha', qtdRegistros: number, mensagemErro: string | null): Promise<void> {
    const tentativa: TentativaSync = { dataHora: isoDeMs(this.relogio()), tipo: 'Push', status, qtdRegistros, mensagemErro };
    if (this.idUsuario) {
      const parametros: ValorSql[] = [
        this.gerarId(),
        this.idUsuario,
        this.idDispositivo,
        tentativa.dataHora,
        tentativa.tipo,
        tentativa.status,
        tentativa.qtdRegistros,
        tentativa.mensagemErro,
      ];
      await this.trava.executar(() =>
        this.banco.executar(
          `INSERT INTO log_sincronizacao (id_log_sync, id_usuario, id_dispositivo, data_hora, tipo, status, qtd_registros, mensagem_erro)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          parametros,
        ),
      );
    }
    try {
      await this.aoTentar?.(tentativa);
    } catch {
      // Um erro no observador não pode parar a fila.
    }
  }

  private async emitir(eventos: EventoFila[]): Promise<void> {
    for (const evento of eventos) {
      try {
        await this.aoResultado?.(evento);
      } catch {
        // Idem: o app trata os próprios erros; a fila segue.
      }
    }
  }

  // -------------------------------------------------------------------------
  // Agendamento da próxima tentativa
  // -------------------------------------------------------------------------

  private async agendarProxima(): Promise<number | null> {
    const [linha] = await this.trava.executar(() =>
      this.banco.consultar<{ proxima: number | null }>(
        'SELECT MIN(proxima_tentativa_em) AS proxima FROM fila_sincronizacao WHERE retentar_automaticamente = 1',
      ),
    );
    const proxima = linha?.proxima === null || linha?.proxima === undefined ? null : Number(linha.proxima);
    this.cancelarTimer();
    if (proxima !== null && !this.parada) this.agendarEm(proxima);
    return proxima;
  }

  private agendarEm(instante: number): void {
    if (this.parada) return;
    if (this.alvoTimer !== null && this.alvoTimer <= instante) return;
    this.cancelarTimer();
    this.alvoTimer = instante;
    this.idTimer = this.agendarFn(() => {
      this.idTimer = null;
      this.alvoTimer = null;
      void this.processar();
    }, Math.max(0, instante - this.relogio()));
  }

  private cancelarTimer(): void {
    if (this.idTimer !== null) this.cancelarFn(this.idTimer);
    this.idTimer = null;
    this.alvoTimer = null;
  }
}
