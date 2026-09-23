import { describe, expect, it } from 'vitest';
import { ErroValidacao } from '../erros';
import { calcularEventosSolares, calcularPosicaoSolar, diaJuliano, refracaoAtmosfericaGraus } from './posicaoSolar';
import { calcularTrajetoriaAnual, calcularTrajetoriaDiaria, ehDataValida, formatarHora } from './trajetoria';
import referencia from './__fixtures__/referencia-spa-nrel.json';

const TAUBATE = { latitude: -23.0104, longitude: -45.5593 };

/** Diferença angular em graus, considerando a volta de 360°. */
function difAngular(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Distância angular (°) entre duas posições no céu (elevação/azimute). */
function separacaoAngular(el1: number, az1: number, el2: number, az2: number): number {
  const r = Math.PI / 180;
  const cos =
    Math.sin(el1 * r) * Math.sin(el2 * r) + Math.cos(el1 * r) * Math.cos(el2 * r) * Math.cos((az1 - az2) * r);
  return Math.acos(Math.min(1, Math.max(-1, cos))) / r;
}

/** "HH:MM" → minutos desde a meia-noite. */
function minutosDe(hora: string | null): number {
  const [h, m] = (hora ?? 'NaN:NaN').split(':').map(Number) as [number, number];
  return h * 60 + m;
}

describe('calcularPosicaoSolar — comparação com o SPA do NREL (pvlib)', () => {
  it(`usa ${referencia.amostras.length} amostras de referência`, () => {
    expect(referencia.amostras.length).toBeGreaterThan(300);
    expect(referencia.fonte).toMatch(/SPA/);
  });

  it('elevação geométrica com erro máximo < 0,02°', () => {
    let erroMax = 0;
    for (const a of referencia.amostras) {
      const p = calcularPosicaoSolar(new Date(a.instante), a.latitude, a.longitude);
      erroMax = Math.max(erroMax, Math.abs(p.elevacaoGeometricaGraus - a.elevacaoGeometrica));
    }
    expect(erroMax).toBeLessThan(0.02);
  });

  it('posição no céu (separação angular) com erro máximo < 0,02° com o sol acima do horizonte', () => {
    let erroMax = 0;
    for (const a of referencia.amostras) {
      if (a.elevacaoGeometrica < 1) continue;
      const p = calcularPosicaoSolar(new Date(a.instante), a.latitude, a.longitude);
      erroMax = Math.max(
        erroMax,
        separacaoAngular(p.elevacaoGeometricaGraus, p.azimuteGraus, a.elevacaoGeometrica, a.azimute),
      );
    }
    expect(erroMax).toBeLessThan(0.02);
  });

  it('azimute com erro máximo < 0,05° até 75° de elevação', () => {
    // Perto do zênite o azimute muda muito rápido, então um erro minúsculo de
    // posição vira um erro maior de azimute; por isso o teste acima usa a
    // separação angular, e este limita a elevação.
    let erroMax = 0;
    for (const a of referencia.amostras) {
      if (a.elevacaoGeometrica < 1 || a.elevacaoGeometrica > 75) continue;
      const p = calcularPosicaoSolar(new Date(a.instante), a.latitude, a.longitude);
      erroMax = Math.max(erroMax, difAngular(p.azimuteGraus, a.azimute));
    }
    expect(erroMax).toBeLessThan(0.05);
  });

  it('elevação aparente (com refração) com erro < 0,05° acima de 5° de elevação', () => {
    let erroMax = 0;
    for (const a of referencia.amostras) {
      if (a.elevacaoGeometrica < 5) continue;
      const p = calcularPosicaoSolar(new Date(a.instante), a.latitude, a.longitude);
      erroMax = Math.max(erroMax, Math.abs(p.elevacaoGraus - a.elevacaoAparente));
    }
    expect(erroMax).toBeLessThan(0.05);
  });

  it('equação do tempo com erro < 0,1 min', () => {
    let erroMax = 0;
    for (const a of referencia.amostras) {
      const p = calcularPosicaoSolar(new Date(a.instante), a.latitude, a.longitude);
      erroMax = Math.max(erroMax, Math.abs(p.equacaoTempoMin - a.equacaoTempoMin));
    }
    expect(erroMax).toBeLessThan(0.1);
  });
});

describe('calcularPosicaoSolar — comportamento físico', () => {
  it('em Taubaté, no solstício de inverno, o sol do meio-dia fica ao Norte e baixo', () => {
    const p = calcularPosicaoSolar(new Date('2026-06-21T15:04:00Z'), TAUBATE.latitude, TAUBATE.longitude);
    expect(difAngular(p.azimuteGraus, 0)).toBeLessThan(1);
    // 90° − |−23,01 − 23,44| ≈ 43,5°
    expect(p.elevacaoGraus).toBeGreaterThan(43);
    expect(p.elevacaoGraus).toBeLessThan(44);
    expect(p.declinacaoGraus).toBeCloseTo(23.44, 1);
  });

  it('em Taubaté, no solstício de verão, o sol do meio-dia passa quase no zênite', () => {
    const p = calcularPosicaoSolar(new Date('2026-12-21T14:57:00Z'), TAUBATE.latitude, TAUBATE.longitude);
    expect(p.elevacaoGraus).toBeGreaterThan(89);
    expect(p.declinacaoGraus).toBeCloseTo(-23.44, 1);
  });

  it('de manhã o sol está a Leste e à tarde a Oeste', () => {
    const manha = calcularPosicaoSolar(new Date('2026-09-23T12:00:00Z'), TAUBATE.latitude, TAUBATE.longitude);
    const tarde = calcularPosicaoSolar(new Date('2026-09-23T18:00:00Z'), TAUBATE.latitude, TAUBATE.longitude);
    expect(manha.azimuteGraus).toBeGreaterThan(45);
    expect(manha.azimuteGraus).toBeLessThan(135);
    expect(manha.anguloHorarioGraus).toBeLessThan(0);
    expect(tarde.azimuteGraus).toBeGreaterThan(225);
    expect(tarde.azimuteGraus).toBeLessThan(315);
    expect(tarde.anguloHorarioGraus).toBeGreaterThan(0);
  });

  it('à noite a elevação é negativa', () => {
    const p = calcularPosicaoSolar(new Date('2026-09-24T03:00:00Z'), TAUBATE.latitude, TAUBATE.longitude);
    expect(p.elevacaoGraus).toBeLessThan(0);
  });

  it('sem refração, a elevação é a geométrica', () => {
    const instante = new Date('2026-09-23T13:00:00Z');
    const p = calcularPosicaoSolar(instante, TAUBATE.latitude, TAUBATE.longitude, { refracao: false });
    expect(p.elevacaoGraus).toBe(p.elevacaoGeometricaGraus);
  });

  it('refração: ~0,57° no horizonte e zero acima de 85°', () => {
    expect(refracaoAtmosfericaGraus(0)).toBeCloseTo(0.482, 2);
    expect(refracaoAtmosfericaGraus(-0.5)).toBeGreaterThan(0.5);
    expect(refracaoAtmosfericaGraus(86)).toBe(0);
    expect(refracaoAtmosfericaGraus(45)).toBeCloseTo(0.016, 3);
  });

  it('dia juliano de J2000.0', () => {
    expect(diaJuliano(new Date('2000-01-01T12:00:00Z'))).toBe(2451545);
  });

  it('rejeita coordenadas e datas inválidas', () => {
    expect(() => calcularPosicaoSolar(new Date('2026-01-01T12:00:00Z'), -95, 0)).toThrow(ErroValidacao);
    expect(() => calcularPosicaoSolar(new Date('2026-01-01T12:00:00Z'), 0, 181)).toThrow(ErroValidacao);
    expect(() => calcularPosicaoSolar(new Date('data ruim'), 0, 0)).toThrow(ErroValidacao);
  });
});

describe('calcularEventosSolares — nascer, pôr e meio-dia solar vs. SPA', () => {
  it('diferença máxima de 2 minutos em todas as localidades de referência', () => {
    let erroMaxMin = 0;
    for (const e of referencia.eventos) {
      const [ano, mes, dia] = e.data.split('-').map(Number) as [number, number, number];
      const r = calcularEventosSolares(ano, mes, dia, e.latitude, e.longitude, e.fusoHorarioHoras);
      const difs = [
        Math.abs(r.nascer!.getTime() - Date.parse(e.nascer)),
        Math.abs(r.por!.getTime() - Date.parse(e.por)),
        Math.abs(r.meioDiaSolar.getTime() - Date.parse(e.meioDiaSolar)),
      ].map((ms) => ms / 60_000);
      erroMaxMin = Math.max(erroMaxMin, ...difs);
    }
    expect(erroMaxMin).toBeLessThan(2);
  });

  it('trata noite polar e dia polar', () => {
    const noite = calcularEventosSolares(2026, 6, 21, -80, 0, 0);
    expect(noite.nascer).toBeNull();
    expect(noite.duracaoDiaHoras).toBe(0);
    const dia = calcularEventosSolares(2026, 12, 21, -80, 0, 0);
    expect(dia.por).toBeNull();
    expect(dia.duracaoDiaHoras).toBe(24);
  });
});

describe('calcularTrajetoriaDiaria — SCRUM-80 (ao longo do dia)', () => {
  const trajetoria = calcularTrajetoriaDiaria({ ...TAUBATE, data: { ano: 2026, mes: 6, dia: 21 } });

  it('traz nascer, pôr e meio-dia em horário local de Brasília (±1 min do SPA)', () => {
    // SPA (pvlib): nascer 06:42:27, pôr 17:25:42, meio-dia solar 12:04:04 (UTC−3).
    expect(trajetoria.nascerDoSol).toMatch(/^\d{2}:\d{2}$/);
    expect(Math.abs(minutosDe(trajetoria.nascerDoSol) - (6 * 60 + 42.45))).toBeLessThanOrEqual(1);
    expect(Math.abs(minutosDe(trajetoria.porDoSol) - (17 * 60 + 25.7))).toBeLessThanOrEqual(1);
    expect(Math.abs(minutosDe(trajetoria.meioDiaSolar) - (12 * 60 + 4.07))).toBeLessThanOrEqual(1);
    expect(trajetoria.duracaoDiaHoras).toBeCloseTo(10.72, 1);
  });

  it('começa e termina no horizonte e só tem pontos com o sol acima dele', () => {
    const { pontos } = trajetoria;
    expect(pontos[0]!.elevacaoGraus).toBe(0);
    expect(pontos[pontos.length - 1]!.elevacaoGraus).toBe(0);
    expect(pontos.slice(1, -1).every((p) => p.elevacaoGraus > 0)).toBe(true);
    // Pontos internos em grade regular de 10 min (06:50, 07:00, ...).
    expect(pontos[1]!.horaLocal).toBe('06:50');
    expect(pontos[2]!.horaLocal).toBe('07:00');
    expect(pontos[2]!.minutosLocal - pontos[1]!.minutosLocal).toBe(10);
  });

  it('a elevação máxima coincide com o meio-dia solar e o sol fica ao Norte no inverno', () => {
    const maiorPonto = Math.max(...trajetoria.pontos.map((p) => p.elevacaoGraus));
    expect(trajetoria.elevacaoMaximaGraus).toBeGreaterThanOrEqual(maiorPonto - 1e-9);
    expect(trajetoria.elevacaoMaximaGraus).toBeCloseTo(43.6, 0);
    expect(difAngular(trajetoria.azimuteMeioDiaGraus, 0)).toBeLessThan(1);
  });

  it('o sol nasce a Nordeste e se põe a Noroeste no inverno do hemisfério Sul', () => {
    const { pontos } = trajetoria;
    expect(pontos[0]!.azimuteGraus).toBeGreaterThan(55);
    expect(pontos[0]!.azimuteGraus).toBeLessThan(70);
    expect(pontos[pontos.length - 1]!.azimuteGraus).toBeGreaterThan(290);
    expect(pontos[pontos.length - 1]!.azimuteGraus).toBeLessThan(305);
  });

  it('respeita o fuso (Manaus, UTC−4)', () => {
    const manaus = calcularTrajetoriaDiaria({
      latitude: -3.11866,
      longitude: -60.0212,
      fusoHorarioHoras: -4,
      data: { ano: 2026, mes: 3, dia: 20 },
    });
    // Longitude −60,02° com fuso −60° → meio-dia solar ≈ 12:00 + 0,08 min + 7,4 min (equação do tempo).
    expect(Math.abs(minutosDe(manaus.meioDiaSolar) - (12 * 60 + 7.5))).toBeLessThanOrEqual(1);
  });

  it('valida a data', () => {
    expect(ehDataValida({ ano: 2026, mes: 2, dia: 29 })).toBe(false);
    expect(ehDataValida({ ano: 2028, mes: 2, dia: 29 })).toBe(true);
    expect(() => calcularTrajetoriaDiaria({ ...TAUBATE, data: { ano: 2026, mes: 13, dia: 1 } })).toThrow(ErroValidacao);
    expect(() =>
      calcularTrajetoriaDiaria({ ...TAUBATE, data: { ano: 2026, mes: 1, dia: 1 }, passoMinutos: 0 }),
    ).toThrow(ErroValidacao);
  });

  it('formata horas', () => {
    expect(formatarHora(0)).toBe('00:00');
    expect(formatarHora(725.4)).toBe('12:05');
    expect(formatarHora(1440)).toBe('00:00');
  });
});

describe('calcularTrajetoriaAnual — SCRUM-80 (ao longo do ano)', () => {
  const ano = calcularTrajetoriaAnual({ ...TAUBATE, ano: 2026 });

  it('traz um dia por mês (dia 21 por padrão)', () => {
    expect(ano).toHaveLength(12);
    expect(ano.map((t) => t.data.mes)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(ano.every((t) => t.data.dia === 21)).toBe(true);
  });

  it('o dia mais longo é em dezembro e o mais curto em junho (hemisfério Sul)', () => {
    const duracoes = ano.map((t) => t.duracaoDiaHoras);
    expect(duracoes.indexOf(Math.max(...duracoes))).toBe(11);
    expect(duracoes.indexOf(Math.min(...duracoes))).toBe(5);
  });

  it('a elevação máxima é maior no verão que no inverno', () => {
    expect(ano[11]!.elevacaoMaximaGraus).toBeGreaterThan(ano[5]!.elevacaoMaximaGraus + 40);
  });

  it("aceita o dia médio de Klein ('medio')", () => {
    const medio = calcularTrajetoriaAnual({ ...TAUBATE, ano: 2026, diaDoMes: 'medio' });
    expect(medio.map((t) => t.data.dia)).toEqual([17, 16, 16, 15, 15, 11, 17, 16, 15, 15, 14, 10]);
  });

  it('rejeita dia do mês e ano inválidos', () => {
    expect(() => calcularTrajetoriaAnual({ ...TAUBATE, ano: 2026, diaDoMes: 31 })).toThrow(ErroValidacao);
    expect(() => calcularTrajetoriaAnual({ ...TAUBATE, ano: 1800 })).toThrow(ErroValidacao);
  });
});
