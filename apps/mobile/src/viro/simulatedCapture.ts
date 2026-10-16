import type { Orientation } from '@/domain/entities';
import type { ScenePoint } from './ARMeasurementScene';

// Capturas simuladas: cada seção do telhado tem 4 vértices e as leituras que
// os sensores (inclinação) e a bússola (orientação) retornariam.
export interface SimulatedSection {
  points: ScenePoint[];
  edgeLengths: number[];
  inclinationDeg: number;
  orientation: Orientation;
}

export const simulatedSections: SimulatedSection[] = [
  {
    points: [
      { x: 8, y: 400 },
      { x: 214, y: 334 },
      { x: 300, y: 545 },
      { x: 70, y: 588 },
    ],
    edgeLengths: [8.5, 5.3, 8.5, 5.3],
    inclinationDeg: 15,
    orientation: 'N',
  },
  {
    points: [
      { x: 262, y: 322 },
      { x: 382, y: 292 },
      { x: 382, y: 452 },
      { x: 322, y: 490 },
    ],
    edgeLengths: [5.0, 4.2, 3.1, 4.4],
    inclinationDeg: 12,
    orientation: 'L',
  },
];

/** Área aproximada do quadrilátero a partir dos lados opostos médios. */
export function sectionArea(edgeLengths: number[]): number {
  const [a = 0, b = 0, c = 0, d = 0] = edgeLengths;
  return ((a + c) / 2) * ((b + d) / 2);
}
