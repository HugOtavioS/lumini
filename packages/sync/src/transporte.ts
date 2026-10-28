/**
 * Envio do push para a API e classificação das falhas.
 *
 * A fila só precisa saber uma coisa de cada falha: vale tentar de novo depois
 * (falta de rede, tempo esgotado, API fora do ar) ou não adianta insistir
 * (o servidor recusou o pedido). Este módulo faz essa separação.
 */
import type { RequisicaoPush, RespostaPush } from './contrato';
import { ESPERA_MAXIMA_RETRY_AFTER_MS } from './fila/backoff';

export interface TransporteSync {
  enviar(requisicao: RequisicaoPush): Promise<RespostaPush>;
}

/** Sem conexão, DNS, conexão recusada ou tempo esgotado: sempre vale tentar de novo. */
export class ErroDeRede extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeRede';
  }
}

/** A API respondeu com erro HTTP. */
export class ErroHttp extends Error {
  readonly status: number;
  readonly retentavel: boolean;
  /** Espera pedida pelo servidor (cabeçalho Retry-After), em ms. */
  readonly esperaSugeridaMs: number | null;
  /** 401: o token expirou; o app precisa renovar a sessão. */
  readonly exigeLogin: boolean;

  constructor(status: number, mensagem: string, esperaSugeridaMs: number | null = null) {
    super(mensagem);
    this.name = 'ErroHttp';
    this.status = status;
    this.retentavel = statusHttpRetentavel(status);
    this.esperaSugeridaMs = esperaSugeridaMs;
    this.exigeLogin = status === 401;
  }
}

/**
 * Status em que vale tentar de novo: tempo esgotado (408), cedo demais (425),
 * excesso de pedidos (429), erros do servidor (5xx) e sessão expirada (401,
 * que volta a funcionar depois que o app renova o token). Os demais 4xx
 * significam que o pedido em si foi recusado.
 */
export function statusHttpRetentavel(status: number): boolean {
  return status === 401 || status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

/** Lê o `Retry-After` (segundos ou data HTTP). Devolve ms, limitado a 1 hora, ou `null`. */
export function lerRetryAfter(valor: string | null | undefined, agoraMs: number = Date.now()): number | null {
  if (!valor) return null;
  const texto = valor.trim();
  let ms: number | null = null;
  if (/^\d+$/.test(texto)) {
    ms = Number(texto) * 1000;
  } else {
    const data = Date.parse(texto);
    if (Number.isFinite(data)) ms = Math.max(0, data - agoraMs);
  }
  return ms === null ? null : Math.min(ms, ESPERA_MAXIMA_RETRY_AFTER_MS);
}

/** `true` quando a falha deve manter os itens na fila com nova tentativa automática. */
export function falhaRetentavel(erro: unknown): boolean {
  if (erro instanceof ErroHttp) return erro.retentavel;
  // Erro de rede ou qualquer erro inesperado do transporte: não há como saber
  // se o servidor recebeu, então o mais seguro é tentar de novo (o servidor é
  // idempotente pelo UUID de cada registro).
  return true;
}

/** Formato mínimo de `fetch` usado aqui (o global do React Native, do navegador e do Node 18+). */
export type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(nome: string): string | null };
  json(): Promise<unknown>;
}>;

export interface OpcoesTransporteHttp {
  /** Endereço da API, sem a barra final (ex.: https://api.lumini.app). */
  urlBase: string;
  /** Token de acesso atual (JWT). */
  obterToken: () => string | null | Promise<string | null>;
  fetch?: FetchLike;
  /** Tempo máximo de cada envio (padrão 20 s). */
  tempoLimiteMs?: number;
  /** Caminho do push (padrão `/sync/push`; o SCRUM-67 confirma o endereço). */
  caminho?: string;
}

function ehRespostaPush(valor: unknown): valor is RespostaPush {
  if (typeof valor !== 'object' || valor === null) return false;
  const v = valor as Record<string, unknown>;
  return typeof v.horaServidor === 'string' && Array.isArray(v.resultados);
}

/** Transporte HTTP do push (POST JSON com o token no cabeçalho Authorization). */
export function criarTransporteHttp(opcoes: OpcoesTransporteHttp): TransporteSync {
  const tempoLimite = opcoes.tempoLimiteMs ?? 20_000;
  const caminho = opcoes.caminho ?? '/sync/push';
  return {
    async enviar(requisicao) {
      const fetchFn = opcoes.fetch ?? (globalThis.fetch as unknown as FetchLike | undefined);
      if (!fetchFn) throw new ErroDeRede('fetch não está disponível neste ambiente.');
      const token = await opcoes.obterToken();
      const controlador = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const mensagemTempo = `A API não respondeu em ${Math.round(tempoLimite / 1000)} s.`;
      let rejeitarPorTempo!: (erro: Error) => void;
      // O Promise.race garante o tempo-limite mesmo se o fetch ignorar o abort.
      const limite = new Promise<never>((_, rejeitar) => {
        rejeitarPorTempo = rejeitar;
      });
      const temporizador = setTimeout(() => {
        controlador?.abort();
        rejeitarPorTempo(new ErroDeRede(mensagemTempo));
      }, tempoLimite);
      try {
        const envio = fetchFn(`${opcoes.urlBase}${caminho}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(requisicao),
          ...(controlador ? { signal: controlador.signal } : {}),
        });
        // Se o tempo esgotar primeiro, o fetch abortado rejeita depois; sem isto,
        // a rejeição ficaria sem tratamento.
        envio.catch(() => undefined);
        let resposta: Awaited<ReturnType<FetchLike>>;
        try {
          resposta = await Promise.race([envio, limite]);
        } catch (erro) {
          if (erro instanceof ErroDeRede) throw erro;
          throw new ErroDeRede(`Sem conexão com a API (${erro instanceof Error ? erro.message : String(erro)}).`);
        }
        if (!resposta.ok) {
          const espera = lerRetryAfter(resposta.headers.get('Retry-After'));
          throw new ErroHttp(resposta.status, `A API respondeu HTTP ${resposta.status}.`, espera);
        }
        let corpo: unknown;
        try {
          corpo = await resposta.json();
        } catch {
          throw new ErroHttp(502, 'A API respondeu algo que não é JSON.');
        }
        if (!ehRespostaPush(corpo)) throw new ErroHttp(502, 'Resposta do push em formato inesperado.');
        return corpo;
      } finally {
        clearTimeout(temporizador);
      }
    },
  };
}
