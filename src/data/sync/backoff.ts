/**
 * backoff.ts
 *
 * SCRUM-18 — Backoff exponencial: base · 2^tentativa, limitado a `maxMs`.
 * Ex.: base 2 s → 2 s, 4 s, 8 s, ...
 *
 * Sem jitter: há um único cliente por dispositivo, então não há risco de
 * "rajada" sincronizada contra o servidor vinda do mesmo aparelho.
 */

export function atrasoBackoffExponencial(
  tentativa: number,
  baseMs: number,
  maxMs: number,
): number {
  if (tentativa < 0) return 0;
  return Math.min(maxMs, baseMs * 2 ** tentativa);
}
