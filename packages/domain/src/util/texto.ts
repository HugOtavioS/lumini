/** Utilidades de texto compartilhadas. */

const ACENTOS: Record<string, string> = {
  á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', ô: 'o', õ: 'o', ö: 'o',
  ú: 'u', ù: 'u', û: 'u', ü: 'u',
  ç: 'c', ñ: 'n',
};

/**
 * Minúsculas, sem acentos e sem espaços nas pontas. Não usa
 * `String.prototype.normalize`, que pode não existir no Hermes (React Native).
 */
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/[áàâãäéèêëíìîïóòôõöúùûüçñ]/g, (c) => ACENTOS[c] ?? c)
    .trim();
}
