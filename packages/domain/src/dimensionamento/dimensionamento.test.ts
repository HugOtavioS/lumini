import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErroValidacao } from '../erros';
import { calcularPerdasTotais, type ComponentesPerdas } from './perdas';
import {
  calcularGeracaoEstimada,
  calcularQuantidadeModulos,
  dimensionarSistema,
  validarEntradaDimensionamento,
} from './dimensionamento';

const PERDAS_REFERENCIA: ComponentesPerdas = {
  temperaturaPerc: 10,
  sujeiraPerc: 3,
  cabeamentoPerc: 2,
  sombreamentoPerc: 3,
};

function capturarErro(fn: () => unknown): ErroValidacao {
  try {
    fn();
  } catch (e) {
    if (e instanceof ErroValidacao) return e;
    throw e;
  }
  throw new Error('Era esperado um ErroValidacao');
}

describe('calcularPerdasTotais (SCRUM-12 / SCRUM-74)', () => {
  it('soma os componentes no método aditivo (padrão do Dicionário de Dados)', () => {
    const r = calcularPerdasTotais(PERDAS_REFERENCIA);
    expect(r.totalPerc).toBe(18);
    expect(r.fatorDesempenho).toBeCloseTo(0.82, 12);
    expect(r.metodo).toBe('aditivo');
  });

  it('combina os componentes no método multiplicativo', () => {
    // 1 − 0,90 × 0,97 × 0,98 × 0,97 = 0,1701262
    const r = calcularPerdasTotais(PERDAS_REFERENCIA, 'multiplicativo');
    expect(r.totalPerc).toBe(17.01);
    expect(r.fatorDesempenho).toBeCloseTo(0.8298738, 7);
  });

  it('aceita perdas zeradas', () => {
    const r = calcularPerdasTotais({ temperaturaPerc: 0, sujeiraPerc: 0, cabeamentoPerc: 0, sombreamentoPerc: 0 });
    expect(r.totalPerc).toBe(0);
    expect(r.fatorDesempenho).toBe(1);
  });

  it('rejeita componente negativo, ≥ 100 % ou não numérico', () => {
    const erro = capturarErro(() =>
      calcularPerdasTotais({ temperaturaPerc: -1, sujeiraPerc: 100, cabeamentoPerc: Number.NaN, sombreamentoPerc: 3 }),
    );
    expect(erro.erros.map((e) => e.campo)).toEqual(['temperaturaPerc', 'sujeiraPerc', 'cabeamentoPerc']);
  });

  it('rejeita soma de perdas ≥ 100 % no método aditivo', () => {
    const erro = capturarErro(() =>
      calcularPerdasTotais({ temperaturaPerc: 40, sujeiraPerc: 30, cabeamentoPerc: 20, sombreamentoPerc: 10 }),
    );
    expect(erro.erros[0]?.campo).toBe('perdas');
  });

  it('no método multiplicativo, perdas grandes nunca chegam a 100 %', () => {
    const r = calcularPerdasTotais(
      { temperaturaPerc: 40, sujeiraPerc: 30, cabeamentoPerc: 20, sombreamentoPerc: 10 },
      'multiplicativo',
    );
    expect(r.totalPerc).toBeLessThan(100);
  });
});

describe('dimensionarSistema — RN01 (SCRUM-12)', () => {
  it('calcula o kWp pelo caso de referência: 500 kWh/mês, HSP 4,9, perdas 18 %', () => {
    // kWp = 500 / (4,9 × 30 × 0,82) = 500 / 120,54 = 4,148…
    const r = dimensionarSistema({ consumoMensalKwh: 500, hspMedio: 4.9, perdas: PERDAS_REFERENCIA });
    expect(r.potenciaNecessariaKwp).toBe(4.15);
    expect(r.perdasTotaisPerc).toBe(18);
    expect(r.fatorDesempenho).toBeCloseTo(0.82, 12);
  });

  it('com a potência necessária, a geração estimada é igual ao consumo', () => {
    const r = dimensionarSistema({ consumoMensalKwh: 500, hspMedio: 4.9, perdas: PERDAS_REFERENCIA });
    expect(r.geracao.mediaMensalKwh).toBe(500);
    expect(r.geracao.anualKwh).toBe(6000);
  });

  it('respeita o método multiplicativo', () => {
    // 500 / (4,9 × 30 × 0,8298738) = 4,0986…
    const r = dimensionarSistema({
      consumoMensalKwh: 500,
      hspMedio: 4.9,
      perdas: PERDAS_REFERENCIA,
      metodoPerdas: 'multiplicativo',
    });
    expect(r.potenciaNecessariaKwp).toBe(4.1);
    expect(r.premissas.metodoPerdas).toBe('multiplicativo');
  });

  it('segue a proporcionalidade da fórmula (dobrar o consumo dobra o kWp)', () => {
    const base = dimensionarSistema({ consumoMensalKwh: 350, hspMedio: 5.2, perdas: PERDAS_REFERENCIA });
    const dobro = dimensionarSistema({ consumoMensalKwh: 700, hspMedio: 5.2, perdas: PERDAS_REFERENCIA });
    expect(dobro.potenciaNecessariaKwp).toBeCloseTo(base.potenciaNecessariaKwp * 2, 1);
  });

  it('gera a estimativa mês a mês quando o HSP mensal é informado', () => {
    const hspMensal = [5.6, 5.8, 5.0, 4.6, 3.9, 3.7, 3.9, 4.7, 4.8, 5.2, 5.4, 5.5];
    const hspMedio = hspMensal.reduce((a, b) => a + b, 0) / 12;
    const r = dimensionarSistema({ consumoMensalKwh: 400, hspMedio, hspMensal, perdas: PERDAS_REFERENCIA });
    expect(r.geracao.porMesKwh).toHaveLength(12);
    const soma = r.geracao.porMesKwh!.reduce((a, b) => a + b, 0);
    // Na convenção de 30 dias, a soma dos meses bate com a geração anual
    // (a diferença vem só do arredondamento de cada mês a 0,1 kWh).
    expect(Math.abs(soma - r.geracao.anualKwh)).toBeLessThanOrEqual(0.6);
    // Janeiro (HSP 5,6) gera mais que junho (HSP 3,7).
    expect(r.geracao.porMesKwh![0]!).toBeGreaterThan(r.geracao.porMesKwh![5]!);
  });

  it.each([
    [{ consumoMensalKwh: 0 }, 'consumoMensalKwh'],
    [{ consumoMensalKwh: -50 }, 'consumoMensalKwh'],
    [{ consumoMensalKwh: Number.NaN }, 'consumoMensalKwh'],
    [{ hspMedio: 0 }, 'hspMedio'],
    [{ hspMedio: 15 }, 'hspMedio'],
    [{ hspMedio: Number.NaN }, 'hspMedio'],
    [{ hspMensal: [5, 5, 5] }, 'hspMensal'],
    [{ diasPorMes: 0 }, 'diasPorMes'],
  ])('rejeita entrada inválida %o', (parcial, campo) => {
    const entrada = { consumoMensalKwh: 500, hspMedio: 4.9, perdas: PERDAS_REFERENCIA, ...parcial };
    expect(validarEntradaDimensionamento(entrada).map((e) => e.campo)).toContain(campo);
    const erro = capturarErro(() => dimensionarSistema(entrada));
    expect(erro.erros.map((e) => e.campo)).toContain(campo);
  });

  it('rejeita perdas de 100 % (caso-limite pedido no SCRUM-104)', () => {
    const erro = capturarErro(() =>
      dimensionarSistema({
        consumoMensalKwh: 500,
        hspMedio: 4.9,
        perdas: { temperaturaPerc: 100, sujeiraPerc: 0, cabeamentoPerc: 0, sombreamentoPerc: 0 },
      }),
    );
    expect(erro.erros[0]?.campo).toBe('temperaturaPerc');
  });
});

describe('calcularGeracaoEstimada — sistema selecionado', () => {
  it('estima a geração de 9 módulos de 575 W (5,175 kWp)', () => {
    // 5,175 × 4,9 × 30 × 0,82 = 623,79 kWh/mês
    const g = calcularGeracaoEstimada({ potenciaKwp: 5.175, hspMedio: 4.9, perdas: PERDAS_REFERENCIA });
    expect(g.mediaMensalKwh).toBe(623.8);
    expect(g.anualKwh).toBe(7485.5);
  });

  it('rejeita potência zero', () => {
    const erro = capturarErro(() => calcularGeracaoEstimada({ potenciaKwp: 0, hspMedio: 4.9, perdas: PERDAS_REFERENCIA }));
    expect(erro.erros[0]?.campo).toBe('potenciaKwp');
  });
});

describe('calcularQuantidadeModulos', () => {
  it('arredonda para cima', () => {
    expect(calcularQuantidadeModulos(4.15, 575)).toEqual({ quantidade: 8, potenciaInstaladaKwp: 4.6 });
    expect(calcularQuantidadeModulos(4.61, 575)).toEqual({ quantidade: 9, potenciaInstaladaKwp: 5.18 });
  });

  it('não acrescenta módulo por erro de ponto flutuante quando a divisão é exata', () => {
    expect(calcularQuantidadeModulos(4.6, 575).quantidade).toBe(8);
    expect(calcularQuantidadeModulos(0.3 * 3, 300).quantidade).toBe(3);
  });

  it('rejeita potências inválidas', () => {
    const erro = capturarErro(() => calcularQuantidadeModulos(0, -1));
    expect(erro.erros.map((e) => e.campo)).toEqual(['potenciaNecessariaKwp', 'potenciaModuloW']);
  });
});

describe('RNF01 — cálculo no dispositivo, sem rede e rápido', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('não faz nenhuma chamada de rede', () => {
    const fetchEspiao = vi.fn(() => {
      throw new Error('rede não deveria ser usada');
    });
    vi.stubGlobal('fetch', fetchEspiao);
    vi.stubGlobal('XMLHttpRequest', vi.fn());

    const r = dimensionarSistema({ consumoMensalKwh: 500, hspMedio: 4.9, perdas: PERDAS_REFERENCIA });
    calcularGeracaoEstimada({ potenciaKwp: 5.175, hspMedio: 4.9, perdas: PERDAS_REFERENCIA });

    expect(r.potenciaNecessariaKwp).toBe(4.15);
    expect(fetchEspiao).not.toHaveBeenCalled();
  });
});
