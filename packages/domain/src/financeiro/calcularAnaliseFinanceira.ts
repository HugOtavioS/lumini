/**
 * calcularAnaliseFinanceira.ts
 *
 * SCRUM-24 — Payback, ROI e economia acumulada (RF11 / RN04).
 *
 * Modelo (ano a ano, n = 1..horizonte):
 *   geração_n = geração_ano1 × (1 − degradação)^(n − 1)
 *   tarifa_n  = tarifa_ano1  × (1 + reajuste)^(n − 1)
 *   economia_n = geração_n × tarifa_n
 *   payback: primeiro ano em que a economia acumulada ≥ investimento, com
 *            resolução mensal (economia do ano distribuída igualmente nos 12 meses).
 *   ROI (%) = (economia acumulada no horizonte − investimento) / investimento × 100
 *
 * Premissas simplificadoras (ver pendências):
 * - Toda a energia gerada é valorada pela tarifa cheia (não considera Lei 14.300/Fio B,
 *   custo de disponibilidade, autoconsumo × injeção, O&M ou troca de inversor).
 * - Sem desconto a valor presente (ROI e payback simples, não descontados).
 *
 * ⚠️ Função pura: sem banco, rede ou React.
 */

import {
  DEGRADACAO_ANUAL_MODULOS_PADRAO,
  geracaoNoAno,
  HORIZONTE_ANALISE_ANOS_PADRAO,
  validarParametrosProjecao,
} from '../energia/projecaoGeracao';
import type { PrecoTotalProposta } from './PrecoTotalProposta';

export interface PremissasEconomicas {
  /** Reajuste anual da tarifa de energia (0,05 = 5% a.a.). */
  reajusteTarifarioAnual: number;
  /** Perda anual de potência dos módulos (0,005 = 0,5% a.a.). */
  degradacaoAnualModulos: number;
  horizonteAnos: number;
}

/**
 * Premissas padrão.
 *
 * reajusteTarifarioAnual = 0 é um PLACEHOLDER CONSERVADOR, não um dado:
 * TODO: definir com o negócio o reajuste a adotar (ex.: média histórica dos
 * reajustes da distribuidora publicados pela ANEEL, ou IPCA) e citar a fonte aqui.
 * Com 0, a economia projetada não considera aumento da tarifa (subestima o retorno).
 */
export const PREMISSAS_ECONOMICAS_PADRAO: PremissasEconomicas = {
  reajusteTarifarioAnual: 0,
  degradacaoAnualModulos: DEGRADACAO_ANUAL_MODULOS_PADRAO,
  horizonteAnos: HORIZONTE_ANALISE_ANOS_PADRAO,
};

export interface EntradaAnaliseFinanceira {
  precoTotal: PrecoTotalProposta;
  /** Geração estimada no primeiro ano, em kWh (já com perdas do sistema, SCRUM-74). */
  geracaoAnualKwh: number;
  /** Tarifa de energia no primeiro ano, em R$/kWh. */
  tarifaKwh: number;
  premissas?: Partial<PremissasEconomicas>;
}

export interface AnoAnaliseFinanceira {
  ano: number;
  geracaoKwh: number;
  tarifaKwh: number;
  economia: number;
  economiaAcumulada: number;
  /** Economia acumulada − investimento (negativo até o payback). */
  saldo: number;
}

export interface Payback {
  anos: number;
  meses: number;
  totalMeses: number;
}

export interface AnaliseFinanceira {
  investimento: number;
  premissas: PremissasEconomicas;
  serie: AnoAnaliseFinanceira[];
  /** Economia acumulada ao fim do horizonte. */
  economiaAcumulada: number;
  roiPercentual: number;
  /** null quando o investimento não se paga dentro do horizonte. */
  payback: Payback | null;
  /** Ano em que o acumulado supera o investimento; null se não ocorre no horizonte. */
  anoRetorno: number | null;
}

export class EntradaAnaliseFinanceiraInvalidaError extends RangeError {
  constructor(readonly erros: string[]) {
    super(`Entrada inválida para análise financeira: ${erros.join(' ')}`);
    this.name = 'EntradaAnaliseFinanceiraInvalidaError';
  }
}

/** Tolerância para ruído de ponto flutuante ao arredondar meses (ex.: 5.0000000001). */
const EPSILON_MESES = 1e-9;
const MESES_POR_ANO = 12;

function validarEntrada(
  investimento: number,
  entrada: EntradaAnaliseFinanceira,
  premissas: PremissasEconomicas,
): string[] {
  const erros: string[] = [];
  if (!Number.isFinite(investimento) || investimento <= 0) {
    erros.push('Preço total deve ser maior que zero.');
  }
  if (!Number.isFinite(entrada.tarifaKwh) || entrada.tarifaKwh < 0) {
    erros.push('Tarifa deve ser um número maior ou igual a zero.');
  }
  if (
    !Number.isFinite(premissas.reajusteTarifarioAnual) ||
    premissas.reajusteTarifarioAnual <= -1
  ) {
    erros.push('Reajuste tarifário anual deve ser maior que −100%.');
  }
  return [
    ...erros,
    ...validarParametrosProjecao(
      entrada.geracaoAnualKwh,
      premissas.degradacaoAnualModulos,
      premissas.horizonteAnos,
    ),
  ];
}

export function calcularAnaliseFinanceira(
  entrada: EntradaAnaliseFinanceira,
): AnaliseFinanceira {
  const premissas: PremissasEconomicas = {
    ...PREMISSAS_ECONOMICAS_PADRAO,
    ...entrada.premissas,
  };
  const investimento = entrada.precoTotal.valorTotal;

  const erros = validarEntrada(investimento, entrada, premissas);
  if (erros.length > 0) {
    throw new EntradaAnaliseFinanceiraInvalidaError(erros);
  }

  const serie: AnoAnaliseFinanceira[] = [];
  let acumulado = 0;
  let payback: Payback | null = null;
  let anoRetorno: number | null = null;

  for (let ano = 1; ano <= premissas.horizonteAnos; ano++) {
    const geracaoKwh = geracaoNoAno(
      entrada.geracaoAnualKwh,
      premissas.degradacaoAnualModulos,
      ano,
    );
    const tarifaKwh = entrada.tarifaKwh * (1 + premissas.reajusteTarifarioAnual) ** (ano - 1);
    const economia = geracaoKwh * tarifaKwh;
    const acumuladoAnterior = acumulado;
    acumulado += economia;

    if (anoRetorno === null && acumulado >= investimento) {
      anoRetorno = ano;
      const economiaMensal = economia / MESES_POR_ANO;
      const mesesNoAno = Math.ceil(
        (investimento - acumuladoAnterior) / economiaMensal - EPSILON_MESES,
      );
      const totalMeses = (ano - 1) * MESES_POR_ANO + Math.max(1, mesesNoAno);
      payback = {
        anos: Math.floor(totalMeses / MESES_POR_ANO),
        meses: totalMeses % MESES_POR_ANO,
        totalMeses,
      };
    }

    serie.push({
      ano,
      geracaoKwh,
      tarifaKwh,
      economia,
      economiaAcumulada: acumulado,
      saldo: acumulado - investimento,
    });
  }

  return {
    investimento,
    premissas,
    serie,
    economiaAcumulada: acumulado,
    roiPercentual: ((acumulado - investimento) / investimento) * 100,
    payback,
    anoRetorno,
  };
}
