/**
 * SCRUM-12 — lógica matemática de dimensionamento fotovoltaico (client-side).
 *
 * Tudo aqui é cálculo puro: nenhuma função acessa rede, banco ou relógio, então
 * o fluxo roda offline e em poucos milissegundos (RNF01 pede até 3 s).
 *
 * Fórmula central (RN01):
 *
 *     kWp = Consumo / (HSP × 30 × (1 − Perdas))
 *
 * onde Consumo é a média mensal em kWh, HSP são as horas de sol pleno
 * (kWh/m²/dia) e Perdas é a fração total de perdas (0 a 1).
 *
 * Convenção de dias: RN01 usa 30 dias por mês. Para manter os números
 * coerentes entre si, a geração mensal também usa 30 dias por mês e a anual é
 * 12 × a mensal (assim, um sistema com exatamente a potência necessária gera
 * exatamente o consumo informado). O parâmetro `diasPorMes` permite mudar
 * isso, mas o valor deve ser o mesmo no app e na web.
 */
import { garantirSemErros, ehNumeroFinito, type ErroCampo } from '../erros';
import { arredondar, CASAS_DECIMAIS } from '../util/numeros';
import {
  calcularPerdasTotais,
  validarPerdas,
  type ComponentesPerdas,
  type MetodoCombinacaoPerdas,
} from './perdas';

/** Dias por mês usados em RN01. */
export const DIAS_POR_MES_PADRAO = 30;

/** Maior HSP plausível (kWh/m²/dia). Acima disso o dado de entrada está errado. */
export const HSP_MAXIMO_PLAUSIVEL = 12;

export interface EntradaDimensionamento {
  /** Consumo médio mensal da instalação (kWh/mês). Coluna `consumo_mensal_kwh`. */
  consumoMensalKwh: number;
  /** HSP médio anual da localidade (kWh/m²/dia) — vem do RF08/SCRUM-8. */
  hspMedio: number;
  /** Perdas do sistema (temperatura, sujeira, cabeamento e sombreamento). */
  perdas: ComponentesPerdas;
  /** Método de combinação das perdas. Padrão: `aditivo` (Dicionário de Dados). */
  metodoPerdas?: MetodoCombinacaoPerdas;
  /**
   * HSP de cada mês (jan→dez), opcional. Quando informado, o resultado traz a
   * geração estimada mês a mês (útil para o gráfico da proposta).
   */
  hspMensal?: readonly number[];
  /** Dias por mês (padrão 30, RN01). */
  diasPorMes?: number;
}

export interface GeracaoEstimada {
  /** Geração média mensal (kWh/mês). */
  mediaMensalKwh: number;
  /** Geração anual (kWh/ano) = 12 × média mensal. */
  anualKwh: number;
  /** Geração de cada mês (jan→dez), quando o HSP mensal é conhecido. */
  porMesKwh?: number[];
}

export interface ResultadoDimensionamento {
  /** Potência necessária para cobrir o consumo (kWp), arredondada a 2 casas. */
  potenciaNecessariaKwp: number;
  /** Perda total aplicada (%). */
  perdasTotaisPerc: number;
  /** Fração de energia aproveitada, 1 − perdas. */
  fatorDesempenho: number;
  /** Geração estimada com a potência necessária (≈ consumo, por construção). */
  geracao: GeracaoEstimada;
  /** Valores usados no cálculo, para exibir no resumo técnico e salvar na proposta. */
  premissas: {
    consumoMensalKwh: number;
    hspMedio: number;
    diasPorMes: number;
    metodoPerdas: MetodoCombinacaoPerdas;
  };
}

function validarHsp(hsp: number, campo: string, erros: ErroCampo[]): void {
  if (!ehNumeroFinito(hsp)) {
    erros.push({ campo, mensagem: 'HSP indisponível: obtenha o HSP da localidade antes de dimensionar.' });
  } else if (hsp <= 0 || hsp > HSP_MAXIMO_PLAUSIVEL) {
    erros.push({ campo, mensagem: `O HSP deve estar entre 0 e ${HSP_MAXIMO_PLAUSIVEL} kWh/m²/dia.` });
  }
}

function validarHspMensal(hspMensal: readonly number[] | undefined, erros: ErroCampo[]): void {
  if (hspMensal === undefined) return;
  if (hspMensal.length !== 12) {
    erros.push({ campo: 'hspMensal', mensagem: 'O HSP mensal precisa ter 12 valores (janeiro a dezembro).' });
    return;
  }
  hspMensal.forEach((valor, i) => validarHsp(valor, `hspMensal[${i}]`, erros));
}

function validarDias(dias: number, erros: ErroCampo[]): void {
  if (!ehNumeroFinito(dias) || dias <= 0 || dias > 31) {
    erros.push({ campo: 'diasPorMes', mensagem: 'Dias por mês deve estar entre 1 e 31.' });
  }
}

/** Valida a entrada do dimensionamento sem lançar erro (útil para formulários). */
export function validarEntradaDimensionamento(entrada: EntradaDimensionamento): ErroCampo[] {
  const erros: ErroCampo[] = [];
  const { consumoMensalKwh } = entrada;
  if (!ehNumeroFinito(consumoMensalKwh)) {
    erros.push({ campo: 'consumoMensalKwh', mensagem: 'Informe o consumo médio mensal em kWh.' });
  } else if (consumoMensalKwh <= 0) {
    erros.push({ campo: 'consumoMensalKwh', mensagem: 'O consumo médio mensal deve ser maior que zero.' });
  }
  validarHsp(entrada.hspMedio, 'hspMedio', erros);
  validarHspMensal(entrada.hspMensal, erros);
  validarDias(entrada.diasPorMes ?? DIAS_POR_MES_PADRAO, erros);
  erros.push(...validarPerdas(entrada.perdas, entrada.metodoPerdas ?? 'aditivo'));
  return erros;
}

/**
 * Energia gerada por um sistema de `potenciaKwp` com o HSP e o fator de
 * desempenho informados, na convenção de dias do pacote.
 */
function energiaMensal(potenciaKwp: number, hsp: number, fatorDesempenho: number, dias: number): number {
  return potenciaKwp * hsp * dias * fatorDesempenho;
}

function montarGeracao(
  potenciaKwp: number,
  hspMedio: number,
  fatorDesempenho: number,
  dias: number,
  hspMensal: readonly number[] | undefined,
): GeracaoEstimada {
  const mediaMensal = energiaMensal(potenciaKwp, hspMedio, fatorDesempenho, dias);
  const geracao: GeracaoEstimada = {
    mediaMensalKwh: arredondar(mediaMensal, CASAS_DECIMAIS.kwh),
    anualKwh: arredondar(mediaMensal * 12, CASAS_DECIMAIS.kwh),
  };
  if (hspMensal) {
    geracao.porMesKwh = hspMensal.map((hsp) =>
      arredondar(energiaMensal(potenciaKwp, hsp, fatorDesempenho, dias), CASAS_DECIMAIS.kwh),
    );
  }
  return geracao;
}

/**
 * Calcula a potência necessária (kWp) e a geração estimada — RF07, passos 1 a 3.
 *
 * @throws {ErroValidacao} se consumo, HSP ou perdas forem inválidos.
 *
 * @example
 * const r = dimensionarSistema({
 *   consumoMensalKwh: 500,
 *   hspMedio: 4.9,
 *   perdas: { temperaturaPerc: 10, sujeiraPerc: 3, cabeamentoPerc: 2, sombreamentoPerc: 3 },
 * });
 * r.potenciaNecessariaKwp; // 4.15
 */
export function dimensionarSistema(entrada: EntradaDimensionamento): ResultadoDimensionamento {
  garantirSemErros(validarEntradaDimensionamento(entrada));

  const metodoPerdas = entrada.metodoPerdas ?? 'aditivo';
  const diasPorMes = entrada.diasPorMes ?? DIAS_POR_MES_PADRAO;
  const perdas = calcularPerdasTotais(entrada.perdas, metodoPerdas);

  // RN01: kWp = Consumo / (HSP × 30 × (1 − Perdas))
  const potenciaKwp = entrada.consumoMensalKwh / (entrada.hspMedio * diasPorMes * perdas.fatorDesempenho);

  return {
    potenciaNecessariaKwp: arredondar(potenciaKwp, CASAS_DECIMAIS.kwp),
    perdasTotaisPerc: perdas.totalPerc,
    fatorDesempenho: perdas.fatorDesempenho,
    geracao: montarGeracao(potenciaKwp, entrada.hspMedio, perdas.fatorDesempenho, diasPorMes, entrada.hspMensal),
    premissas: {
      consumoMensalKwh: entrada.consumoMensalKwh,
      hspMedio: entrada.hspMedio,
      diasPorMes,
      metodoPerdas,
    },
  };
}

export interface EntradaGeracao {
  /** Potência instalada (kWp) — normalmente qtd. de módulos × potência do módulo. */
  potenciaKwp: number;
  hspMedio: number;
  perdas: ComponentesPerdas;
  metodoPerdas?: MetodoCombinacaoPerdas;
  hspMensal?: readonly number[];
  diasPorMes?: number;
}

/**
 * Geração estimada de um sistema com potência conhecida (ex.: depois que o
 * técnico escolhe os módulos no RF09). É a base do alerta de
 * superdimensionamento (SCRUM-394) e da viabilidade (RF11).
 *
 * @throws {ErroValidacao} se potência, HSP ou perdas forem inválidos.
 */
export function calcularGeracaoEstimada(entrada: EntradaGeracao): GeracaoEstimada {
  const erros: ErroCampo[] = [];
  if (!ehNumeroFinito(entrada.potenciaKwp) || entrada.potenciaKwp <= 0) {
    erros.push({ campo: 'potenciaKwp', mensagem: 'A potência do sistema deve ser maior que zero.' });
  }
  validarHsp(entrada.hspMedio, 'hspMedio', erros);
  validarHspMensal(entrada.hspMensal, erros);
  validarDias(entrada.diasPorMes ?? DIAS_POR_MES_PADRAO, erros);
  const metodo = entrada.metodoPerdas ?? 'aditivo';
  erros.push(...validarPerdas(entrada.perdas, metodo));
  garantirSemErros(erros);

  const perdas = calcularPerdasTotais(entrada.perdas, metodo);
  return montarGeracao(
    entrada.potenciaKwp,
    entrada.hspMedio,
    perdas.fatorDesempenho,
    entrada.diasPorMes ?? DIAS_POR_MES_PADRAO,
    entrada.hspMensal,
  );
}

export interface ResultadoQuantidadeModulos {
  /** Quantidade mínima de módulos para atingir a potência necessária. */
  quantidade: number;
  /** Potência instalada com essa quantidade (kWp). */
  potenciaInstaladaKwp: number;
}

/**
 * Quantos módulos de `potenciaModuloW` são necessários para chegar a
 * `potenciaNecessariaKwp` (arredonda para cima). Não sugere kit (D09): só faz a
 * conta para o módulo que o técnico escolheu.
 *
 * @throws {ErroValidacao} se alguma potência for ≤ 0.
 */
export function calcularQuantidadeModulos(
  potenciaNecessariaKwp: number,
  potenciaModuloW: number,
): ResultadoQuantidadeModulos {
  const erros: ErroCampo[] = [];
  if (!ehNumeroFinito(potenciaNecessariaKwp) || potenciaNecessariaKwp <= 0) {
    erros.push({ campo: 'potenciaNecessariaKwp', mensagem: 'A potência necessária deve ser maior que zero.' });
  }
  if (!ehNumeroFinito(potenciaModuloW) || potenciaModuloW <= 0) {
    erros.push({ campo: 'potenciaModuloW', mensagem: 'A potência do módulo deve ser maior que zero.' });
  }
  garantirSemErros(erros);

  // O arredondamento evita que um erro de ponto flutuante (ex.: 5,000000001)
  // acrescente um módulo a mais.
  const quantidade = Math.ceil(arredondar((potenciaNecessariaKwp * 1000) / potenciaModuloW, 6));
  return {
    quantidade,
    potenciaInstaladaKwp: arredondar((quantidade * potenciaModuloW) / 1000, CASAS_DECIMAIS.kwp),
  };
}
