/**
 * 2026102401_hsp_contingencia.ts
 *
 * SCRUM-17 — Cria a tabela de HSP de contingência e o controle de versão de seeds.
 *
 * - hsp_contingencia: HSP médio por cidade (abrangencia = 'cidade') e média por UF
 *   (abrangencia = 'uf'), usado quando a busca em tempo real (SCRUM-8) falha.
 * - seed_versao: registra qual versão de cada seed já foi aplicada, garantindo
 *   que a carga inicial seja idempotente.
 */

import type { MigracaoSql } from './MigracaoSql';

export const migracaoHspContingencia: MigracaoSql = {
  versao: 2026102401,
  nome: 'hsp_contingencia',
  up: [
    `CREATE TABLE IF NOT EXISTS hsp_contingencia (
      id              TEXT PRIMARY KEY NOT NULL,
      abrangencia     TEXT NOT NULL CHECK (abrangencia IN ('cidade', 'uf')),
      codigo_ibge     TEXT,
      cidade          TEXT,
      cidade_chave    TEXT,
      uf              TEXT NOT NULL,
      hsp_medio_anual REAL NOT NULL CHECK (hsp_medio_anual > 0),
      hsp_mensal      TEXT,
      fonte           TEXT NOT NULL,
      dado_de_exemplo INTEGER NOT NULL DEFAULT 0 CHECK (dado_de_exemplo IN (0, 1)),
      versao_seed     INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_hsp_contingencia_ibge
      ON hsp_contingencia (codigo_ibge)`,
    `CREATE INDEX IF NOT EXISTS idx_hsp_contingencia_uf_cidade
      ON hsp_contingencia (uf, cidade_chave)`,
    `CREATE TABLE IF NOT EXISTS seed_versao (
      nome        TEXT PRIMARY KEY NOT NULL,
      versao      INTEGER NOT NULL,
      aplicado_em TEXT NOT NULL
    )`,
  ],
  down: [
    'DROP INDEX IF EXISTS idx_hsp_contingencia_uf_cidade',
    'DROP INDEX IF EXISTS idx_hsp_contingencia_ibge',
    'DROP TABLE IF EXISTS hsp_contingencia',
    'DROP TABLE IF EXISTS seed_versao',
  ],
};
