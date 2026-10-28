/**
 * Tabelas locais usadas pela fila (SQLite do app, com SQLCipher).
 *
 * Os comandos usam `IF NOT EXISTS` e podem rodar a cada abertura do app.
 * O sistema de migrações versionadas do app (DAS v1.2) pode incluir os mesmos
 * comandos; o pacote não mexe no `PRAGMA user_version`.
 */

/** Fila de sincronização: uma linha por registro com alteração ainda não confirmada pelo servidor. */
export const SQL_TABELA_FILA = `CREATE TABLE IF NOT EXISTS fila_sincronizacao (
  id_operacao TEXT PRIMARY KEY NOT NULL,
  entidade TEXT NOT NULL,
  id_registro TEXT NOT NULL,
  prioridade INTEGER NOT NULL,
  payload TEXT NOT NULL,
  base_updated_at TEXT,
  situacao TEXT NOT NULL DEFAULT 'Pendente' CHECK (situacao IN ('Pendente', 'Erro')),
  retentar_automaticamente INTEGER NOT NULL DEFAULT 1 CHECK (retentar_automaticamente IN (0, 1)),
  tentativas INTEGER NOT NULL DEFAULT 0 CHECK (tentativas >= 0),
  proxima_tentativa_em INTEGER NOT NULL,
  ultima_tentativa_em INTEGER,
  ultimo_erro TEXT,
  revisao INTEGER NOT NULL DEFAULT 1,
  criado_em INTEGER NOT NULL,
  atualizado_em INTEGER NOT NULL,
  UNIQUE (entidade, id_registro)
)`;

export const SQL_INDICE_FILA = `CREATE INDEX IF NOT EXISTS idx_fila_sincronizacao_envio
  ON fila_sincronizacao (retentar_automaticamente, proxima_tentativa_em)`;

/** Log de Sincronização (Dicionário 8.2; RNF11). */
export const SQL_TABELA_LOG_SINCRONIZACAO = `CREATE TABLE IF NOT EXISTS log_sincronizacao (
  id_log_sync TEXT PRIMARY KEY NOT NULL,
  id_usuario TEXT NOT NULL,
  id_dispositivo TEXT NOT NULL,
  data_hora TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Pull', 'Push')),
  status TEXT NOT NULL CHECK (status IN ('Sucesso', 'Falha')),
  qtd_registros INTEGER NOT NULL CHECK (qtd_registros >= 0),
  mensagem_erro TEXT
)`;

export const MIGRACOES_FILA: readonly string[] = [SQL_TABELA_FILA, SQL_INDICE_FILA, SQL_TABELA_LOG_SINCRONIZACAO];
