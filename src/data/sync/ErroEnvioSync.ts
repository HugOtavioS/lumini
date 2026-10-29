/**
 * ErroEnvioSync.ts
 *
 * SCRUM-18 — Erro de upload de uma proposta, com a indicação se vale tentar de novo.
 */

export class ErroEnvioSync extends Error {
  constructor(
    mensagem: string,
    /** true para falhas transitórias (rede, timeout, 5xx, 429). */
    readonly retentavel: boolean,
    readonly statusHttp?: number,
  ) {
    super(mensagem);
    this.name = 'ErroEnvioSync';
  }
}

/** Qualquer erro desconhecido é tratado como transitório. */
export function normalizarErroEnvio(erro: unknown): ErroEnvioSync {
  if (erro instanceof ErroEnvioSync) return erro;
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  return new ErroEnvioSync(mensagem, true);
}
