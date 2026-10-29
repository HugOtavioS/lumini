/// <reference types="node" />
import { DatabaseSync } from 'node:sqlite';
import { adaptarSqliteSincrono, type BancoSql } from '@lumini/sync';

/** Só para testes no Node: SQLite em memória com a mesma interface do app. */
export function bancoEmMemoria(): BancoSql {
  return adaptarSqliteSincrono(new DatabaseSync(':memory:'));
}
