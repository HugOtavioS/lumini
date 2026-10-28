/**
 * Utilidades numéricas compartilhadas. Ficam no pacote de domínio para que o
 * app e a web arredondem exatamente da mesma forma (DAS, Seção 6).
 */

/** Casas decimais usadas nos resultados expostos pelo pacote. */
export const CASAS_DECIMAIS = {
  /** Potência em kWp (ex.: 4,73 kWp). */
  kwp: 2,
  /** Energia em kWh (ex.: 512,4 kWh/mês). */
  kwh: 1,
  /** Percentuais (ex.: 18,25 %). */
  percentual: 2,
  /** Áreas em m² (ex.: 23,18 m²). */
  area: 2,
  /** Ângulos em graus (ex.: 21,4°). */
  graus: 2,
  /** Tensão (V) e corrente (A). */
  eletrica: 2,
} as const;

/**
 * Arredonda "meio para cima" com a quantidade de casas pedida, evitando o erro
 * clássico de ponto flutuante (`1.005` → `1.01`, e não `1.00`).
 */
export function arredondar(valor: number, casas = 2): number {
  if (!Number.isFinite(valor)) return valor;
  const sinal = valor < 0 ? -1 : 1;
  const absoluto = Math.abs(valor);
  const texto = String(absoluto);
  // Números muito pequenos/grandes já vêm em notação exponencial; nesse caso
  // a multiplicação direta é suficiente.
  if (texto.includes('e')) {
    const fator = 10 ** casas;
    return (sinal * Math.round(absoluto * fator)) / fator;
  }
  const deslocado = Math.round(Number(`${texto}e${casas}`));
  return sinal * Number(`${deslocado}e-${casas}`);
}

/** Limita `valor` ao intervalo [min, max]. */
export function limitar(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor));
}

/** Converte graus para radianos. */
export function radianos(graus: number): number {
  return (graus * Math.PI) / 180;
}

/** Converte radianos para graus. */
export function graus(radianosValor: number): number {
  return (radianosValor * 180) / Math.PI;
}

/** Normaliza um ângulo para o intervalo [0, 360). */
export function normalizar360(angulo: number): number {
  const resto = angulo % 360;
  return resto < 0 ? resto + 360 : resto;
}

/** Normaliza um ângulo para o intervalo (-180, 180]. */
export function normalizar180(angulo: number): number {
  const a = normalizar360(angulo);
  return a > 180 ? a - 360 : a;
}

/** Soma simples de uma lista de números. */
export function somar(valores: readonly number[]): number {
  let total = 0;
  for (const v of valores) total += v;
  return total;
}

/** Formata um número no padrão brasileiro (vírgula decimal), sem depender de `Intl`. */
export function formatarNumeroBr(valor: number, casas = 1): string {
  const arredondado = arredondar(valor, casas);
  const [inteiro = '0', decimal] = Math.abs(arredondado).toFixed(casas).split('.');
  const comMilhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sinal = arredondado < 0 ? '-' : '';
  return decimal !== undefined ? `${sinal}${comMilhar},${decimal}` : `${sinal}${comMilhar}`;
}
