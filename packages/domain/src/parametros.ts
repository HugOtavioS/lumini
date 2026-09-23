/**
 * Parâmetros técnicos usados pelos cálculos do pacote.
 *
 * Na aplicação, esses valores vêm da tabela **Parâmetros Técnicos** da empresa
 * (Dicionário de Dados, seção 4.2), baixada no pull (RF15). Os valores abaixo
 * são apenas uma sugestão inicial para testes e para empresas que ainda não
 * configuraram os próprios parâmetros.
 */
export interface ParametrosTecnicosCalculo {
  /** Perda por temperatura dos módulos (%). Coluna `perda_temperatura_perc`. */
  perdaTemperaturaPerc: number;
  /** Perda por sujeira (%). Coluna `perda_sujeira_perc`. */
  perdaSujeiraPerc: number;
  /** Perda ôhmica no cabeamento CC/CA (%). Coluna `perda_cabeamento_perc`. */
  perdaCabeamentoPerc: number;
  /** Sombreamento usado quando não há simulação nem valor informado (RF05, subfluxo 3.1). */
  sombreamentoPadraoPerc: number;
  /** Limite do alerta de superdimensionamento (Lei 14.300). Coluna `limite_superdimensionamento_perc`. */
  limiteSuperdimensionamentoPerc: number;
  /** Menor temperatura ambiente esperada no local (°C) — usada no Voc máximo do string sizing. */
  temperaturaMinimaAmbienteC: number;
  /** Maior temperatura de célula esperada (°C) — usada no Vmp mínimo do string sizing. */
  temperaturaMaximaCelulaC: number;
}

/**
 * Sugestão inicial de parâmetros (configurável por empresa).
 *
 * - Perdas: 10 % temperatura, 3 % sujeira e 2 % cabeamento, faixas usuais em
 *   projetos residenciais no Brasil; sombreamento padrão de 3 %.
 * - Superdimensionamento: 20 %, o `default` do Dicionário de Dados.
 * - Temperaturas: 0 °C de mínima ambiente (conservador para a maior parte do
 *   Sudeste; use valores menores no Sul/serras) e 70 °C de máxima de célula.
 */
export const PARAMETROS_TECNICOS_PADRAO: Readonly<ParametrosTecnicosCalculo> = Object.freeze({
  perdaTemperaturaPerc: 10,
  perdaSujeiraPerc: 3,
  perdaCabeamentoPerc: 2,
  sombreamentoPadraoPerc: 3,
  limiteSuperdimensionamentoPerc: 20,
  temperaturaMinimaAmbienteC: 0,
  temperaturaMaximaCelulaC: 70,
});
