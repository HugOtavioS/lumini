import { afterEach, describe, expect, it, vi } from 'vitest';
import { aceitarTudo, capturarErro, cliente, operacao } from './testes/registros';
import {
  ErroDeRede,
  ErroHttp,
  criarTransporteHttp,
  falhaRetentavel,
  lerRetryAfter,
  statusHttpRetentavel,
  type FetchLike,
} from './transporte';

const requisicao = { idDispositivo: 'aparelho-1', operacoes: [operacao('Cliente', cliente('c1', '2026-10-18T10:00:00.000Z'))] };

function resposta(status: number, corpo: unknown, cabecalhos: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (nome: string) => cabecalhos[nome] ?? null },
    json: async () => {
      if (corpo instanceof Error) throw corpo;
      return corpo;
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('classificação das falhas', () => {
  it('vale tentar de novo: 401, 408, 425, 429 e 5xx; os outros 4xx não', () => {
    expect([401, 408, 425, 429, 500, 502, 503, 504].every(statusHttpRetentavel)).toBe(true);
    expect([400, 403, 404, 409, 413, 422].some(statusHttpRetentavel)).toBe(false);
  });

  it('erro de rede e erros inesperados contam como retentáveis (o servidor é idempotente)', () => {
    expect(falhaRetentavel(new ErroDeRede('sem sinal'))).toBe(true);
    expect(falhaRetentavel(new TypeError('fetch failed'))).toBe(true);
    expect(falhaRetentavel(new ErroHttp(503, 'fora'))).toBe(true);
    expect(falhaRetentavel(new ErroHttp(422, 'inválido'))).toBe(false);
  });

  it('lê o Retry-After em segundos ou como data, com teto de 1 hora', () => {
    expect(lerRetryAfter('30')).toBe(30_000);
    expect(lerRetryAfter('Sun, 18 Oct 2026 12:01:00 GMT', Date.parse('2026-10-18T12:00:00Z'))).toBe(60_000);
    expect(lerRetryAfter('86400')).toBe(3_600_000);
    expect(lerRetryAfter('amanhã')).toBeNull();
    expect(lerRetryAfter(null)).toBeNull();
  });
});

describe('transporte HTTP do push', () => {
  it('envia POST JSON com o token e devolve a resposta da API', async () => {
    const fetch = vi.fn<FetchLike>(async () => resposta(200, aceitarTudo(requisicao)));
    const transporte = criarTransporteHttp({ urlBase: 'https://api.lumini.test', obterToken: () => 'jwt-123', fetch });
    const r = await transporte.enviar(requisicao);
    expect(r.resultados[0]?.situacao).toBe('aplicada');
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('https://api.lumini.test/sync/push');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer jwt-123');
    expect(JSON.parse(init.body)).toEqual(requisicao);
  });

  it('sem conexão (fetch rejeita) vira ErroDeRede', async () => {
    const transporte = criarTransporteHttp({
      urlBase: 'https://api.lumini.test',
      obterToken: () => null,
      fetch: async () => {
        throw new TypeError('Network request failed');
      },
    });
    await expect(transporte.enviar(requisicao)).rejects.toBeInstanceOf(ErroDeRede);
  });

  it('API que não responde: desiste no tempo-limite com ErroDeRede, sem travar', async () => {
    vi.useFakeTimers();
    let sinal: AbortSignal | undefined;
    const transporte = criarTransporteHttp({
      urlBase: 'https://api.lumini.test',
      obterToken: () => null,
      tempoLimiteMs: 5_000,
      fetch: (_url, init) => {
        sinal = init.signal;
        return new Promise(() => undefined);
      },
    });
    const envio = transporte.enviar(requisicao);
    const verificacao = expect(envio).rejects.toThrow('não respondeu em 5 s');
    await vi.advanceTimersByTimeAsync(5_000);
    await verificacao;
    expect(sinal?.aborted).toBe(true);
  });

  it('503 com Retry-After: erro retentável com a espera pedida', async () => {
    const transporte = criarTransporteHttp({
      urlBase: 'https://api.lumini.test',
      obterToken: () => null,
      fetch: async () => resposta(503, {}, { 'Retry-After': '120' }),
    });
    const erro = await capturarErro<ErroHttp>(transporte.enviar(requisicao));
    expect(erro).toBeInstanceOf(ErroHttp);
    expect(erro.retentavel).toBe(true);
    expect(erro.esperaSugeridaMs).toBe(120_000);
  });

  it('400 não é retentável; 401 pede novo login', async () => {
    const com = (status: number) =>
      capturarErro<ErroHttp>(
        criarTransporteHttp({ urlBase: 'https://x', obterToken: () => null, fetch: async () => resposta(status, {}) }).enviar(requisicao),
      );
    const e400 = await com(400);
    expect(e400.retentavel).toBe(false);
    const e401 = await com(401);
    expect(e401.retentavel).toBe(true);
    expect(e401.exigeLogin).toBe(true);
  });

  it('resposta 200 que não é JSON ou não tem o formato do push vira erro retentável', async () => {
    const com = (corpo: unknown) =>
      capturarErro<ErroHttp>(
        criarTransporteHttp({ urlBase: 'https://x', obterToken: () => null, fetch: async () => resposta(200, corpo) }).enviar(requisicao),
      );
    const naoJson = await com(new SyntaxError('Unexpected token <'));
    expect(naoJson).toBeInstanceOf(ErroHttp);
    expect(naoJson.retentavel).toBe(true);
    const formatoErrado = await com({ ok: true });
    expect(formatoErrado.message).toContain('formato inesperado');
  });
});
