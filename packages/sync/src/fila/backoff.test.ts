import { describe, expect, it } from 'vitest';
import { POLITICA_RETENTATIVA_PADRAO, calcularEspera, esperaSemJitter, validarPolitica } from './backoff';

describe('backoff exponencial — SCRUM-82', () => {
  it('a espera dobra a cada falha: 2 s, 4 s, 8 s, 16 s, 32 s', () => {
    expect([1, 2, 3, 4, 5].map((n) => esperaSemJitter(n))).toEqual([2_000, 4_000, 8_000, 16_000, 32_000]);
  });

  it('para no teto de 10 minutos, mesmo depois de muitas falhas', () => {
    expect(esperaSemJitter(9)).toBe(512_000);
    expect(esperaSemJitter(10)).toBe(600_000);
    expect(esperaSemJitter(1_000)).toBe(600_000);
  });

  it('o sorteio (jitter) fica entre 50 % e 100 % da espera', () => {
    expect(calcularEspera(3, POLITICA_RETENTATIVA_PADRAO, () => 0)).toBe(4_000);
    expect(calcularEspera(3, POLITICA_RETENTATIVA_PADRAO, () => 0.5)).toBe(6_000);
    expect(calcularEspera(3, POLITICA_RETENTATIVA_PADRAO, () => 0.999999)).toBe(8_000);
    for (let i = 0; i < 200; i += 1) {
      const espera = calcularEspera(4);
      expect(espera).toBeGreaterThanOrEqual(8_000);
      expect(espera).toBeLessThanOrEqual(16_000);
    }
  });

  it('sem jitter, a espera é exata; com política própria, usa os valores dela', () => {
    const politica = { ...POLITICA_RETENTATIVA_PADRAO, jitter: 0, esperaInicialMs: 1_000, fator: 3, esperaMaximaMs: 20_000 };
    expect([1, 2, 3, 4].map((n) => calcularEspera(n, politica))).toEqual([1_000, 3_000, 9_000, 20_000]);
  });

  it('trata 0 ou número quebrado de falhas como a primeira falha', () => {
    expect(esperaSemJitter(0)).toBe(2_000);
    expect(esperaSemJitter(1.7)).toBe(2_000);
  });

  it('valida a política', () => {
    expect(validarPolitica(POLITICA_RETENTATIVA_PADRAO)).toEqual([]);
    expect(validarPolitica({ ...POLITICA_RETENTATIVA_PADRAO, esperaInicialMs: 0, fator: 0.5, jitter: 2 })).toHaveLength(3);
    expect(validarPolitica({ ...POLITICA_RETENTATIVA_PADRAO, esperaMaximaMs: 1_000, tentativasAteAlerta: 0 })).toHaveLength(2);
  });
});
