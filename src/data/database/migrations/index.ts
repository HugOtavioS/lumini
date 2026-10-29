/**
 * Migrações adicionadas na Sprint 3 (SCRUM-17, SCRUM-18).
 *
 * ⚠️ PENDÊNCIA (merge SCRUM-66): concatenar esta lista à lista oficial de
 *    migrações do runner do SCRUM-66, mantendo a ordem por versão.
 */

import type { MigracaoSql } from './MigracaoSql';
import { migracaoHspContingencia } from './2026102401_hsp_contingencia';
import { migracaoFilaSyncPropostas } from './2026102402_fila_sync_propostas';

export type { MigracaoSql } from './MigracaoSql';

export const MIGRACOES_SPRINT_3: readonly MigracaoSql[] = [
  migracaoHspContingencia,
  migracaoFilaSyncPropostas,
];
