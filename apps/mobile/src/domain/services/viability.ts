import type { ViabilityResult } from '../entities';
import { financialParameters } from '../parameters';

interface ViabilityInput {
  totalCost: number;
  monthlyGenerationKwh: number;
  tariffPerKwh: number;
}

/** Payback (RN04), ROI, economia em 25 anos e CO₂ evitado (RN10) — RF11. */
export function analyzeViability(input: ViabilityInput): ViabilityResult {
  const { annualTariffIncreasePct, annualDegradationPct, horizonYears, emissionFactorKgPerKwh } =
    financialParameters;

  const monthlySavings = input.monthlyGenerationKwh * input.tariffPerKwh;
  const cumulativeSavings: number[] = [];
  let cumulative = 0;
  let generatedKwh = 0;
  let paybackYears = Number.POSITIVE_INFINITY;

  for (let year = 1; year <= horizonYears; year++) {
    const yearGeneration = input.monthlyGenerationKwh * 12 * (1 - annualDegradationPct / 100) ** (year - 1);
    const yearTariff = input.tariffPerKwh * (1 + annualTariffIncreasePct / 100) ** (year - 1);
    const yearSavings = yearGeneration * yearTariff;

    if (!Number.isFinite(paybackYears) && cumulative + yearSavings >= input.totalCost) {
      paybackYears = year - 1 + (input.totalCost - cumulative) / yearSavings;
    }
    cumulative += yearSavings;
    generatedKwh += yearGeneration;
    cumulativeSavings.push(cumulative);
  }

  return {
    monthlySavings,
    paybackYears,
    roiPct: input.totalCost > 0 ? ((cumulative - input.totalCost) / input.totalCost) * 100 : 0,
    savings25y: cumulative,
    co2AvoidedTon: (generatedKwh * emissionFactorKgPerKwh) / 1000,
    cumulativeSavings,
  };
}
