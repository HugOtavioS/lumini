import { afterEach, describe, expect, it, vi } from 'vitest';

import { executarMigracoes } from '@/data/database/migracoes';
import { bancoEmMemoria } from '@/data/database/testing';
import {
  definirServicoEmPrimeiroPlano,
  lerContextoSync,
  rodarSyncEmSegundoPlano,
  salvarContextoSync,
} from './backgroundSyncRunner';
import { SyncLockSqlite } from './syncLock';
import type { SyncService } from './syncService';

const ctx = { idEmpresa: 'emp-1', idUsuario: 'usr-1' };

async function bancoMigrado() {
  const banco = bancoEmMemoria();
  await executarMigracoes(banco);
  return banco;
}

function servicoFalso(mode: 'api' | 'simulado' = 'api') {
  return {
    mode,
    syncNow: vi.fn(async () => 'sincronizado' as const),
    stop: vi.fn(),
  } as unknown as SyncService & { syncNow: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> };
}

afterEach(() => definirServicoEmPrimeiroPlano(null));

describe('sincronização em segundo plano (SCRUM-18)', () => {
  it('guarda, lê e apaga o contexto da sessão', async () => {
    const banco = await bancoMigrado();
    expect(await lerContextoSync(banco)).toBeNull();
    await salvarContextoSync(banco, ctx);
    await salvarContextoSync(banco, ctx); // upsert
    expect(await lerContextoSync(banco)).toEqual(ctx);
    await salvarContextoSync(banco, null);
    expect(await lerContextoSync(banco)).toBeNull();
  });

  it('não faz nada sem API (modo demonstração) ou sem sessão salva', async () => {
    const banco = await bancoMigrado();
    const criarServico = vi.fn();
    expect(await rodarSyncEmSegundoPlano({ hasApi: false, abrirBanco: async () => banco, criarServico })).toBe('sem_api');
    expect(await rodarSyncEmSegundoPlano({ hasApi: true, abrirBanco: async () => banco, criarServico })).toBe('sem_sessao');
    expect(criarServico).not.toHaveBeenCalled();
  });

  it('com o app fechado, abre a fila, envia, fecha e solta o lock', async () => {
    const banco = await bancoMigrado();
    await salvarContextoSync(banco, ctx);
    const servico = servicoFalso();
    const r = await rodarSyncEmSegundoPlano({ hasApi: true, abrirBanco: async () => banco, criarServico: async () => servico });
    expect(r).toBe('sincronizado');
    expect(servico.syncNow).toHaveBeenCalledOnce();
    expect(servico.stop).toHaveBeenCalledOnce();
    expect(await banco.consultar('SELECT * FROM sync_lock')).toEqual([]);
  });

  it('não roda se outro runtime estiver com o lock, e assume quando o lock expira', async () => {
    const banco = await bancoMigrado();
    await salvarContextoSync(banco, ctx);
    await new SyncLockSqlite(banco).adquirir('app-aberto', 1_000, 60_000);
    const servico = servicoFalso();
    const deps = { hasApi: true, abrirBanco: async () => banco, criarServico: async () => servico };
    expect(await rodarSyncEmSegundoPlano({ ...deps, agora: () => 2_000 })).toBe('ocupado');
    expect(servico.syncNow).not.toHaveBeenCalled();
    expect(await rodarSyncEmSegundoPlano({ ...deps, agora: () => 61_001 })).toBe('sincronizado');
  });

  it('com o app aberto no mesmo runtime, usa a fila que já está rodando', async () => {
    const aberto = servicoFalso('api');
    definirServicoEmPrimeiroPlano(aberto);
    const abrirBanco = vi.fn();
    expect(await rodarSyncEmSegundoPlano({ hasApi: true, abrirBanco, criarServico: vi.fn() })).toBe('sincronizado');
    expect(abrirBanco).not.toHaveBeenCalled();
    expect(aberto.stop).not.toHaveBeenCalled();
  });
});
