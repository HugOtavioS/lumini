/**
 * calcularCO2Evitado.ts
 *
 * SCRUM-88 — CO₂ que deixa de ser emitido pela geração solar (RF11 / RN10, Apêndice A).
 *
 *   CO₂ evitado (kg/ano) = geração anual (kWh) × fator de emissão da rede (kgCO₂/kWh)
 *
 * A série de 25 anos aplica a mesma degradação do cálculo financeiro (projecaoGeracao).
 * O fator de emissão é considerado constante no horizonte (premissa simplificadora).
 *
 * ⚠️ Função pura: sem banco, rede ou React.
 * ⚠️ Equivalências (ex.: árvores) NÃO implementadas: dependem do Apêndice A (pendência).
 */

import {
  DEGRADACAO_ANUAL_MODULOS_PADRAO,
  geracaoNoAno,
  HORIZONTE_ANALISE_ANOS_PADRAO,
  validarParametrosProjecao,
} from '../energia/projecaoGeracao';

export interface FatorEmissaoRede {
  /**
   * kgCO₂ por kWh. O MCTI publica em tCO₂/MWh, que é numericamente igual a kgCO₂/kWh.
   */
  kgCo2PorKwh: number;
  fonte: string;
  anoReferencia: number;
}

/**
 * Fator de emissão do Sistema Interligado Nacional (SIN).
 *
 * TODO: PLACEHOLDER — valor não confirmado nesta entrega, por isso null.
 * Preencher com o fator publicado pelo MCTI ("Fatores de Emissão de CO₂ do SIN"),
 * citando o ano de referência. Definir com o negócio qual fator usar:
 * - fator médio anual (inventários; o mais usado em propostas comerciais), ou
 * - margem combinada (metodologia MDL, mais rigorosa para "emissão evitada").
 * Enquanto for null, a UI exibe "fator de emissão não configurado".
 */
export const FATOR_EMISSAO_SIN: FatorEmissaoRede | null = null;

export class EntradaCO2InvalidaError extends RangeError {
  constructor(readonly erros: string[]) {
    super(`Entrada inválida para cálculo de CO₂: ${erros.join(' ')}`);
    this.name = 'EntradaCO2InvalidaError';
  }
}

function validarFator(kgCo2PorKwh: number): string[] {
  return Number.isFinite(kgCo2PorKwh) && kgCo2PorKwh >= 0
    ? []
    : ['Fator de emissão deve ser um número maior ou igual a zero.'];
}

/**
 * CO₂ evitado em um ano, em kg.
 * @param geracaoAnualKwh - Geração anual em kWh
 * @param fatorEmissao    - Fator de emissão da rede em kgCO₂/kWh
 */
export function calcularCO2Evitado(geracaoAnualKwh: number, fatorEmissao: number): number {
  const erros = [
    ...(Number.isFinite(geracaoAnualKwh) && geracaoAnualKwh >= 0
      ? []
      : ['Geração anual deve ser um número maior ou igual a zero.']),
    ...validarFator(fatorEmissao),
  ];
  if (erros.length > 0) throw new EntradaCO2InvalidaError(erros);

  return geracaoAnualKwh * fatorEmissao;
}

export interface EntradaSerieCO2 {
  /** Geração no primeiro ano, em kWh. */
  geracaoAnualKwh: number;
  /** kgCO₂/kWh. */
  fatorEmissao: number;
  degradacaoAnual?: number;
  horizonteAnos?: number;
}

export interface AnoCO2Evitado {
  ano: number;
  geracaoKwh: number;
  co2EvitadoKg: number;
  co2AcumuladoKg: number;
}

export interface ImpactoAmbiental {
  serie: AnoCO2Evitado[];
  co2AnoUmKg: number;
  co2TotalKg: number;
  co2TotalToneladas: number;
  horizonteAnos: number;
}

export const KG_POR_TONELADA = 1000;

export function calcularSerieCO2Evitado(entrada: EntradaSerieCO2): ImpactoAmbiental {
  const degradacao = entrada.degradacaoAnual ?? DEGRADACAO_ANUAL_MODULOS_PADRAO;
  const horizonte = entrada.horizonteAnos ?? HORIZONTE_ANALISE_ANOS_PADRAO;

  const erros = [
    ...validarParametrosProjecao(entrada.geracaoAnualKwh, degradacao, horizonte),
    ...validarFator(entrada.fatorEmissao),
  ];
  if (erros.length > 0) throw new EntradaCO2InvalidaError(erros);

  const serie: AnoCO2Evitado[] = [];
  let acumulado = 0;

  for (let ano = 1; ano <= horizonte; ano++) {
    const geracaoKwh = geracaoNoAno(entrada.geracaoAnualKwh, degradacao, ano);
    const co2EvitadoKg = calcularCO2Evitado(geracaoKwh, entrada.fatorEmissao);
    acumulado += co2EvitadoKg;
    serie.push({ ano, geracaoKwh, co2EvitadoKg, co2AcumuladoKg: acumulado });
  }

  return {
    serie,
    co2AnoUmKg: serie[0]?.co2EvitadoKg ?? 0,
    co2TotalKg: acumulado,
    co2TotalToneladas: acumulado / KG_POR_TONELADA,
    horizonteAnos: horizonte,
  };
}
