/**
 * initDatabase.ts
 *
 * SCRUM-17 — Inicialização do SQLite: roda as migrações e, em seguida, a carga
 * inicial idempotente do seed de HSP de contingência.
 *
 * ⚠️ PENDÊNCIA (merge SCRUM-66): `executarMigracoes` é o runner do SCRUM-66,
 *    já com MIGRACOES_SPRINT_3 (src/data/database/migrations) registradas na lista dele.
 *    Chamar inicializarBancoDeDados uma vez no bootstrap do app (e no início da
 *    tarefa em background, que pode rodar com o app fechado).
 */

import type { SqlExecutor } from '@/data/database/SqlExecutor';
import {
  carregarSeedHsp,
  ResultadoCargaSeed,
} from '@/data/seeds/carregarSeedHsp';

export interface DependenciasInitDatabase {
  db: SqlExecutor;
  executarMigracoes: () => Promise<void>;
}

export interface ResultadoInitDatabase {
  seedHsp: ResultadoCargaSeed;
}

export async function inicializarBancoDeDados(
  deps: DependenciasInitDatabase,
): Promise<ResultadoInitDatabase> {
  await deps.executarMigracoes();
  const seedHsp = await carregarSeedHsp(deps.db);
  return { seedHsp };
}
