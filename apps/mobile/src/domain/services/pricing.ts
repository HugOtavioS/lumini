import type { Installation, PricingBreakdown, ProposalItem } from '../entities';
import { commercialParameters } from '../parameters';

/** Preço unitário na proposta após desconto e markup do item (RF18). */
export function unitPrice(item: Pick<ProposalItem, 'catalogPrice' | 'discountPct' | 'markupPct'>): number {
  return item.catalogPrice * (1 - item.discountPct / 100) * (1 + item.markupPct / 100);
}

export function itemTotal(item: ProposalItem): number {
  return unitPrice(item) * item.quantity;
}

export function equipmentSubtotal(items: ProposalItem[]): number {
  return items.reduce((sum, item) => sum + itemTotal(item), 0);
}

/** Variação líquida do preço em relação ao catálogo, em %. */
export function netAdjustmentPct(discountPct: number, markupPct: number): number {
  return ((1 - discountPct / 100) * (1 + markupPct / 100) - 1) * 100;
}

/** O ajuste deve ficar dentro do limite configurado pela empresa (RN06). */
export function isAdjustmentWithinLimit(
  discountPct: number,
  markupPct: number,
  limitPct: number = commercialParameters.priceAdjustLimitPct,
): boolean {
  return Math.abs(netAdjustmentPct(discountPct, markupPct)) <= limitPct + 1e-9;
}

/**
 * SCRUM-375 — material elétrico complementar: cabo além da distância já
 * incluída nos R$/kWp e adequação do quadro de carga.
 */
export function electricalComplement(
  installation: Pick<Installation, 'roofToPanelDistanceM' | 'panelUpgradeNeeded'> | null | undefined,
): number {
  if (!installation) return 0;
  const p = commercialParameters;
  const extraMeters = Math.max(0, (installation.roofToPanelDistanceM ?? 0) - p.includedPanelDistanceM);
  return round2(extraMeters * p.extraCablePerMeter + (installation.panelUpgradeNeeded ? p.panelUpgradeFee : 0));
}

/**
 * Precificação (RN03 / D10): equipamentos + materiais elétricos + mão de obra
 * + ART/homologação + frete + margem − desconto comercial. A margem incide só
 * sobre serviços e materiais, pois o preço do equipamento já inclui a margem.
 */
export function priceProposal(
  items: ProposalItem[],
  systemKwp: number,
  commercialDiscount = 0,
  installation?: Pick<Installation, 'roofToPanelDistanceM' | 'panelUpgradeNeeded'> | null,
): PricingBreakdown {
  const p = commercialParameters;
  const equipment = equipmentSubtotal(items);
  const complement = electricalComplement(installation);
  const electricalMaterials = round2(p.electricalMaterialsPerKwp * systemKwp + complement);
  const labor = round2(p.laborPerKwp * systemKwp);
  const projectAndApproval = p.projectAndApprovalFee;
  const freight = p.freightFee;
  const margin = round2(((electricalMaterials + labor + projectAndApproval + freight) * p.marginPct) / 100);
  const total =
    equipment + electricalMaterials + labor + projectAndApproval + freight + margin - commercialDiscount;

  return {
    equipment,
    electricalMaterials,
    electricalComplement: complement,
    labor,
    projectAndApproval,
    freight,
    marginPct: p.marginPct,
    margin,
    commercialDiscount,
    total,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
