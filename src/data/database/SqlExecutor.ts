/**
 * SqlExecutor.ts
 *
 * SCRUM-17 / SCRUM-18 — Porta mínima de acesso ao SQLite usada pelos módulos desta entrega.
 *
 * ⚠️ PENDÊNCIA (merge SCRUM-66): a conexão SQLite real e a escolha da biblioteca
 *    (expo-sqlite, op-sqlite, ...) vêm do SCRUM-66. No merge, criar um adaptador
 *    dessa conexão para esta interface (ou trocar esta interface pela do SCRUM-66).
 *    Mantê-la pequena isola seed, repositórios e fila de sync da biblioteca escolhida.
 */

export type ParametroSql = string | number | null;

export interface SqlExecutor {
  executar(sql: string, parametros?: readonly ParametroSql[]): Promise<void>;
  consultar<T>(sql: string, parametros?: readonly ParametroSql[]): Promise<T[]>;
  /**
   * Executa `fn` em uma transação; faz rollback se `fn` lançar erro.
   * O adaptador deve usar transação exclusiva (ex.: withExclusiveTransactionAsync
   * no expo-sqlite), para que outras consultas não se intercalem com a transação.
   */
  transacao<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}
