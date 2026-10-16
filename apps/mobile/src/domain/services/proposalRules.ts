import type { ProposalStatus } from '../entities';
import { FREE_PLAN_MONTHLY_LIMIT } from '../parameters';

/** RN11: o técnico edita apenas em "Em elaboração" e "Reaberta". */
export function canTechnicianEdit(status: ProposalStatus): boolean {
  return status === 'em_elaboracao' || status === 'reaberta';
}

/** RN07: só sincroniza a partir de "Gerada". */
export function isSyncable(status: ProposalStatus): boolean {
  return status !== 'em_elaboracao';
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
