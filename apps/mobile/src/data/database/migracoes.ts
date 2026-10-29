import type { BancoSql } from '@lumini/sync';

// Migrações do banco local do app (SQLite). Formato e versões AAAAMMDDNN vêm
// da entrega do Misael (SCRUM-17/18); o runner é este arquivo (SCRUM-66).
//
// As tabelas da fila de sincronização NÃO estão aqui: o @lumini/sync (Pedro,
// SCRUM-82/83) cria e versiona as dele ao abrir a fila. Por isso a tabela
// `fila_sync_propostas` da entrega do Misael não foi trazida (seria uma segunda
// fila); dela ficou só o `sync_lock`, usado pela tarefa em segundo plano.

export interface Migracao {
  versao: number;
  nome: string;
  up: readonly string[];
  down: readonly string[];
}

/** SCRUM-17 — HSP de contingência (UF e, quando houver, cidade) e versão das cargas. */
export const migracaoHspContingencia: Migracao = {
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
      latitude        REAL,
      fonte           TEXT NOT NULL,
      dado_de_exemplo INTEGER NOT NULL DEFAULT 0 CHECK (dado_de_exemplo IN (0, 1)),
      versao_seed     INTEGER NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS idx_hsp_contingencia_ibge ON hsp_contingencia (codigo_ibge)',
    'CREATE INDEX IF NOT EXISTS idx_hsp_contingencia_uf_cidade ON hsp_contingencia (uf, cidade_chave)',
    `CREATE TABLE IF NOT EXISTS seed_versao (
      nome        TEXT PRIMARY KEY NOT NULL,
      versao      INTEGER NOT NULL,
      rotulo      TEXT,
      publicada_em TEXT,
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

/** SCRUM-18 — lock com expiração entre o app aberto e a tarefa em segundo plano. */
export const migracaoSyncLock: Migracao = {
  versao: 2026102402,
  nome: 'sync_lock',
  up: [
    `CREATE TABLE IF NOT EXISTS sync_lock (
      nome      TEXT PRIMARY KEY NOT NULL,
      dono      TEXT NOT NULL,
      expira_em INTEGER NOT NULL
    )`,
  ],
  down: ['DROP TABLE IF EXISTS sync_lock'],
};

/** Configuração local (id do dispositivo, contexto da sessão para o segundo plano). */
export const migracaoAppConfig: Migracao = {
  versao: 2026102901,
  nome: 'app_config',
  up: ['CREATE TABLE IF NOT EXISTS app_config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)'],
  down: ['DROP TABLE IF EXISTS app_config'],
};

export const MIGRACOES: readonly Migracao[] = [migracaoHspContingencia, migracaoSyncLock, migracaoAppConfig];

/**
 * Aplica, em ordem de versão, as migrações ainda não registradas em
 * `schema_migracoes`. Cada migração roda em uma transação (tudo ou nada).
 * Retorna as versões aplicadas nesta chamada.
 */
export async function executarMigracoes(banco: BancoSql, migracoes: readonly Migracao[] = MIGRACOES): Promise<number[]> {
  await banco.executar(
    `CREATE TABLE IF NOT EXISTS schema_migracoes (
      versao      INTEGER PRIMARY KEY NOT NULL,
      nome        TEXT NOT NULL,
      aplicada_em TEXT NOT NULL
    )`,
  );
  const feitas = new Set(
    (await banco.consultar<{ versao: number }>('SELECT versao FROM schema_migracoes')).map((l) => Number(l.versao)),
  );
  const aplicadas: number[] = [];
  for (const m of [...migracoes].sort((a, b) => a.versao - b.versao)) {
    if (feitas.has(m.versao)) continue;
    await banco.emTransacao(async () => {
      for (const sql of m.up) await banco.executar(sql);
      await banco.executar('INSERT INTO schema_migracoes (versao, nome, aplicada_em) VALUES (?, ?, ?)', [
        m.versao,
        m.nome,
        new Date().toISOString(),
      ]);
    });
    aplicadas.push(m.versao);
  }
  return aplicadas;
}
