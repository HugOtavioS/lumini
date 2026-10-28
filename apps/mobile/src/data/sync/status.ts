import type { StatusProposta } from '@lumini/sync';

import type { ProposalStatus, SyncStatus } from '@/domain/entities';

// O app usa códigos (snake_case) nos status; o contrato da sincronização
// (@lumini/sync) e o Dicionário de Dados usam o texto exibido. Este é o único
// ponto de conversão entre os dois.

export const statusParaContrato: Readonly<Record<ProposalStatus, StatusProposta>> = {
  em_elaboracao: 'Em elaboração',
  gerada: 'Gerada',
  em_negociacao: 'Em negociação',
  reaberta: 'Reaberta',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
};

export const statusDoContrato: Readonly<Record<StatusProposta, ProposalStatus>> = {
  'Em elaboração': 'em_elaboracao',
  Gerada: 'gerada',
  'Em negociação': 'em_negociacao',
  Reaberta: 'reaberta',
  Aprovada: 'aprovada',
  Recusada: 'recusada',
};

/** `sync_status` da fila (@lumini/sync) → status exibido no app (RF16). */
export const syncStatusDaFila: Readonly<Record<'Pendente' | 'Sincronizado' | 'Erro', SyncStatus>> = {
  Pendente: 'pendente',
  Sincronizado: 'sincronizado',
  Erro: 'erro',
};
