-- Lumini — banco central no Amazon RDS (PostgreSQL).
-- Mesmo modelo das migrações SQLite 1 a 4 (apps/api/src/db/migracoes.ts),
-- com os tipos do PostgreSQL: JSONB, TIMESTAMPTZ, BOOLEAN, NUMERIC.
-- Idempotente: pode rodar de novo sem erro.

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migracoes (
  versao      INTEGER PRIMARY KEY,
  nome        TEXT NOT NULL,
  aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1. Empresa, usuário, assinatura e sessão --------------------------------
CREATE TABLE IF NOT EXISTS empresa (
  id_empresa    TEXT PRIMARY KEY,
  razao_social  TEXT NOT NULL,
  nome_fantasia TEXT NOT NULL,
  cnpj          TEXT UNIQUE,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usuario (
  id_usuario       TEXT PRIMARY KEY,
  id_empresa       TEXT NOT NULL REFERENCES empresa (id_empresa),
  nome             TEXT NOT NULL,
  email            TEXT NOT NULL,
  senha_hash       TEXT NOT NULL,
  papel            TEXT NOT NULL CHECK (papel IN ('Tecnico', 'Gestor')),
  telefone         TEXT,
  ativo            BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_acesso_em TIMESTAMPTZ
);
-- e-mail único sem diferenciar maiúsculas (COLLATE NOCASE no SQLite)
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_email ON usuario (lower(email));
CREATE INDEX IF NOT EXISTS idx_usuario_empresa ON usuario (id_empresa);

CREATE TABLE IF NOT EXISTS assinatura (
  id_assinatura        TEXT PRIMARY KEY,
  id_empresa           TEXT NOT NULL UNIQUE REFERENCES empresa (id_empresa),
  tipo_plano           TEXT NOT NULL CHECK (tipo_plano IN ('Freemium', 'Mensal', 'Anual')),
  limite_propostas_mes INTEGER,
  status               TEXT NOT NULL CHECK (status IN ('Ativa', 'Suspensa', 'Cancelada')),
  inicio_em            TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS sessao_refresh (
  id_sessao  TEXT PRIMARY KEY,
  id_usuario TEXT NOT NULL REFERENCES usuario (id_usuario),
  token_hash TEXT NOT NULL UNIQUE,
  expira_em  TIMESTAMPTZ NOT NULL,
  revogada   BOOLEAN NOT NULL DEFAULT FALSE
);

-- 2. Catálogo de equipamentos ----------------------------------------------
CREATE TABLE IF NOT EXISTS equipamento (
  id_equipamento    TEXT PRIMARY KEY,
  id_empresa        TEXT NOT NULL REFERENCES empresa (id_empresa),
  categoria         TEXT NOT NULL,
  fabricante        TEXT NOT NULL,
  modelo            TEXT NOT NULL,
  fornecedor        TEXT NOT NULL,
  potencia_w        NUMERIC(10,2),
  preco_custo       NUMERIC(12,2) NOT NULL CHECK (preco_custo >= 0),
  margem_percentual NUMERIC(6,2) NOT NULL,
  preco_venda       NUMERIC(12,2) NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('Ativo', 'Oculto')),
  dados             JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL,
  updated_by        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_equipamento_empresa ON equipamento (id_empresa, categoria);

-- 3. Sincronização e logs --------------------------------------------------
CREATE TABLE IF NOT EXISTS registro_sync (
  entidade       TEXT NOT NULL,
  id_registro    TEXT NOT NULL,
  id_empresa     TEXT NOT NULL REFERENCES empresa (id_empresa),
  dados          JSONB NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL,
  updated_by     TEXT NOT NULL,
  id_dispositivo TEXT,
  seq            BIGINT NOT NULL UNIQUE,
  PRIMARY KEY (entidade, id_registro)
);
CREATE INDEX IF NOT EXISTS idx_registro_sync_empresa_seq ON registro_sync (id_empresa, seq);

CREATE TABLE IF NOT EXISTS status_versao (
  entidade    TEXT NOT NULL,
  id_registro TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL,
  status      TEXT NOT NULL,
  PRIMARY KEY (entidade, id_registro, updated_at)
);

CREATE TABLE IF NOT EXISTS ultimo_envio (
  chave_envio       TEXT PRIMARY KEY,
  impressao         TEXT NOT NULL,
  mensagem_descarte TEXT
);

CREATE TABLE IF NOT EXISTS aviso_pendente (
  id_aviso   TEXT PRIMARY KEY,
  id_usuario TEXT NOT NULL,
  conteudo   JSONB NOT NULL,
  criado_em  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_aviso_usuario ON aviso_pendente (id_usuario);

CREATE TABLE IF NOT EXISTS log_auditoria (
  id_log         TEXT PRIMARY KEY,
  id_empresa     TEXT NOT NULL,
  entidade       TEXT NOT NULL,
  id_registro    TEXT NOT NULL,
  campo          TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo     TEXT,
  id_usuario     TEXT NOT NULL,
  origem         TEXT NOT NULL CHECK (origem IN ('Mobile', 'Web', 'API')),
  data_hora      TIMESTAMPTZ NOT NULL,
  motivo         TEXT
);
CREATE INDEX IF NOT EXISTS idx_auditoria_registro ON log_auditoria (entidade, id_registro);

CREATE TABLE IF NOT EXISTS log_sincronizacao (
  id_log_sync    TEXT PRIMARY KEY,
  id_usuario     TEXT NOT NULL,
  id_dispositivo TEXT NOT NULL,
  data_hora      TIMESTAMPTZ NOT NULL,
  tipo           TEXT NOT NULL CHECK (tipo IN ('Pull', 'Push')),
  status         TEXT NOT NULL CHECK (status IN ('Sucesso', 'Falha')),
  qtd_registros  INTEGER NOT NULL,
  mensagem_erro  TEXT
);
CREATE INDEX IF NOT EXISTS idx_log_sync_usuario ON log_sincronizacao (id_usuario, data_hora);

CREATE TABLE IF NOT EXISTS contingencia_versao (
  versao       TEXT PRIMARY KEY,
  publicada_em TIMESTAMPTZ NOT NULL,
  dados        JSONB NOT NULL
);

-- 4. Views relacionais (painel e relatórios) -------------------------------
CREATE OR REPLACE VIEW vw_cliente AS
  SELECT r.id_registro AS id_cliente, r.id_empresa,
         r.dados->>'id_usuario_responsavel' AS id_usuario_responsavel,
         r.dados->>'nome_razao_social'      AS nome_razao_social,
         r.dados->>'contato_whatsapp'       AS contato_whatsapp,
         r.dados->>'contato_email'          AS contato_email,
         r.updated_at, r.updated_by
    FROM registro_sync r WHERE r.entidade = 'Cliente';

CREATE OR REPLACE VIEW vw_instalacao AS
  SELECT r.id_registro AS id_instalacao, r.id_empresa,
         r.dados->>'id_cliente' AS id_cliente, r.dados->>'cidade' AS cidade, r.dados->>'estado' AS estado,
         r.dados->>'bairro' AS bairro, r.dados->>'logradouro' AS logradouro, r.dados->>'numero' AS numero, r.dados->>'cep' AS cep,
         (r.dados->>'tarifa_kwh')::numeric         AS tarifa_kwh,
         (r.dados->>'consumo_mensal_kwh')::numeric AS consumo_mensal_kwh,
         r.dados->>'tipo_ligacao' AS tipo_ligacao, r.dados->>'tipo_telhado' AS tipo_telhado,
         r.updated_at, r.updated_by
    FROM registro_sync r WHERE r.entidade = 'Instalacao';

CREATE OR REPLACE VIEW vw_proposta AS
  SELECT r.id_registro AS id_proposta, r.id_empresa,
         r.dados->>'id_instalacao' AS id_instalacao, r.dados->>'id_usuario_responsavel' AS id_usuario_responsavel,
         r.dados->>'numero_proposta' AS numero_proposta, (r.dados->>'numero_versao')::int AS numero_versao,
         r.dados->>'status_proposta' AS status_proposta,
         (r.dados->>'potencia_kwp')::numeric             AS potencia_kwp,
         (r.dados->>'geracao_estimada_kwh_mes')::numeric AS geracao_estimada_kwh_mes,
         (r.dados->>'valor_total')::numeric              AS valor_total,
         (r.dados->>'economia_mensal_estimada')::numeric AS economia_mensal_estimada,
         (r.dados->>'payback_meses')::int                AS payback_meses,
         (r.dados->>'roi_percentual')::numeric           AS roi_percentual,
         r.dados->>'condicao_pagamento' AS condicao_pagamento,
         (r.dados->>'validade_dias')::int AS validade_dias,
         (r.dados->>'data_geracao')::timestamptz AS data_geracao,
         r.updated_at, r.updated_by
    FROM registro_sync r WHERE r.entidade = 'Proposta';

CREATE OR REPLACE VIEW vw_item_proposta AS
  SELECT i->>'id_item' AS id_item, r.id_registro AS id_proposta, r.id_empresa,
         i->>'id_equipamento' AS id_equipamento,
         (i->>'quantidade')::int          AS quantidade,
         (i->>'preco_unitario')::numeric  AS preco_unitario,
         (i->>'subtotal')::numeric        AS subtotal
    FROM registro_sync r, jsonb_array_elements(COALESCE(r.dados->'itens', '[]'::jsonb)) AS i
   WHERE r.entidade = 'Proposta';

INSERT INTO schema_migracoes (versao, nome) VALUES
  (1, 'empresa_usuario_assinatura'), (2, 'catalogo_equipamentos'),
  (3, 'sincronizacao_e_logs'), (4, 'views_relacionais')
ON CONFLICT (versao) DO NOTHING;

COMMIT;
