/**
 * SCRUM-18 — Testes do cliente HTTP de upload.
 */

import { ErroEnvioSync } from '../../../sync/ErroEnvioSync';
import { SyncApiHttp } from '../SyncApiHttp';

const URL_TESTE = 'https://api.teste.local/sync/propostas';

function respostaHttp(status: number): Response {
  return { ok: status >= 200 && status < 300, status } as Response;
}

describe('SyncApiHttp', () => {
  it('envia POST JSON com chave de idempotência e token', async () => {
    const fetchMock = jest.fn(async () => respostaHttp(201));
    const api = new SyncApiHttp<{ id: string }>({
      urlUpload: URL_TESTE,
      obterTokenAcesso: async () => 'tk',
      fetch: fetchMock as unknown as typeof fetch,
    });

    await api.enviarProposta({ id: 'p1' }, 'p1');

    expect(fetchMock).toHaveBeenCalledWith(
      URL_TESTE,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ id: 'p1' }),
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'p1',
          Authorization: 'Bearer tk',
        },
      }),
    );
  });

  it.each([
    [500, true],
    [503, true],
    [429, true],
    [408, true],
    [400, false],
    [401, false],
    [422, false],
  ])('HTTP %i → retentável = %s', async (status, retentavel) => {
    const api = new SyncApiHttp({
      urlUpload: URL_TESTE,
      fetch: (async () => respostaHttp(status)) as unknown as typeof fetch,
    });

    const erro = await api.enviarProposta({}, 'p1').catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroEnvioSync);
    expect((erro as ErroEnvioSync).retentavel).toBe(retentavel);
    expect((erro as ErroEnvioSync).statusHttp).toBe(status);
  });

  it('falha de rede é retentável', async () => {
    const api = new SyncApiHttp({
      urlUpload: URL_TESTE,
      fetch: (async () => {
        throw new TypeError('Network request failed');
      }) as unknown as typeof fetch,
    });

    await expect(api.enviarProposta({}, 'p1')).rejects.toMatchObject({ retentavel: true });
  });

  it('aborta e trata como retentável ao exceder o timeout', async () => {
    jest.useFakeTimers();
    const api = new SyncApiHttp({
      urlUpload: URL_TESTE,
      timeoutMs: 100,
      fetch: ((_url: string, init: RequestInit) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })) as unknown as typeof fetch,
    });

    const promessa = api.enviarProposta({}, 'p1').catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(100);
    const erro = await promessa;
    jest.useRealTimers();

    expect(erro).toMatchObject({ retentavel: true, message: 'Upload excedeu 100 ms.' });
  });
});
