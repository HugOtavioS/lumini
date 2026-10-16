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

export const commercialParameters = {
  electricalMaterialsPerKwp: 250,
  laborPerKwp: 800,
  projectAndApprovalFee: 1200,
  freightFee: 800,
  /** Margem sobre serviços e materiais (RN03 / D10). */
  marginPct: 25,
  /** Limite de ajuste de preço por item na proposta (RN06). */
  priceAdjustLimitPct: 15,
  defaultValidityDays: 15,
} as const;

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
