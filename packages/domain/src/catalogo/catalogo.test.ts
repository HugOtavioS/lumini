import { describe, expect, it } from 'vitest';
import { ErroValidacao } from '../erros';
import {
  calcularPrecoVenda,
  contarPorCategoria,
  filtrarCatalogo,
  listarFabricantes,
  normalizarTexto,
  validarEquipamento,
} from './catalogo';
import { criarCatalogoInicial, DADOS_CATALOGO_INICIAL } from './seed';
import { CATEGORIAS_EQUIPAMENTO, type Equipamento } from './tipos';

const ID_EMPRESA = '11111111-1111-4111-8111-111111111111';
const ID_USUARIO = '22222222-2222-4222-8222-222222222222';
const AGORA = '2026-09-23T12:00:00.000Z';

const catalogo = criarCatalogoInicial({ idEmpresa: ID_EMPRESA, idUsuario: ID_USUARIO, agora: AGORA });
const porModelo = (trecho: string): Equipamento => {
  const eq = catalogo.find((e) => e.modelo.includes(trecho));
  if (!eq) throw new Error(`Item ${trecho} não encontrado no seed`);
  return eq;
};

describe('seed do catálogo — SCRUM-76', () => {
  it('tem itens nas 6 categorias confirmadas no protótipo', () => {
    const contagem = contarPorCategoria(catalogo);
    expect(Object.keys(contagem)).toEqual([...CATEGORIAS_EQUIPAMENTO]);
    for (const categoria of CATEGORIAS_EQUIPAMENTO) {
      expect(contagem[categoria], categoria).toBeGreaterThan(0);
    }
    expect(catalogo).toHaveLength(15);
  });

  it('todo item passa na validação e tem fabricante e preço', () => {
    for (const eq of catalogo) {
      expect(validarEquipamento(eq), eq.modelo).toEqual([]);
      expect(eq.fabricante.length).toBeGreaterThan(0);
      expect(eq.precoCusto).toBeGreaterThan(0);
      expect(eq.precoVenda).toBeGreaterThan(eq.precoCusto);
    }
  });

  it('módulos e inversores têm potência; as demais categorias não', () => {
    for (const eq of catalogo) {
      if (eq.categoria === 'Módulo' || eq.categoria === 'Inversor') {
        expect(eq.potenciaW, eq.modelo).toBeGreaterThan(0);
      } else {
        expect(eq.potenciaW, eq.modelo).toBeNull();
      }
    }
  });

  it('IDs são UUIDs únicos e os campos de controle vêm das opções', () => {
    const ids = catalogo.map((e) => e.idEquipamento);
    expect(new Set(ids).size).toBe(ids.length);
    for (const eq of catalogo) {
      expect(eq.idEquipamento).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(eq.idEmpresa).toBe(ID_EMPRESA);
      expect(eq.updatedBy).toBe(ID_USUARIO);
      expect(eq.createdAt).toBe(AGORA);
      expect(eq.status).toBe('Ativo');
    }
  });

  it('dados dos módulos são coerentes com o datasheet (Vmp × Imp ≈ Pmax e eficiência ≈ P/área)', () => {
    for (const eq of catalogo.filter((e) => e.categoria === 'Módulo')) {
      const p = eq.potenciaW!;
      expect(Math.abs(eq.vmpV! * eq.impA! - p) / p, eq.modelo).toBeLessThan(0.01);
      const area = (eq.comprimentoMm! * eq.larguraMm!) / 1e6;
      expect(Math.abs((p / (area * 1000)) * 100 - eq.eficienciaPerc!), eq.modelo).toBeLessThan(0.3);
      expect(eq.vocV!).toBeGreaterThan(eq.vmpV!);
      expect(eq.iscA!).toBeGreaterThan(eq.impA!);
    }
  });

  it('inversores têm a faixa de MPPT dentro da tensão máxima de entrada', () => {
    for (const eq of catalogo.filter((e) => e.categoria === 'Inversor')) {
      expect(eq.faixaMpptMaxV!, eq.modelo).toBeLessThanOrEqual(eq.tensaoMaxEntradaV!);
      expect(eq.faixaMpptMinV!, eq.modelo).toBeLessThan(eq.faixaMpptMaxV!);
    }
  });

  it('cada item registra a fonte das especificações e do preço, com a data de referência', () => {
    expect(DADOS_CATALOGO_INICIAL.dataReferenciaPrecos).toBe('2026-09-23');
    for (const item of DADOS_CATALOGO_INICIAL.itens) {
      expect(item.fontes.especificacoes).toMatch(/^https:\/\//);
      expect(item.fontes.preco).toMatch(/^https:\/\//);
    }
    // As fontes não vão para o registro do banco.
    expect('fontes' in catalogo[0]!).toBe(false);
  });

  it('aplica a margem padrão (15 %) ou a informada', () => {
    expect(porModelo('CS6W-550MS').precoVenda).toBe(629.94); // 547,77 × 1,15
    const semMargem = criarCatalogoInicial({ idEmpresa: ID_EMPRESA, idUsuario: ID_USUARIO, margemPercentual: 0 });
    expect(semMargem[0]!.precoVenda).toBe(semMargem[0]!.precoCusto);
  });
});

describe('calcularPrecoVenda', () => {
  it('custo × (1 + margem), com 2 casas', () => {
    expect(calcularPrecoVenda(100, 15)).toBe(115);
    expect(calcularPrecoVenda(547.77, 15)).toBe(629.94);
    expect(calcularPrecoVenda(7.62, 0)).toBe(7.62);
  });
});

describe('validarEquipamento', () => {
  const modulo = porModelo('CS6W-550MS');
  const inversor = porModelo('MIN 5000TL-X');

  it('exige os dados elétricos do módulo', () => {
    const erros = validarEquipamento({ ...modulo, vmpV: null, coefTempVocPercC: 0.1, larguraMm: undefined });
    expect(erros.map((e) => e.campo)).toEqual(expect.arrayContaining(['vmpV', 'coefTempVocPercC', 'larguraMm']));
  });

  it('rejeita Vmp ≥ Voc e Imp ≥ Isc', () => {
    const erros = validarEquipamento({ ...modulo, vmpV: 50, impA: 15 });
    expect(erros.map((e) => e.campo)).toEqual(['vmpV', 'impA']);
  });

  it('exige a configuração de MPPT do inversor', () => {
    const erros = validarEquipamento({ ...inversor, qtdMppt: null, correnteMaxEntradaA: null });
    expect(erros.map((e) => e.campo)).toEqual(['qtdMppt', 'correnteMaxEntradaA']);
    expect(validarEquipamento({ ...inversor, fases: null }).map((e) => e.campo)).toEqual(['fases']);
  });

  it('aceita MPPTs diferentes entre si (configuracaoMppt)', () => {
    expect(validarEquipamento(porModelo('MIN 10000TL-X'))).toEqual([]);
  });

  it('rejeita preço ≤ 0 e preço de venda incoerente (RF25 4a)', () => {
    expect(validarEquipamento({ ...modulo, precoCusto: 0 }).map((e) => e.campo)).toContain('precoCusto');
    expect(validarEquipamento({ ...modulo, precoVenda: 1 }).map((e) => e.campo)).toEqual(['precoVenda']);
  });

  it('criarCatalogoInicial falha se o seed tiver item inválido', () => {
    const original = DADOS_CATALOGO_INICIAL.itens[0]!.vocV;
    DADOS_CATALOGO_INICIAL.itens[0]!.vocV = null;
    try {
      expect(() => criarCatalogoInicial({ idEmpresa: ID_EMPRESA, idUsuario: ID_USUARIO })).toThrow(ErroValidacao);
    } finally {
      DADOS_CATALOGO_INICIAL.itens[0]!.vocV = original;
    }
  });
});

describe('filtrarCatalogo — SCRUM-76 (marca, preço e disponibilidade)', () => {
  it('filtra por categoria', () => {
    const modulos = filtrarCatalogo(catalogo, { categoria: 'Módulo' });
    expect(modulos).toHaveLength(4);
    expect(modulos.every((e) => e.categoria === 'Módulo')).toBe(true);
  });

  it('filtra por marca sem diferenciar acentos e maiúsculas', () => {
    expect(filtrarCatalogo(catalogo, { fabricantes: ['staubli'] }).map((e) => e.fabricante)).toEqual(['Stäubli']);
    expect(filtrarCatalogo(catalogo, { fabricantes: ['GROWATT'] })).toHaveLength(3);
  });

  it('busca livre por fabricante e modelo', () => {
    expect(filtrarCatalogo(catalogo, { busca: 'min 5000' }).map((e) => e.modelo)).toEqual(['MIN 5000TL-X']);
    expect(filtrarCatalogo(catalogo, { busca: 'string box' })).toHaveLength(1);
    expect(filtrarCatalogo(catalogo, { busca: 'telhado ceramico' }).map((e) => e.fabricante)).toEqual(['Romagnole']);
  });

  it('filtra por faixa de potência e de preço', () => {
    const grandes = filtrarCatalogo(catalogo, { categoria: 'Módulo', potenciaMinW: 600 });
    // Ordem padrão: fabricante (Honor Solar, Osda Solar).
    expect(grandes.map((e) => [e.fabricante, e.potenciaW])).toEqual([
      ['Honor Solar', 700],
      ['Osda Solar', 610],
    ]);
    const baratos = filtrarCatalogo(catalogo, { precoMax: 20 });
    expect(baratos.map((e) => e.categoria).sort()).toEqual(['Cabos', 'Conectores']);
  });

  it('por padrão esconde itens ocultos (disponibilidade)', () => {
    const comOculto = catalogo.map((e) => (e.modelo === 'MIN 5000TL-X' ? { ...e, status: 'Oculto' as const } : e));
    expect(filtrarCatalogo(comOculto, { categoria: 'Inversor' })).toHaveLength(4);
    expect(filtrarCatalogo(comOculto, { categoria: 'Inversor', status: 'Todos' })).toHaveLength(5);
    expect(filtrarCatalogo(comOculto, { status: 'Oculto' }).map((e) => e.modelo)).toEqual(['MIN 5000TL-X']);
  });

  it('ordena por preço e por potência', () => {
    const porPreco = filtrarCatalogo(catalogo, { categoria: 'Módulo', ordenarPor: 'preco' }).map((e) => e.precoVenda);
    expect(porPreco).toEqual([...porPreco].sort((a, b) => a - b));
    const porPotenciaDesc = filtrarCatalogo(catalogo, { categoria: 'Inversor', ordenarPor: 'potencia', ordem: 'desc' });
    expect(porPotenciaDesc.map((e) => e.potenciaW)).toEqual([15000, 10000, 6000, 5000, 2000]);
  });

  it('não altera a lista original', () => {
    const copia = [...catalogo];
    filtrarCatalogo(catalogo, { ordenarPor: 'preco', ordem: 'desc' });
    expect(catalogo).toEqual(copia);
  });
});

describe('listarFabricantes e normalizarTexto', () => {
  it('lista marcas distintas em ordem alfabética', () => {
    expect(listarFabricantes(catalogo, 'Inversor')).toEqual(['Deye', 'Growatt', 'Hoymiles']);
    expect(listarFabricantes(catalogo)).toContain('Stäubli');
  });

  it('remove acentos e deixa minúsculo', () => {
    expect(normalizarTexto('  Módulo ÇÃO Stäubli ')).toBe('modulo cao staubli');
  });
});
