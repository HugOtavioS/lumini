/**
 * sqliteEmMemoria.ts
 *
 * SCRUM-17 / SCRUM-18 — SqlExecutor sobre SQLite real em memória, SOMENTE para testes.
 * Usa o módulo nativo `node:sqlite` (Node ≥ 22.13), sem dependências extras.
 *
 * ⚠️ Não importar em código de produção.
 */

import { DatabaseSync } from 'node:sqlite';
import type { ParametroSql, SqlExecutor } from '../SqlExecutor';
import type { MigracaoSql } from '../migrations/MigracaoSql';

export interface SqliteEmMemoria extends SqlExecutor {
  fechar(): void;
}

export function criarSqliteEmMemoria(): SqliteEmMemoria {
  const db = new DatabaseSync(':memory:');
  const params = (p?: readonly ParametroSql[]): ParametroSql[] => [...(p ?? [])];

  const executor: SqliteEmMemoria = {
    async executar(sql, parametros) {
      db.prepare(sql).run(...params(parametros));
    },
    async consultar<T>(sql: string, parametros?: readonly ParametroSql[]) {
      return db.prepare(sql).all(...params(parametros)) as T[];
    },
    async transacao(fn) {
      db.exec('BEGIN');
      try {
        const resultado = await fn(executor);
        db.exec('COMMIT');
        return resultado;
      } catch (erro) {
        db.exec('ROLLBACK');
        throw erro;
      }
    },
    fechar() {
      db.close();
    },
  };

  return executor;
}

/** Runner simplificado, só para testes (o oficial é do SCRUM-66). */
export async function aplicarMigracoes(
  db: SqlExecutor,
  migracoes: readonly MigracaoSql[],
): Promise<void> {
  for (const m of [...migracoes].sort((a, b) => a.versao - b.versao)) {
    for (const sql of m.up) {
      await db.executar(sql);
    }
  }
}
