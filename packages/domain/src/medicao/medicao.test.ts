import { describe, expect, it } from 'vitest';
import { ErroValidacao } from '../erros';
import { areaPoligono3D, medirPoligono, orientacaoDoAzimute, type Ponto3D } from './geometria3d';
import { avaliarCalibracao, consolidarCalibracao } from './calibracao';
import { avaliarRegistros, gerarRelatorioCalibracao, lerRegistroCalibracao } from './relatorioCalibracao';

/** Retângulo de `largura` (eixo X) × `comprimento` (na descida), inclinado `beta` graus, descendo para −Z. */
function telhado(largura: number, comprimento: number, beta: number, altura = 3): Ponto3D[] {
  const b = (beta * Math.PI) / 180;
  const dy = comprimento * Math.sin(b);
  const dz = comprimento * Math.cos(b);
  return [
    { x: 0, y: altura, z: 0 },
    { x: largura, y: altura, z: 0 },
    { x: largura, y: altura - dy, z: -dz },
    { x: 0, y: altura - dy, z: -dz },
  ];
}

describe('medirPoligono — geometria da medição por RA', () => {
  it('telhado de 4 × 3 m, 20°, descendo para a frente da câmera', () => {
    // Câmera começou apontando para o Norte (rumo 0°): o telhado está voltado para o Norte.
    const m = medirPoligono(telhado(4, 3, 20), { rumoInicialGraus: 0 });
    expect(m.areaM2).toBe(12);
    expect(m.inclinacaoGraus).toBe(20);
    expect(m.azimuteGraus).toBe(0);
    expect(m.orientacao).toBe('N');
    expect(m.ladosM).toEqual([4, 3, 4, 3]);
    expect(m.perimetroM).toBe(14);
    expect(m.desvioPlanaridadeM).toBe(0);
  });

  it('usa o rumo inicial da bússola para achar a orientação real', () => {
    expect(medirPoligono(telhado(4, 3, 20), { rumoInicialGraus: 90 })).toMatchObject({ azimuteGraus: 90, orientacao: 'L' });
    expect(medirPoligono(telhado(4, 3, 20), { rumoInicialGraus: 200 })).toMatchObject({ azimuteGraus: 200, orientacao: 'S' });
  });

  it('a ordem dos vértices (horário/anti-horário) não muda o resultado', () => {
    const invertido = [...telhado(4, 3, 20)].reverse();
    expect(medirPoligono(invertido, { rumoInicialGraus: 0 })).toMatchObject({ areaM2: 12, inclinacaoGraus: 20, azimuteGraus: 0 });
  });

  it('piso plano: inclinação zero e sem azimute (face voltada para cima)', () => {
    const piso: Ponto3D[] = [
      { x: 0, y: 0, z: 0 },
      { x: 4, y: 0, z: 0 },
      { x: 4, y: 0, z: -3 },
      { x: 0, y: 0, z: -3 },
    ];
    const m = medirPoligono(piso, { rumoInicialGraus: 0 });
    expect(m).toMatchObject({ areaM2: 12, inclinacaoGraus: 0, azimuteGraus: null, orientacao: null });
  });

  it('sem bússola, calcula área e inclinação mas não a orientação', () => {
    expect(medirPoligono(telhado(4, 3, 30))).toMatchObject({ areaM2: 12, inclinacaoGraus: 30, azimuteGraus: null });
  });

  it('polígono em L (6 vértices) e desvio de planaridade', () => {
    const l: Ponto3D[] = [
      { x: 0, y: 0, z: 0 },
      { x: 4, y: 0, z: 0 },
      { x: 4, y: 0, z: -2 },
      { x: 2, y: 0, z: -2 },
      { x: 2, y: 0, z: -4 },
      { x: 0, y: 0.05, z: -4 },
    ];
    const m = medirPoligono(l);
    expect(m.areaM2).toBeCloseTo(12, 1);
    expect(m.desvioPlanaridadeM).toBeGreaterThan(0.01);
    expect(areaPoligono3D(telhado(5, 2, 10))).toBeCloseTo(10, 10);
  });

  it('rejeita menos de 3 vértices e pontos alinhados', () => {
    expect(() => medirPoligono([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }])).toThrow(ErroValidacao);
    expect(() =>
      medirPoligono([
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 2, y: 0, z: 0 },
      ]),
    ).toThrow(/alinhados/);
  });

  it('orientação cardinal mais próxima', () => {
    expect(orientacaoDoAzimute(10)).toBe('N');
    expect(orientacaoDoAzimute(350)).toBe('N');
    expect(orientacaoDoAzimute(130)).toBe('SE');
    expect(orientacaoDoAzimute(-90)).toBe('O');
  });
});

describe('avaliarCalibracao — SCRUM-79', () => {
  it('comprimento aprovado: todas as medições dentro de ±3 %', () => {
    const r = avaliarCalibracao({ grandeza: 'comprimento', valorReferencia: 4, medicoes: [3.98, 4.03, 4.05, 3.97, 4.02] });
    expect(r.aprovado).toBe(true);
    expect(r.quantidade).toBe(5);
    expect(r.media).toBe(4.01);
    expect(r.erroMaximo).toBe(0.05);
    expect(r.erroMaximoPerc).toBe(1.25);
    expect(r.dentroDaToleranciaPerc).toBe(100);
    expect(r.fatorCorrecaoSugerido).toBeNull();
    expect(r.resumo).toMatch(/^Aprovado: 5 de 5/);
  });

  it('área com viés sistemático: reprovada, com fator de correção sugerido', () => {
    // A RA mede sempre ~6 % a mais que os 12 m² do cômodo.
    const r = avaliarCalibracao({ grandeza: 'area', valorReferencia: 12, medicoes: [12.7, 12.75, 12.72, 12.68, 12.74] });
    expect(r.aprovado).toBe(false);
    expect(r.viesPerc).toBeCloseTo(5.98, 1);
    expect(r.fatorCorrecaoSugerido).toBeCloseTo(0.9437, 3);
    expect(r.aprovadoComCorrecao).toBe(true);
    expect(r.resumo).toContain('fator de correção sugerido');
  });

  it('inclinação usa tolerância absoluta (±2°)', () => {
    expect(avaliarCalibracao({ grandeza: 'inclinacao', valorReferencia: 20, medicoes: [19, 21.5, 20.3] }).aprovado).toBe(true);
    expect(avaliarCalibracao({ grandeza: 'inclinacao', valorReferencia: 20, medicoes: [19, 23, 20.3] }).aprovado).toBe(false);
  });

  it('azimute trata a volta de 360° (358° e 4° contra 0°)', () => {
    const r = avaliarCalibracao({ grandeza: 'azimute', valorReferencia: 0, medicoes: [358, 4, 2, 356] });
    expect(r.aprovado).toBe(true);
    expect(r.erroMaximo).toBe(4);
    expect(Math.abs(r.vies)).toBeLessThan(1);
    expect(r.fatorCorrecaoSugerido).toBeNull();
  });

  it('aceita tolerância personalizada', () => {
    const r = avaliarCalibracao({
      grandeza: 'comprimento',
      valorReferencia: 4,
      medicoes: [4.1, 4.12],
      tolerancia: { relativaPerc: 5 },
    });
    expect(r.aprovado).toBe(true);
  });

  it('rejeita referência inválida e menos de 2 medições', () => {
    expect(() => avaliarCalibracao({ grandeza: 'area', valorReferencia: 0, medicoes: [1, 2] })).toThrow(ErroValidacao);
    expect(() => avaliarCalibracao({ grandeza: 'comprimento', valorReferencia: 4, medicoes: [4] })).toThrow(ErroValidacao);
  });

  it('aparelho só é "calibrado" se todas as grandezas passarem', () => {
    const ok = consolidarCalibracao([
      { grandeza: 'comprimento', valorReferencia: 4, medicoes: [4.01, 3.99, 4.02] },
      { grandeza: 'area', valorReferencia: 12, medicoes: [12.1, 11.9, 12.2] },
    ]);
    expect(ok.calibrada).toBe(true);
    const falhou = consolidarCalibracao([
      { grandeza: 'comprimento', valorReferencia: 4, medicoes: [4.01, 3.99, 4.02] },
      { grandeza: 'azimute', valorReferencia: 90, medicoes: [70, 110] },
    ]);
    expect(falhou.calibrada).toBe(false);
    expect(falhou.resumo).toContain('orientação (azimute)');
  });
});

describe('registro CSV e relatório da calibração', () => {
  const csv = [
    'data;dispositivo;sistema;grandeza;referencia;medido;observacoes',
    '2026-11-12;Galaxy A54;Android 14 (ARCore);comprimento;4,00;3,98;sala 1',
    '2026-11-12;Galaxy A54;Android 14 (ARCore);comprimento;4,00;4,03;',
    '2026-11-12;Galaxy A54;Android 14 (ARCore);area;12,00;12,10;',
    '2026-11-12;Galaxy A54;Android 14 (ARCore);area;12,00;11,85;',
    '2026-11-12;iPhone 12;iOS 18 (ARKit);area;12,00;12,05;',
    '2026-11-12;iPhone 12;iOS 18 (ARKit);area;12,00;13,20;tracking perdido',
    '2026-11-12;iPhone 12;iOS 18 (ARKit);altura;2,80;2,79;grandeza fora do protocolo',
  ].join('\n');

  it('lê o CSV (vírgula decimal) e ignora linhas inválidas', () => {
    const { registros, ignoradas } = lerRegistroCalibracao(csv);
    expect(registros).toHaveLength(6);
    expect(ignoradas).toEqual([8]);
    expect(registros[0]).toMatchObject({ dispositivo: 'Galaxy A54', grandeza: 'comprimento', referencia: 4, medido: 3.98 });
  });

  it('avalia por aparelho e gera o relatório em Markdown', () => {
    const avaliacoes = avaliarRegistros(lerRegistroCalibracao(csv).registros);
    expect(avaliacoes.map((a) => [a.dispositivo, a.calibrada])).toEqual([
      ['Galaxy A54', true],
      ['iPhone 12', false],
    ]);
    const md = gerarRelatorioCalibracao(avaliacoes);
    expect(md).toContain('# Relatório de calibração da RA (SCRUM-79)');
    expect(md).toContain('## Galaxy A54 (Android 14 (ARCore)) — ✅ calibrado');
    expect(md).toContain('## iPhone 12 (iOS 18 (ARKit)) — ❌ não calibrado');
    expect(md).toContain('| área | 12 m² | 2 |');
  });
});
