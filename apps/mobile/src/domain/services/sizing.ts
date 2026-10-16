import type { DomainAlert, LossBreakdown, RoofMeasurement, SizingResult } from '../entities';
import { technicalParameters } from '../parameters';
import { formatNumber } from '@/utils/format';

const DAYS_PER_MONTH = 30;

/** Perdas combinadas de forma multiplicativa (RN01). */
export function computeLosses(shadingPct: number): LossBreakdown {
  const { temperatureLossPct, soilingLossPct, cablingLossPct } = technicalParameters;
  const efficiency = [temperatureLossPct, soilingLossPct, cablingLossPct, shadingPct].reduce(
    (acc, loss) => acc * (1 - loss / 100),
    1,
  );
  return {
    temperaturePct: temperatureLossPct,
    soilingPct: soilingLossPct,
    cablingPct: cablingLossPct,
    shadingPct,
    totalPct: (1 - efficiency) * 100,
  };
}

/** kWp = Consumo / (HSP × 30 × (1 − Perdas)) — RN01. */
export function requiredKwp(monthlyConsumptionKwh: number, hsp: number, lossesPct: number): number {
  return monthlyConsumptionKwh / (hsp * DAYS_PER_MONTH * (1 - lossesPct / 100));
}

export function monthlyGeneration(kwp: number, hsp: number, lossesPct: number): number {
  return kwp * hsp * DAYS_PER_MONTH * (1 - lossesPct / 100);
}

export function totalArea(measurement: RoofMeasurement): number {
  return measurement.sections.reduce((sum, section) => sum + section.areaM2, 0);
}

interface SizingInput {
  monthlyConsumptionKwh: number;
  hsp: number;
  hspSource: SizingResult['hspSource'];
  shadingPct: number;
  measurement: RoofMeasurement;
}

/** Dimensionamento técnico (RF07). */
export function sizeSystem(input: SizingInput): SizingResult {
  const { referenceModuleW, moduleAreaM2, oversizeTolerancePct } = technicalParameters;
  const losses = computeLosses(input.shadingPct);
  const kwp = requiredKwp(input.monthlyConsumptionKwh, input.hsp, losses.totalPct);
  const moduleCount = Math.max(1, Math.ceil((kwp * 1000) / referenceModuleW));
  const installedKwp = (moduleCount * referenceModuleW) / 1000;
  const estimatedMonthlyKwh = monthlyGeneration(installedKwp, input.hsp, losses.totalPct);
  const requiredAreaM2 = moduleCount * moduleAreaM2;
  const measuredAreaM2 = totalArea(input.measurement);

  const alerts: DomainAlert[] = [];
  const excessPct = (estimatedMonthlyKwh / input.monthlyConsumptionKwh - 1) * 100;
  if (excessPct > oversizeTolerancePct) {
    alerts.push({
      level: 'error',
      code: 'superdimensionado',
      message: `Sistema superdimensionado: a geração estimada (${formatNumber(estimatedMonthlyKwh, 0)} kWh/mês) excede o consumo informado (${formatNumber(input.monthlyConsumptionKwh, 0)} kWh/mês) em ${formatNumber(excessPct, 0)}%. A concessionária pode recusar a homologação conforme a Lei 14.300/2022. Ajuste o número de módulos.`,
    });
  }
  if (requiredAreaM2 > measuredAreaM2) {
    alerts.push({
      level: 'warning',
      code: 'area_insuficiente',
      message: `Atenção: o kit dimensionado requer ${formatNumber(requiredAreaM2, 0)} m², mas o telhado medido tem apenas ${formatNumber(measuredAreaM2, 0)} m². Considere placas de maior potência ou adicione outra seção do telhado.`,
    });
  }

  return {
    hsp: input.hsp,
    hspSource: input.hspSource,
    losses,
    requiredKwp: kwp,
    referenceModuleW,
    moduleCount,
    installedKwp,
    estimatedMonthlyKwh,
    requiredAreaM2,
    measuredAreaM2,
    alerts,
  };
}
