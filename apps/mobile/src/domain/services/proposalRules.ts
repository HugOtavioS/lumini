import { STATUS_QUE_SINCRONIZAM, motivoBloqueio, podeEditar } from '@lumini/sync';

import { statusParaContrato } from '@/data/sync/status';
import type { ProposalStatus } from '../entities';
import { FREE_PLAN_MONTHLY_LIMIT } from '../parameters';

// RN07 e RN11 vêm do @lumini/sync (SCRUM-406): a mesma regra vale no app, na
// web e na API, então o app não mantém uma cópia própria.

/** RN11: o técnico edita apenas em "Em elaboração" e "Reaberta". */
export function canTechnicianEdit(status: ProposalStatus): boolean {
  return podeEditar('Tecnico', statusParaContrato[status]);
}

/** RN11: texto que explica por que o técnico não pode editar (null se pode). */
export function technicianEditBlockReason(status: ProposalStatus): string | null {
  return motivoBloqueio('Tecnico', statusParaContrato[status]);
}

/**
 * RN07: só sincroniza a partir de "Gerada". "Reaberta" também fica no aparelho:
 * o técnico está editando e a proposta só volta a subir quando for gerada de novo.
 */
export function isSyncable(status: ProposalStatus): boolean {
  return STATUS_QUE_SINCRONIZAM.includes(statusParaContrato[status]);
}

/** RN05 / RN11: gerar de novo uma proposta "Reaberta" não consome o limite do plano. */
export function countsTowardPlan(sourceStatus: ProposalStatus | null): boolean {
  return sourceStatus !== 'reaberta';
}

export function isPlanLimitReached(usedThisMonth: number, limit = FREE_PLAN_MONTHLY_LIMIT): boolean {
  return usedThisMonth >= limit;
}

export function proposalNumber(year: number, sequence: number): string {
  return `LMN-${year}-${String(sequence).padStart(4, '0')}`;
}
