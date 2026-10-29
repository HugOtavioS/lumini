/**
 * SCRUM-405 — Testes da regra RN07 (podeSincronizar).
 */

import { StatusProposta } from '../StatusProposta';
import {
  EstadoPropostaSync,
  MOTIVOS_BLOQUEIO_SYNC,
  podeSincronizar,
} from '../podeSincronizar';

const PRONTA: EstadoPropostaSync = {
  status: StatusProposta.Gerada,
  dimensionamentoConcluido: true,
  precificacaoConcluida: true,
  pdfGerado: true,
};

describe('podeSincronizar', () => {
  it('permite proposta Gerada com as três etapas concluídas', () => {
    expect(podeSincronizar(PRONTA)).toEqual({ permitido: true, motivos: [] });
  });

  it.each([
    StatusProposta.Rascunho,
    StatusProposta.Dimensionada,
    StatusProposta.Precificada,
    StatusProposta.PdfGerado,
  ])('bloqueia status %s mesmo com etapas concluídas', (status) => {
    const r = podeSincronizar({ ...PRONTA, status });
    expect(r.permitido).toBe(false);
    expect(r.motivos).toEqual([MOTIVOS_BLOQUEIO_SYNC.statusNaoGerada(status)]);
  });

  it('bloqueia quando o dimensionamento não foi concluído', () => {
    const r = podeSincronizar({ ...PRONTA, dimensionamentoConcluido: false });
    expect(r).toEqual({
      permitido: false,
      motivos: [MOTIVOS_BLOQUEIO_SYNC.dimensionamentoPendente],
    });
  });

  it('bloqueia quando a precificação não foi concluída', () => {
    const r = podeSincronizar({ ...PRONTA, precificacaoConcluida: false });
    expect(r).toEqual({
      permitido: false,
      motivos: [MOTIVOS_BLOQUEIO_SYNC.precificacaoPendente],
    });
  });

  it('bloqueia quando o PDF não foi gerado', () => {
    const r = podeSincronizar({ ...PRONTA, pdfGerado: false });
    expect(r).toEqual({
      permitido: false,
      motivos: [MOTIVOS_BLOQUEIO_SYNC.pdfPendente],
    });
  });

  it('acumula todos os motivos de bloqueio', () => {
    const r = podeSincronizar({
      status: StatusProposta.Rascunho,
      dimensionamentoConcluido: false,
      precificacaoConcluida: false,
      pdfGerado: false,
    });
    expect(r.permitido).toBe(false);
    expect(r.motivos).toEqual([
      MOTIVOS_BLOQUEIO_SYNC.statusNaoGerada(StatusProposta.Rascunho),
      MOTIVOS_BLOQUEIO_SYNC.dimensionamentoPendente,
      MOTIVOS_BLOQUEIO_SYNC.precificacaoPendente,
      MOTIVOS_BLOQUEIO_SYNC.pdfPendente,
    ]);
  });
});
