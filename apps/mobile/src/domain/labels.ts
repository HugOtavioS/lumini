import type {
  ConnectionType,
  EquipmentCategory,
  Orientation,
  ProposalStatus,
  RoofType,
  SyncStatus,
} from './entities';

export const connectionTypeLabels: Record<ConnectionType, string> = {
  monofasica: 'Monofásica',
  bifasica: 'Bifásica',
  trifasica: 'Trifásica',
};

export const roofTypeLabels: Record<RoofType, string> = {
  ceramica: 'Cerâmica',
  fibrocimento: 'Fibrocimento',
  laje: 'Laje',
  metalico: 'Metálico',
};

export const orientationLabels: Record<Orientation, string> = {
  N: 'Norte',
  NE: 'Nordeste',
  L: 'Leste',
  SE: 'Sudeste',
  S: 'Sul',
  SO: 'Sudoeste',
  O: 'Oeste',
  NO: 'Noroeste',
};

export const orientations = Object.keys(orientationLabels) as Orientation[];

export const categoryLabels: Record<EquipmentCategory, string> = {
  modulo: 'Módulo Solar',
  inversor: 'Inversor',
  estrutura: 'Estrutura',
  string_box: 'String Box',
  cabos: 'Cabos',
  conectores: 'Conectores',
};

export const proposalStatusLabels: Record<ProposalStatus, string> = {
  em_elaboracao: 'Em elaboração',
  gerada: 'Gerada',
  em_negociacao: 'Em negociação',
  reaberta: 'Reaberta',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
};

export const syncStatusLabels: Record<SyncStatus, string> = {
  pendente: 'Pendente',
  sincronizado: 'Sincronizado',
  erro: 'Erro',
};

export const brazilianStates = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];
