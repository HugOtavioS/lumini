import {
  FilaSincronizacao,
  criarTransporteHttp,
  idOperacaoDe,
  type BancoSql,
  type EventoFila,
  type ResultadoRodada,
} from '@lumini/sync';

import { config } from '@/data/config';
import type { Proposal, UpgradeRequest } from '@/domain/entities';
import { openLocalDatabase } from './openDatabase';
import { propostaDoRegistro, propostaPodeSubir, registroDaSolicitacao, registrosDaProposta, type ContextoSync } from './registros';

// Ponte entre o app e a fila do @lumini/sync (SCRUM-82/83, feitos pelo Pedro).
//
// - Modo "api": com EXPO_PUBLIC_API_URL definida, no aparelho, usa a
//   FilaSincronizacao real (SQLite, retentativa com backoff, RN07, conflito).
// - Modo "simulado": sem API (ou no preview web), mantém o comportamento de
//   demonstração, com o mesmo contrato, para as telas não mudarem.
//
// As telas não conhecem a fila: falam só com esta interface, pelo AppStore.

export type SyncOutcome = 'sincronizado' | 'offline' | 'nada_pendente' | 'com_erro';

export type SyncUpdate =
  | {
      kind: 'synced';
      proposalId: string | null;
      /** Registro confirmado e o `updated_at` que ficou no servidor (vira a versão-base). */
      idOperacao: string;
      serverUpdatedAt: string;
      /** `true` quando o registro confirmado é a própria proposta. */
      isProposal: boolean;
      conflict: boolean;
      messages: string[];
      stillPending: boolean;
    }
  | { kind: 'replaced'; proposalId: string | null; idOperacao: string; serverUpdatedAt: string; message: string }
  | { kind: 'error'; proposalId: string | null; message: string; retryable: boolean }
  | { kind: 'upgradeSynced' };

export interface SyncSummary {
  pending: number;
  withError: number;
  /** RF16, 1a: falha repetida ou recusa que precisa de ação do técnico. */
  persistentFailure: boolean;
  lastAttemptAt: string | null;
  lastError: string | null;
}

export interface SyncService {
  readonly mode: 'simulado' | 'api';
  /** Coloca a proposta (e os registros de que ela depende) na fila. `false` se o RN07 a segura no aparelho. */
  enqueueProposal(proposal: Proposal): Promise<boolean>;
  enqueueUpgrade(request: UpgradeRequest): Promise<void>;
  /** "Forçar sincronização agora" (SCRUM-404): tenta tudo, inclusive itens que aguardavam ação. */
  syncNow(): Promise<SyncOutcome>;
  setOnline(online: boolean): void;
  summary(): Promise<SyncSummary>;
  stop(): void;
}

export interface SyncServiceOptions {
  ctx: ContextoSync;
  onUpdate: (update: SyncUpdate) => void;
  /** Token JWT da sessão (SCRUM-397); null enquanto o login for simulado. */
  getToken: () => string | null;
  isOnline: boolean;
}

const SIMULATED_LATENCY_MS = 1200;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Modo de demonstração: mesmo contrato, sem rede. */
export class SimulatedSyncService implements SyncService {
  readonly mode = 'simulado' as const;
  private readonly pending = new Map<string, { proposalId: string | null; updatedAt: string; isProposal: boolean }>();
  private upgradePending = false;
  private online: boolean;
  private lastAttemptAt: string | null = null;

  constructor(private readonly options: SyncServiceOptions) {
    this.online = options.isOnline;
  }

  async enqueueProposal(proposal: Proposal): Promise<boolean> {
    if (!propostaPodeSubir(proposal, this.options.ctx)) return false;
    for (const entrada of registrosDaProposta(proposal, this.options.ctx)) {
      this.pending.set(idOperacaoDe(entrada.entidade, entrada.versao.id), {
        proposalId: proposal.id,
        updatedAt: entrada.versao.updatedAt,
        isProposal: entrada.entidade === 'Proposta',
      });
    }
    return true;
  }

  async enqueueUpgrade(): Promise<void> {
    this.upgradePending = true;
  }

  async syncNow(): Promise<SyncOutcome> {
    if (this.pending.size === 0 && !this.upgradePending) return 'nada_pendente';
    if (!this.online) return 'offline';
    await wait(SIMULATED_LATENCY_MS);
    this.lastAttemptAt = new Date().toISOString();
    for (const [idOperacao, item] of [...this.pending]) {
      this.pending.delete(idOperacao);
      this.options.onUpdate({
        kind: 'synced',
        proposalId: item.proposalId,
        idOperacao,
        serverUpdatedAt: item.updatedAt,
        isProposal: item.isProposal,
        conflict: false,
        messages: [],
        stillPending: false,
      });
    }
    if (this.upgradePending) {
      this.upgradePending = false;
      this.options.onUpdate({ kind: 'upgradeSynced' });
    }
    return 'sincronizado';
  }

  setOnline(online: boolean): void {
    const reconnected = online && !this.online;
    this.online = online;
    // RF15: ao reconectar, envia o que estava pendente.
    if (reconnected && (this.pending.size > 0 || this.upgradePending)) void this.syncNow();
  }

  async summary(): Promise<SyncSummary> {
    return {
      pending: this.pending.size + (this.upgradePending ? 1 : 0),
      withError: 0,
      persistentFailure: false,
      lastAttemptAt: this.lastAttemptAt,
      lastError: null,
    };
  }

  stop(): void {}
}

/** Fila real do @lumini/sync, em SQLite, enviando para a API (modo "api"). */
export class QueueSyncService implements SyncService {
  readonly mode = 'api' as const;
  private readonly knownProposals = new Set<string>();

  private constructor(
    private readonly options: SyncServiceOptions,
    private readonly fila: FilaSincronizacao,
    /** Compartilhado com a `conectividade` da fila. */
    private readonly onlineRef: { value: boolean },
  ) {}

  static async create(options: SyncServiceOptions, banco?: BancoSql): Promise<QueueSyncService> {
    const db = banco ?? (await openLocalDatabase());
    const idDispositivo = await deviceId(db);
    const onlineRef = { value: options.isOnline };
    let service: QueueSyncService | null = null;
    const fila = await FilaSincronizacao.abrir({
      banco: db,
      transporte: criarTransporteHttp({ urlBase: config.apiUrl, obterToken: options.getToken }),
      idDispositivo,
      idUsuario: options.ctx.idUsuario,
      conectividade: { estaOnline: () => onlineRef.value },
      aoResultado: (evento) => service?.handleEvent(evento),
    });
    service = new QueueSyncService(options, fila, onlineRef);
    await fila.iniciar();
    return service;
  }

  async enqueueProposal(proposal: Proposal): Promise<boolean> {
    if (!propostaPodeSubir(proposal, this.options.ctx)) return false;
    this.knownProposals.add(proposal.id);
    for (const entrada of registrosDaProposta(proposal, this.options.ctx)) {
      await this.fila.enfileirar(entrada);
    }
    return true;
  }

  async enqueueUpgrade(request: UpgradeRequest): Promise<void> {
    await this.fila.enfileirar(registroDaSolicitacao(request, this.options.ctx));
  }

  async syncNow(): Promise<SyncOutcome> {
    const antes = await this.fila.resumo();
    if (antes.total === 0) return 'nada_pendente';
    if (!this.onlineRef.value) return 'offline';
    return resultadoDaRodada(await this.fila.retentarAgora());
  }

  setOnline(online: boolean): void {
    this.onlineRef.value = online;
    void this.fila.aoMudarConexao(online);
  }

  async summary(): Promise<SyncSummary> {
    const r = await this.fila.resumo();
    return {
      pending: r.pendentes,
      withError: r.comErro,
      persistentFailure: r.falhaPersistente,
      lastAttemptAt: r.ultimaTentativaEm === null ? null : new Date(r.ultimaTentativaEm).toISOString(),
      lastError: r.ultimoErro,
    };
  }

  stop(): void {
    this.fila.parar();
  }

  private handleEvent(evento: EventoFila): void {
    const proposalId = propostaDoRegistro(evento.entidade, evento.idRegistro, this.knownProposals);
    const idOperacao = idOperacaoDe(evento.entidade, evento.idRegistro);
    if (evento.entidade === 'SolicitacaoUpgrade') {
      if (evento.tipo === 'sincronizado') this.options.onUpdate({ kind: 'upgradeSynced' });
      return;
    }
    switch (evento.tipo) {
      case 'sincronizado':
        this.options.onUpdate({
          kind: 'synced',
          proposalId,
          idOperacao,
          serverUpdatedAt: evento.versaoAceita.updatedAt,
          isProposal: evento.entidade === 'Proposta',
          conflict: evento.conflito,
          messages: evento.avisos,
          stillPending: evento.aindaPendente,
        });
        break;
      case 'substituido':
        this.options.onUpdate({
          kind: 'replaced',
          proposalId,
          idOperacao,
          serverUpdatedAt: evento.versaoServidor.updatedAt,
          message: evento.mensagem,
        });
        break;
      case 'erro':
        this.options.onUpdate({ kind: 'error', proposalId, message: evento.mensagem, retryable: evento.retentavel });
        break;
    }
  }
}

function resultadoDaRodada(r: ResultadoRodada): SyncOutcome {
  if (r.motivo === 'offline') return 'offline';
  if (r.motivo === 'vazia') return 'nada_pendente';
  if (r.motivo === 'falha' || r.rejeitadas > 0) return 'com_erro';
  return 'sincronizado';
}

/** Identificador desta instalação do app, guardado no banco local (Log de Sincronização, RNF11). */
async function deviceId(db: BancoSql): Promise<string> {
  await db.executar('CREATE TABLE IF NOT EXISTS app_config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)');
  const [linha] = await db.consultar<{ valor: string }>("SELECT valor FROM app_config WHERE chave = 'id_dispositivo'");
  if (linha) return linha.valor;
  const id = `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await db.executar("INSERT INTO app_config (chave, valor) VALUES ('id_dispositivo', ?)", [id]);
  return id;
}

/**
 * Escolhe a implementação: fila real quando há API configurada e o banco local
 * abre (aparelho); senão, o modo de demonstração.
 */
export async function createSyncService(options: SyncServiceOptions): Promise<SyncService> {
  if (config.hasApi) {
    try {
      return await QueueSyncService.create(options);
    } catch (erro) {
      console.warn('[sync] Fila real indisponível; usando o modo de demonstração.', erro);
    }
  }
  return new SimulatedSyncService(options);
}
