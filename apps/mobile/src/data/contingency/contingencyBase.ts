// Base climática de contingência (RN02 / RF08, subfluxo 3.1): HSP médio por UF,
// usado quando a API de clima não responde. Vem embutida no app e é trocada
// por versões novas baixadas pelo ContingencyUpdater (SCRUM-85).

export interface ClimateReference {
  hsp: number;
  /** Latitude aproximada da capital, em graus (negativa = hemisfério sul). */
  latitude: number;
}

export interface ContingencyBase {
  /** Identificador da versão (ex.: "2026.10.1"). */
  version: string;
  /** Quando a versão foi publicada (ISO 8601) — decide qual é a mais nova. */
  publishedAt: string;
  hspByState: Record<string, ClimateReference>;
}

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

/** Valores médios aproximados por UF, embutidos no app. */
export const BUILTIN_CONTINGENCY_BASE: ContingencyBase = {
  version: 'embutida-2026.09',
  publishedAt: '2026-09-01T00:00:00.000Z',
  hspByState: {
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
  },
};

/** Problemas que impedem instalar uma base baixada (lista vazia = válida). */
export function validateContingencyBase(base: unknown): string[] {
  if (typeof base !== 'object' || base === null) return ['Base vazia.'];
  const b = base as Partial<ContingencyBase>;
  const problems: string[] = [];
  if (typeof b.version !== 'string' || b.version.trim() === '') problems.push('Versão ausente.');
  if (typeof b.publishedAt !== 'string' || Number.isNaN(Date.parse(b.publishedAt))) problems.push('Data de publicação inválida.');
  if (typeof b.hspByState !== 'object' || b.hspByState === null) return [...problems, 'HSP por UF ausente.'];
  for (const uf of UFS) {
    const ref = b.hspByState[uf];
    if (!ref || !(ref.hsp >= 2 && ref.hsp <= 8)) problems.push(`HSP de ${uf} ausente ou fora da faixa (2 a 8).`);
    else if (!(ref.latitude >= -35 && ref.latitude <= 6)) problems.push(`Latitude de ${uf} fora do Brasil.`);
  }
  return problems;
}

let activeBase: ContingencyBase = BUILTIN_CONTINGENCY_BASE;

export function getActiveContingencyBase(): ContingencyBase {
  return activeBase;
}

/** Troca a base em uso; recusa base inválida (o app continua com a anterior). */
export function setActiveContingencyBase(base: ContingencyBase): void {
  const problems = validateContingencyBase(base);
  if (problems.length > 0) throw new Error(`Base de contingência inválida: ${problems.join(' ')}`);
  activeBase = base;
}

/** Só para testes. */
export function resetContingencyBase(): void {
  activeBase = BUILTIN_CONTINGENCY_BASE;
}
