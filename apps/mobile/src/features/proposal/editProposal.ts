import { router } from 'expo-router';

import type { Proposal } from '@/domain/entities';
import { technicianEditBlockReason } from '@/domain/services/proposalRules';
import { notify } from '@/utils/notify';

type LoadDraft = (proposal: Proposal, mode: 'edit' | 'duplicate') => void;

/** RN11: o técnico só edita propostas "Em elaboração" ou "Reaberta". */
export function editProposal(proposal: Proposal, load: LoadDraft): void {
  const blockReason = technicianEditBlockReason(proposal.status);
  if (blockReason) {
    notify('Edição indisponível', blockReason);
    return;
  }
  load(proposal, 'edit');
  router.push('/instalacao/equipamentos');
}

/** Duplicar: nova instalação com os dados da proposta como ponto de partida. */
export function duplicateProposal(proposal: Proposal, load: LoadDraft): void {
  load(proposal, 'duplicate');
  router.push('/instalacao/novo-cliente');
}
