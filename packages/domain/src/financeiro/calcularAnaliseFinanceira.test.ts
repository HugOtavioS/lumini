/**
 * SCRUM-24 — Testes do cálculo financeiro (payback, ROI, economia acumulada).
 * O preço total usa um mock da interface da REV-1 (PrecoTotalProposta).
 */

import { describe, expect, it } from 'vitest';

import type { PrecoTotalProposta } from './PrecoTotalProposta';
import {
  calcularAnaliseFinanceira,
  EntradaAnaliseFinanceira,
  EntradaAnaliseFinanceiraInvalidaError,
  PREMISSAS_ECONOMICAS_PADRAO,
} from './calcularAnaliseFinanceira';

/** Mock da saída da REV-1 (precificação ainda não implementada). */
const precoMock = (valorTotal: number): PrecoTotalProposta => ({ valorTotal });

/** Cenário linear: R$ 1.000/ano de economia, sem reajuste nem degradação. */
function entradaLinear(valorTotal: number): EntradaAnaliseFinanceira {
  return {
    precoTotal: precoMock(valorTotal),
    geracaoAnualKwh: 1000,
    tarifaKwh: 1,
    premissas: { reajusteTarifarioAnual: 0, degradacaoAnualModulos: 0 },
  };
}

describe('calcularAnaliseFinanceira', () => {
  it('usa as premissas padrão documentadas (25 anos, 0,5% de degradação)', () => {
    const r = calcularAnaliseFinanceira({
      precoTotal: precoMock(20_000),
      geracaoAnualKwh: 6_000,
      tarifaKwh: 0.9,
    });
    expect(r.premissas).toEqual(PREMISSAS_ECONOMICAS_PADRAO);
    expect(r.serie).toHaveLength(25);
  });

  it('payback exato no fim de um ano', () => {
    const r = calcularAnaliseFinanceira(entradaLinear(10_000));
    expect(r.anoRetorno).toBe(10);
    expect(r.payback).toEqual({ anos: 10, meses: 0, totalMeses: 120 });
  });

  it('payback no meio do ano, com resolução mensal', () => {
    const r = calcularAnaliseFinanceira(entradaLinear(10_500));
    expect(r.anoRetorno).toBe(11);
    expect(r.payback).toEqual({ anos: 10, meses: 6, totalMeses: 126 });
  });

  it('arredonda o mês para cima (o retorno só se completa no mês seguinte)', () => {
    const r = calcularAnaliseFinanceira(entradaLinear(10_010));
    expect(r.payback).toEqual({ anos: 10, meses: 1, totalMeses: 121 });
  });

  it('calcula ROI e economia acumulada no horizonte', () => {
    const r = calcularAnaliseFinanceira(entradaLinear(10_000));
    expect(r.economiaAcumulada).toBeCloseTo(25_000, 6);
    expect(r.roiPercentual).toBeCloseTo(150, 6);
    expect(r.serie[24]).toMatchObject({ ano: 25, economiaAcumulada: 25_000, saldo: 15_000 });
  });

  it('aplica reajuste tarifário e degradação compostos ano a ano', () => {
    const r = calcularAnaliseFinanceira({
      precoTotal: precoMock(10_000),
      geracaoAnualKwh: 1000,
      tarifaKwh: 1,
      premissas: { reajusteTarifarioAnual: 0.05, degradacaoAnualModulos: 0.005, horizonteAnos: 3 },
    });

    expect(r.serie[0]!.economia).toBeCloseTo(1000, 6);
    expect(r.serie[1]!.geracaoKwh).toBeCloseTo(995, 6);
    expect(r.serie[1]!.tarifaKwh).toBeCloseTo(1.05, 6);
    expect(r.serie[1]!.economia).toBeCloseTo(1044.75, 6);
    expect(r.serie[2]!.economia).toBeCloseTo(990.025 * 1.1025, 6);
    expect(r.serie[2]!.economiaAcumulada).toBeCloseTo(
      1000 + 1044.75 + 990.025 * 1.1025,
      6,
    );
  });

  it('payback que excede 25 anos: payback e ano de retorno nulos, ROI negativo', () => {
    const r = calcularAnaliseFinanceira(entradaLinear(30_000));
    expect(r.payback).toBeNull();
    expect(r.anoRetorno).toBeNull();
    expect(r.economiaAcumulada).toBeCloseTo(25_000, 6);
    expect(r.roiPercentual).toBeCloseTo(-16.6667, 3);
    expect(r.serie.every((a) => a.saldo < 0)).toBe(true);
  });

  it('economia zero: nunca se paga e ROI é −100%', () => {
    const r = calcularAnaliseFinanceira({ ...entradaLinear(10_000), tarifaKwh: 0 });
    expect(r.payback).toBeNull();
    expect(r.roiPercentual).toBe(-100);
  });

  it('respeita horizonte configurável', () => {
    const r = calcularAnaliseFinanceira({
      ...entradaLinear(10_000),
      premissas: { reajusteTarifarioAnual: 0, degradacaoAnualModulos: 0, horizonteAnos: 5 },
    });
    expect(r.serie).toHaveLength(5);
    expect(r.payback).toBeNull();
  });

  it.each<[string, Partial<EntradaAnaliseFinanceira>]>([
    ['preço zero', { precoTotal: precoMock(0) }],
    ['preço negativo', { precoTotal: precoMock(-1) }],
    ['geração negativa', { geracaoAnualKwh: -1 }],
    ['tarifa NaN', { tarifaKwh: Number.NaN }],
    ['degradação 100%', { premissas: { degradacaoAnualModulos: 1 } }],
    ['reajuste −100%', { premissas: { reajusteTarifarioAnual: -1 } }],
    ['horizonte fracionário', { premissas: { horizonteAnos: 2.5 } }],
  ])('rejeita entrada inválida: %s', (_caso, alteracao) => {
    expect(() =>
      calcularAnaliseFinanceira({ ...entradaLinear(10_000), ...alteracao }),
    ).toThrow(EntradaAnaliseFinanceiraInvalidaError);
  });
});
