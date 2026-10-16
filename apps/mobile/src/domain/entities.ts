// Entidades do domínio (Dicionário de Dados v1.2 / Registro de Decisões D12, D18).

export type ConnectionType = 'monofasica' | 'bifasica' | 'trifasica';
export type RoofType = 'ceramica' | 'fibrocimento' | 'laje' | 'metalico';
export type Orientation = 'N' | 'NE' | 'L' | 'SE' | 'S' | 'SO' | 'O' | 'NO';
export type MeasurementSource = 'RA' | 'Manual';

/** Status comercial da proposta (D12). */
export type ProposalStatus =
  | 'em_elaboracao'
  | 'gerada'
  | 'em_negociacao'
  | 'reaberta'
  | 'aprovada'
  | 'recusada';

/** Status de sincronização, existe apenas no dispositivo (D12). */
export type SyncStatus = 'pendente' | 'sincronizado' | 'erro';

export type EquipmentCategory =
  | 'modulo'
  | 'inversor'
  | 'estrutura'
  | 'string_box'
  | 'cabos'
  | 'conectores';

export interface Client {
  name: string;
  whatsapp: string;
  email: string;
}

export interface Installation {
  cep: string;
  address: string;
  city: string;
  state: string;
  consumerUnit: string;
  monthlyConsumptionKwh: number;
  tariffPerKwh: number;
  connectionType: ConnectionType;
  roofType: RoofType;
}

export interface RoofSection {
  id: string;
  areaM2: number;
  inclinationDeg: number;
  orientation: Orientation;
}

export interface RoofMeasurement {
  source: MeasurementSource;
  sections: RoofSection[];
  measuredAt: string;
}

export interface Equipment {
  id: string;
  category: EquipmentCategory;
  name: string;
  manufacturer: string;
  price: number;
  warrantyYears: number;
  available: boolean;
  suppliers: string[];
  /** Potência nominal (módulos e inversores). */
  powerW?: number;
  /** Fases do inversor. */
  phases?: 1 | 3;
  /** Área ocupada por módulo. */
  areaM2?: number;
}

export interface ProposalItem {
  equipmentId: string;
  category: EquipmentCategory;
  name: string;
  quantity: number;
  /** Preço copiado do catálogo no momento da seleção (RF17, 3). */
  catalogPrice: number;
  /** Ajuste do preço somente na proposta (RF18 / RN06). */
  discountPct: number;
  markupPct: number;
  supplier: string;
  notes: string;
  powerW?: number;
  phases?: 1 | 3;
}

export type AlertLevel = 'error' | 'warning';

export interface DomainAlert {
  level: AlertLevel;
  code: string;
  message: string;
}

export interface LossBreakdown {
  temperaturePct: number;
  soilingPct: number;
  cablingPct: number;
  shadingPct: number;
  totalPct: number;
}

export interface SizingResult {
  hsp: number;
  hspSource: 'api' | 'contingencia';
  losses: LossBreakdown;
  requiredKwp: number;
  referenceModuleW: number;
  moduleCount: number;
  installedKwp: number;
  estimatedMonthlyKwh: number;
  requiredAreaM2: number;
  measuredAreaM2: number;
  alerts: DomainAlert[];
}

export interface PricingBreakdown {
  equipment: number;
  electricalMaterials: number;
  labor: number;
  projectAndApproval: number;
  freight: number;
  marginPct: number;
  margin: number;
  /** Desconto comercial: aplicado apenas pelo gestor no editor web (RN03). */
  commercialDiscount: number;
  total: number;
}

export interface ViabilityResult {
  monthlySavings: number;
  paybackYears: number;
  roiPct: number;
  savings25y: number;
  co2AvoidedTon: number;
  /** Economia acumulada ao fim de cada ano (índice 0 = ano 1). */
  cumulativeSavings: number[];
}

export interface Proposal {
  id: string;
  number: string;
  technicianId: string;
  client: Client;
  installation: Installation;
  measurement: RoofMeasurement;
  shadingPct: number;
  sizing: SizingResult;
  items: ProposalItem[];
  systemKwp: number;
  monthlyGenerationKwh: number;
  pricing: PricingBreakdown;
  viability: ViabilityResult;
  validityDays: number;
  status: ProposalStatus;
  syncStatus: SyncStatus;
  version: number;
  createdAt: string;
  generatedAt?: string;
  updatedAt: string;
  lastSyncAttemptAt?: string;
  syncError?: string;
}

export type UpgradeRequestStatus = 'pendente' | 'atendida' | 'recusada';

export interface UpgradeRequest {
  id: string;
  createdAt: string;
  status: UpgradeRequestStatus;
  syncStatus: SyncStatus;
  message?: string;
}

export interface Technician {
  id: string;
  name: string;
  email: string;
  role: 'tecnico';
  companyId: string;
}
