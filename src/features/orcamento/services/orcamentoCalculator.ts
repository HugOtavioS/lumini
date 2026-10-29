/**
 * orcamentoCalculator.ts
 *
 * Serviço de cálculos puros de dimensionamento solar.
 * Responsabilidades:
 * - Funções puras (sem side effects, sem dependência de React)
 * - Facilmente testáveis com unit tests
 * - Reutilizáveis fora do contexto de componentes
 *
 * ⚠️ NUNCA importe React ou hooks aqui.
 *    Este arquivo contém apenas lógica de negócio pura.
 */

/**
 * Calcula a quantidade de placas necessárias para suprir o consumo.
 *
 * @param consumoMensalKwh - Consumo médio mensal em kWh
 * @param potenciaPlacaWp  - Potência nominal da placa em Wp
 * @param irradiacaoHSP    - Horas de Sol Pleno da localidade
 * @param perdas           - Fator de perdas do sistema (padrão 20%)
 * @returns Quantidade de placas (arredondado para cima)
 */
export function calcularQuantidadePlacas(
  consumoMensalKwh: number,
  potenciaPlacaWp: number,
  irradiacaoHSP: number,
  perdas: number = 0.2,
): number {
  if (consumoMensalKwh <= 0 || potenciaPlacaWp <= 0 || irradiacaoHSP <= 0) {
    return 0;
  }

  // Geração diária por placa = (Wp / 1000) * HSP * (1 - perdas)
  const geracaoDiariaPlaca =
    (potenciaPlacaWp / 1000) * irradiacaoHSP * (1 - perdas);

  // Geração mensal por placa (30 dias)
  const geracaoMensalPlaca = geracaoDiariaPlaca * 30;

  // Quantidade necessária
  return Math.ceil(consumoMensalKwh / geracaoMensalPlaca);
}

/**
 * Calcula a geração mensal estimada do sistema.
 *
 * @param potenciaKwp   - Potência total do sistema em kWp
 * @param irradiacaoHSP - Horas de Sol Pleno
 * @param perdas        - Fator de perdas (padrão 20%)
 * @returns Geração mensal em kWh
 */
export function calcularGeracaoMensal(
  potenciaKwp: number,
  irradiacaoHSP: number,
  perdas: number = 0.2,
): number {
  return potenciaKwp * irradiacaoHSP * 30 * (1 - perdas);
}

/**
 * Calcula o tempo de retorno do investimento (payback).
 *
 * @param valorInstalacao - Custo total da instalação em R$
 * @param geracaoMensalKwh - Geração mensal estimada em kWh
 * @param tarifaKwh       - Tarifa de energia em R$/kWh
 * @returns Payback em meses
 */
export function calcularPayback(
  valorInstalacao: number,
  geracaoMensalKwh: number,
  tarifaKwh: number,
): number {
  const economiaMensal = geracaoMensalKwh * tarifaKwh;

  if (economiaMensal <= 0) return Infinity;

  return Math.ceil(valorInstalacao / economiaMensal);
}

/**
 * Calcula a área mínima de telhado necessária.
 *
 * @param quantidadePlacas - Número de placas do sistema
 * @param larguraPlaca     - Largura da placa em metros (padrão 1.13m)
 * @param alturaPlaca      - Altura da placa em metros (padrão 2.27m)
 * @param espacamento      - Espaço entre placas em metros (padrão 0.02m)
 * @returns Área mínima em m²
 */
export function calcularAreaMinima(
  quantidadePlacas: number,
  larguraPlaca: number = 1.13,
  alturaPlaca: number = 2.27,
  espacamento: number = 0.02,
): number {
  const areaPlaca =
    (larguraPlaca + espacamento) * (alturaPlaca + espacamento);
  return Number((quantidadePlacas * areaPlaca).toFixed(2));
}
