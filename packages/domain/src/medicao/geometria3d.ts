/**
 * Geometria da medição do telhado por RA (RF04, passo 4): converte os
 * vértices marcados na cena em área, inclinação e orientação.
 *
 * Sistema de coordenadas da cena (ViroReact/ARKit/ARCore): metros, eixo Y
 * para cima, e −Z é a direção para onde a câmera apontava no início da
 * sessão. Para saber onde fica o Norte, o app informa o rumo (bússola) dessa
 * direção inicial em `rumoInicialGraus`.
 *
 * É a mesma conta usada na calibração (SCRUM-79): a área que o técnico mede
 * com a RA passa por aqui antes de ser comparada com a medida da trena.
 */
import { ehNumeroFinito, garantirSemErros, type ErroCampo } from '../erros';
import { arredondar, CASAS_DECIMAIS, graus, normalizar360 } from '../util/numeros';
import { AZIMUTE_POR_ORIENTACAO, type Orientacao } from '../sombreamento/sombreamento';

export interface Ponto3D {
  x: number;
  y: number;
  z: number;
}

function sub(a: Ponto3D, b: Ponto3D): Ponto3D {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function norma(v: Ponto3D): number {
  return Math.hypot(v.x, v.y, v.z);
}

function validarVertices(vertices: readonly Ponto3D[]): ErroCampo[] {
  const erros: ErroCampo[] = [];
  if (!Array.isArray(vertices) || vertices.length < 3) {
    erros.push({ campo: 'vertices', mensagem: 'Marque pelo menos 3 vértices do telhado.' });
    return erros;
  }
  if (!vertices.every((p) => ehNumeroFinito(p.x) && ehNumeroFinito(p.y) && ehNumeroFinito(p.z))) {
    erros.push({ campo: 'vertices', mensagem: 'Há vértices com coordenadas inválidas.' });
  }
  return erros;
}

/**
 * Normal do polígono pelo método de Newell (robusto a pequenos desvios de
 * planaridade), com módulo igual a 2 × área e sempre apontando para cima.
 */
export function normalNewell(vertices: readonly Ponto3D[]): Ponto3D {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % vertices.length]!;
    nx += (a.y - b.y) * (a.z + b.z);
    ny += (a.z - b.z) * (a.x + b.x);
    nz += (a.x - b.x) * (a.y + b.y);
  }
  // A face do telhado aponta para o céu: garante componente Y ≥ 0.
  return ny < 0 ? { x: -nx, y: -ny, z: -nz } : { x: nx, y: ny, z: nz };
}

/** Área (m²) do polígono no próprio plano — a área real do telhado inclinado. */
export function areaPoligono3D(vertices: readonly Ponto3D[]): number {
  garantirSemErros(validarVertices(vertices));
  return norma(normalNewell(vertices)) / 2;
}

/** Orientação cardinal (N, NE, L, …) mais próxima de um azimute. */
export function orientacaoDoAzimute(azimuteGraus: number): Orientacao {
  const ordem: Orientacao[] = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
  return ordem[Math.round(normalizar360(azimuteGraus) / 45) % 8]!;
}

export interface OpcoesMedicaoPoligono {
  /**
   * Rumo (graus a partir do Norte verdadeiro, sentido horário) da direção −Z
   * da cena, lido da bússola no início da sessão de RA. Sem ele, o azimute
   * não é calculado.
   */
  rumoInicialGraus?: number;
}

export interface MedicaoPoligono {
  /** Área do telhado no plano inclinado (m²). */
  areaM2: number;
  /** Inclinação em relação à horizontal (°). */
  inclinacaoGraus: number;
  /** Para onde a face do telhado está voltada (°, 0 = Norte); `null` sem bússola ou em superfície quase plana. */
  azimuteGraus: number | null;
  orientacao: Orientacao | null;
  /** Comprimento de cada lado (m), na ordem dos vértices. */
  ladosM: number[];
  perimetroM: number;
  /** Maior distância de um vértice ao plano médio (m): indica marcação ruim. */
  desvioPlanaridadeM: number;
}

/**
 * Calcula área, inclinação e orientação do polígono marcado na cena de RA.
 *
 * @throws {ErroValidacao} com menos de 3 vértices, coordenadas inválidas ou
 * pontos colineares (área zero).
 */
export function medirPoligono(vertices: readonly Ponto3D[], opcoes: OpcoesMedicaoPoligono = {}): MedicaoPoligono {
  garantirSemErros(validarVertices(vertices));
  const normal = normalNewell(vertices);
  const modulo = norma(normal);
  if (modulo < 1e-9) {
    garantirSemErros([{ campo: 'vertices', mensagem: 'Os vértices estão alinhados: marque os cantos do telhado.' }]);
  }
  const unit = { x: normal.x / modulo, y: normal.y / modulo, z: normal.z / modulo };

  const inclinacao = graus(Math.acos(Math.min(1, Math.max(-1, unit.y))));
  let azimute: number | null = null;
  const componenteHorizontal = Math.hypot(unit.x, unit.z);
  if (ehNumeroFinito(opcoes.rumoInicialGraus) && componenteHorizontal > Math.sin((0.5 * Math.PI) / 180)) {
    // −Z = frente (rumo inicial); +X = direita (rumo + 90°).
    azimute = normalizar360(opcoes.rumoInicialGraus + graus(Math.atan2(unit.x, -unit.z)));
  }

  const ladosM = vertices.map((p, i) => norma(sub(vertices[(i + 1) % vertices.length]!, p)));
  const centro = vertices.reduce((c, p) => ({ x: c.x + p.x, y: c.y + p.y, z: c.z + p.z }), { x: 0, y: 0, z: 0 });
  const n = vertices.length;
  const centroide = { x: centro.x / n, y: centro.y / n, z: centro.z / n };
  const desvio = Math.max(
    ...vertices.map((p) => {
      const d = sub(p, centroide);
      return Math.abs(d.x * unit.x + d.y * unit.y + d.z * unit.z);
    }),
  );

  return {
    areaM2: arredondar(modulo / 2, CASAS_DECIMAIS.area),
    inclinacaoGraus: arredondar(inclinacao, CASAS_DECIMAIS.graus),
    azimuteGraus: azimute === null ? null : arredondar(azimute, CASAS_DECIMAIS.graus),
    orientacao: azimute === null ? null : orientacaoDoAzimute(azimute),
    ladosM: ladosM.map((l) => arredondar(l, 3)),
    perimetroM: arredondar(ladosM.reduce((s, l) => s + l, 0), 3),
    desvioPlanaridadeM: arredondar(desvio, 3),
  };
}

/** Azimute (°) de uma orientação cardinal — atalho para a medição manual (RF05). */
export function azimuteDe(orientacao: Orientacao): number {
  return AZIMUTE_POR_ORIENTACAO[orientacao];
}
