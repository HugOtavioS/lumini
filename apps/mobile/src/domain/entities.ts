// Entidades do domínio (Dicionário de Dados v1.2 / Registro de Decisões D12, D18).

export type ConnectionType = 'monofasica' | 'bifasica' | 'trifasica';
/** Modalidade tarifária da UC (SCRUM-371; Dicionário 3.2 `modalidade_tarifaria`). */
export type TariffModality = 'convencional' | 'branca';
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
  /** SCRUM-372: obrigatório (busca de HSP e PDF). Só dígitos ou "00000-000". */
  cep: string;
  /** Logradouro (rua/avenida). */
  address: string;
  number: string;
  district: string;
  city: string;
  state: string;
  /** Nº da instalação na concessionária (UC/NIS) — SCRUM-371. */
  consumerUnit: string;
  monthlyConsumptionKwh: number;
  tariffPerKwh: number;
  /** SCRUM-371. */
  tariffModality: TariffModality;
  connectionType: ConnectionType;
  /** Amperagem do disjuntor principal (A) — SCRUM-371. */
  mainBreakerAmps: number;
  roofType: RoofType;
  /** Distância do telhado ao quadro de carga (m); null se não informada — SCRUM-375. */
  roofToPanelDistanceM: number | null;
  /** O quadro de carga precisa de adequação — SCRUM-375. */
  panelUpgradeNeeded: boolean;
}

/** Condição de pagamento da proposta (SCRUM-399; Dicionário 7.1 `condicao_pagamento`). */
export type PaymentConditionType = 'a_vista' | 'parcelado' | 'entrada_parcelas';

export interface PaymentCondition {
  type: PaymentConditionType;
  /** Número de parcelas ("parcelado" e "entrada_parcelas"). */
  installments: number;
  /** Entrada, em % do total ("entrada_parcelas"). */
  downPaymentPct: number;
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
  /** Materiais elétricos, já somado o complemento abaixo (RN03). */
  electricalMaterials: number;
  /** Parte dos materiais elétricos causada pela distância telhado–quadro e pela adequação do quadro (SCRUM-375). */
  electricalComplement: number;
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
  /** SCRUM-399: refletida no detalhe, no compartilhamento e no PDF. */
  paymentCondition: PaymentCondition;
  status: ProposalStatus;
  syncStatus: SyncStatus;
  version: number;
  /**
   * `updated_at` de cada registro na última versão confirmada pelo servidor,
   * por operação da fila (`Proposta:<id>`, `Cliente:<id>`...). É a versão-base
   * enviada no próximo push (SCRUM-83 / RN11).
   */
  syncBase?: Record<string, string>;
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
  /** E-mail, papel e empresa: só o gestor altera (RF14, 1.1). */
  email: string;
  role: 'tecnico';
  companyId: string;
  companyName: string;
  /** Editáveis pelo técnico no perfil (RF14 / SCRUM-378). */
  phone: string;
  photoUri: string | null;
}

/** Itens da tela "Notificações" do Perfil (SCRUM-401). */
export type AppNotificationKind = 'upgrade' | 'proposta' | 'sincronizacao' | 'sistema';

export interface AppNotification {
  id: string;
  kind: AppNotificationKind;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  /** Proposta relacionada, para abrir o detalhe. */
  proposalId?: string;
}

/** Preferências do técnico (SCRUM-402). */
export interface AppPreferences {
  /** Modo Leve: medição manual, sem RA (RF19). */
  lightMode: boolean;
  /** Avisar quando uma proposta não sobe depois de várias tentativas (RF16, 1a). */
  notifySyncFailures: boolean;
  /** Avisar quando o gestor responde a uma solicitação ou reabre uma proposta. */
  notifyManagerUpdates: boolean;
  /** Verificar sozinho, quando online, se a base de contingência tem versão nova (SCRUM-85). */
  autoUpdateContingency: boolean;
}
