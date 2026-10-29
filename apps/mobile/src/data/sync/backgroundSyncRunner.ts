import type { BancoSql } from '@lumini/sync';

import type { ContextoSync } from './registros';
import { SyncLockSqlite, comLockDeSync } from './syncLock';
import type { SyncOutcome, SyncService } from './syncService';

// SCRUM-18 (Misael) — o que a tarefa em segundo plano faz, sem depender de
// expo-task-manager (testável no Node). Quem agenda é o backgroundSync.native.ts.

const CHAVE_CONTEXTO = 'contexto_sync';

/** Guarda quem está logado, para a tarefa saber em nome de quem sincronizar com o app fechado. */
export async function salvarContextoSync(banco: BancoSql, ctx: ContextoSync | null): Promise<void> {
  if (ctx === null) {
    await banco.executar('DELETE FROM app_config WHERE chave = ?', [CHAVE_CONTEXTO]);
    return;
  }
  await banco.executar(
    'INSERT INTO app_config (chave, valor) VALUES (?, ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor',
    [CHAVE_CONTEXTO, JSON.stringify(ctx)],
  );
}

export async function lerContextoSync(banco: BancoSql): Promise<ContextoSync | null> {
  const [linha] = await banco.consultar<{ valor: string }>('SELECT valor FROM app_config WHERE chave = ?', [CHAVE_CONTEXTO]);
  if (!linha) return null;
  try {
    const ctx = JSON.parse(linha.valor) as Partial<ContextoSync>;
    return typeof ctx.idEmpresa === 'string' && typeof ctx.idUsuario === 'string'
      ? { idEmpresa: ctx.idEmpresa, idUsuario: ctx.idUsuario }
      : null;
  } catch {
    return null;
  }
}

/** Serviço do app aberto neste mesmo runtime (iOS roda a tarefa no mesmo JS). */
let servicoEmPrimeiroPlano: SyncService | null = null;
export function definirServicoEmPrimeiroPlano(servico: SyncService | null): void {
  servicoEmPrimeiroPlano = servico;
}

export type ResultadoSegundoPlano = SyncOutcome | 'sem_api' | 'sem_sessao' | 'ocupado';

export interface DependenciasSegundoPlano {
  hasApi: boolean;
  abrirBanco: () => Promise<BancoSql>;
  /** Cria a fila real só para esta rodada (app fechado). */
  criarServico: (ctx: ContextoSync, banco: BancoSql) => Promise<SyncService>;
  agora?: () => number;
}

/**
 * Uma rodada de sincronização em segundo plano:
 * - sem API configurada (modo demonstração) ou sem sessão salva, não faz nada;
 * - com o app aberto no mesmo runtime, usa a fila que já está rodando;
 * - senão, abre a fila, envia o que está pendente e fecha, sob o `sync_lock`
 *   para não concorrer com outro runtime (Android).
 */
export async function rodarSyncEmSegundoPlano(deps: DependenciasSegundoPlano): Promise<ResultadoSegundoPlano> {
  if (!deps.hasApi) return 'sem_api';
  if (servicoEmPrimeiroPlano?.mode === 'api') return servicoEmPrimeiroPlano.syncNow();

  const banco = await deps.abrirBanco();
  const ctx = await lerContextoSync(banco);
  if (!ctx) return 'sem_sessao';

  const dono = `segundo-plano-${(deps.agora ?? Date.now)()}-${Math.random().toString(36).slice(2, 8)}`;
  const resultado = await comLockDeSync(
    new SyncLockSqlite(banco),
    dono,
    async () => {
      const servico = await deps.criarServico(ctx, banco);
      try {
        return await servico.syncNow();
      } finally {
        servico.stop();
      }
    },
    { agora: deps.agora },
  );
  return resultado ?? 'ocupado';
}
