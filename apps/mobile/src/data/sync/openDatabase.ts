import type { BancoSql } from '@lumini/sync';

// No navegador (preview web), o expo-sqlite precisa de configuração extra do
// Metro para o WebAssembly. O preview web só serve para revisar as telas, então
// ele fica no modo simulado; no aparelho vale o arquivo `.native.ts`.
export async function openLocalDatabase(): Promise<BancoSql> {
  throw new Error('A fila de sincronização em SQLite só roda no aparelho (Android/iOS).');
}
