/**
 * syncLock.ts
 *
 * SCRUM-18 — Lock persistente (tabela sync_lock) contra execuções concorrentes.
 *
 * No Android a tarefa em background pode rodar em um runtime JS separado do app
 * em primeiro plano, então um lock só em memória não basta. O lock tem expiração
 * (lease): se o processo morrer segurando o lock, ele expira e outra execução assume.
 * A aquisição é um único UPSERT condicional, atômico no SQLite.
 */

import type { SqlExecutor } from '../database/SqlExecutor';

export interface SyncLock {
  adquirir(dono: string, agora: number, duracaoMs: number): Promise<boolean>;
  liberar(dono: string): Promise<void>;
}

export const NOME_LOCK_SYNC_PROPOSTAS = 'sync-propostas';

export class SyncLockSqlite implements SyncLock {
  constructor(
    private readonly db: SqlExecutor,
    private readonly nome: string = NOME_LOCK_SYNC_PROPOSTAS,
  ) {}

  async adquirir(dono: string, agora: number, duracaoMs: number): Promise<boolean> {
    await this.db.executar(
      `INSERT INTO sync_lock (nome, dono, expira_em) VALUES (?, ?, ?)
       ON CONFLICT (nome) DO UPDATE SET dono = excluded.dono, expira_em = excluded.expira_em
       WHERE sync_lock.expira_em <= ? OR sync_lock.dono = excluded.dono`,
      [this.nome, dono, agora + duracaoMs, agora],
    );
    const [lock] = await this.db.consultar<{ dono: string }>(
      'SELECT dono FROM sync_lock WHERE nome = ?',
      [this.nome],
    );
    return lock?.dono === dono;
  }

  async liberar(dono: string): Promise<void> {
    await this.db.executar('DELETE FROM sync_lock WHERE nome = ? AND dono = ?', [
      this.nome,
      dono,
    ]);
  }
}
