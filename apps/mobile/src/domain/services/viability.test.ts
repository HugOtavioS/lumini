import { describe, expect, it } from 'vitest';

import { analyzeViability } from './viability';

describe('analyzeViability (adaptador do @lumini/domain)', () => {
  it('calcula economia, payback em meses inteiros, ROI e CO₂ com as premissas do app', () => {
    const r = analyzeViability({ totalCost: 20_000, monthlyGenerationKwh: 500, tariffPerKwh: 0.9 });
    expect(r.monthlySavings).toBeCloseTo(450, 6);
    expect(r.cumulativeSavings).toHaveLength(25);
    // Payback em meses inteiros (RN04): ~3,5 anos para R$ 5.400/ano com reajuste de 4%.
    expect(Number.isInteger(r.paybackYears * 12)).toBe(true);
    expect(r.paybackYears).toBeGreaterThan(3);
    expect(r.paybackYears).toBeLessThan(4);
    expect(r.savings25y).toBe(r.cumulativeSavings[24]);
    expect(r.roiPct).toBeCloseTo(((r.savings25y - 20_000) / 20_000) * 100, 6);
    // 6.000 kWh/ano × 0,07 kg/kWh, com degradação de 0,5% a.a., em 25 anos ≈ 9,96 t.
    expect(r.co2AvoidedTon).toBeGreaterThan(9.5);
    expect(r.co2AvoidedTon).toBeLessThan(10.5);
  });

  it('devolve resultado neutro sem custo ou sem geração, em vez de lançar erro', () => {
    const semCusto = analyzeViability({ totalCost: 0, monthlyGenerationKwh: 500, tariffPerKwh: 0.9 });
    expect(semCusto.paybackYears).toBe(Number.POSITIVE_INFINITY);
    expect(semCusto.cumulativeSavings).toEqual([]);
    const semGeracao = analyzeViability({ totalCost: 10_000, monthlyGenerationKwh: 0, tariffPerKwh: 0.9 });
    expect(semGeracao.roiPct).toBe(0);
  });
});
