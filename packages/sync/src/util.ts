/** Utilitários internos do pacote (sem dependência de Node ou do React Native). */

/** JSON com as chaves dos objetos em ordem alfabética: dois objetos iguais geram o mesmo texto. */
export function jsonEstavel(valor: unknown): string {
  return JSON.stringify(ordenarChaves(valor));
}

function ordenarChaves(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenarChaves);
  if (valor !== null && typeof valor === 'object') {
    const objeto = valor as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(objeto)
        .filter((k) => objeto[k] !== undefined)
        .sort()
        .map((k) => [k, ordenarChaves(objeto[k])]),
    );
  }
  return valor;
}

/** Converte um instante ISO 8601 em milissegundos; `null` se o texto não for uma data válida. */
export function msDeIso(iso: unknown): number | null {
  if (typeof iso !== 'string' || iso.trim() === '') return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

export function isoDeMs(ms: number): string {
  return new Date(ms).toISOString();
}

let contadorId = 0;

/**
 * Gera um identificador único. Usa `crypto.randomUUID` quando existe (Node,
 * navegadores e Hermes com polyfill); senão, cai num identificador baseado em
 * tempo e contador, suficiente para logs locais.
 */
export function gerarIdPadrao(): string {
  const cripto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cripto?.randomUUID) return cripto.randomUUID();
  contadorId += 1;
  return `id-${Date.now().toString(36)}-${contadorId.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Mensagem legível de um erro qualquer. */
export function descreverErro(erro: unknown): string {
  if (erro instanceof Error) return erro.message;
  return String(erro);
}
