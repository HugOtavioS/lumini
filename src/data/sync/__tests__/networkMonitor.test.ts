/**
 * SCRUM-18 — Testes do monitor de conectividade.
 */

import { criarMonitorRede, estaConectado, EstadoRede } from '../networkMonitor';

describe('estaConectado', () => {
  it.each<[EstadoRede, boolean]>([
    [{ isConnected: true, isInternetReachable: true }, true],
    [{ isConnected: true, isInternetReachable: null }, true],
    [{ isConnected: true, isInternetReachable: false }, false],
    [{ isConnected: false, isInternetReachable: true }, false],
    [{ isConnected: null, isInternetReachable: null }, false],
  ])('%j → %s', (estado, esperado) => {
    expect(estaConectado(estado)).toBe(esperado);
  });
});

describe('criarMonitorRede', () => {
  it('estaOnline retorna false se a leitura falhar', async () => {
    const monitor = criarMonitorRede({
      fetch: async () => {
        throw new Error('indisponível');
      },
      addEventListener: () => () => undefined,
    });
    await expect(monitor.estaOnline()).resolves.toBe(false);
  });

  it('aoReconectar dispara só nas transições para online', () => {
    let ouvinte: ((e: EstadoRede) => void) | undefined;
    const monitor = criarMonitorRede({
      fetch: async () => ({ isConnected: true }),
      addEventListener: (l) => {
        ouvinte = l;
        return () => undefined;
      },
    });
    const callback = jest.fn();
    monitor.aoReconectar(callback);

    const emitir = (online: boolean) => ouvinte?.({ isConnected: online, isInternetReachable: online });
    emitir(true); // primeira leitura já online → dispara
    emitir(true); // continua online → não dispara
    emitir(false);
    emitir(true); // voltou → dispara

    expect(callback).toHaveBeenCalledTimes(2);
  });
});
