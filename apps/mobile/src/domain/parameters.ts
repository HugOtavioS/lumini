// Parâmetros técnicos e comerciais da empresa. No app real chegam no pull do
// login (RF15) e são configurados pelo gestor (RF29); aqui ficam os padrões.

export const technicalParameters = {
  temperatureLossPct: 8,
  soilingLossPct: 2,
  cablingLossPct: 2,
  /** Sombreamento usado quando não há simulação nem valor informado (RF05, 3.1). */
  defaultShadingPct: 5,
  /** Módulo de referência para a estimativa do Resumo Técnico. */
  referenceModuleW: 550,
  moduleAreaM2: 2.6,
  /** Geração acima do consumo tolerada antes do alerta da Lei 14.300/2022. */
  oversizeTolerancePct: 20,
  /** Relação CC/CA máxima antes de alertar sobre inversor subdimensionado. */
  maxDcAcRatio: 1.25,
  minDcAcRatio: 0.8,
  /** Divergência entre kWp selecionado e dimensionado que exige confirmação (RF09, 4b). */
  selectedPowerTolerancePct: 20,
} as const;

export const commercialParameters: {
  electricalMaterialsPerKwp: number;
  includedPanelDistanceM: number;
  extraCablePerMeter: number;
  panelUpgradeFee: number;
  laborPerKwp: number;
  projectAndApprovalFee: number;
  freightFee: number;
  marginPct: number;
  priceAdjustLimitPct: number;
  defaultValidityDays: number;
  maxInstallments: number;
} = {
  electricalMaterialsPerKwp: 250,
  /**
   * SCRUM-375 — material elétrico complementar. Os R$/kWp acima cobrem até esta
   * distância entre o telhado e o quadro de carga; o que passar disso é cobrado
   * por metro (cabo CA, eletroduto e fixação). Valores provisórios, a validar
   * com a empresa e configuráveis pelo gestor (RF29).
   */
  includedPanelDistanceM: 10,
  extraCablePerMeter: 35,
  /** Adequação do quadro de carga (disjuntores, DPS, barramento), quando necessária. */
  panelUpgradeFee: 1200,
  laborPerKwp: 800,
  projectAndApprovalFee: 1200,
  freightFee: 800,
  /** Margem sobre serviços e materiais (RN03 / D10). */
  marginPct: 25,
  /** Limite de ajuste de preço por item na proposta (RN06). */
  priceAdjustLimitPct: 15,
  defaultValidityDays: 15,
  /** Condição de pagamento sugerida (SCRUM-399). */
  maxInstallments: 24,
};

/** Valores que o gestor configura no painel (SCRUM-433), vindos de GET /sync/parametros. */
export interface CompanyCommercialParameters {
  limiteAjustePrecoPerc: number;
  margemPadraoPerc: number;
  materiaisEletricosPorKwp: number;
  maoDeObraPorKwp: number;
  artHomologacaoPadrao: number;
  fretePadrao: number;
  validadePadraoDias: number;
}

/** Aplica os parâmetros da empresa baixados no login; valores inválidos são ignorados. */
export function applyCompanyParameters(p: Partial<CompanyCommercialParameters>): void {
  const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  if (ok(p.limiteAjustePrecoPerc)) commercialParameters.priceAdjustLimitPct = p.limiteAjustePrecoPerc;
  if (ok(p.margemPadraoPerc)) commercialParameters.marginPct = p.margemPadraoPerc;
  if (ok(p.materiaisEletricosPorKwp)) commercialParameters.electricalMaterialsPerKwp = p.materiaisEletricosPorKwp;
  if (ok(p.maoDeObraPorKwp)) commercialParameters.laborPerKwp = p.maoDeObraPorKwp;
  if (ok(p.artHomologacaoPadrao)) commercialParameters.projectAndApprovalFee = p.artHomologacaoPadrao;
  if (ok(p.fretePadrao)) commercialParameters.freightFee = p.fretePadrao;
  if (ok(p.validadePadraoDias) && p.validadePadraoDias > 0) commercialParameters.defaultValidityDays = Math.round(p.validadePadraoDias);
}

export const financialParameters = {
  annualTariffIncreasePct: 4,
  annualDegradationPct: 0.5,
  horizonYears: 25,
  /**
   * Fator de emissão de referência (kg CO₂/kWh) para o CO₂ evitado (RN10).
   * Valor provisório: validar com o fator médio anual do SIN publicado pelo MCTI.
   */
  emissionFactorKgPerKwh: 0.07,
} as const;

/** Limite do plano Freemium: 25 propostas por mês por empresa (RN05 / D11). */
export const FREE_PLAN_MONTHLY_LIMIT = 25;
/** Alerta preventivo a partir de 80% do limite (RF24, 2.1). */
export const PLAN_WARNING_RATIO = 0.8;
