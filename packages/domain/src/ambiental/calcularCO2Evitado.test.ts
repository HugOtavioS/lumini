/**
 * SCRUM-88 — Testes do cálculo de CO₂ evitado.
 * Os fatores usados aqui são valores de TESTE, não o fator oficial do SIN.
 */

import { describe, expect, it } from 'vitest';

import {
  calcularCO2Evitado,
  calcularSerieCO2Evitado,
  EntradaCO2InvalidaError,
  FATOR_EMISSAO_SIN,
} from './calcularCO2Evitado';

const FATOR_TESTE = 0.1; // kgCO₂/kWh, apenas para teste

describe('calcularCO2Evitado', () => {
  it('multiplica geração pelo fator de emissão', () => {
    expect(calcularCO2Evitado(6_000, FATOR_TESTE)).toBeCloseTo(600, 9);
  });

  it('geração zero não evita CO₂', () => {
    expect(calcularCO2Evitado(0, FATOR_TESTE)).toBe(0);
  });

  it.each([
    [-1, FATOR_TESTE],
    [Number.NaN, FATOR_TESTE],
    [1000, -0.1],
    [1000, Number.POSITIVE_INFINITY],
  ])('rejeita entrada inválida (%p, %p)', (geracao, fator) => {
    expect(() => calcularCO2Evitado(geracao, fator)).toThrow(EntradaCO2InvalidaError);
  });

  it('o fator oficial do SIN ainda é placeholder (pendência explícita)', () => {
    expect(FATOR_EMISSAO_SIN).toBeNull();
  });
});

describe('calcularSerieCO2Evitado', () => {
  it('gera 25 anos por padrão, com degradação de 0,5% a.a.', () => {
    const r = calcularSerieCO2Evitado({ geracaoAnualKwh: 1000, fatorEmissao: FATOR_TESTE });

    expect(r.horizonteAnos).toBe(25);
    expect(r.serie).toHaveLength(25);
    expect(r.co2AnoUmKg).toBeCloseTo(100, 9);
    expect(r.serie[1]!.co2EvitadoKg).toBeCloseTo(99.5, 9);
    expect(r.serie[24]!.geracaoKwh).toBeCloseTo(1000 * 0.995 ** 24, 9);
  });

  it('acumula ano a ano e converte o total para toneladas', () => {
    const r = calcularSerieCO2Evitado({
      geracaoAnualKwh: 1000,
      fatorEmissao: FATOR_TESTE,
      degradacaoAnual: 0,
      horizonteAnos: 10,
    });

    expect(r.serie.map((a) => a.co2AcumuladoKg)).toEqual(
      Array.from({ length: 10 }, (_, i) => expect.closeTo((i + 1) * 100, 9)),
    );
    expect(r.co2TotalKg).toBeCloseTo(1000, 9);
    expect(r.co2TotalToneladas).toBeCloseTo(1, 9);
  });

  it('total com degradação é a soma da progressão geométrica', () => {
    const d = 0.005;
    const r = calcularSerieCO2Evitado({ geracaoAnualKwh: 1000, fatorEmissao: FATOR_TESTE, degradacaoAnual: d });
    const esperado = (100 * (1 - (1 - d) ** 25)) / d;
    expect(r.co2TotalKg).toBeCloseTo(esperado, 6);
  });

  it('rejeita horizonte e degradação inválidos', () => {
    expect(() =>
      calcularSerieCO2Evitado({ geracaoAnualKwh: 1000, fatorEmissao: FATOR_TESTE, horizonteAnos: 0 }),
    ).toThrow(EntradaCO2InvalidaError);
    expect(() =>
      calcularSerieCO2Evitado({ geracaoAnualKwh: 1000, fatorEmissao: FATOR_TESTE, degradacaoAnual: 1 }),
    ).toThrow(EntradaCO2InvalidaError);
  });
});
