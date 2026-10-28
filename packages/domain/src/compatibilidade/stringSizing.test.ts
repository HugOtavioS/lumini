import { describe, expect, it } from 'vitest';
import { ErroValidacao } from '../erros';
import { criarCatalogoInicial } from '../catalogo/seed';
import type { Equipamento } from '../catalogo/tipos';
import {
  especInversorDoEquipamento,
  especModuloDoEquipamento,
  verificarCompatibilidade,
  verificarCompatibilidadeCatalogo,
  type CodigoProblema,
  type ResultadoCompatibilidade,
} from './stringSizing';

const catalogo = criarCatalogoInicial({ idEmpresa: 'empresa', idUsuario: 'usuario', agora: '2026-09-23T12:00:00Z' });
const item = (trecho: string): Equipamento => {
  const eq = catalogo.find((e) => e.modelo.includes(trecho));
  if (!eq) throw new Error(trecho);
  return eq;
};

const CANADIAN_550 = item('CS6W-550MS');
const OSDA_610 = item('ODA610');
const HONOR_700 = item('HY-M12');
const MAXEON_425 = item('MAX3-425');
const MIN_5000 = item('MIN 5000TL-X');
const MIN_10000 = item('MIN 10000TL-X');
const DEYE_6K = item('SUN-6K');
const HOYMILES = item('HMS-2000DW');
const MID_15K = item('MID 15KTL3-X');

function codigos(r: ResultadoCompatibilidade, nivel?: 'erro' | 'alerta' | 'info'): CodigoProblema[] {
  return r.problemas.filter((p) => !nivel || p.nivel === nivel).map((p) => p.codigo);
}

describe('verificarCompatibilidade — SCRUM-395 (string sizing)', () => {
  it('Canadian 550 W × 10 + Growatt MIN 5000TL-X: compatível, 2 strings de 5', () => {
    const r = verificarCompatibilidadeCatalogo({ modulo: CANADIAN_550, quantidadeModulos: 10, inversor: MIN_5000 });
    expect(r.compativel).toBe(true);
    expect(r.bloqueia).toBe(false);
    expect(r.problemas).toEqual([]);
    // Voc a 0 °C: 49,6 × (1 + 0,0026 × 25) = 52,82 V → no máximo 10 módulos (550 V)
    expect(r.valoresPorModulo).toEqual({ vocMaxV: 52.82, vocMinV: 43.8, vmpMinV: 35.32, vmpMaxV: 45.24, iscMaxA: 14.32 });
    expect(r.limitesString).toEqual({ minimo: 3, maximo: 10, recomendadoMin: 3, recomendadoMax: 10 });
    expect(r.descricaoArranjo).toBe('MPPT 1: 1 string de 5 módulos | MPPT 2: 1 string de 5 módulos');
    expect(r.arranjo![0]).toMatchObject({ vocMaxV: 264.12, correnteOperacaoA: 13.2, correnteCurtoMaxA: 14.32 });
    expect(r.relacaoCcCa).toBe(1.1);
    expect(r.potenciaCcKwp).toBe(5.5);
  });

  it('Honor 700 W + Growatt MIN 5000TL-X: bloqueia (curto de 18,8 A > 16,9 A por MPPT)', () => {
    const r = verificarCompatibilidadeCatalogo({ modulo: HONOR_700, quantidadeModulos: 8, inversor: MIN_5000 });
    expect(r.compativel).toBe(false);
    expect(r.bloqueia).toBe(true);
    expect(codigos(r, 'erro')).toEqual(['CORRENTE_CURTO_ACIMA']);
    expect(r.problemas[0]!.mensagem).toContain('18,8 A');
    expect(r.problemas[0]!.mensagem).toContain('16,9 A');
    expect(r.arranjo).toBeNull();
  });

  it('o mesmo módulo de 700 W no Deye SUN-6K (18 A / 27 A por MPPT) é compatível', () => {
    const r = verificarCompatibilidadeCatalogo({ modulo: HONOR_700, quantidadeModulos: 8, inversor: DEYE_6K });
    expect(r.compativel).toBe(true);
    expect(r.descricaoArranjo).toBe('MPPT 1: 1 string de 4 módulos | MPPT 2: 1 string de 4 módulos');
  });

  it('módulos demais para o inversor: erro + alerta de potência CC acima do fabricante', () => {
    const r = verificarCompatibilidadeCatalogo({ modulo: CANADIAN_550, quantidadeModulos: 24, inversor: MIN_5000 });
    expect(codigos(r, 'erro')).toEqual(['MODULOS_DEMAIS']);
    expect(codigos(r, 'alerta')).toEqual(['POTENCIA_CC_ACIMA_FABRICANTE']);
    expect(r.problemas[0]!.mensagem).toContain('no máximo 20');
  });

  it('com dois inversores, os 24 módulos cabem', () => {
    const r = verificarCompatibilidadeCatalogo({
      modulo: CANADIAN_550,
      quantidadeModulos: 24,
      inversor: MIN_5000,
      quantidadeInversores: 2,
    });
    expect(r.compativel).toBe(true);
    expect(r.arranjo!.reduce((s, m) => s + m.strings * m.modulosPorString, 0)).toBe(24);
    expect(new Set(r.arranjo!.map((m) => m.inversor))).toEqual(new Set([1, 2]));
  });

  it('poucos módulos: não atinge a faixa do MPPT/partida', () => {
    const r = verificarCompatibilidadeCatalogo({ modulo: CANADIAN_550, quantidadeModulos: 1, inversor: MIN_5000 });
    expect(codigos(r, 'erro')).toEqual(['MODULOS_DE_MENOS']);
  });

  it('Maxeon 425 W (Voc 40,7 V) × 12 no MIN 5000: 2 strings de 6', () => {
    const r = verificarCompatibilidadeCatalogo({ modulo: MAXEON_425, quantidadeModulos: 12, inversor: MIN_5000 });
    expect(r.compativel).toBe(true);
    expect(r.limitesString.maximo).toBe(12);
    expect(r.descricaoArranjo).toBe('MPPT 1: 1 string de 6 módulos | MPPT 2: 1 string de 6 módulos');
  });
});

describe('microinversor Hoymiles HMS-2000DW-4T (4 entradas, 1 módulo cada)', () => {
  it('4 módulos de 610 W: uma entrada por módulo', () => {
    const r = verificarCompatibilidadeCatalogo({ modulo: OSDA_610, quantidadeModulos: 4, inversor: HOYMILES });
    expect(r.compativel).toBe(true);
    expect(r.limitesString.maximo).toBe(1);
    expect(r.descricaoArranjo).toBe('MPPT 1: 2 strings de 1 módulo | MPPT 2: 2 strings de 1 módulo');
  });

  it('5 módulos exigem 2 microinversores', () => {
    const um = verificarCompatibilidadeCatalogo({ modulo: OSDA_610, quantidadeModulos: 5, inversor: HOYMILES });
    expect(codigos(um, 'erro')).toEqual(['MODULOS_DEMAIS']);
    const dois = verificarCompatibilidadeCatalogo({
      modulo: OSDA_610,
      quantidadeModulos: 5,
      inversor: HOYMILES,
      quantidadeInversores: 2,
    });
    expect(dois.compativel).toBe(true);
    expect(codigos(dois)).not.toContain('INVERSOR_SEM_MODULOS');
  });

  it('módulo de 700 W (17,5 A) funciona, mas com alerta de corrente acima da entrada (clipping)', () => {
    const r = verificarCompatibilidadeCatalogo({ modulo: HONOR_700, quantidadeModulos: 4, inversor: HOYMILES });
    expect(r.compativel).toBe(true);
    expect(r.exigeConfirmacao).toBe(true);
    expect(codigos(r, 'alerta')).toEqual(['CORRENTE_ACIMA_MPPT', 'CORRENTE_ACIMA_MPPT', 'RELACAO_CC_CA_ALTA']);
    // Mensagens iguais em MPPTs diferentes viram uma só.
    expect(r.problemas[0]!.mensagem.startsWith('MPPT 1, MPPT 2:')).toBe(true);
  });
});

describe('inversor com MPPTs diferentes (Growatt MIN 10000TL-X: 13,5 / 13,5 / 27 A)', () => {
  it('20 módulos de 550 W: 7 + 7 + 6', () => {
    const r = verificarCompatibilidadeCatalogo({ modulo: CANADIAN_550, quantidadeModulos: 20, inversor: MIN_10000 });
    expect(r.compativel).toBe(true);
    expect(r.arranjo!.map((m) => m.modulosPorString).sort()).toEqual([6, 7, 7]);
  });

  it('módulo de 700 W: só o MPPT de 27 A aceita a corrente, e 14 módulos não cabem', () => {
    const r = verificarCompatibilidadeCatalogo({ modulo: HONOR_700, quantidadeModulos: 14, inversor: MIN_10000 });
    expect(codigos(r, 'erro')).toEqual(['SEM_ARRANJO_VALIDO']);
    expect(r.problemas[0]!.mensagem).toContain('Só 1 MPPT aceita');
    // 11 módulos cabem, todos no MPPT 3.
    const onze = verificarCompatibilidadeCatalogo({ modulo: HONOR_700, quantidadeModulos: 11, inversor: MIN_10000 });
    expect(onze.compativel).toBe(true);
    expect(onze.arranjo).toEqual([expect.objectContaining({ mppt: 3, strings: 1, modulosPorString: 11 })]);
  });
});

describe('fases e tensão da rede', () => {
  it('inversor trifásico em instalação monofásica: erro', () => {
    const r = verificarCompatibilidadeCatalogo({
      modulo: HONOR_700,
      quantidadeModulos: 30,
      inversor: MID_15K,
      tipoLigacao: 'Monofásica',
    });
    expect(codigos(r, 'erro')).toEqual(['FASES_INCOMPATIVEIS']);
    expect(r.bloqueia).toBe(true);
  });

  it('inversor monofásico em instalação trifásica: só informativo', () => {
    const r = verificarCompatibilidadeCatalogo({
      modulo: CANADIAN_550,
      quantidadeModulos: 10,
      inversor: MIN_5000,
      tipoLigacao: 'Trifásica',
    });
    expect(r.compativel).toBe(true);
    expect(codigos(r)).toEqual(['MONOFASICO_EM_TRIFASICA']);
  });

  it('inversor de 380 V em rede de 220 V: erro', () => {
    const r = verificarCompatibilidadeCatalogo({
      modulo: HONOR_700,
      quantidadeModulos: 30,
      inversor: MID_15K,
      tipoLigacao: 'Trifásica',
      tensaoRedeV: 220,
    });
    expect(codigos(r, 'erro')).toEqual(['TENSAO_CA_INCOMPATIVEL']);
  });

  it('30 módulos de 700 W no MID 15KTL3-X trifásico: 2 strings de 15', () => {
    const r = verificarCompatibilidadeCatalogo({
      modulo: HONOR_700,
      quantidadeModulos: 30,
      inversor: MID_15K,
      tipoLigacao: 'Trifásica',
    });
    expect(r.compativel).toBe(true);
    expect(r.descricaoArranjo).toBe('MPPT 1: 1 string de 15 módulos | MPPT 2: 1 string de 15 módulos');
  });
});

describe('arranjo informado pelo técnico e temperaturas de projeto', () => {
  it('11 módulos em uma string passam da tensão máxima no frio', () => {
    const r = verificarCompatibilidadeCatalogo({
      modulo: CANADIAN_550,
      quantidadeModulos: 11,
      inversor: MIN_5000,
      arranjo: [[{ strings: 1, modulosPorString: 11 }, null]],
    });
    expect(codigos(r, 'erro')).toContain('TENSAO_STRING_ACIMA_MAXIMO');
    expect(r.problemas.find((p) => p.codigo === 'TENSAO_STRING_ACIMA_MAXIMO')!.mensagem).toContain('581,1 V');
  });

  it('em clima mais frio (−20 °C) o limite cai para 9 módulos por string', () => {
    const r = verificarCompatibilidadeCatalogo({
      modulo: CANADIAN_550,
      quantidadeModulos: 10,
      inversor: MIN_5000,
      temperaturaMinimaC: -20,
      arranjo: [[{ strings: 1, modulosPorString: 10 }, null]],
    });
    expect(r.limitesString.maximo).toBe(9);
    expect(codigos(r, 'erro')).toContain('TENSAO_STRING_ACIMA_MAXIMO');
    expect(r.premissas.temperaturaMinimaC).toBe(-20);
  });

  it('string curta: alerta de Vmp abaixo do MPPT em dias quentes', () => {
    const r = verificarCompatibilidadeCatalogo({
      modulo: HONOR_700,
      quantidadeModulos: 10,
      inversor: MID_15K,
      // 5 × 40 V = 200 V em STC (ok), mas a 70 °C cai para 5 × 33,9 = 169,4 V < 200 V.
      arranjo: [[{ strings: 1, modulosPorString: 5 }, { strings: 1, modulosPorString: 5 }]],
    });
    expect(r.compativel).toBe(true);
    expect(codigos(r, 'alerta')).toEqual(['VMP_ABAIXO_MPPT_CALOR']);
    expect(r.problemas[0]!.mensagem).toMatch(/^MPPT 1, MPPT 2: em dias muito quentes/);
  });

  it('sem arranjo informado, prefere strings que não gerem alerta', () => {
    const r = verificarCompatibilidadeCatalogo({ modulo: HONOR_700, quantidadeModulos: 10, inversor: MID_15K });
    expect(r.exigeConfirmacao).toBe(false);
    expect(r.arranjo!.every((m) => m.vmpMinV >= 200)).toBe(true);
  });

  it('arranjo que não soma a quantidade de módulos é inválido', () => {
    const r = verificarCompatibilidadeCatalogo({
      modulo: CANADIAN_550,
      quantidadeModulos: 10,
      inversor: MIN_5000,
      arranjo: [[{ strings: 1, modulosPorString: 5 }, null]],
    });
    expect(codigos(r, 'erro')).toEqual(['ARRANJO_INVALIDO']);
  });

  it('avisa quando um dos inversores escolhidos fica sem módulos', () => {
    const r = verificarCompatibilidadeCatalogo({
      modulo: CANADIAN_550,
      quantidadeModulos: 10,
      inversor: MIN_5000,
      quantidadeInversores: 2,
      arranjo: [
        [
          { strings: 1, modulosPorString: 5 },
          { strings: 1, modulosPorString: 5 },
        ],
        [null, null],
      ],
    });
    expect(codigos(r, 'alerta')).toContain('INVERSOR_SEM_MODULOS');
  });
});

describe('conversão do catálogo e validação', () => {
  it('monta a especificação do módulo e do inversor a partir do catálogo', () => {
    expect(especModuloDoEquipamento(CANADIAN_550)).toMatchObject({ vocV: 49.6, coefTempPmaxPercC: -0.34 });
    expect(especInversorDoEquipamento(MIN_5000).mppts).toEqual([
      { strings: 1, correnteMaxA: 13.5, correnteCurtoMaxA: 16.9 },
      { strings: 1, correnteMaxA: 13.5, correnteCurtoMaxA: 16.9 },
    ]);
    expect(especInversorDoEquipamento(MIN_10000).mppts.map((m) => m.correnteMaxA)).toEqual([13.5, 13.5, 27]);
    expect(especInversorDoEquipamento(HOYMILES)).toMatchObject({ correnteMaxPorStringA: 16, fases: 1 });
  });

  it('exige os dados elétricos no cadastro', () => {
    expect(() => especModuloDoEquipamento({ ...CANADIAN_550, vmpV: null })).toThrow(ErroValidacao);
    expect(() => especInversorDoEquipamento({ ...MIN_5000, qtdMppt: null })).toThrow(ErroValidacao);
    expect(() => especModuloDoEquipamento(MIN_5000)).toThrow(ErroValidacao);
  });

  it('rejeita quantidade inválida', () => {
    expect(() =>
      verificarCompatibilidade({
        modulo: especModuloDoEquipamento(CANADIAN_550),
        inversor: especInversorDoEquipamento(MIN_5000),
        quantidadeModulos: 0,
      }),
    ).toThrow(ErroValidacao);
  });

  it('usa a relação CC/CA máxima (1,3) quando o fabricante não informa a potência CC', () => {
    const r = verificarCompatibilidadeCatalogo({ modulo: HONOR_700, quantidadeModulos: 4, inversor: HOYMILES });
    expect(r.relacaoCcCa).toBe(1.4);
    expect(codigos(r)).toContain('RELACAO_CC_CA_ALTA');
  });

  it('é rápido mesmo com muitos microinversores (200 módulos, 50 inversores)', () => {
    const inicio = performance.now();
    const r = verificarCompatibilidadeCatalogo({
      modulo: OSDA_610,
      quantidadeModulos: 200,
      inversor: HOYMILES,
      quantidadeInversores: 50,
    });
    const ms = performance.now() - inicio;
    expect(r.compativel).toBe(true);
    expect(ms).toBeLessThan(500);
  });
});
