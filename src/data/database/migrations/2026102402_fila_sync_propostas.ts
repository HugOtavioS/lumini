/**
 * 2026102402_fila_sync_propostas.ts
 *
 * SCRUM-18 — Cria a fila de sincronização de propostas e o lock de execução.
 *
 * - fila_sync_propostas: uma linha por proposta enfileirada (só entram propostas
 *   aprovadas por podeSincronizar, SCRUM-405), com estado de sync e agenda de retry.
 * - sync_lock: lock persistente com expiração, impede que a tarefa em background
 *   e o app em primeiro plano sincronizem ao mesmo tempo (podem rodar em
 *   runtimes JS diferentes no Android).
 *
 * ⚠️ PENDÊNCIA (merge SCRUM-66/67): se o schema do outro repositório já tiver
 *    uma tabela de fila de sync, consolidar com ela em vez de manter duas.
 */

import type { MigracaoSql } from './MigracaoSql';

export const migracaoFilaSyncPropostas: MigracaoSql = {
  versao: 2026102402,
  nome: 'fila_sync_propostas',
  up: [
    `CREATE TABLE IF NOT EXISTS fila_sync_propostas (
      proposta_id      TEXT PRIMARY KEY NOT NULL,
      status_sync      TEXT NOT NULL
                       CHECK (status_sync IN ('pendente', 'sincronizando', 'sincronizada', 'erro')),
      tentativas       INTEGER NOT NULL DEFAULT 0,
      proximo_envio_em INTEGER,
      ultimo_erro      TEXT,
      enfileirada_em   INTEGER NOT NULL,
      atualizada_em    INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_fila_sync_status_proximo
      ON fila_sync_propostas (status_sync, proximo_envio_em)`,
    `CREATE TABLE IF NOT EXISTS sync_lock (
      nome      TEXT PRIMARY KEY NOT NULL,
      dono      TEXT NOT NULL,
      expira_em INTEGER NOT NULL
    )`,
  ],
  down: [
    'DROP INDEX IF EXISTS idx_fila_sync_status_proximo',
    'DROP TABLE IF EXISTS fila_sync_propostas',
    'DROP TABLE IF EXISTS sync_lock',
  ],
};
