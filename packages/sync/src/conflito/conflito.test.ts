import { describe, expect, it } from 'vitest';
import { ErroValidacao } from '../erros';
import { EMPRESA, GESTORA_CARLA, TECNICO_ANA, TECNICO_BRUNO, cliente, proposta, versao } from '../testes/registros';
import { listarDiferencas, valorParaAuditoria } from './diferencas';
import { formatarDataHoraBrasilia, resolverConflito, type EntradaConflito } from './resolverConflito';

const T0 = '2026-10-18T12:00:00.000Z'; // versão baixada pelos dois aparelhos
const T1 = '2026-10-18T12:05:00.000Z'; // edição da Ana
const T2 = '2026-10-18T12:10:00.000Z'; // edição do Bruno
const AGORA = '2026-10-18T12:30:00.000Z'; // hora do servidor ao receber

let contador = 0;
const gerarId = () => `log-${(contador += 1)}`;

function entrada(parcial: Partial<EntradaConflito> & Pick<EntradaConflito, 'atual' | 'recebida'>): EntradaConflito {
  return { entidade: 'Proposta', baseUpdatedAt: null, agora: AGORA, origem: 'Mobile', gerarId, ...parcial };
}

const baixada = proposta('p1', 'i1', T0);

const daAna = proposta('p1', 'i1', T1, {
  valor_total: 22000,
  itens: [
    { id_item: 'p1-i1', id_equipamento: 'modulo-550', quantidade: 9, preco_unitario: 629.94 },
    { id_item: 'p1-i2', id_equipamento: 'inversor-5k', quantidade: 1, preco_unitario: 4513.75 },
  ],
}, TECNICO_ANA);

const doBruno = proposta('p1', 'i1', T2, {
  valor_total: 24500,
  condicao_pagamento: 'Parcelado',
  itens: [
    { id_item: 'p1-i1', id_equipamento: 'modulo-550', quantidade: 8, preco_unitario: 629.94 },
    { id_item: 'p1-i3', id_equipamento: 'inversor-6k', quantidade: 1, preco_unitario: 2180.71 },
  ],
}, TECNICO_BRUNO);

describe('resolverConflito — sem conflito', () => {
  it('registro novo: grava como chegou', () => {
    const r = resolverConflito(entrada({ atual: null, recebida: daAna }));
    expect(r).toMatchObject({ decisao: 'criar', conflito: false, vencedora: daAna, auditoria: [], aviso: null });
  });

  it('edição sobre a versão que está no servidor: aplica, sem auditoria nem aviso', () => {
    const r = resolverConflito(entrada({ atual: baixada, recebida: daAna, baseUpdatedAt: T0 }));
    expect(r).toMatchObject({ decisao: 'atualizar', conflito: false, vencedora: daAna, auditoria: [], aviso: null });
  });

  it('a ordem dos fatos vale mais que o relógio: aparelho atrasado ainda aplica a edição, logo depois da anterior', () => {
    const atrasada = { ...daAna, updatedAt: '2026-10-18T11:00:00.000Z' };
    const r = resolverConflito(entrada({ atual: baixada, recebida: atrasada, baseUpdatedAt: T0 }));
    expect(r.decisao).toBe('atualizar');
    expect(r.vencedora.updatedAt).toBe('2026-10-18T12:00:00.001Z');
    expect(r.observacoes[0]).toContain('atrasado');
  });

  it('reenvio do mesmo conteúdo (o aparelho não recebeu a confirmação): nada muda', () => {
    const r = resolverConflito(entrada({ atual: daAna, recebida: { ...daAna }, baseUpdatedAt: T0 }));
    expect(r).toMatchObject({ decisao: 'repetida', conflito: false, vencedora: daAna, auditoria: [], aviso: null });
  });
});

describe('resolverConflito — mesmo registro editado offline em dois aparelhos (SCRUM-83)', () => {
  it('chega a versão mais recente: ela vence, e cada campo sobrescrito vai para o log de auditoria', () => {
    // A Ana sincronizou primeiro (servidor = versão dela, de T1); o Bruno editou em T2 a partir de T0.
    const r = resolverConflito(entrada({ atual: daAna, recebida: doBruno, baseUpdatedAt: T0 }));
    expect(r.decisao).toBe('sobrescrever');
    expect(r.conflito).toBe(true);
    expect(r.vencedora).toEqual(doBruno);

    expect(r.auditoria.map((l) => [l.entidade, l.idRegistro, l.campo, l.valorAnterior, l.valorNovo])).toEqual([
      ['Proposta', 'p1', 'condicao_pagamento', null, 'Parcelado'],
      ['Proposta', 'p1', 'valor_total', '22000', '24500'],
      ['ItemProposta', 'p1-i1', 'quantidade', '9', '8'],
      ['ItemProposta', 'p1-i2', '(item removido)', '{"id_equipamento":"inversor-5k","id_item":"p1-i2","preco_unitario":4513.75,"quantidade":1}', null],
      ['ItemProposta', 'p1-i3', '(item incluído)', null, '{"id_equipamento":"inversor-6k","id_item":"p1-i3","preco_unitario":2180.71,"quantidade":1}'],
    ]);
    for (const linha of r.auditoria) {
      expect(linha).toMatchObject({ idEmpresa: EMPRESA, idUsuario: TECNICO_BRUNO, origem: 'Mobile', dataHora: AGORA });
      expect(linha.motivo).toContain('last-write-wins');
      expect(linha.idLog).toMatch(/^log-\d+$/);
    }
    expect(new Set(r.auditoria.map((l) => l.idLog)).size).toBe(r.auditoria.length);

    expect(r.aviso).toMatchObject({ idUsuario: TECNICO_ANA, sobrescritoPor: TECNICO_BRUNO, entidade: 'Proposta', idRegistro: 'p1' });
    expect(r.aviso?.mensagem).toBe(
      'Sua alteração na proposta, feita em 18/10/2026 às 09:05, foi substituída por uma versão mais recente, de 18/10/2026 às 09:10, ' +
        'feita em outro aparelho. Os valores anteriores ficaram no log de auditoria.',
    );
  });

  it('chega uma versão mais antiga: fica a do servidor, e o log guarda o que foi descartado', () => {
    // O Bruno sincronizou primeiro (servidor = T2); a Ana, que editou antes (T1), sincroniza depois.
    const r = resolverConflito(entrada({ atual: doBruno, recebida: daAna, baseUpdatedAt: T0 }));
    expect(r).toMatchObject({ decisao: 'manter', conflito: true, vencedora: doBruno });
    const valorTotal = r.auditoria.find((l) => l.campo === 'valor_total');
    expect(valorTotal).toMatchObject({ valorAnterior: '22000', valorNovo: '24500', idUsuario: TECNICO_BRUNO, origem: 'API' });
    expect(valorTotal?.motivo).toContain('foi descartada');
    expect(r.aviso).toMatchObject({ idUsuario: TECNICO_ANA, sobrescritoPor: TECNICO_BRUNO });
    expect(r.aviso?.mensagem).toContain('não foi aplicada porque já havia uma versão mais recente no servidor');
  });

  it('empate exato de horário: fica a versão do servidor (resultado igual em qualquer ordem de chegada)', () => {
    const outra = { ...daAna, updatedBy: TECNICO_BRUNO, dados: { ...daAna.dados, valor_total: 1 } };
    const r = resolverConflito(entrada({ atual: daAna, recebida: outra, baseUpdatedAt: T0 }));
    expect(r.decisao).toBe('manter');
    expect(r.auditoria[0]?.motivo).toContain('empate');
  });

  it('o gestor e o técnico editam a mesma proposta: vale a mesma regra (web × app)', () => {
    const doGestor = proposta('p1', 'i1', T2, { status_proposta: 'Em negociação', desconto_comercial_perc: 5 }, GESTORA_CARLA);
    const r = resolverConflito(entrada({ atual: daAna, recebida: doGestor, baseUpdatedAt: T0, origem: 'Web' }));
    expect(r.decisao).toBe('sobrescrever');
    expect(r.auditoria.find((l) => l.campo === 'status_proposta')).toMatchObject({ valorAnterior: 'Gerada', valorNovo: 'Em negociação', origem: 'Web' });
  });

  it('registro criado de novo no aparelho, mas que já existe no servidor, também passa pela regra', () => {
    const r = resolverConflito(entrada({ atual: daAna, recebida: doBruno, baseUpdatedAt: null }));
    expect(r.decisao).toBe('sobrescrever');
  });

  it('vale para as outras entidades sincronizadas (ex.: cadastro do cliente)', () => {
    const r = resolverConflito(
      entrada({ entidade: 'Cliente', atual: cliente('c1', T1, 'Maria Souza'), recebida: { ...cliente('c1', T2, 'Maria S. Souza'), updatedBy: TECNICO_BRUNO }, baseUpdatedAt: T0 }),
    );
    expect(r.auditoria).toHaveLength(1);
    expect(r.auditoria[0]).toMatchObject({ entidade: 'Cliente', campo: 'nome', valorAnterior: 'Maria Souza', valorNovo: 'Maria S. Souza' });
    expect(r.aviso?.mensagem).toContain('no cadastro do cliente');
  });
});

describe('relógio do aparelho', () => {
  it('relógio adiantado: a hora é trocada pela do servidor, e o aparelho não vence os conflitos seguintes para sempre', () => {
    const doFuturo = { ...doBruno, updatedAt: '2026-10-19T12:10:00.000Z' }; // um dia à frente
    const r = resolverConflito(entrada({ atual: daAna, recebida: doFuturo, baseUpdatedAt: T0 }));
    expect(r.decisao).toBe('sobrescrever');
    expect(r.vencedora.updatedAt).toBe(AGORA);
    expect(r.observacoes[0]).toContain('adiantado');

    // Edição legítima feita 5 min depois, em outro aparelho, ganha da versão corrigida.
    const depois = proposta('p1', 'i1', '2026-10-18T12:35:00.000Z', { valor_total: 25000 }, TECNICO_ANA);
    const seguinte = resolverConflito(entrada({ atual: r.vencedora, recebida: depois, baseUpdatedAt: T1, agora: '2026-10-18T12:40:00.000Z' }));
    expect(seguinte.decisao).toBe('sobrescrever');
  });

  it('dentro da tolerância de 2 min, a hora do aparelho é mantida', () => {
    const quase = { ...daAna, updatedAt: '2026-10-18T12:31:30.000Z' };
    const r = resolverConflito(entrada({ atual: null, recebida: quase }));
    expect(r.vencedora.updatedAt).toBe('2026-10-18T12:31:30.000Z');
    expect(r.observacoes).toEqual([]);
  });

  it('recusa updated_at inválido', () => {
    expect(() => resolverConflito(entrada({ atual: null, recebida: { ...daAna, updatedAt: 'ontem' } }))).toThrow(ErroValidacao);
    expect(() => resolverConflito(entrada({ atual: { ...daAna, updatedAt: '' }, recebida: doBruno }))).toThrow(ErroValidacao);
    expect(() => resolverConflito(entrada({ atual: null, recebida: daAna, agora: 'agora' }))).toThrow(ErroValidacao);
  });

  it('formata a data no horário de Brasília', () => {
    expect(formatarDataHoraBrasilia(Date.parse('2026-10-18T02:07:00Z'))).toBe('17/10/2026 às 23:07');
  });
});

describe('listarDiferencas', () => {
  it('ignora os campos de controle e compara listas e objetos pelo conteúdo, não pela ordem das chaves', () => {
    const a = versao('m1', T0, { obstaculos: [{ nome: 'Árvore', azimute: 35 }], updated_at: T0, sync_status: 'Pendente' });
    const b = versao('m1', T1, { obstaculos: [{ azimute: 35, nome: 'Árvore' }], updated_at: T1, sync_status: 'Sincronizado' });
    expect(listarDiferencas('Medicao', a, b)).toEqual([]);
    const c = versao('m1', T1, { obstaculos: [{ azimute: 40, nome: 'Árvore' }] });
    expect(listarDiferencas('Medicao', a, c)).toEqual([
      { entidade: 'Medicao', idRegistro: 'm1', campo: 'obstaculos', valorAnterior: '[{"azimute":35,"nome":"Árvore"}]', valorNovo: '[{"azimute":40,"nome":"Árvore"}]' },
    ]);
  });

  it('converte valores para texto do jeito que o log guarda', () => {
    expect(valorParaAuditoria(null)).toBeNull();
    expect(valorParaAuditoria(undefined)).toBeNull();
    expect(valorParaAuditoria(4.4)).toBe('4.4');
    expect(valorParaAuditoria(true)).toBe('true');
    expect(valorParaAuditoria('Gerada')).toBe('Gerada');
    expect(valorParaAuditoria({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });
});
