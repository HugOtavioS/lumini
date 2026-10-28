import { ServidorSincronizacaoMemoria, idOperacaoDe, type OperacaoSync } from '@lumini/sync';
import { describe, expect, it } from 'vitest';

import { seedProposals } from '@/data/mock/proposals';
import type { Proposal } from '@/domain/entities';
import { canTechnicianEdit, isSyncable } from '@/domain/services/proposalRules';
import { propostaDoRegistro, propostaPodeSubir, registrosDaProposta } from './registros';
import { statusDoContrato, statusParaContrato } from './status';

const ctx = { idEmpresa: 'emp-001', idUsuario: 'tec-001' };
const base = seedProposals.find((p) => p.status === 'gerada')!;
const comStatus = (status: Proposal['status']): Proposal => ({ ...base, status });

function operacoes(proposal: Proposal): OperacaoSync[] {
  return registrosDaProposta(proposal, ctx).map((e) => ({
    idOperacao: idOperacaoDe(e.entidade, e.versao.id),
    entidade: e.entidade,
    baseUpdatedAt: e.baseUpdatedAt ?? null,
    versao: e.versao,
  }));
}

describe('status do app ↔ contrato do @lumini/sync', () => {
  it('a conversão é de ida e volta', () => {
    for (const [app, contrato] of Object.entries(statusParaContrato)) {
      expect(statusDoContrato[contrato]).toBe(app);
    }
  });

  it('RN07 e RN11 vêm do pacote compartilhado (SCRUM-406)', () => {
    expect(isSyncable('gerada')).toBe(true);
    expect(isSyncable('em_elaboracao')).toBe(false);
    expect(isSyncable('reaberta')).toBe(false); // antes o app deixava subir
    expect(canTechnicianEdit('reaberta')).toBe(true);
    expect(canTechnicianEdit('gerada')).toBe(false);
    expect(canTechnicianEdit('aprovada')).toBe(false);
  });
});

describe('proposta do app → registros do contrato (Dicionário v1.4)', () => {
  it('gera cliente, instalação, medição, simulação e proposta, em ordem de dependência', () => {
    const entradas = registrosDaProposta(base, ctx);
    expect(entradas.map((e) => e.entidade)).toEqual(['Cliente', 'Instalacao', 'Medicao', 'SimulacaoSombreamento', 'Proposta']);
    const instalacao = entradas.find((e) => e.entidade === 'Instalacao')!.versao.dados;
    expect(instalacao).toMatchObject({
      cep: '74000000',
      modalidade_tarifaria: 'Convencional',
      tipo_ligacao: 'Bifásica',
      disjuntor_amperagem: 40,
      distancia_quadro_m: 8,
      necessidade_adequacao_quadro: false,
    });
    const proposta = entradas.find((e) => e.entidade === 'Proposta')!.versao.dados;
    expect(proposta).toMatchObject({ status_proposta: 'Gerada', condicao_pagamento: 'Parcelado', parcelas: 12 });
    expect(proposta.itens).toHaveLength(base.items.length);
  });

  it('RN07: "Em elaboração" e "Reaberta" não sobem', () => {
    expect(propostaPodeSubir(comStatus('gerada'), ctx)).toBe(true);
    expect(propostaPodeSubir(comStatus('em_elaboracao'), ctx)).toBe(false);
    expect(propostaPodeSubir(comStatus('reaberta'), ctx)).toBe(false);
  });

  it('a versão-base de cada registro vem de syncBase', () => {
    const proposal = { ...base, syncBase: { [`Proposta:${base.id}`]: '2026-10-01T10:00:00.000Z' } };
    const proposta = registrosDaProposta(proposal, ctx).find((e) => e.entidade === 'Proposta')!;
    expect(proposta.baseUpdatedAt).toBe('2026-10-01T10:00:00.000Z');
  });

  it('os eventos da fila voltam para a proposta certa', () => {
    const ids = [base.id, 'outra'];
    for (const e of registrosDaProposta(base, ctx)) {
      expect(propostaDoRegistro(e.entidade, e.versao.id, ids)).toBe(base.id);
    }
  });
});

describe('encaixe com o servidor de referência (as regras da API)', () => {
  it('o servidor aceita tudo o que o app envia', () => {
    const servidor = new ServidorSincronizacaoMemoria();
    const resposta = servidor.push({ idUsuario: ctx.idUsuario, idEmpresa: ctx.idEmpresa, papel: 'Tecnico' }, { idDispositivo: 'app-teste', operacoes: operacoes(base) });
    expect(resposta.resultados.map((r) => r.situacao)).toEqual(['aplicada', 'aplicada', 'aplicada', 'aplicada', 'aplicada']);
  });

  it('RN11: depois de gerada, o técnico não altera a proposta pelo app', () => {
    const servidor = new ServidorSincronizacaoMemoria();
    const sessao = { idUsuario: ctx.idUsuario, idEmpresa: ctx.idEmpresa, papel: 'Tecnico' as const };
    servidor.push(sessao, { idDispositivo: 'app-teste', operacoes: operacoes(base) });
    const editada: Proposal = {
      ...base,
      validityDays: 30,
      updatedAt: new Date(Date.parse(base.updatedAt) + 60_000).toISOString(),
      syncBase: { [`Proposta:${base.id}`]: base.updatedAt },
    };
    const proposta = operacoes(editada).filter((o) => o.entidade === 'Proposta');
    const r = servidor.push(sessao, { idDispositivo: 'app-teste', operacoes: proposta });
    expect(r.resultados[0]).toMatchObject({ situacao: 'rejeitada', codigo: 'RN11' });
  });
});
