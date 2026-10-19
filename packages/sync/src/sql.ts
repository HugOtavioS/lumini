/**
 * Acesso mínimo ao SQLite usado pela fila.
 *
 * O pacote não importa nenhuma biblioteca de banco: recebe um `BancoSql` e
 * traz dois adaptadores por "formato" (tipagem estrutural):
 * - `adaptarExpoSqlite`, para o `expo-sqlite` do app (SQLite com SQLCipher,
 *   DAS v1.2); a chave do SQLCipher é aplicada pelo app ao abrir o banco;
 * - `adaptarSqliteSincrono`, para APIs síncronas como o `node:sqlite` e o
 *   `better-sqlite3` (testes e scripts no Node).
 */

export type ValorSql = string | number | null;

export interface BancoSql {
  executar(sql: string, parametros?: readonly ValorSql[]): Promise<{ alteradas: number }>;
  consultar<T extends object>(sql: string, parametros?: readonly ValorSql[]): Promise<T[]>;
  /** Roda `tarefa` dentro de uma transação: tudo ou nada. */
  emTransacao<T>(tarefa: () => Promise<T>): Promise<T>;
}

/** Formato do banco do `expo-sqlite` (SDK 50 em diante) usado pelo adaptador. */
export interface ExpoSqliteDatabaseLike {
  runAsync(sql: string, parametros: ValorSql[]): Promise<{ changes: number }>;
  getAllAsync<T>(sql: string, parametros: ValorSql[]): Promise<T[]>;
  withTransactionAsync(tarefa: () => Promise<void>): Promise<void>;
}

export function adaptarExpoSqlite(db: ExpoSqliteDatabaseLike): BancoSql {
  return {
    async executar(sql, parametros = []) {
      const r = await db.runAsync(sql, [...parametros]);
      return { alteradas: r.changes };
    },
    consultar: <T extends object>(sql: string, parametros: readonly ValorSql[] = []) =>
      db.getAllAsync<T>(sql, [...parametros]),
    async emTransacao<T>(tarefa: () => Promise<T>): Promise<T> {
      let resultado: T | undefined;
      await db.withTransactionAsync(async () => {
        resultado = await tarefa();
      });
      return resultado as T;
    },
  };
}

/** Formato de bancos SQLite síncronos (`node:sqlite`, `better-sqlite3`). */
export interface SqliteSincronoLike {
  exec(sql: string): unknown;
  prepare(sql: string): {
    run(...parametros: ValorSql[]): { changes: number | bigint };
    all(...parametros: ValorSql[]): unknown[];
  };
}

export function adaptarSqliteSincrono(db: SqliteSincronoLike): BancoSql {
  return {
    async executar(sql, parametros = []) {
      const r = db.prepare(sql).run(...parametros);
      return { alteradas: Number(r.changes) };
    },
    async consultar<T extends object>(sql: string, parametros: readonly ValorSql[] = []) {
      return db.prepare(sql).all(...parametros) as T[];
    },
    async emTransacao<T>(tarefa: () => Promise<T>): Promise<T> {
      db.exec('BEGIN IMMEDIATE');
      try {
        const resultado = await tarefa();
        db.exec('COMMIT');
        return resultado;
      } catch (erro) {
        db.exec('ROLLBACK');
        throw erro;
      }
    },
  };
}

/**
 * Trava assíncrona simples: garante que as operações da fila no banco não se
 * misturem (o SQLite tem uma conexão só, e uma transação aberta enquanto outra
 * tarefa roda incluiria os comandos da outra tarefa).
 */
export class Trava {
  private fim: Promise<void> = Promise.resolve();

  async executar<T>(tarefa: () => Promise<T>): Promise<T> {
    const anterior = this.fim;
    let liberar!: () => void;
    this.fim = new Promise<void>((resolver) => {
      liberar = resolver;
    });
    await anterior;
    try {
      return await tarefa();
    } finally {
      liberar();
    }
  }
}
