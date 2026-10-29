import type { BancoSql } from '@lumini/sync';

// SCRUM-18 (Misael) — lock persistente (tabela `sync_lock`) contra rodadas
// concorrentes. No Android a tarefa em segundo plano pode rodar num runtime JS
// separado do app aberto, então a trava em memória da fila não basta. O lock
// expira (lease): se o processo morrer segurando, outra execução assume.
// A aquisição é um único UPSERT condicional, atômico no SQLite.

export const NOME_LOCK_SYNC = 'sync-propostas';

export class SyncLockSqlite {
  constructor(
    private readonly banco: BancoSql,
    private readonly nome: string = NOME_LOCK_SYNC,
  ) {}

  async adquirir(dono: string, agora: number, duracaoMs: number): Promise<boolean> {
    await this.banco.executar(
      `INSERT INTO sync_lock (nome, dono, expira_em) VALUES (?, ?, ?)
       ON CONFLICT (nome) DO UPDATE SET dono = excluded.dono, expira_em = excluded.expira_em
       WHERE sync_lock.expira_em <= ? OR sync_lock.dono = excluded.dono`,
      [this.nome, dono, agora + duracaoMs, agora],
    );
    const [lock] = await this.banco.consultar<{ dono: string }>('SELECT dono FROM sync_lock WHERE nome = ?', [this.nome]);
    return lock?.dono === dono;
  }

  async liberar(dono: string): Promise<void> {
    await this.banco.executar('DELETE FROM sync_lock WHERE nome = ? AND dono = ?', [this.nome, dono]);
  }
}

/** Roda `tarefa` com o lock; devolve `null` se outra execução estiver com ele. */
export async function comLockDeSync<T>(
  lock: SyncLockSqlite,
  dono: string,
  tarefa: () => Promise<T>,
  { duracaoMs = 5 * 60 * 1000, agora = () => Date.now() }: { duracaoMs?: number; agora?: () => number } = {},
): Promise<T | null> {
  if (!(await lock.adquirir(dono, agora(), duracaoMs))) return null;
  try {
    return await tarefa();
  } finally {
    await lock.liberar(dono);
  }
}
