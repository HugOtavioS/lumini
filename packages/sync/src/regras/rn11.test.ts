import { describe, expect, it } from 'vitest';
import { STATUS_PROPOSTA, type StatusProposta } from '../contrato';
import {
  acoesDoGestor,
  motivoBloqueio,
  podeEditar,
  responsavelPelaEdicao,
  transicaoPermitida,
  verificarGravacaoRN11,
} from './rn11';

describe('SCRUM-406 — RN11: quem edita em cada status', () => {
  it('cada status tem no máximo um responsável; "Aprovada" e "Recusada" não têm nenhum', () => {
    const tabela = Object.fromEntries(STATUS_PROPOSTA.map((s) => [s, responsavelPelaEdicao(s)]));
    expect(tabela).toEqual({
      'Em elaboração': 'Tecnico',
      Reaberta: 'Tecnico',
      Gerada: 'Gestor',
      'Em negociação': 'Gestor',
      Aprovada: null,
      Recusada: null,
    });
  });

  it('podeEditar segue a tabela do Adendo 1 à ERS', () => {
    expect(podeEditar('Tecnico', 'Em elaboração')).toBe(true);
    expect(podeEditar('Tecnico', 'Gerada')).toBe(false);
    expect(podeEditar('Gestor', 'Reaberta')).toBe(false);
    expect(podeEditar('Gestor', 'Em negociação')).toBe(true);
    for (const papel of ['Tecnico', 'Gestor'] as const) {
      expect(podeEditar(papel, 'Aprovada')).toBe(false);
      expect(podeEditar(papel, 'Recusada')).toBe(false);
    }
  });

  it('transições: o técnico só gera; o gestor negocia, reabre, aprova ou recusa', () => {
    expect(transicaoPermitida('Tecnico', null, 'Gerada')).toBe(true);
    expect(transicaoPermitida('Tecnico', 'Reaberta', 'Gerada')).toBe(true);
    expect(transicaoPermitida('Tecnico', 'Reaberta', 'Aprovada')).toBe(false);
    expect(transicaoPermitida('Gestor', null, 'Gerada')).toBe(false);
    for (const para of ['Gerada', 'Em negociação', 'Reaberta', 'Aprovada', 'Recusada'] as StatusProposta[]) {
      expect(transicaoPermitida('Gestor', 'Gerada', para)).toBe(true);
    }
    expect(transicaoPermitida('Gestor', 'Gerada', 'Em elaboração')).toBe(false);
    expect(transicaoPermitida('Gestor', 'Aprovada', 'Reaberta')).toBe(false);
  });

  it('acoesDoGestor: botões do editor web por status', () => {
    expect(acoesDoGestor('Gerada')).toEqual(['editar', 'mover_negociacao', 'gerar_nova_versao', 'reabrir', 'aprovar', 'recusar']);
    expect(acoesDoGestor('Em negociação')).toEqual(['editar', 'gerar_nova_versao', 'reabrir', 'aprovar', 'recusar']);
    expect(acoesDoGestor('Reaberta')).toEqual([]);
    expect(acoesDoGestor('Aprovada')).toEqual([]);
  });

  it('motivoBloqueio explica a regra para quem não pode editar', () => {
    expect(motivoBloqueio('Tecnico', 'Reaberta')).toBeNull();
    expect(motivoBloqueio('Tecnico', 'Gerada')).toContain('gestor');
    expect(motivoBloqueio('Gestor', 'Recusada')).toContain('somente leitura');
  });
});

describe('SCRUM-406 — RN11 na gravação (API)', () => {
  it('edição normal: avalia o status atual', () => {
    expect(verificarGravacaoRN11({ papel: 'Tecnico', statusAtual: 'Reaberta', statusBase: 'Reaberta', statusNovo: 'Gerada' })).toEqual({ permitido: true });
    expect(verificarGravacaoRN11({ papel: 'Tecnico', statusAtual: 'Gerada', statusBase: 'Gerada', statusNovo: 'Gerada' })).toMatchObject({ permitido: false });
    expect(verificarGravacaoRN11({ papel: 'Gestor', statusAtual: 'Gerada', statusBase: 'Gerada', statusNovo: 'Aprovada' })).toEqual({ permitido: true });
  });

  it('edição concorrente: avalia o status em que o usuário começou a editar', () => {
    // Dois técnicos editaram a mesma proposta "Reaberta"; um deles já gerou.
    expect(verificarGravacaoRN11({ papel: 'Tecnico', statusAtual: 'Gerada', statusBase: 'Reaberta', statusNovo: 'Gerada' })).toEqual({ permitido: true });
  });

  it('proposta encerrada ou já em negociação não aceita edição atrasada', () => {
    expect(verificarGravacaoRN11({ papel: 'Gestor', statusAtual: 'Aprovada', statusBase: 'Gerada', statusNovo: 'Recusada' })).toMatchObject({ permitido: false });
    expect(verificarGravacaoRN11({ papel: 'Tecnico', statusAtual: 'Em negociação', statusBase: 'Reaberta', statusNovo: 'Gerada' })).toMatchObject({ permitido: false });
  });

  it('o gestor não cria proposta; status desconhecido é recusado', () => {
    expect(verificarGravacaoRN11({ papel: 'Gestor', statusAtual: null, statusBase: null, statusNovo: 'Gerada' })).toMatchObject({ permitido: false });
    expect(verificarGravacaoRN11({ papel: 'Tecnico', statusAtual: null, statusBase: null, statusNovo: 'Pronta' })).toMatchObject({ permitido: false });
  });
});
