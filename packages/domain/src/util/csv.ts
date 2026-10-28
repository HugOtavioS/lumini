/** Leitura de CSV simples (sem dependências), usada pelos importadores e relatórios. */
import { normalizarTexto } from './texto';

/** Lê um CSV simples (separador `;` ou `,`, detectado pelo cabeçalho; aspas opcionais). */
export function lerCsv(texto: string): { cabecalho: string[]; linhas: string[][]; separador: ';' | ',' } {
  const linhasBrutas = texto.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  const primeira = linhasBrutas[0] ?? '';
  const separador: ';' | ',' = (primeira.match(/;/g) ?? []).length >= (primeira.match(/,/g) ?? []).length ? ';' : ',';
  const dividir = (linha: string): string[] => linha.split(separador).map((c) => c.trim().replace(/^"(.*)"$/, '$1'));
  return {
    cabecalho: dividir(primeira).map((c) => normalizarTexto(c)),
    linhas: linhasBrutas.slice(1).map(dividir),
    separador,
  };
}
