import { afterEach, describe, expect, it } from 'vitest';

import {
  BUILTIN_CONTINGENCY_BASE,
  getActiveContingencyBase,
  resetContingencyBase,
  setActiveContingencyBase,
  type ContingencyBase,
} from './contingencyBase';
import { ContingencyUpdater, isNewerVersion, type ContingencySource } from './contingencyUpdater';

const nova: ContingencyBase = {
  ...BUILTIN_CONTINGENCY_BASE,
  version: '2026.10.1',
  publishedAt: '2026-10-20T00:00:00.000Z',
  hspByState: { ...BUILTIN_CONTINGENCY_BASE.hspByState, SP: { hsp: 5.1, latitude: -23.55 } },
};

function fonte(base: ContingencyBase, contador = { downloads: 0 }): ContingencySource {
  return {
    latestVersion: async () => ({ version: base.version, publishedAt: base.publishedAt }),
    download: async () => {
      contador.downloads += 1;
      return base;
    },
  };
}

function updater(source: ContingencySource | null, online = true, agora = { t: 0 }) {
  const tarefas: Array<() => void> = [];
  const u = new ContingencyUpdater({
    source,
    getCurrent: getActiveContingencyBase,
    apply: setActiveContingencyBase,
    isOnline: () => online,
    now: () => agora.t,
    schedule: (tarefa) => tarefas.push(tarefa),
    cancel: () => undefined,
    intervalMs: 1000,
  });
  return { u, tarefas, agora };
}

afterEach(resetContingencyBase);

describe('SCRUM-85 — atualização da base de contingência', () => {
  it('compara versões pela data de publicação', () => {
    expect(isNewerVersion(nova, BUILTIN_CONTINGENCY_BASE)).toBe(true);
    expect(isNewerVersion(BUILTIN_CONTINGENCY_BASE, nova)).toBe(false);
    expect(isNewerVersion(nova, nova)).toBe(false);
  });

  it('online, baixa e instala a versão nova', async () => {
    const { u } = updater(fonte(nova));
    expect(await u.checkNow()).toEqual({ status: 'instalada', version: '2026.10.1', previousVersion: 'embutida-2026.09' });
    expect(getActiveContingencyBase().hspByState.SP?.hsp).toBe(5.1);
  });

  it('offline não tenta e fica vencida para quando a conexão voltar', async () => {
    const contador = { downloads: 0 };
    const { u } = updater(fonte(nova, contador), false);
    expect(await u.checkNow()).toEqual({ status: 'offline' });
    expect(u.isDue()).toBe(true);
    expect(contador.downloads).toBe(0);
  });

  it('sem servidor configurado (modo de demonstração) continua com a base embutida', async () => {
    const { u } = updater(null);
    expect(await u.checkNow()).toEqual({ status: 'sem_servidor' });
    expect(getActiveContingencyBase().version).toBe('embutida-2026.09');
  });

  it('recusa base corrompida e mantém a atual', async () => {
    const quebrada = { ...nova, hspByState: { SP: { hsp: 40, latitude: -23 } } } as ContingencyBase;
    const { u } = updater(fonte(quebrada));
    const r = await u.checkNow();
    expect(r.status).toBe('erro');
    expect(getActiveContingencyBase().version).toBe('embutida-2026.09');
  });

  it('a rotina só verifica de novo depois do intervalo', async () => {
    const contador = { downloads: 0 };
    const { u, tarefas, agora } = updater(fonte(BUILTIN_CONTINGENCY_BASE, contador));
    u.start();
    await u.checkNow();
    expect(u.isDue()).toBe(false);
    agora.t = 1500;
    expect(u.isDue()).toBe(true);
    tarefas.shift()!();
    await u.checkNow();
    expect(u.isDue()).toBe(false);
    u.stop();
  });
});
