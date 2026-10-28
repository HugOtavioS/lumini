// Base climática de contingência (RN02). Usada enquanto a API de clima
// (NOVO-103) não estiver integrada; a versão em uso é atualizada pelo job do
// SCRUM-85 (src/data/contingency).

import { getActiveContingencyBase, type ClimateReference } from '@/data/contingency/contingencyBase';

const fallback: ClimateReference = { hsp: 5.0, latitude: -15.78 };

export interface ClimateData extends ClimateReference {
  source: 'api' | 'contingencia';
  approximate: boolean;
  /** Versão da base de contingência usada. */
  baseVersion: string;
}

export function getClimateData(state: string): ClimateData {
  const base = getActiveContingencyBase();
  const reference = base.hspByState[state.toUpperCase()];
  return {
    ...(reference ?? fallback),
    source: 'contingencia',
    approximate: reference === undefined,
    baseVersion: base.version,
  };
}
