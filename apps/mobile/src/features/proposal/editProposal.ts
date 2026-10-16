import { router } from 'expo-router';

import type { Proposal } from '@/domain/entities';
import { proposalStatusLabels } from '@/domain/labels';
import { canTechnicianEdit } from '@/domain/services/proposalRules';
import { notify } from '@/utils/notify';

type LoadDraft = (proposal: Proposal, mode: 'edit' | 'duplicate') => void;

/** RN11: o técnico só edita propostas "Em elaboração" ou "Reaberta". */
export function editProposal(proposal: Proposal, load: LoadDraft): void {
  if (!canTechnicianEdit(proposal.status)) {
    notify(
      'Edição indisponível',
      `Propostas com status "${proposalStatusLabels[proposal.status]}" são editadas pelo gestor no painel web.`,
    );
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
