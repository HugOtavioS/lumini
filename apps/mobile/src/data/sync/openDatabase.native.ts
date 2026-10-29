import { openDatabaseAsync } from 'expo-sqlite';
import { adaptarExpoSqlite, type BancoSql } from '@lumini/sync';

import { executarMigracoes } from '@/data/database/migracoes';

let aberto: Promise<BancoSql> | null = null;

/**
 * Banco local do app (Android/iOS), já migrado. Uma conexão só por runtime JS:
 * a fila, a base de contingência e a tarefa em segundo plano compartilham.
 * A criptografia SQLCipher (D16) entra com o RF15.
 */
export function openLocalDatabase(): Promise<BancoSql> {
  aberto ??= (async () => {
    const banco = adaptarExpoSqlite(await openDatabaseAsync('lumini.db'));
    await executarMigracoes(banco);
    return banco;
  })().catch((erro) => {
    aberto = null;
    throw erro;
  });
  return aberto;
}
