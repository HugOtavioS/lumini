/**
 * projecaoGeracao.ts
 *
 * SCRUM-24 / SCRUM-88 — Projeção da geração ao longo da vida útil, compartilhada
 * pelos cálculos financeiro e ambiental (mesma premissa de degradação nos dois).
 *
 * ⚠️ Função pura, sem dependências.
 */

/**
 * Horizonte padrão de análise, em anos (definido no SCRUM-24).
 * Coincide com o prazo usual da garantia de performance linear dos fabricantes de módulos.
 */
export const HORIZONTE_ANALISE_ANOS_PADRAO = 25;

/**
 * Degradação anual padrão da potência dos módulos: 0,5% ao ano.
 * Fonte: Jordan, D. C.; Kurtz, S. R. "Photovoltaic Degradation Rates — An Analytical
 * Review". Progress in Photovoltaics, v. 21, n. 1, p. 12–29, 2013 (NREL), que reporta
 * mediana de 0,5%/ano.
 * Sempre que possível, usar o valor do datasheet do módulo selecionado (SCRUM-75).
 */
export const DEGRADACAO_ANUAL_MODULOS_PADRAO = 0.005;

/**
 * Geração no ano `ano` (1 = primeiro ano), com degradação composta:
 * geração_ano = geração_ano1 × (1 − degradação)^(ano − 1).
 */
export function geracaoNoAno(
  geracaoAnoUmKwh: number,
  degradacaoAnual: number,
  ano: number,
): number {
  return geracaoAnoUmKwh * (1 - degradacaoAnual) ** (ano - 1);
}

/** Mensagens de erro de validação dos parâmetros de projeção (vazio = válido). */
export function validarParametrosProjecao(
  geracaoAnoUmKwh: number,
  degradacaoAnual: number,
  horizonteAnos: number,
): string[] {
  const erros: string[] = [];
  if (!Number.isFinite(geracaoAnoUmKwh) || geracaoAnoUmKwh < 0) {
    erros.push('Geração anual deve ser um número maior ou igual a zero.');
  }
  if (!Number.isFinite(degradacaoAnual) || degradacaoAnual < 0 || degradacaoAnual >= 1) {
    erros.push('Degradação anual deve estar entre 0 (inclusive) e 1 (exclusive).');
  }
  if (!Number.isInteger(horizonteAnos) || horizonteAnos < 1) {
    erros.push('Horizonte deve ser um número inteiro de anos maior ou igual a 1.');
  }
  return erros;
}
