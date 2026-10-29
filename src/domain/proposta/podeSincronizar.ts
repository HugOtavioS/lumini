/**
 * podeSincronizar.ts
 *
 * SCRUM-405 — Regra RN07: uma proposta só pode entrar na fila de sincronização
 * quando o status é "Gerada" E dimensionamento, precificação e PDF estão concluídos.
 *
 * ⚠️ Função pura. O SyncService (SCRUM-18) chama esta regra antes de enfileirar
 *    e novamente antes de enviar cada proposta.
 */

import { StatusProposta } from './StatusProposta';

/**
 * Dados mínimos da proposta necessários para avaliar a RN07.
 * PENDÊNCIA: no merge, mapear a entidade Proposta real (SCRUM-41) para esta forma.
 */
export interface EstadoPropostaSync {
  status: StatusProposta;
  dimensionamentoConcluido: boolean;
  precificacaoConcluida: boolean;
  pdfGerado: boolean;
}

export interface ResultadoPodeSincronizar {
  permitido: boolean;
  motivos: string[];
}

export const MOTIVOS_BLOQUEIO_SYNC = {
  statusNaoGerada: (status: StatusProposta) =>
    `Status da proposta é ${status}; a sincronização exige ${StatusProposta.Gerada}.`,
  dimensionamentoPendente: 'Dimensionamento não concluído.',
  precificacaoPendente: 'Precificação não concluída.',
  pdfPendente: 'PDF da proposta não gerado.',
} as const;

export function podeSincronizar(
  proposta: EstadoPropostaSync,
): ResultadoPodeSincronizar {
  const motivos: string[] = [];

  if (proposta.status !== StatusProposta.Gerada) {
    motivos.push(MOTIVOS_BLOQUEIO_SYNC.statusNaoGerada(proposta.status));
  }
  if (!proposta.dimensionamentoConcluido) {
    motivos.push(MOTIVOS_BLOQUEIO_SYNC.dimensionamentoPendente);
  }
  if (!proposta.precificacaoConcluida) {
    motivos.push(MOTIVOS_BLOQUEIO_SYNC.precificacaoPendente);
  }
  if (!proposta.pdfGerado) {
    motivos.push(MOTIVOS_BLOQUEIO_SYNC.pdfPendente);
  }

  return { permitido: motivos.length === 0, motivos };
}
