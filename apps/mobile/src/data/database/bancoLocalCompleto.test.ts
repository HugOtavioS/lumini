import { describe, expect, it } from 'vitest';

import { TABELAS_BANCO_LOCAL_COMPLETO, migracaoBancoLocalCompleto } from './bancoLocalCompleto';
import { MIGRACOES, executarMigracoes } from './migracoes';
import { bancoEmMemoria } from './testing';

const agora = '2026-10-30T12:00:00.000Z';

describe('banco local completo (secundário)', () => {
  it('não faz parte das migrações padrão do app', () => {
    expect(MIGRACOES.map((m) => m.versao)).not.toContain(migracaoBancoLocalCompleto.versao);
  });

  it('cria as 13 tabelas do DER local junto com as atuais', async () => {
    const banco = bancoEmMemoria();
    await executarMigracoes(banco, [...MIGRACOES, migracaoBancoLocalCompleto]);
    const tabelas = (await banco.consultar<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")).map((t) => t.name);
    expect(tabelas).toEqual(expect.arrayContaining([...TABELAS_BANCO_LOCAL_COMPLETO, 'hsp_contingencia', 'sync_lock', 'app_config']));
  });

  it('grava uma proposta completa e respeita as chaves estrangeiras', async () => {
    const banco = bancoEmMemoria();
    await executarMigracoes(banco, [migracaoBancoLocalCompleto]);
    await banco.executar('PRAGMA foreign_keys = ON');
    const ctl = [agora, agora, 'tec-001'];
    await banco.executar(`INSERT INTO cliente (id_cliente, id_empresa, id_usuario_responsavel, tipo_pessoa, nome_razao_social, cpf_cnpj, contato_whatsapp, created_at, updated_at, updated_by)
      VALUES ('cli-1','emp-001','tec-001','Física','Ana Souza','12345678901','12999990000',?,?,?)`, ctl);
    await banco.executar(`INSERT INTO concessionaria VALUES ('edp-sp','EDP São Paulo','SP',0.92,?)`, [agora]);
    await banco.executar(`INSERT INTO instalacao (id_instalacao, id_empresa, id_cliente, cep, logradouro, numero, bairro, cidade, estado, uc_nis, id_concessionaria, tarifa_kwh, modalidade_tarifaria, tipo_ligacao, disjuntor_amperagem, consumo_mensal_kwh, tipo_telhado, created_at, updated_at, updated_by)
      VALUES ('ins-1','emp-001','cli-1','12280000','Rua A','10','Centro','Caçapava','SP','123','edp-sp',0.92,'Convencional','Bifásica',50,400,'Cerâmico',?,?,?)`, ctl);
    await banco.executar(`INSERT INTO proposta (id_proposta, id_empresa, id_instalacao, id_usuario_responsavel, status_proposta, valor_equipamentos, valor_materiais_eletricos, valor_mao_de_obra, valor_art_homologacao, valor_logistica_frete, margem_percentual, valor_margem, valor_total, condicao_pagamento, created_at, updated_at, updated_by)
      VALUES ('pro-1','emp-001','ins-1','tec-001','Gerada',10000,800,2000,600,300,20,740,14440,'À vista',?,?,?)`, ctl);
    const [p] = await banco.consultar<{ sync_status: string; validade_dias: number; numero_versao: number }>('SELECT sync_status, validade_dias, numero_versao FROM proposta');
    expect(p).toEqual({ sync_status: 'Pendente', validade_dias: 15, numero_versao: 1 });
    await expect(
      banco.executar(`INSERT INTO medicao_telhado (id_medicao, id_instalacao, metodo_medicao, area_m2, inclinacao_graus, orientacao, data_coleta, created_at, updated_at, updated_by)
        VALUES ('m','nao-existe','RA',30,20,'N',?,?,?,?)`, [agora, ...ctl]),
    ).rejects.toThrow();
  });

  it('desfaz pelo down', async () => {
    const banco = bancoEmMemoria();
    await executarMigracoes(banco, [migracaoBancoLocalCompleto]);
    for (const sql of migracaoBancoLocalCompleto.down) await banco.executar(sql);
    expect(await banco.consultar("SELECT name FROM sqlite_master WHERE name = 'proposta'")).toEqual([]);
  });
});
