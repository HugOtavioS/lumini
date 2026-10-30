import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Acesso ao banco. A API usa sempre esta interface; há duas implementações:
// - BancoSqlite: arquivo local (desenvolvimento e testes);
// - BancoPostgres (bancoPostgres.ts): PostgreSQL no Amazon RDS, quando a
//   variável DATABASE_URL está definida (implantação na EC2).

export type ValorSql = string | number | boolean | null;

export interface Banco {
  readonly tipo: 'sqlite' | 'postgres';
  executar(sql: string, ...params: ValorSql[]): number;
  todos<T>(sql: string, ...params: ValorSql[]): T[];
  um<T>(sql: string, ...params: ValorSql[]): T | undefined;
  /** Executa SQL sem parâmetros (um ou vários comandos). */
  exec(sql: string): void;
  /** Transação (aninhada vira parte da externa). */
  transacao<T>(tarefa: () => T): T;
  fechar(): void;
}

/** Controle de transação aninhada, comum às duas implementações. */
export abstract class BancoBase implements Banco {
  abstract readonly tipo: 'sqlite' | 'postgres';
  private profundidade = 0;
  abstract executar(sql: string, ...params: ValorSql[]): number;
  abstract todos<T>(sql: string, ...params: ValorSql[]): T[];
  abstract um<T>(sql: string, ...params: ValorSql[]): T | undefined;
  abstract exec(sql: string): void;
  abstract fechar(): void;
  protected abstract comandoInicio: string;

  transacao<T>(tarefa: () => T): T {
    if (this.profundidade > 0) {
      this.profundidade += 1;
      try {
        return tarefa();
      } finally {
        this.profundidade -= 1;
      }
    }
    this.exec(this.comandoInicio);
    this.profundidade = 1;
    try {
      const resultado = tarefa();
      this.exec('COMMIT');
      return resultado;
    } catch (erro) {
      this.exec('ROLLBACK');
      throw erro;
    } finally {
      this.profundidade = 0;
    }
  }
}

export class BancoSqlite extends BancoBase {
  readonly tipo = 'sqlite' as const;
  readonly db: DatabaseSync;
  protected comandoInicio = 'BEGIN IMMEDIATE';

  constructor(caminho: string) {
    super();
    if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true });
    this.db = new DatabaseSync(caminho);
    this.db.exec('PRAGMA foreign_keys = ON');
    if (caminho !== ':memory:') this.db.exec('PRAGMA journal_mode = WAL');
  }

  private args(params: ValorSql[]) {
    return params.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : p));
  }

  executar(sql: string, ...params: ValorSql[]): number {
    return Number(this.db.prepare(sql).run(...this.args(params)).changes);
  }

  todos<T>(sql: string, ...params: ValorSql[]): T[] {
    return this.db.prepare(sql).all(...this.args(params)) as T[];
  }

  um<T>(sql: string, ...params: ValorSql[]): T | undefined {
    return this.db.prepare(sql).get(...this.args(params)) as T | undefined;
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  fechar(): void {
    this.db.close();
  }
}
