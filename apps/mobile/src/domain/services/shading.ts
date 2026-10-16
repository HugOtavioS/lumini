import type { Orientation } from '../entities';
import { technicalParameters } from '../parameters';

// Simulação simplificada de sombreamento (RF06, subfluxo 2.1): sem obstáculos
// marcados, considera apenas orientação e inclinação. A trajetória solar
// completa (Sun Path) fica no pacote de domínio compartilhado (NOVO-107).

// Hemisfério sul: a face norte recebe mais sol.
const orientationPenaltyPct: Record<Orientation, number> = {
  N: 0,
  NE: 2,
  NO: 2,
  L: 6,
  O: 6,
  SE: 12,
  SO: 12,
  S: 18,
};

export function simulateShading(
  orientation: Orientation,
  inclinationDeg: number,
  latitude: number,
): number {
  const tiltDeviation = Math.abs(inclinationDeg - Math.abs(latitude));
  const pct =
    technicalParameters.defaultShadingPct +
    orientationPenaltyPct[orientation] +
    tiltDeviation * 0.15;
  return Math.round(Math.min(100, Math.max(0, pct)));
}

export type ShadingRating = 'excelente' | 'bom' | 'atencao';

export function rateShading(pct: number): ShadingRating {
  if (pct <= 10) return 'excelente';
  if (pct <= 20) return 'bom';
  return 'atencao';
}
