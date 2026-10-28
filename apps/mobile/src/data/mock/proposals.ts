import type {
  Installation,
  Proposal,
  ProposalItem,
  ProposalStatus,
  RoofMeasurement,
  SyncStatus,
} from '@/domain/entities';
import { calculateProposal } from '@/domain/services/proposalCalculator';
import { proposalNumber } from '@/domain/services/proposalRules';
import { findEquipment } from './catalog';
import { mockTechnician } from './user';

// Histórico de exemplo, calculado com as mesmas regras do fluxo real.

function item(equipmentId: string, quantity: number, markupPct = 0): ProposalItem {
  const equipment = findEquipment(equipmentId);
  if (!equipment) throw new Error(`Equipamento ${equipmentId} fora do catálogo`);
  return {
    equipmentId,
    category: equipment.category,
    name: equipment.name,
    quantity,
    catalogPrice: equipment.price,
    discountPct: 0,
    markupPct,
    supplier: equipment.suppliers[0] ?? '',
    notes: '',
    powerW: equipment.powerW,
    phases: equipment.phases,
  };
}

function daysAgo(days: number, hour = 10, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

interface SeedInput {
  sequence: number;
  name: string;
  whatsapp: string;
  installation: Pick<Installation, 'address' | 'city' | 'state' | 'monthlyConsumptionKwh' | 'tariffPerKwh' | 'connectionType'> &
    Partial<Installation>;
  areaM2: number;
  items: ProposalItem[];
  status: ProposalStatus;
  syncStatus: SyncStatus;
  createdAt: string;
  syncError?: string;
}

function seed(input: SeedInput): Proposal {
  const installation: Installation = {
    cep: '74000-000',
    number: 'S/N',
    district: 'Centro',
    consumerUnit: String(10000000 + input.sequence * 7919),
    tariffModality: 'convencional',
    mainBreakerAmps: input.installation.connectionType === 'trifasica' ? 63 : 40,
    roofType: 'ceramica',
    roofToPanelDistanceM: 8,
    panelUpgradeNeeded: false,
    ...input.installation,
  };
  const measurement: RoofMeasurement = {
    source: 'RA',
    sections: [{ id: `s-${input.sequence}`, areaM2: input.areaM2, inclinationDeg: 15, orientation: 'N' }],
    measuredAt: input.createdAt,
  };
  const shadingPct = 5;
  const calculation = calculateProposal({ installation, measurement, shadingPct, items: input.items });

  return {
    id: `seed-${input.sequence}`,
    number: proposalNumber(new Date(input.createdAt).getFullYear(), input.sequence),
    technicianId: mockTechnician.id,
    client: {
      name: input.name,
      whatsapp: input.whatsapp,
      email: `${input.name.split(' ')[0].toLowerCase()}@email.com`,
    },
    installation,
    measurement,
    shadingPct,
    items: input.items,
    ...calculation,
    validityDays: 15,
    paymentCondition: { type: 'parcelado', installments: 12, downPaymentPct: 0 },
    status: input.status,
    syncStatus: input.syncStatus,
    version: 1,
    createdAt: input.createdAt,
    generatedAt: input.createdAt,
    updatedAt: input.createdAt,
    lastSyncAttemptAt: input.createdAt,
    syncError: input.syncError,
  };
}

export const seedProposals: Proposal[] = [
  seed({
    sequence: 47,
    name: 'Aline de Souza',
    whatsapp: '(62) 99876-5432',
    installation: { address: 'Rua das Palmeiras', number: '452', city: 'Goiânia', state: 'GO', monthlyConsumptionKwh: 450, tariffPerKwh: 0.85, connectionType: 'monofasica' },
    areaM2: 45,
    items: [item('mod-cs-550', 8), item('inv-growatt-5k', 1), item('est-ceramica', 8)],
    status: 'aprovada',
    syncStatus: 'sincronizado',
    createdAt: daysAgo(0, 14, 20),
  }),
  seed({
    sequence: 46,
    name: 'Condomínio Vista',
    whatsapp: '(62) 3241-7788',
    installation: { address: 'Av. T-63', number: '1200', city: 'Goiânia', state: 'GO', monthlyConsumptionKwh: 2600, tariffPerKwh: 0.82, connectionType: 'trifasica', roofType: 'laje' },
    areaM2: 180,
    items: [item('mod-cs-650', 30), item('inv-huawei-8k', 2), item('est-laje', 30), item('sb-clamper', 2)],
    status: 'em_negociacao',
    syncStatus: 'sincronizado',
    createdAt: daysAgo(1, 9, 40),
  }),
  seed({
    sequence: 45,
    name: 'Julia Silveira',
    whatsapp: '(62) 98111-2233',
    installation: { address: 'Rua 9', number: '88', city: 'Anápolis', state: 'GO', monthlyConsumptionKwh: 620, tariffPerKwh: 0.87, connectionType: 'bifasica' },
    areaM2: 50,
    items: [item('mod-jinko-580', 10), item('inv-growatt-6k', 1), item('est-ceramica', 10)],
    status: 'gerada',
    syncStatus: 'pendente',
    createdAt: daysAgo(3, 16, 5),
  }),
  seed({
    sequence: 44,
    name: 'Marcos Oliveira',
    whatsapp: '(62) 99222-4411',
    installation: { address: 'Rua C-137', number: '310', city: 'Goiânia', state: 'GO', monthlyConsumptionKwh: 700, tariffPerKwh: 0.85, connectionType: 'bifasica', roofType: 'fibrocimento' },
    areaM2: 60,
    items: [item('mod-cs-550', 12), item('inv-growatt-6k', 1), item('est-fibrocimento', 12)],
    status: 'aprovada',
    syncStatus: 'sincronizado',
    createdAt: daysAgo(6, 11, 15),
  }),
  seed({
    sequence: 43,
    name: 'Roberto Santos',
    whatsapp: '(62) 99655-1020',
    installation: { address: 'Rua 15', number: '45', city: 'Aparecida de Goiânia', state: 'GO', monthlyConsumptionKwh: 380, tariffPerKwh: 0.85, connectionType: 'monofasica' },
    areaM2: 30,
    items: [item('mod-trina-440', 8), item('inv-growatt-3k', 1), item('est-ceramica', 8)],
    status: 'recusada',
    syncStatus: 'sincronizado',
    createdAt: daysAgo(9, 15, 0),
  }),
  seed({
    sequence: 42,
    name: 'Clínica Dr. Silva',
    whatsapp: '(62) 3095-4400',
    installation: { address: 'Av. Anhanguera', number: '5400', city: 'Goiânia', state: 'GO', monthlyConsumptionKwh: 1300, tariffPerKwh: 0.83, connectionType: 'trifasica', roofType: 'metalico' },
    areaM2: 110,
    items: [item('mod-cs-650', 16), item('inv-huawei-8k', 1), item('est-metalico', 16)],
    status: 'aprovada',
    syncStatus: 'sincronizado',
    createdAt: daysAgo(12, 10, 30),
  }),
  seed({
    sequence: 41,
    name: 'Claudio Ramos',
    whatsapp: '(62) 99180-3377',
    installation: { address: 'Rua 1', number: '12', city: 'Trindade', state: 'GO', monthlyConsumptionKwh: 520, tariffPerKwh: 0.86, connectionType: 'monofasica' },
    areaM2: 40,
    items: [item('mod-cs-550', 9), item('inv-growatt-5k', 1), item('est-ceramica', 9)],
    status: 'gerada',
    syncStatus: 'erro',
    createdAt: daysAgo(15, 8, 50),
    syncError: 'Tempo de resposta da API excedido.',
  }),
];

/** Propostas geradas pela empresa no mês antes das de exemplo (contador do plano, RF15). */
export const seedCompanyProposalsThisMonth = 14;
