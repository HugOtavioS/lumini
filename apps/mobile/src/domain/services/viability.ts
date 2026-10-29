import { calcularAnaliseFinanceira, calcularSerieCO2Evitado } from '@lumini/domain';

import type { ViabilityResult } from '../entities';
import { financialParameters } from '../parameters';

interface ViabilityInput {
  totalCost: number;
  monthlyGenerationKwh: number;
  tariffPerKwh: number;
}

/**
 * Payback (RN04), ROI, economia em 25 anos e CO₂ evitado (RN10) — RF11.
 *
 * Adaptador: as fórmulas ficam no @lumini/domain (SCRUM-24 e SCRUM-88, feitas
 * pelo Misael). Aqui só entram as premissas do app (parameters.ts) e a saída é
 * convertida para o formato que as telas já usam.
 */
export function analyzeViability(input: ViabilityInput): ViabilityResult {
  const { annualTariffIncreasePct, annualDegradationPct, horizonYears, emissionFactorKgPerKwh } =
    financialParameters;

  const monthlySavings = input.monthlyGenerationKwh * input.tariffPerKwh;
  const geracaoAnualKwh = input.monthlyGenerationKwh * 12;

  // Sem custo ou sem geração não há análise possível: devolve um resultado neutro
  // (as funções do domínio recusam essas entradas com erro de validação).
  if (!(input.totalCost > 0) || !(geracaoAnualKwh > 0) || !(input.tariffPerKwh >= 0)) {
    return {
      monthlySavings,
      paybackYears: Number.POSITIVE_INFINITY,
      roiPct: 0,
      savings25y: 0,
      co2AvoidedTon: 0,
      cumulativeSavings: [],
    };
  }

  const degradacaoAnual = annualDegradationPct / 100;
  const financeiro = calcularAnaliseFinanceira({
    precoTotal: { valorTotal: input.totalCost },
    geracaoAnualKwh,
    tarifaKwh: input.tariffPerKwh,
    premissas: {
      reajusteTarifarioAnual: annualTariffIncreasePct / 100,
      degradacaoAnualModulos: degradacaoAnual,
      horizonteAnos: horizonYears,
    },
  });
  const ambiental = calcularSerieCO2Evitado({
    geracaoAnualKwh,
    fatorEmissao: emissionFactorKgPerKwh,
    degradacaoAnual,
    horizonteAnos: horizonYears,
  });

  return {
    monthlySavings,
    // O domínio resolve o payback em meses inteiros (RN04); as telas mostram anos.
    paybackYears: financeiro.payback ? financeiro.payback.totalMeses / 12 : Number.POSITIVE_INFINITY,
    roiPct: financeiro.roiPercentual,
    savings25y: financeiro.economiaAcumulada,
    co2AvoidedTon: ambiental.co2TotalToneladas,
    cumulativeSavings: financeiro.serie.map((ano) => ano.economiaAcumulada),
  };
}
