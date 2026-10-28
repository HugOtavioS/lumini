/**
 * SCRUM-81 — visualização 2D do sombreamento sobre o telhado medido.
 *
 * Gera um **diagrama solar polar** (visão do céu a partir do telhado):
 * o centro é o zênite, a borda é o horizonte, Norte para cima e Leste à
 * direita. Nele aparecem:
 *
 * - a trajetória do sol no dia 21 de cada mês (azul = inverno, laranja = verão);
 * - as linhas de hora (mesma hora em meses diferentes);
 * - os obstáculos como faixas escuras a partir do horizonte — onde a
 *   trajetória cruza uma faixa, o telhado fica sombreado;
 * - a região do céu "atrás do telhado" (sol que não bate na face dos módulos);
 * - a direção para onde a face do telhado está voltada;
 * - barras com a perda por sombreamento de cada mês e a média anual.
 *
 * A saída é uma string SVG sem CSS nem scripts, para funcionar igual no app
 * (react-native-svg, `SvgXml`) e na web (detalhe da proposta, RF23). Nada é
 * salvo: o diagrama é regenerado a partir da medição, dos obstáculos e do
 * resultado do sombreamento que já vão para o banco.
 */
import { formatarNumeroBr, radianos, graus, normalizar360 } from '../util/numeros';
import { calcularTrajetoriaAnual, NOMES_MESES, type TrajetoriaDiaria } from '../solar/trajetoria';
import {
  aberturaObstaculo,
  calcularSombreamento,
  type EntradaSombreamento,
  type ObstaculoAngular,
  type PlanoTelhado,
  type ResultadoSombreamento,
} from './sombreamento';

export interface CoresDiagrama {
  fundo: string;
  grade: string;
  horizonte: string;
  texto: string;
  textoSecundario: string;
  inverno: string;
  verao: string;
  obstaculo: string;
  atrasDoTelhado: string;
  telhado: string;
  barra: string;
}

/** Paleta padrão (tema claro), com contraste adequado sobre fundo branco. */
export const CORES_PADRAO: Readonly<CoresDiagrama> = Object.freeze({
  fundo: '#ffffff',
  grade: '#d0d5dd',
  horizonte: '#667085',
  texto: '#101828',
  textoSecundario: '#475467',
  inverno: '#1f6fd1',
  verao: '#e8590c',
  obstaculo: '#344054',
  atrasDoTelhado: '#eaecf0',
  telhado: '#0f766e',
  barra: '#e8590c',
});

export interface DadosDiagramaSombreamento {
  /** Trajetórias do ano (uma por mês), ex.: {@link calcularTrajetoriaAnual}. */
  trajetorias: readonly TrajetoriaDiaria[];
  obstaculos: readonly ObstaculoAngular[];
  plano?: PlanoTelhado;
  sombreamento?: ResultadoSombreamento;
  /** Título do diagrama (ex.: nome do cliente ou da cidade). */
  titulo?: string;
}

export interface OpcoesDiagrama {
  cores?: Partial<CoresDiagrama>;
}

// Geometria fixa (o SVG escala pelo viewBox).
const LARGURA = 400;
const CX = 200;
const CY = 238;
const RAIO = 150;

const ROTULOS_DIRECAO: readonly [number, string, boolean][] = [
  [0, 'N', true],
  [45, 'NE', false],
  [90, 'L', true],
  [135, 'SE', false],
  [180, 'S', true],
  [225, 'SO', false],
  [270, 'O', true],
  [315, 'NO', false],
];

const NOMES_ORIENTACAO = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];

function escapar(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function n(valor: number): string {
  return String(Math.round(valor * 10) / 10);
}

/** Raio no diagrama para uma elevação (projeção equidistante). */
function raioDaElevacao(elevacao: number): number {
  return (RAIO * (90 - Math.max(0, Math.min(90, elevacao)))) / 90;
}

/** Ponto (x, y) do diagrama para uma posição no céu. */
function ponto(elevacao: number, azimute: number): [number, number] {
  const r = raioDaElevacao(elevacao);
  const a = radianos(azimute);
  return [CX + r * Math.sin(a), CY - r * Math.cos(a)];
}

function misturarCor(corA: string, corB: string, t: number): string {
  const ler = (c: string): number[] => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const a = ler(corA);
  const b = ler(corB);
  const canal = (i: number): string =>
    Math.round(a[i]! + (b[i]! - a[i]!) * t)
      .toString(16)
      .padStart(2, '0');
  return `#${canal(0)}${canal(1)}${canal(2)}`;
}

function orientacaoMaisProxima(azimute: number): string {
  return NOMES_ORIENTACAO[Math.round(normalizar360(azimute) / 45) % 8]!;
}

function desenharGrade(cores: CoresDiagrama): string {
  const partes: string[] = [];
  for (const elev of [15, 30, 45, 60, 75]) {
    partes.push(
      `<circle cx="${CX}" cy="${CY}" r="${n(raioDaElevacao(elev))}" fill="none" stroke="${cores.grade}" stroke-width="0.8"/>`,
    );
  }
  for (let az = 0; az < 360; az += 30) {
    const [x, y] = ponto(0, az);
    partes.push(`<line x1="${CX}" y1="${CY}" x2="${n(x)}" y2="${n(y)}" stroke="${cores.grade}" stroke-width="0.8"/>`);
  }
  for (const elev of [30, 60]) {
    const [x, y] = ponto(elev, 160);
    partes.push(
      `<text x="${n(x + 3)}" y="${n(y + 3)}" font-size="9" fill="${cores.textoSecundario}" font-family="sans-serif">${elev}°</text>`,
    );
  }
  partes.push(
    `<circle cx="${CX}" cy="${CY}" r="${RAIO}" fill="none" stroke="${cores.horizonte}" stroke-width="1.4"/>`,
  );
  for (const [az, rotulo, principal] of ROTULOS_DIRECAO) {
    const a = radianos(az);
    const distancia = RAIO + (principal ? 13 : 12);
    const x = CX + distancia * Math.sin(a);
    const y = CY - distancia * Math.cos(a) + 4;
    partes.push(
      `<text x="${n(x)}" y="${n(y)}" text-anchor="middle" font-size="${principal ? 13 : 9}" font-weight="${principal ? 'bold' : 'normal'}" fill="${principal ? cores.texto : cores.textoSecundario}" font-family="sans-serif">${rotulo}</text>`,
    );
  }
  return partes.join('');
}

/** Região do céu em que o sol fica atrás do plano do telhado (cos θ ≤ 0). */
function desenharAtrasDoTelhado(plano: PlanoTelhado, cores: CoresDiagrama): string {
  const beta = radianos(plano.inclinacaoGraus);
  if (plano.inclinacaoGraus <= 0.5) return '';
  const externos: string[] = [];
  const internos: string[] = [];
  for (let d = 90; d <= 270; d += 3) {
    const az = plano.azimuteGraus + d;
    const [xe, ye] = ponto(0, az);
    externos.push(`${n(xe)},${n(ye)}`);
    const elevLimite = Math.max(0, graus(Math.atan(-Math.tan(beta) * Math.cos(radianos(d)))));
    const [xi, yi] = ponto(elevLimite, az);
    internos.push(`${n(xi)},${n(yi)}`);
  }
  const pontos = [...externos, ...internos.reverse()].join(' ');
  return `<polygon points="${pontos}" fill="${cores.atrasDoTelhado}" stroke="none"/>`;
}

function desenharObstaculos(obstaculos: readonly ObstaculoAngular[], cores: CoresDiagrama): string {
  const partes: string[] = [];
  obstaculos.forEach((o, indice) => {
    const abertura = aberturaObstaculo(o);
    if (abertura <= 0) return;
    const ini = o.azimuteInicialGraus;
    const fim = ini + abertura;
    const rInterno = raioDaElevacao(o.elevacaoGraus);
    const [x1, y1] = ponto(0, ini);
    const [x2, y2] = ponto(0, fim);
    const [x3, y3] = ponto(o.elevacaoGraus, fim);
    const [x4, y4] = ponto(o.elevacaoGraus, ini);
    const arcoGrande = abertura > 180 ? 1 : 0;
    const d =
      `M${n(x1)},${n(y1)} A${RAIO},${RAIO} 0 ${arcoGrande} 1 ${n(x2)},${n(y2)} ` +
      `L${n(x3)},${n(y3)} A${n(rInterno)},${n(rInterno)} 0 ${arcoGrande} 0 ${n(x4)},${n(y4)} Z`;
    partes.push(
      `<path d="${d}" fill="${cores.obstaculo}" fill-opacity="0.55" stroke="${cores.obstaculo}" stroke-width="1"/>`,
    );
    // Número do obstáculo no meio da faixa; o nome vai na legenda.
    const [xt, yt] = ponto(o.elevacaoGraus / 2, ini + abertura / 2);
    partes.push(
      `<circle cx="${n(xt)}" cy="${n(yt)}" r="7" fill="${cores.obstaculo}"/>` +
        `<text x="${n(xt)}" y="${n(yt + 3.5)}" text-anchor="middle" font-size="10" font-weight="bold" fill="#ffffff" font-family="sans-serif">${indice + 1}</text>`,
    );
  });
  return partes.join('');
}

function desenharTrajetorias(trajetorias: readonly TrajetoriaDiaria[], cores: CoresDiagrama): string {
  const partes: string[] = [];
  // Linhas de hora: liga a mesma hora cheia em meses diferentes.
  const porHora = new Map<number, [number, number][]>();
  const ordem = [...trajetorias].sort((a, b) => Math.abs(a.data.mes - 6) - Math.abs(b.data.mes - 6));
  for (const t of ordem) {
    for (const p of t.pontos) {
      if (Math.abs(p.minutosLocal % 60) > 1e-9 || p.elevacaoGraus <= 0) continue;
      const hora = p.minutosLocal / 60;
      const lista = porHora.get(hora) ?? [];
      lista.push(ponto(p.elevacaoGraus, p.azimuteGraus));
      porHora.set(hora, lista);
    }
  }
  for (const [hora, pontos] of porHora) {
    if (pontos.length >= 2) {
      partes.push(
        `<polyline points="${pontos.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" fill="none" stroke="${cores.textoSecundario}" stroke-width="0.7" stroke-dasharray="2,2"/>`,
      );
    }
    // Rótulo na ponta mais externa (mais perto do horizonte).
    const externo = pontos.reduce((a, b) =>
      Math.hypot(b[0] - CX, b[1] - CY) > Math.hypot(a[0] - CX, a[1] - CY) ? b : a,
    );
    const dist = Math.hypot(externo[0] - CX, externo[1] - CY) || 1;
    const xt = externo[0] + ((externo[0] - CX) / dist) * 9;
    const yt = externo[1] + ((externo[1] - CY) / dist) * 9 + 3;
    partes.push(
      `<text x="${n(xt)}" y="${n(yt)}" text-anchor="middle" font-size="8" fill="${cores.textoSecundario}" font-family="sans-serif">${hora}h</text>`,
    );
  }

  for (const t of trajetorias) {
    if (t.pontos.length < 2) continue;
    const verao = Math.abs(t.data.mes - 6) / 6; // jun = 0 (inverno), dez = 1 (verão)
    const cor = misturarCor(cores.inverno, cores.verao, verao);
    const destaque = t.data.mes === 6 || t.data.mes === 12 || t.data.mes === 3 || t.data.mes === 9;
    const pts = t.pontos.map((p) => ponto(p.elevacaoGraus, p.azimuteGraus));
    partes.push(
      `<polyline points="${pts.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" fill="none" stroke="${cor}" stroke-width="${destaque ? 2.2 : 1.2}" stroke-linejoin="round"/>`,
    );
  }

  return partes.join('');
}

function desenharFaceTelhado(plano: PlanoTelhado, cores: CoresDiagrama): string {
  const comprimento = RAIO * 0.32;
  const a = radianos(plano.azimuteGraus);
  const xf = CX + comprimento * Math.sin(a);
  const yf = CY - comprimento * Math.cos(a);
  const ponta = (desvio: number): string => {
    const b = a + Math.PI + radianos(desvio);
    return `${n(xf + 8 * Math.sin(b))},${n(yf - 8 * Math.cos(b))}`;
  };
  return (
    `<line x1="${CX}" y1="${CY}" x2="${n(xf)}" y2="${n(yf)}" stroke="${cores.telhado}" stroke-width="2.5"/>` +
    `<polygon points="${n(xf)},${n(yf)} ${ponta(25)} ${ponta(-25)}" fill="${cores.telhado}"/>` +
    `<circle cx="${CX}" cy="${CY}" r="3" fill="${cores.telhado}"/>`
  );
}

/** Legenda em linhas; retorna o SVG e a altura ocupada. */
function desenharLegenda(
  y0: number,
  cores: CoresDiagrama,
  plano: PlanoTelhado | undefined,
  obstaculos: readonly ObstaculoAngular[],
): { svg: string; altura: number } {
  const partes: string[] = [];
  const texto = (x: number, y: number, conteudo: string): string =>
    `<text x="${n(x)}" y="${n(y + 4)}" font-size="9" fill="${cores.textoSecundario}" font-family="sans-serif">${conteudo}</text>`;
  const linha = (x: number, y: number, cor: string): string =>
    `<line x1="${n(x)}" y1="${n(y)}" x2="${n(x + 14)}" y2="${n(y)}" stroke="${cor}" stroke-width="2.2"/>`;

  // Linha 1: as três curvas de referência.
  let y = y0;
  const curvas: [string, string][] = [
    [cores.verao, 'dez (verão)'],
    [misturarCor(cores.inverno, cores.verao, 0.5), 'mar/set (equinócios)'],
    [cores.inverno, 'jun (inverno)'],
  ];
  let x = 18;
  for (const [cor, rotulo] of curvas) {
    partes.push(linha(x, y, cor), texto(x + 18, y, rotulo));
    x += 18 + rotulo.length * 4.8 + 16;
  }

  // Linha 2: telhado e região atrás do telhado.
  y += 16;
  x = 18;
  if (plano) {
    partes.push(
      `<line x1="${x}" y1="${y}" x2="${x + 14}" y2="${y}" stroke="${cores.telhado}" stroke-width="2.5"/>`,
      texto(x + 18, y, 'face do telhado'),
    );
    x += 102;
    if (plano.inclinacaoGraus > 0.5) {
      partes.push(
        `<rect x="${x}" y="${y - 5}" width="14" height="10" fill="${cores.atrasDoTelhado}" stroke="${cores.grade}"/>`,
        texto(x + 18, y, 'sol atrás do telhado (não é sombra)'),
      );
    }
  } else {
    partes.push(texto(x, y, 'Linhas tracejadas: mesma hora do dia em meses diferentes'));
  }

  // Linha 3: obstáculos numerados.
  if (obstaculos.length > 0) {
    y += 16;
    const nomes = obstaculos.map((o, i) => `${i + 1} = ${escapar(o.nome ?? 'obstáculo')}`).join(' · ');
    partes.push(
      `<rect x="18" y="${y - 5}" width="14" height="10" fill="${cores.obstaculo}" fill-opacity="0.55"/>`,
      texto(36, y, `Obstáculos: ${nomes}`),
    );
  }
  return { svg: partes.join(''), altura: y - y0 + 10 };
}

function desenharBarras(y0: number, sombreamento: ResultadoSombreamento, cores: CoresDiagrama): string {
  const partes: string[] = [];
  const alturaMax = 60;
  const maior = Math.max(...sombreamento.mensal.map((m) => m.sombreamentoPerc), 0);
  const escala = Math.max(5, Math.ceil(maior / 5) * 5);
  const esquerda = 30;
  const largura = LARGURA - esquerda - 14;
  const passo = largura / 12;
  const base = y0 + 16 + alturaMax;

  partes.push(
    `<text x="18" y="${y0}" font-size="11" font-weight="bold" fill="${cores.texto}" font-family="sans-serif">Perda por sombreamento por mês (%)</text>`,
  );
  partes.push(
    `<line x1="${esquerda}" y1="${base}" x2="${esquerda + largura}" y2="${base}" stroke="${cores.horizonte}" stroke-width="1"/>`,
  );
  partes.push(
    `<text x="${esquerda - 4}" y="${n(base - alturaMax + 3)}" text-anchor="end" font-size="8" fill="${cores.textoSecundario}" font-family="sans-serif">${escala}</text>`,
  );
  sombreamento.mensal.forEach((m, i) => {
    const h = (m.sombreamentoPerc / escala) * alturaMax;
    const x = esquerda + i * passo + passo * 0.18;
    const w = passo * 0.64;
    partes.push(`<rect x="${n(x)}" y="${n(base - h)}" width="${n(w)}" height="${n(h)}" fill="${cores.barra}"/>`);
    partes.push(
      `<text x="${n(x + w / 2)}" y="${n(base - h - 3)}" text-anchor="middle" font-size="8" fill="${cores.texto}" font-family="sans-serif">${formatarNumeroBr(m.sombreamentoPerc, 1)}</text>`,
    );
    partes.push(
      `<text x="${n(x + w / 2)}" y="${base + 12}" text-anchor="middle" font-size="9" fill="${cores.textoSecundario}" font-family="sans-serif">${NOMES_MESES[m.mes - 1]}</text>`,
    );
  });
  partes.push(
    `<text x="18" y="${base + 32}" font-size="11" fill="${cores.texto}" font-family="sans-serif">Média anual: <tspan font-weight="bold">${formatarNumeroBr(sombreamento.mediaAnualPerc, 1)} %</tspan> (entra como perda no dimensionamento)</text>`,
  );
  return partes.join('');
}

/**
 * Monta o SVG do diagrama de sombreamento a partir de dados já calculados.
 * Retorna uma string pronta para `SvgXml` (app) ou para a web.
 */
export function renderizarDiagramaSombreamentoSvg(
  dados: DadosDiagramaSombreamento,
  opcoes: OpcoesDiagrama = {},
): string {
  const cores: CoresDiagrama = { ...CORES_PADRAO, ...opcoes.cores };
  const titulo = dados.titulo ?? 'Diagrama solar e sombreamento';
  const plano = dados.plano;
  const subtitulo = plano
    ? `Telhado voltado para ${orientacaoMaisProxima(plano.azimuteGraus)} (${formatarNumeroBr(normalizar360(plano.azimuteGraus), 0)}°), inclinação ${formatarNumeroBr(plano.inclinacaoGraus, 0)}°`
    : 'Visão do céu a partir do telhado';
  const descricao =
    'Diagrama polar: centro = sol a pino, borda = horizonte, Norte para cima. ' +
    'Curvas = trajetória do sol no dia 21 de cada mês; faixas escuras = obstáculos.' +
    (dados.sombreamento
      ? ` Sombreamento médio anual estimado: ${formatarNumeroBr(dados.sombreamento.mediaAnualPerc, 1)} %.`
      : '');

  const legenda = desenharLegenda(CY + RAIO + 36, cores, plano, dados.obstaculos);
  const inicioBarras = CY + RAIO + 36 + legenda.altura + 22;
  const altura = dados.sombreamento ? inicioBarras + 130 : CY + RAIO + 36 + legenda.altura + 10;

  const partes: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LARGURA} ${n(altura)}" width="${LARGURA}" height="${n(altura)}" role="img">`,
    `<title>${escapar(titulo)}</title>`,
    `<desc>${escapar(descricao)}</desc>`,
    `<rect x="0" y="0" width="${LARGURA}" height="${n(altura)}" fill="${cores.fundo}"/>`,
    `<text x="18" y="26" font-size="15" font-weight="bold" fill="${cores.texto}" font-family="sans-serif">${escapar(titulo)}</text>`,
    `<text x="18" y="44" font-size="11" fill="${cores.textoSecundario}" font-family="sans-serif">${escapar(subtitulo)}</text>`,
  ];
  if (plano) partes.push(desenharAtrasDoTelhado(plano, cores));
  partes.push(desenharGrade(cores));
  partes.push(desenharObstaculos(dados.obstaculos, cores));
  partes.push(desenharTrajetorias(dados.trajetorias, cores));
  if (plano) partes.push(desenharFaceTelhado(plano, cores));
  partes.push(legenda.svg);
  if (dados.sombreamento) partes.push(desenharBarras(inicioBarras, dados.sombreamento, cores));
  partes.push('</svg>');
  return partes.join('');
}

export interface EntradaDiagramaSombreamento extends EntradaSombreamento {
  titulo?: string;
}

export interface ResultadoDiagramaSombreamento {
  svg: string;
  sombreamento: ResultadoSombreamento;
  trajetorias: TrajetoriaDiaria[];
}

/**
 * Atalho para a tela do RF06: calcula o sombreamento, a trajetória do ano e
 * devolve o SVG pronto, junto com os números para salvar na Simulação.
 */
export function gerarDiagramaSombreamento(
  entrada: EntradaDiagramaSombreamento,
  opcoes: OpcoesDiagrama = {},
): ResultadoDiagramaSombreamento {
  const sombreamento = calcularSombreamento(entrada);
  const trajetorias = calcularTrajetoriaAnual({
    latitude: entrada.latitude,
    longitude: entrada.longitude,
    ano: entrada.ano,
    ...(entrada.fusoHorarioHoras !== undefined && { fusoHorarioHoras: entrada.fusoHorarioHoras }),
  });
  const svg = renderizarDiagramaSombreamentoSvg(
    {
      trajetorias,
      obstaculos: entrada.obstaculos,
      plano: entrada.plano,
      sombreamento,
      ...(entrada.titulo !== undefined && { titulo: entrada.titulo }),
    },
    opcoes,
  );
  return { svg, sombreamento, trajetorias };
}
