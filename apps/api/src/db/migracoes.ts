import type { Banco } from './banco';

// Banco central do Lumini (SCRUM-29), modelado a partir do Dicionário de
// Dados v1.4. Multi-tenant por `id_empresa` em todas as tabelas de negócio.
//
// Duas famílias de tabela:
// - dados da empresa que só a API grava: empresa, usuário, assinatura,
//   catálogo, logs e base de contingência — tabelas normais;
// - registros que chegam pela sincronização (cliente, instalação, medição,
//   simulação, proposta com itens, solicitação de upgrade) — guardados por
//   versão em `registro_sync` (o JSON do contrato do @lumini/sync), com
//   VIEWS relacionais (vw_*) para o painel e para relatórios.
//
// No PostgreSQL (RDS): TEXT JSON → JSONB, json_extract → ->>, datas ISO →
// TIMESTAMPTZ, INTEGER 0/1 → BOOLEAN. Ver docs/integracao/api-banco-rds.md.

export interface MigracaoApi {
  versao: number;
  nome: string;
  sql: string;
}

const J = (campo: string) => `json_extract(r.dados, '$.${campo}')`;

export const MIGRACOES_API: readonly MigracaoApi[] = [
  {
    versao: 1,
    nome: 'empresa_usuario_assinatura',
    sql: `
      CREATE TABLE empresa (
        id_empresa   TEXT PRIMARY KEY NOT NULL,
        razao_social TEXT NOT NULL,
        nome_fantasia TEXT NOT NULL,
        cnpj         TEXT UNIQUE,
        criado_em    TEXT NOT NULL
      );
      CREATE TABLE usuario (
        id_usuario   TEXT PRIMARY KEY NOT NULL,
        id_empresa   TEXT NOT NULL REFERENCES empresa (id_empresa),
        nome         TEXT NOT NULL,
        email        TEXT NOT NULL UNIQUE COLLATE NOCASE,
        senha_hash   TEXT NOT NULL,
        papel        TEXT NOT NULL CHECK (papel IN ('Tecnico', 'Gestor')),
        telefone     TEXT,
        ativo        INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
        criado_em    TEXT NOT NULL,
        ultimo_acesso_em TEXT
      );
      CREATE INDEX idx_usuario_empresa ON usuario (id_empresa);
      CREATE TABLE assinatura (
        id_assinatura TEXT PRIMARY KEY NOT NULL,
        id_empresa    TEXT NOT NULL UNIQUE REFERENCES empresa (id_empresa),
        tipo_plano    TEXT NOT NULL CHECK (tipo_plano IN ('Freemium', 'Mensal', 'Anual')),
        limite_propostas_mes INTEGER,
        status        TEXT NOT NULL CHECK (status IN ('Ativa', 'Suspensa', 'Cancelada')),
        inicio_em     TEXT NOT NULL
      );
      CREATE TABLE sessao_refresh (
        id_sessao   TEXT PRIMARY KEY NOT NULL,
        id_usuario  TEXT NOT NULL REFERENCES usuario (id_usuario),
        token_hash  TEXT NOT NULL UNIQUE,
        expira_em   TEXT NOT NULL,
        revogada    INTEGER NOT NULL DEFAULT 0
      );`,
  },
  {
    versao: 2,
    nome: 'catalogo_equipamentos',
    sql: `
      CREATE TABLE equipamento (
        id_equipamento TEXT PRIMARY KEY NOT NULL,
        id_empresa     TEXT NOT NULL REFERENCES empresa (id_empresa),
        categoria      TEXT NOT NULL,
        fabricante     TEXT NOT NULL,
        modelo         TEXT NOT NULL,
        fornecedor     TEXT NOT NULL,
        potencia_w     REAL,
        preco_custo    REAL NOT NULL CHECK (preco_custo >= 0),
        margem_percentual REAL NOT NULL,
        preco_venda    REAL NOT NULL,
        status         TEXT NOT NULL CHECK (status IN ('Ativo', 'Oculto')),
        dados          TEXT NOT NULL,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL,
        updated_by     TEXT NOT NULL
      );
      CREATE INDEX idx_equipamento_empresa ON equipamento (id_empresa, categoria);`,
  },
  {
    versao: 3,
    nome: 'sincronizacao_e_logs',
    sql: `
      CREATE TABLE registro_sync (
        entidade      TEXT NOT NULL,
        id_registro   TEXT NOT NULL,
        id_empresa    TEXT NOT NULL REFERENCES empresa (id_empresa),
        dados         TEXT NOT NULL,
        updated_at    TEXT NOT NULL,
        updated_by    TEXT NOT NULL,
        id_dispositivo TEXT,
        seq           INTEGER NOT NULL UNIQUE,
        PRIMARY KEY (entidade, id_registro)
      );
      CREATE INDEX idx_registro_sync_empresa_seq ON registro_sync (id_empresa, seq);
      CREATE TABLE status_versao (
        entidade    TEXT NOT NULL,
        id_registro TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        status      TEXT NOT NULL,
        PRIMARY KEY (entidade, id_registro, updated_at)
      );
      CREATE TABLE ultimo_envio (
        chave_envio       TEXT PRIMARY KEY NOT NULL,
        impressao         TEXT NOT NULL,
        mensagem_descarte TEXT
      );
      CREATE TABLE aviso_pendente (
        id_aviso   TEXT PRIMARY KEY NOT NULL,
        id_usuario TEXT NOT NULL,
        conteudo   TEXT NOT NULL,
        criado_em  TEXT NOT NULL
      );
      CREATE INDEX idx_aviso_usuario ON aviso_pendente (id_usuario);
      CREATE TABLE log_auditoria (
        id_log        TEXT PRIMARY KEY NOT NULL,
        id_empresa    TEXT NOT NULL,
        entidade      TEXT NOT NULL,
        id_registro   TEXT NOT NULL,
        campo         TEXT NOT NULL,
        valor_anterior TEXT,
        valor_novo    TEXT,
        id_usuario    TEXT NOT NULL,
        origem        TEXT NOT NULL CHECK (origem IN ('Mobile', 'Web', 'API')),
        data_hora     TEXT NOT NULL,
        motivo        TEXT
      );
      CREATE INDEX idx_auditoria_registro ON log_auditoria (entidade, id_registro);
      CREATE TABLE log_sincronizacao (
        id_log_sync   TEXT PRIMARY KEY NOT NULL,
        id_usuario    TEXT NOT NULL,
        id_dispositivo TEXT NOT NULL,
        data_hora     TEXT NOT NULL,
        tipo          TEXT NOT NULL CHECK (tipo IN ('Pull', 'Push')),
        status        TEXT NOT NULL CHECK (status IN ('Sucesso', 'Falha')),
        qtd_registros INTEGER NOT NULL,
        mensagem_erro TEXT
      );
      CREATE INDEX idx_log_sync_usuario ON log_sincronizacao (id_usuario, data_hora);
      CREATE TABLE contingencia_versao (
        versao       TEXT PRIMARY KEY NOT NULL,
        publicada_em TEXT NOT NULL,
        dados        TEXT NOT NULL
      );`,
  },
  {
    versao: 4,
    nome: 'views_relacionais',
    sql: `
      CREATE VIEW vw_cliente AS
        SELECT r.id_registro AS id_cliente, r.id_empresa,
               ${J('id_usuario_responsavel')} AS id_usuario_responsavel,
               ${J('nome_razao_social')} AS nome_razao_social,
               ${J('contato_whatsapp')} AS contato_whatsapp,
               ${J('contato_email')} AS contato_email,
               r.updated_at, r.updated_by
          FROM registro_sync r WHERE r.entidade = 'Cliente';
      CREATE VIEW vw_instalacao AS
        SELECT r.id_registro AS id_instalacao, r.id_empresa,
               ${J('id_cliente')} AS id_cliente, ${J('cidade')} AS cidade, ${J('estado')} AS estado,
               ${J('bairro')} AS bairro, ${J('logradouro')} AS logradouro, ${J('numero')} AS numero, ${J('cep')} AS cep,
               ${J('tarifa_kwh')} AS tarifa_kwh, ${J('consumo_mensal_kwh')} AS consumo_mensal_kwh,
               ${J('tipo_ligacao')} AS tipo_ligacao, ${J('tipo_telhado')} AS tipo_telhado,
               r.updated_at, r.updated_by
          FROM registro_sync r WHERE r.entidade = 'Instalacao';
      CREATE VIEW vw_proposta AS
        SELECT r.id_registro AS id_proposta, r.id_empresa,
               ${J('id_instalacao')} AS id_instalacao, ${J('id_usuario_responsavel')} AS id_usuario_responsavel,
               ${J('numero_proposta')} AS numero_proposta, ${J('numero_versao')} AS numero_versao,
               ${J('status_proposta')} AS status_proposta, ${J('potencia_kwp')} AS potencia_kwp,
               ${J('geracao_estimada_kwh_mes')} AS geracao_estimada_kwh_mes, ${J('valor_total')} AS valor_total,
               ${J('economia_mensal_estimada')} AS economia_mensal_estimada, ${J('payback_meses')} AS payback_meses,
               ${J('roi_percentual')} AS roi_percentual, ${J('condicao_pagamento')} AS condicao_pagamento,
               ${J('validade_dias')} AS validade_dias, ${J('data_geracao')} AS data_geracao,
               r.updated_at, r.updated_by
          FROM registro_sync r WHERE r.entidade = 'Proposta';
      CREATE VIEW vw_item_proposta AS
        SELECT json_extract(i.value, '$.id_item') AS id_item, r.id_registro AS id_proposta, r.id_empresa,
               json_extract(i.value, '$.id_equipamento') AS id_equipamento,
               json_extract(i.value, '$.quantidade') AS quantidade,
               json_extract(i.value, '$.preco_unitario') AS preco_unitario,
               json_extract(i.value, '$.subtotal') AS subtotal
          FROM registro_sync r, json_each(r.dados, '$.itens') i WHERE r.entidade = 'Proposta';`,
  },
];

/** Aplica as migrações pendentes, cada uma numa transação. Devolve as versões aplicadas. */
export function migrar(banco: Banco, migracoes: readonly MigracaoApi[] = MIGRACOES_API): number[] {
  banco.db.exec(`CREATE TABLE IF NOT EXISTS schema_migracoes (
    versao INTEGER PRIMARY KEY NOT NULL, nome TEXT NOT NULL, aplicada_em TEXT NOT NULL)`);
  const feitas = new Set(banco.todos<{ versao: number }>('SELECT versao FROM schema_migracoes').map((l) => Number(l.versao)));
  const aplicadas: number[] = [];
  for (const m of [...migracoes].sort((a, b) => a.versao - b.versao)) {
    if (feitas.has(m.versao)) continue;
    banco.transacao(() => {
      banco.db.exec(m.sql);
      banco.executar('INSERT INTO schema_migracoes (versao, nome, aplicada_em) VALUES (?, ?, ?)', m.versao, m.nome, new Date().toISOString());
    });
    aplicadas.push(m.versao);
  }
  return aplicadas;
}
