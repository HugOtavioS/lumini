import { describe, expect, it } from 'vitest';
import { ErroValidacao } from '../erros';
import {
  areaDoModuloM2,
  BASE_LEGAL_SUPERDIMENSIONAMENTO,
  verificarEspacoPorPotencia,
  verificarEspacoTelhado,
  verificarSuperdimensionamento,
} from './alertas';

// Módulo de 2278 × 1134 mm (formato 144 meias-células, ~575 W).
const AREA_MODULO = areaDoModuloM2(2278, 1134); // 2,583252 m²

describe('areaDoModuloM2', () => {
  it('converte as dimensões do datasheet (mm) para m²', () => {
    expect(AREA_MODULO).toBeCloseTo(2.583252, 6);
  });

  it('rejeita dimensões inválidas', () => {
    expect(() => areaDoModuloM2(0, 1134)).toThrow(ErroValidacao);
  });
});

describe('verificarEspacoTelhado — SCRUM-392', () => {
  it('ok quando o kit cabe com folga', () => {
    // 9 × 2,583252 × 1,10 = 25,574 m² em 30 m² → 85,2 %
    const r = verificarEspacoTelhado({ areaMedidaM2: 30, quantidadeModulos: 9, areaModuloM2: AREA_MODULO });
    expect(r.nivel).toBe('ok');
    expect(r.cabe).toBe(true);
    expect(r.areaNecessariaM2).toBe(25.57);
    expect(r.ocupacaoPerc).toBe(85.25);
    expect(r.faltaM2).toBe(0);
    expect(r.maximoModulos).toBe(10);
  });

  it('atenção quando a ocupação passa de 90 %', () => {
    const r = verificarEspacoTelhado({ areaMedidaM2: 27, quantidadeModulos: 9, areaModuloM2: AREA_MODULO });
    expect(r.nivel).toBe('atencao');
    expect(r.cabe).toBe(true);
    expect(r.mensagem).toMatch(/Atenção/);
  });

  it('insuficiente quando a área exigida é maior que a medida, informando quantos módulos cabem', () => {
    const r = verificarEspacoTelhado({ areaMedidaM2: 20, quantidadeModulos: 9, areaModuloM2: AREA_MODULO });
    expect(r.nivel).toBe('insuficiente');
    expect(r.cabe).toBe(false);
    expect(r.faltaM2).toBe(5.57);
    expect(r.maximoModulos).toBe(7);
    expect(r.mensagem).toContain('Espaço insuficiente');
    expect(r.mensagem).toContain('25,6 m²');
    expect(r.mensagem).toContain('20,0 m²');
  });

  it('considera exatamente igual como "cabe"', () => {
    const area = 9 * AREA_MODULO * 1.1;
    const r = verificarEspacoTelhado({ areaMedidaM2: area, quantidadeModulos: 9, areaModuloM2: AREA_MODULO });
    expect(r.cabe).toBe(true);
    expect(r.maximoModulos).toBe(9);
  });

  it('aceita folga e limiar personalizados', () => {
    const semFolga = verificarEspacoTelhado({
      areaMedidaM2: 24,
      quantidadeModulos: 9,
      areaModuloM2: AREA_MODULO,
      folgaInstalacaoPerc: 0,
      limiarAtencaoPerc: 99,
    });
    expect(semFolga.areaNecessariaM2).toBe(23.25);
    expect(semFolga.nivel).toBe('ok');
  });

  it('rejeita entradas inválidas', () => {
    expect(() => verificarEspacoTelhado({ areaMedidaM2: 0, quantidadeModulos: 9, areaModuloM2: AREA_MODULO })).toThrow(
      ErroValidacao,
    );
    expect(() =>
      verificarEspacoTelhado({ areaMedidaM2: 30, quantidadeModulos: 2.5, areaModuloM2: AREA_MODULO }),
    ).toThrow(ErroValidacao);
  });
});

describe('verificarEspacoPorPotencia — resumo técnico antes da seleção', () => {
  it('converte a potência em quantidade de módulos de referência', () => {
    // 4,6 kWp / 575 W = 8 módulos → 8 × 2,8416 = 22,73 m²
    const r = verificarEspacoPorPotencia({
      areaMedidaM2: 22,
      potenciaKwp: 4.6,
      potenciaModuloW: 575,
      areaModuloM2: AREA_MODULO,
    });
    expect(r.areaNecessariaM2).toBe(22.73);
    expect(r.nivel).toBe('insuficiente');
    expect(r.maximoModulos).toBe(7);
  });
});

describe('verificarSuperdimensionamento — SCRUM-394', () => {
  it('alerta acima do limite padrão de 20 %', () => {
    const r = verificarSuperdimensionamento({ consumoMensalKwh: 500, geracaoEstimadaKwhMes: 623.8 });
    expect(r.nivel).toBe('alerta');
    expect(r.excedentePerc).toBe(24.76);
    expect(r.excedenteKwhMes).toBe(123.8);
    expect(r.mensagem).toContain('24,8 %');
    expect(r.mensagem).toContain('60 meses');
    expect(r.baseLegal).toBe(BASE_LEGAL_SUPERDIMENSIONAMENTO);
  });

  it('atenção na faixa de 15 % a 20 %', () => {
    expect(verificarSuperdimensionamento({ consumoMensalKwh: 500, geracaoEstimadaKwhMes: 580 }).nivel).toBe('atencao');
    expect(verificarSuperdimensionamento({ consumoMensalKwh: 500, geracaoEstimadaKwhMes: 575 }).nivel).toBe('atencao');
    // Exatamente 20 % ainda não passa do limite.
    expect(verificarSuperdimensionamento({ consumoMensalKwh: 500, geracaoEstimadaKwhMes: 600 }).nivel).toBe('atencao');
    expect(verificarSuperdimensionamento({ consumoMensalKwh: 500, geracaoEstimadaKwhMes: 600.1 }).nivel).toBe('alerta');
  });

  it('ok abaixo de 15 % e quando a geração não cobre o consumo', () => {
    expect(verificarSuperdimensionamento({ consumoMensalKwh: 500, geracaoEstimadaKwhMes: 540 }).nivel).toBe('ok');
    const abaixo = verificarSuperdimensionamento({ consumoMensalKwh: 500, geracaoEstimadaKwhMes: 450 });
    expect(abaixo.nivel).toBe('ok');
    expect(abaixo.excedentePerc).toBe(-10);
    expect(abaixo.excedenteKwhMes).toBe(0);
    expect(abaixo.mensagem).toContain('90,0 %');
  });

  it('usa o limite configurado pela empresa (Parâmetros Técnicos)', () => {
    const r = verificarSuperdimensionamento({ consumoMensalKwh: 500, geracaoEstimadaKwhMes: 560, limiteAlertaPerc: 10 });
    expect(r.nivel).toBe('alerta');
    expect(r.limiteAlertaPerc).toBe(10);
    // Com limite 10 %, a faixa de atenção começa em 7,5 %.
    expect(
      verificarSuperdimensionamento({ consumoMensalKwh: 500, geracaoEstimadaKwhMes: 540, limiteAlertaPerc: 10 }).nivel,
    ).toBe('atencao');
  });

  it('rejeita consumo zero e limites incoerentes', () => {
    expect(() => verificarSuperdimensionamento({ consumoMensalKwh: 0, geracaoEstimadaKwhMes: 100 })).toThrow(
      ErroValidacao,
    );
    expect(() =>
      verificarSuperdimensionamento({
        consumoMensalKwh: 500,
        geracaoEstimadaKwhMes: 600,
        limiteAlertaPerc: 20,
        limiteAtencaoPerc: 30,
      }),
    ).toThrow(ErroValidacao);
  });
});
