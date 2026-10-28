import { validateContingencyBase, type ContingencyBase } from './contingencyBase';

// SCRUM-85 — rotina que verifica, quando o aparelho está online, se a base de
// contingência (HSP por UF) tem versão nova e a baixa. Sem rede, nada acontece:
// o app segue com a base que já tem (RN02).
//
// Endpoints sugeridos para a API (SCRUM-30, ver apps/api/README.md):
//   GET /contingencia/versao     → { versao, publicadaEm }
//   GET /contingencia/:versao    → { versao, publicadaEm, hsp: { UF: { hsp, latitude } } }

export interface ContingencyVersionInfo {
  version: string;
  publishedAt: string;
}

export interface ContingencySource {
  latestVersion(): Promise<ContingencyVersionInfo>;
  download(version: string): Promise<ContingencyBase>;
}

export type ContingencyCheckResult =
  | { status: 'atualizada'; version: string }
  | { status: 'instalada'; version: string; previousVersion: string }
  | { status: 'offline' }
  | { status: 'sem_servidor' }
  | { status: 'erro'; message: string };

/** Uma verificação por dia quando online. */
export const CONTINGENCY_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface ContingencyUpdaterOptions {
  /** `null` quando não há API configurada (modo de demonstração). */
  source: ContingencySource | null;
  getCurrent: () => ContingencyBase;
  apply: (base: ContingencyBase) => void;
  isOnline: () => boolean;
  onResult?: (result: ContingencyCheckResult, checkedAt: string) => void;
  intervalMs?: number;
  now?: () => number;
  schedule?: (task: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
}

/** A versão remota é mais nova que a instalada? */
export function isNewerVersion(remote: ContingencyVersionInfo, current: ContingencyVersionInfo): boolean {
  if (remote.version === current.version) return false;
  return Date.parse(remote.publishedAt) > Date.parse(current.publishedAt);
}

export class ContingencyUpdater {
  private readonly intervalMs: number;
  private readonly now: () => number;
  private readonly schedule: (task: () => void, ms: number) => unknown;
  private readonly cancel: (handle: unknown) => void;
  private timer: unknown = null;
  private running: Promise<ContingencyCheckResult> | null = null;
  private lastSuccessfulCheck: number | null = null;
  private stopped = true;

  constructor(private readonly options: ContingencyUpdaterOptions) {
    this.intervalMs = options.intervalMs ?? CONTINGENCY_CHECK_INTERVAL_MS;
    this.now = options.now ?? (() => Date.now());
    this.schedule = options.schedule ?? ((task, ms) => setTimeout(task, ms));
    this.cancel = options.cancel ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  }

  /** Já passou o intervalo desde a última verificação bem-sucedida? */
  isDue(): boolean {
    return this.lastSuccessfulCheck === null || this.now() - this.lastSuccessfulCheck >= this.intervalMs;
  }

  /** Verifica agora (botão "Verificar agora" em Preferências ou rotina periódica). */
  checkNow(): Promise<ContingencyCheckResult> {
    if (!this.running) {
      this.running = this.check().finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  /** Liga a rotina: verifica se estiver vencida e agenda as próximas. */
  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    if (this.isDue()) void this.checkNow();
    this.scheduleNext();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer !== null) this.cancel(this.timer);
    this.timer = null;
  }

  /** Ao voltar a conexão, verifica se a rotina ficou vencida enquanto estava offline. */
  onConnectivityChange(online: boolean): void {
    if (online && !this.stopped && this.isDue()) void this.checkNow();
  }

  private scheduleNext(): void {
    if (this.stopped) return;
    this.timer = this.schedule(() => {
      if (this.isDue()) void this.checkNow();
      this.scheduleNext();
    }, this.intervalMs);
  }

  private async check(): Promise<ContingencyCheckResult> {
    const result = await this.runCheck();
    if (result.status === 'atualizada' || result.status === 'instalada') this.lastSuccessfulCheck = this.now();
    this.options.onResult?.(result, new Date(this.now()).toISOString());
    return result;
  }

  private async runCheck(): Promise<ContingencyCheckResult> {
    const { source } = this.options;
    if (!source) return { status: 'sem_servidor' };
    if (!this.options.isOnline()) return { status: 'offline' };
    try {
      const current = this.options.getCurrent();
      const remote = await source.latestVersion();
      if (!isNewerVersion(remote, current)) return { status: 'atualizada', version: current.version };
      const base = await source.download(remote.version);
      const problems = validateContingencyBase(base);
      if (problems.length > 0) return { status: 'erro', message: `Versão ${remote.version} recusada: ${problems[0]}` };
      this.options.apply(base);
      return { status: 'instalada', version: base.version, previousVersion: current.version };
    } catch (erro) {
      return { status: 'erro', message: erro instanceof Error ? erro.message : String(erro) };
    }
  }
}

type FetchJson = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Fonte HTTP da base (API do Lumini). */
export function httpContingencySource(apiUrl: string, fetchFn: FetchJson = (url) => fetch(url)): ContingencySource {
  async function get(path: string): Promise<Record<string, unknown>> {
    const response = await fetchFn(`${apiUrl}${path}`);
    if (!response.ok) throw new Error(`A API respondeu HTTP ${response.status}.`);
    return (await response.json()) as Record<string, unknown>;
  }
  return {
    async latestVersion() {
      const body = await get('/contingencia/versao');
      return { version: String(body.versao), publishedAt: String(body.publicadaEm) };
    },
    async download(version) {
      const body = await get(`/contingencia/${encodeURIComponent(version)}`);
      return {
        version: String(body.versao),
        publishedAt: String(body.publicadaEm),
        hspByState: (body.hsp ?? {}) as ContingencyBase['hspByState'],
      };
    },
  };
}
