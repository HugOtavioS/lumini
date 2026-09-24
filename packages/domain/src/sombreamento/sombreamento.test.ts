import { describe, expect, it } from 'vitest';
import { ErroValidacao } from '../erros';
import {
  aberturaObstaculo,
  azimuteDaOrientacao,
  azimuteDentroDoObstaculo,
  calcularSombreamento,
  cossenoIncidencia,
  fracaoDifusaBloqueada,
  irradianciaDiretaCeuClaro,
  massaDeAr,
  obstaculoGeometricoParaAngular,
  solBloqueado,
  type EntradaSombreamento,
  type ObstaculoAngular,
} from './sombreamento';
import { gerarDiagramaSombreamento, renderizarDiagramaSombreamentoSvg } from './diagramaSvg';
import { calcularTrajetoriaAnual } from '../solar/trajetoria';

const TAUBATE = { latitude: -23.0104, longitude: -45.5593 };
const TELHADO_NORTE_20 = { inclinacaoGraus: 20, azimuteGraus: 0 };

function entrada(obstaculos: ObstaculoAngular[], extra: Partial<EntradaSombreamento> = {}): EntradaSombreamento {
  return { ...TAUBATE, ano: 2026, plano: TELHADO_NORTE_20, obstaculos, ...extra };
}

describe('obstáculos', () => {
  it('converte obstáculo em metros para o perfil angular', () => {
    // Árvore a 8 m, 5 m acima do telhado, 6 m de largura, na direção 35°.
    const o = obstaculoGeometricoParaAngular({ nome: 'Árvore', azimuteGraus: 35, distanciaM: 8, alturaM: 5, larguraM: 6 });
    expect(o.elevacaoGraus).toBeCloseTo(32.005, 3); // atan(5/8)
    expect(o.azimuteInicialGraus).toBeCloseTo(14.444, 3); // 35 − atan(3/8)
    expect(o.azimuteFinalGraus).toBeCloseTo(55.556, 3);
    expect(o.nome).toBe('Árvore');
  });

  it('trata faixas de azimute que passam pelo Norte (350° → 10°)', () => {
    const o: ObstaculoAngular = { azimuteInicialGraus: 350, azimuteFinalGraus: 10, elevacaoGraus: 30 };
    expect(aberturaObstaculo(o)).toBe(20);
    expect(azimuteDentroDoObstaculo(355, o)).toBe(true);
    expect(azimuteDentroDoObstaculo(5, o)).toBe(true);
    expect(azimuteDentroDoObstaculo(20, o)).toBe(false);
    expect(azimuteDentroDoObstaculo(340, o)).toBe(false);
  });

  it('bloqueia o sol só abaixo do topo e dentro da faixa', () => {
    const o: ObstaculoAngular = { azimuteInicialGraus: 350, azimuteFinalGraus: 10, elevacaoGraus: 30 };
    expect(solBloqueado(20, 0, [o])).toBe(true);
    expect(solBloqueado(35, 0, [o])).toBe(false);
    expect(solBloqueado(20, 90, [o])).toBe(false);
  });

  it('converte a orientação da medição manual em azimute', () => {
    expect(azimuteDaOrientacao('N')).toBe(0);
    expect(azimuteDaOrientacao('L')).toBe(90);
    expect(azimuteDaOrientacao('SO')).toBe(225);
  });

  it('rejeita obstáculo em metros inválido', () => {
    expect(() =>
      obstaculoGeometricoParaAngular({ azimuteGraus: 0, distanciaM: 0, alturaM: 5, larguraM: 2 }),
    ).toThrow(ErroValidacao);
  });
});

describe('modelo de irradiância', () => {
  it('massa de ar ≈ 1 no zênite e ≈ 2 a 30° de elevação', () => {
    expect(massaDeAr(0)).toBeCloseTo(1, 3);
    expect(massaDeAr(60)).toBeCloseTo(1.99, 2);
    expect(massaDeAr(90)).toBe(Number.POSITIVE_INFINITY);
  });

  it('irradiância direta de céu claro (Meinel): ~947 W/m² no zênite, zero abaixo do horizonte', () => {
    expect(irradianciaDiretaCeuClaro(90)).toBeCloseTo(947, 0);
    expect(irradianciaDiretaCeuClaro(0)).toBe(0);
    expect(irradianciaDiretaCeuClaro(-5)).toBe(0);
    expect(irradianciaDiretaCeuClaro(10)).toBeLessThan(irradianciaDiretaCeuClaro(40));
  });

  it('cosseno de incidência: plano horizontal = seno da elevação; plano voltado para o sol = 1', () => {
    expect(cossenoIncidencia(30, 123, { inclinacaoGraus: 0, azimuteGraus: 0 })).toBeCloseTo(0.5, 12);
    expect(cossenoIncidencia(60, 0, { inclinacaoGraus: 30, azimuteGraus: 0 })).toBeCloseTo(1, 12);
    // Sol baixo ao Sul, telhado íngreme voltado para o Norte: sol atrás do plano.
    expect(cossenoIncidencia(10, 180, { inclinacaoGraus: 45, azimuteGraus: 0 })).toBeLessThan(0);
  });

  it('fração difusa bloqueada = Σ (Δaz/360) × sen²(elevação), sem contar sobreposição em dobro', () => {
    const o: ObstaculoAngular = { azimuteInicialGraus: 0, azimuteFinalGraus: 90, elevacaoGraus: 30 };
    expect(fracaoDifusaBloqueada([o])).toBeCloseTo(0.0625, 3);
    expect(fracaoDifusaBloqueada([o, { ...o }])).toBeCloseTo(0.0625, 3);
    expect(fracaoDifusaBloqueada([])).toBe(0);
  });
});

describe('calcularSombreamento (RF06)', () => {
  it('sem obstáculos, não há sombreamento', () => {
    const r = calcularSombreamento(entrada([]));
    expect(r.mediaAnualPerc).toBe(0);
    expect(r.mensal.every((m) => m.sombreamentoPerc === 0 && m.horasComSombra === 0)).toBe(true);
    expect(r.mensal).toHaveLength(12);
  });

  it('obstáculo alto cobrindo todo o céu Norte sombreia 100 % da direta em junho', () => {
    const muroNorte: ObstaculoAngular = { azimuteInicialGraus: 270, azimuteFinalGraus: 90, elevacaoGraus: 60 };
    const r = calcularSombreamento(entrada([muroNorte]));
    const junho = r.mensal[5]!;
    expect(junho.sombreamentoDiretoPerc).toBe(100);
    // 0,6 × 100 % + 0,4 × difusa (0,5 × sen²60° = 37,5 %) = 75 %
    expect(r.sombreamentoDifusoPerc).toBe(37.5);
    expect(junho.sombreamentoPerc).toBe(75);
    expect(junho.horasComSombra).toBe(junho.horasDeSolNoPlano);
  });

  it('obstáculo ao Sul não faz sombra direta no inverno (sol ao Norte)', () => {
    const sul: ObstaculoAngular = { azimuteInicialGraus: 150, azimuteFinalGraus: 210, elevacaoGraus: 30 };
    const r = calcularSombreamento(entrada([sul]));
    expect(r.mensal[5]!.sombreamentoDiretoPerc).toBe(0);
  });

  it('árvore a NE: sombra concentrada nas manhãs de inverno', () => {
    const arvore = obstaculoGeometricoParaAngular({ nome: 'Árvore', azimuteGraus: 35, distanciaM: 8, alturaM: 5, larguraM: 6 });
    const r = calcularSombreamento(entrada([arvore]));
    const direta = r.mensal.map((m) => m.sombreamentoDiretoPerc);
    expect(direta[5]!).toBeGreaterThan(5); // junho
    expect(direta[11]!).toBe(0); // dezembro
    const menor = Math.min(...r.mensal.map((m) => m.sombreamentoPerc));
    const maior = Math.max(...r.mensal.map((m) => m.sombreamentoPerc));
    expect(r.mediaAnualPerc).toBeGreaterThanOrEqual(menor);
    expect(r.mediaAnualPerc).toBeLessThanOrEqual(maior);
  });

  it('rejeita plano, obstáculos e parâmetros inválidos', () => {
    expect(() => calcularSombreamento(entrada([], { plano: { inclinacaoGraus: 95, azimuteGraus: 0 } }))).toThrow(
      ErroValidacao,
    );
    expect(() =>
      calcularSombreamento(entrada([{ azimuteInicialGraus: 10, azimuteFinalGraus: 10, elevacaoGraus: 20 }])),
    ).toThrow(ErroValidacao);
    expect(() =>
      calcularSombreamento(entrada([{ azimuteInicialGraus: 10, azimuteFinalGraus: 40, elevacaoGraus: 0 }])),
    ).toThrow(ErroValidacao);
    expect(() => calcularSombreamento(entrada([], { fracaoDireta: 1.5 }))).toThrow(ErroValidacao);
  });
});

/** Verificação simples de XML bem-formado (tags abertas e fechadas na ordem certa). */
function xmlBemFormado(xml: string): boolean {
  const pilha: string[] = [];
  const tag = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g;
  let fim = 0;
  for (const m of xml.matchAll(tag)) {
    const texto = xml.slice(fim, m.index);
    if (texto.includes('<') || texto.includes('>')) return false;
    fim = m.index! + m[0].length;
    const [, fechamento, nome, , autoFechada] = m;
    if (autoFechada) continue;
    if (fechamento) {
      if (pilha.pop() !== nome) return false;
    } else {
      pilha.push(nome!);
    }
  }
  return pilha.length === 0 && !xml.slice(fim).includes('<');
}

describe('diagrama SVG — SCRUM-81', () => {
  const arvore = obstaculoGeometricoParaAngular({ nome: 'Árvore', azimuteGraus: 35, distanciaM: 8, alturaM: 5, larguraM: 6 });
  const caixa: ObstaculoAngular = { nome: "Caixa d'água", azimuteInicialGraus: 285, azimuteFinalGraus: 310, elevacaoGraus: 18 };
  const resultado = gerarDiagramaSombreamento({ ...entrada([arvore, caixa]), titulo: 'Casa & Cia <teste>' });

  it('gera um SVG bem-formado, sem valores inválidos', () => {
    expect(resultado.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(resultado.svg.endsWith('</svg>')).toBe(true);
    expect(xmlBemFormado(resultado.svg)).toBe(true);
    expect(resultado.svg).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('é acessível (title/desc) e escapa textos', () => {
    expect(resultado.svg).toContain('<title>Casa &amp; Cia &lt;teste&gt;</title>');
    expect(resultado.svg).toContain('<desc>');
    expect(resultado.svg).toContain('role="img"');
  });

  it('desenha as 12 trajetórias, os obstáculos numerados e as barras mensais', () => {
    const polylinesMeses = resultado.svg.match(/<polyline[^>]*stroke-linejoin="round"/g) ?? [];
    expect(polylinesMeses).toHaveLength(12);
    expect(resultado.svg.match(/fill-opacity="0.55" stroke=/g)).toHaveLength(2);
    expect(resultado.svg).toContain("1 = Árvore · 2 = Caixa d'água");
    expect(resultado.svg).toContain('Perda por sombreamento por mês');
    expect(resultado.svg).toContain(`Média anual: <tspan font-weight="bold">`);
  });

  it('não usa CSS nem scripts (compatível com react-native-svg)', () => {
    expect(resultado.svg).not.toMatch(/<style|<script|class=|dominant-baseline|paint-order/);
  });

  it('funciona sem plano e sem resultado de sombreamento (só o diagrama solar)', () => {
    const svg = renderizarDiagramaSombreamentoSvg({
      trajetorias: calcularTrajetoriaAnual({ ...TAUBATE, ano: 2026 }),
      obstaculos: [],
    });
    expect(xmlBemFormado(svg)).toBe(true);
    expect(svg).not.toContain('Perda por sombreamento');
    expect(svg).toContain('Visão do céu a partir do telhado');
  });

  it('aceita cores personalizadas (ex.: tema escuro)', () => {
    const svg = renderizarDiagramaSombreamentoSvg(
      { trajetorias: resultado.trajetorias, obstaculos: [] },
      { cores: { fundo: '#101828', texto: '#f9fafb' } },
    );
    expect(svg).toContain('fill="#101828"');
  });

  it('devolve os números para salvar na Simulação de Sombreamento', () => {
    expect(resultado.sombreamento.mensal).toHaveLength(12);
    expect(resultado.trajetorias).toHaveLength(12);
    expect(resultado.sombreamento.mediaAnualPerc).toBeGreaterThan(0);
  });
});
