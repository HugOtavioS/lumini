/**
 * StatusProposta.ts
 *
 * SCRUM-405 — Máquina de estados da proposta (RN07).
 * Responsabilidades:
 * - Declarar os estados possíveis de uma proposta
 * - Declarar as transições válidas entre estados
 * - Validar transições (funções puras, sem efeitos colaterais)
 *
 * ⚠️ Os nomes dos estados seguem o fluxo descrito no SCRUM-405.
 *    PENDÊNCIA: confirmar contra o Dicionário de Dados (SCRUM-41) no merge.
 *    PENDÊNCIA: RN07 não define retrocesso (ex.: reeditar uma proposta
 *    precificada). Por ora o fluxo é estritamente linear.
 */

export const StatusProposta = {
  Rascunho: 'RASCUNHO',
  Dimensionada: 'DIMENSIONADA',
  Precificada: 'PRECIFICADA',
  PdfGerado: 'PDF_GERADO',
  Gerada: 'GERADA',
} as const;

export type StatusProposta = (typeof StatusProposta)[keyof typeof StatusProposta];

/** Mapa de transições válidas: estado atual → estados de destino permitidos. */
export const TRANSICOES_STATUS_PROPOSTA: Readonly<
  Record<StatusProposta, readonly StatusProposta[]>
> = {
  [StatusProposta.Rascunho]: [StatusProposta.Dimensionada],
  [StatusProposta.Dimensionada]: [StatusProposta.Precificada],
  [StatusProposta.Precificada]: [StatusProposta.PdfGerado],
  [StatusProposta.PdfGerado]: [StatusProposta.Gerada],
  [StatusProposta.Gerada]: [],
};

export type ResultadoTransicao =
  | { ok: true; status: StatusProposta }
  | { ok: false; status: StatusProposta; motivo: string };

export function podeTransicionar(
  de: StatusProposta,
  para: StatusProposta,
): boolean {
  return TRANSICOES_STATUS_PROPOSTA[de].includes(para);
}

/**
 * Aplica uma transição de estado.
 * Em caso de transição inválida, o status atual é mantido e o motivo é retornado.
 */
export function transicionarStatus(
  de: StatusProposta,
  para: StatusProposta,
): ResultadoTransicao {
  if (podeTransicionar(de, para)) {
    return { ok: true, status: para };
  }

  const permitidos = TRANSICOES_STATUS_PROPOSTA[de];
  const destinos =
    permitidos.length > 0 ? permitidos.join(', ') : 'nenhum (estado final)';

  return {
    ok: false,
    status: de,
    motivo: `Transição inválida: ${de} → ${para}. Destinos permitidos: ${destinos}.`,
  };
}
