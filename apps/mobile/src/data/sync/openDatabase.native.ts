import { openDatabaseAsync } from 'expo-sqlite';
import { adaptarExpoSqlite, type BancoSql } from '@lumini/sync';

/** Banco local do app (Android/iOS). A criptografia SQLCipher (D16) entra com o RF15. */
export async function openLocalDatabase(): Promise<BancoSql> {
  const db = await openDatabaseAsync('lumini.db');
  return adaptarExpoSqlite(db);
}
