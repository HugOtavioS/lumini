import type {
  Installation,
  PricingBreakdown,
  ProposalItem,
  RoofMeasurement,
  SizingResult,
  ViabilityResult,
} from '../entities';
import { getClimateData } from './climate';
import { checkCompatibility } from './compatibility';
import { priceProposal } from './pricing';
import { monthlyGeneration, sizeSystem } from './sizing';
import { analyzeViability } from './viability';

export interface ProposalCalculation {
  sizing: SizingResult;
  systemKwp: number;
  monthlyGenerationKwh: number;
  pricing: PricingBreakdown;
  viability: ViabilityResult;
}

interface CalculationInput {
  installation: Installation;
  measurement: RoofMeasurement;
  shadingPct: number;
  items: ProposalItem[];
}

/** Encadeia RF07 → RF09 → RF10 → RF11 a partir dos dados da proposta. */
export function calculateProposal(input: CalculationInput): ProposalCalculation {
  const climate = getClimateData(input.installation.state);
  const sizing = sizeSystem({
    monthlyConsumptionKwh: input.installation.monthlyConsumptionKwh,
    hsp: climate.hsp,
    hspSource: climate.source,
    shadingPct: input.shadingPct,
    measurement: input.measurement,
  });

  const { selectedKwp } = checkCompatibility(input.items, sizing.requiredKwp, input.installation.connectionType);
  const systemKwp = selectedKwp > 0 ? selectedKwp : sizing.installedKwp;
  const monthlyGenerationKwh = monthlyGeneration(systemKwp, sizing.hsp, sizing.losses.totalPct);
  const pricing = priceProposal(input.items, systemKwp);
  const viability = analyzeViability({
    totalCost: pricing.total,
    monthlyGenerationKwh,
    tariffPerKwh: input.installation.tariffPerKwh,
  });

  return { sizing, systemKwp, monthlyGenerationKwh, pricing, viability };
}
