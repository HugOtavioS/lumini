// Base climática de contingência (RN02). Valores médios aproximados por UF,
// usados enquanto a API de clima (NOVO-103) não estiver integrada.

interface ClimateReference {
  hsp: number;
  /** Latitude aproximada da capital, em graus (negativa = hemisfério sul). */
  latitude: number;
}

const contingencyBase: Record<string, ClimateReference> = {
  AC: { hsp: 4.6, latitude: -9.97 },
  AL: { hsp: 5.4, latitude: -9.67 },
  AP: { hsp: 4.9, latitude: 0.03 },
  AM: { hsp: 4.6, latitude: -3.12 },
  BA: { hsp: 5.4, latitude: -12.97 },
  CE: { hsp: 5.6, latitude: -3.73 },
  DF: { hsp: 5.3, latitude: -15.78 },
  ES: { hsp: 5.0, latitude: -20.32 },
  GO: { hsp: 5.3, latitude: -16.68 },
  MA: { hsp: 5.1, latitude: -2.53 },
  MT: { hsp: 5.2, latitude: -15.6 },
  MS: { hsp: 5.1, latitude: -20.44 },
  MG: { hsp: 5.2, latitude: -19.92 },
  PA: { hsp: 4.9, latitude: -1.46 },
  PB: { hsp: 5.5, latitude: -7.12 },
  PR: { hsp: 4.6, latitude: -25.43 },
  PE: { hsp: 5.5, latitude: -8.05 },
  PI: { hsp: 5.6, latitude: -5.09 },
  RJ: { hsp: 4.9, latitude: -22.91 },
  RN: { hsp: 5.6, latitude: -5.79 },
  RS: { hsp: 4.6, latitude: -30.03 },
  RO: { hsp: 4.7, latitude: -8.76 },
  RR: { hsp: 4.9, latitude: 2.82 },
  SC: { hsp: 4.4, latitude: -27.6 },
  SP: { hsp: 4.9, latitude: -23.55 },
  SE: { hsp: 5.4, latitude: -10.91 },
  TO: { hsp: 5.4, latitude: -10.18 },
};

const fallback: ClimateReference = { hsp: 5.0, latitude: -15.78 };

export interface ClimateData extends ClimateReference {
  source: 'api' | 'contingencia';
  approximate: boolean;
}

export function getClimateData(state: string): ClimateData {
  const reference = contingencyBase[state.toUpperCase()];
  return {
    ...(reference ?? fallback),
    source: 'contingencia',
    approximate: reference === undefined,
  };
}
