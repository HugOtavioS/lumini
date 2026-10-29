import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Acesso ao SQLite. Fica num arquivo só para que a troca pelo PostgreSQL
// (Amazon RDS) mexa só na camada `db/` — ver docs/integracao/api-banco-rds.md.

export type ValorSql = string | number | null;

export class Banco {
  readonly db: DatabaseSync;
  private profundidade = 0;

  constructor(caminho: string) {
    if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true });
    this.db = new DatabaseSync(caminho);
    this.db.exec('PRAGMA foreign_keys = ON');
    if (caminho !== ':memory:') this.db.exec('PRAGMA journal_mode = WAL');
  }

  executar(sql: string, ...params: ValorSql[]): number {
    return Number(this.db.prepare(sql).run(...params).changes);
  }

  todos<T>(sql: string, ...params: ValorSql[]): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  um<T>(sql: string, ...params: ValorSql[]): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }

  /** Transação (aninhada vira parte da externa). */
  transacao<T>(tarefa: () => T): T {
    if (this.profundidade > 0) {
      this.profundidade += 1;
      try {
        return tarefa();
      } finally {
        this.profundidade -= 1;
      }
    }
    this.db.exec('BEGIN IMMEDIATE');
    this.profundidade = 1;
    try {
      const resultado = tarefa();
      this.db.exec('COMMIT');
      return resultado;
    } catch (erro) {
      this.db.exec('ROLLBACK');
      throw erro;
    } finally {
      this.profundidade = 0;
    }
  }

  fechar(): void {
    this.db.close();
  }
}
