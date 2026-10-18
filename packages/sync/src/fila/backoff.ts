/**
 * SCRUM-82 — espera entre tentativas (backoff exponencial com jitter).
 *
 * Depois da n-ésima falha seguida, a próxima tentativa acontece após
 * `esperaInicial × fator^(n−1)`, limitado a `esperaMaxima`. O jitter sorteia
 * a espera entre `(1 − jitter)` e 100 % desse valor, para que vários aparelhos
 * que perderam a conexão juntos não voltem todos no mesmo segundo.
 *
 * Com os valores padrão: ~2 s, ~4 s, ~8 s, ~16 s ... até ~10 min.
 * O backoff vale para quando o aparelho acha que está online e o envio falha
 * (sinal fraco, API fora do ar). Quando a conexão volta de verdade, a fila
 * envia na hora, sem esperar (ver `FilaSincronizacao.aoMudarConexao`).
 */

export interface PoliticaRetentativa {
  /** Espera depois da primeira falha (ms). */
  esperaInicialMs: number;
  /** Multiplicador a cada nova falha. */
  fator: number;
  /** Teto da espera (ms). */
  esperaMaximaMs: number;
  /** Fração sorteada: 0,5 → espera entre 50 % e 100 % do valor calculado. */
  jitter: number;
  /** A partir de quantas falhas seguidas a UI mostra "falha persistente" (RF16, 1a). */
  tentativasAteAlerta: number;
}

export const POLITICA_RETENTATIVA_PADRAO: Readonly<PoliticaRetentativa> = Object.freeze({
  esperaInicialMs: 2_000,
  fator: 2,
  esperaMaximaMs: 10 * 60_000,
  jitter: 0.5,
  tentativasAteAlerta: 5,
});

/** Teto para o `Retry-After` pedido pelo servidor (evita a fila parada por horas). */
export const ESPERA_MAXIMA_RETRY_AFTER_MS = 60 * 60_000;

/** Espera "cheia" (sem sorteio) depois de `falhas` falhas seguidas. */
export function esperaSemJitter(falhas: number, politica: PoliticaRetentativa = POLITICA_RETENTATIVA_PADRAO): number {
  const n = Math.max(1, Math.floor(falhas));
  return Math.min(politica.esperaMaximaMs, politica.esperaInicialMs * politica.fator ** (n - 1));
}

/**
 * Espera até a próxima tentativa depois de `falhas` falhas seguidas (≥ 1).
 * `aleatorio` devolve um número em [0, 1) (injetável nos testes).
 */
export function calcularEspera(
  falhas: number,
  politica: PoliticaRetentativa = POLITICA_RETENTATIVA_PADRAO,
  aleatorio: () => number = Math.random,
): number {
  const cheia = esperaSemJitter(falhas, politica);
  const jitter = Math.min(1, Math.max(0, politica.jitter));
  const minimo = cheia * (1 - jitter);
  const sorteio = Math.min(1, Math.max(0, aleatorio()));
  return Math.round(minimo + (cheia - minimo) * sorteio);
}

export function validarPolitica(politica: PoliticaRetentativa): string[] {
  const erros: string[] = [];
  if (!(politica.esperaInicialMs > 0)) erros.push('A espera inicial deve ser maior que zero.');
  if (!(politica.fator >= 1)) erros.push('O fator do backoff deve ser pelo menos 1.');
  if (!(politica.esperaMaximaMs >= politica.esperaInicialMs)) erros.push('A espera máxima não pode ser menor que a inicial.');
  if (!(politica.jitter >= 0 && politica.jitter <= 1)) erros.push('O jitter deve estar entre 0 e 1.');
  if (!(Number.isInteger(politica.tentativasAteAlerta) && politica.tentativasAteAlerta >= 1)) {
    erros.push('O número de tentativas até o alerta deve ser um inteiro positivo.');
  }
  return erros;
}
