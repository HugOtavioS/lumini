/**
 * SCRUM-405 — Testes da máquina de estados da proposta.
 */

import {
  StatusProposta,
  TRANSICOES_STATUS_PROPOSTA,
  podeTransicionar,
  transicionarStatus,
} from '../StatusProposta';

const TODOS = Object.values(StatusProposta);

const VALIDAS: Array<[StatusProposta, StatusProposta]> = [
  [StatusProposta.Rascunho, StatusProposta.Dimensionada],
  [StatusProposta.Dimensionada, StatusProposta.Precificada],
  [StatusProposta.Precificada, StatusProposta.PdfGerado],
  [StatusProposta.PdfGerado, StatusProposta.Gerada],
];

describe('máquina de estados da proposta', () => {
  it.each(VALIDAS)('permite %s → %s', (de, para) => {
    expect(podeTransicionar(de, para)).toBe(true);
    expect(transicionarStatus(de, para)).toEqual({ ok: true, status: para });
  });

  it('rejeita todas as demais combinações', () => {
    const invalidas = TODOS.flatMap((de) =>
      TODOS.map((para) => [de, para] as const),
    ).filter(([de, para]) => !VALIDAS.some(([d, p]) => d === de && p === para));

    // 5 estados × 5 destinos − 4 transições válidas
    expect(invalidas).toHaveLength(21);
    for (const [de, para] of invalidas) {
      expect(podeTransicionar(de, para)).toBe(false);
    }
  });

  it('não permite pular etapas (Rascunho → Gerada)', () => {
    const r = transicionarStatus(StatusProposta.Rascunho, StatusProposta.Gerada);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(StatusProposta.Rascunho);
    if (!r.ok) {
      expect(r.motivo).toContain('RASCUNHO → GERADA');
      expect(r.motivo).toContain('DIMENSIONADA');
    }
  });

  it('não permite retroceder (Precificada → Rascunho)', () => {
    expect(
      podeTransicionar(StatusProposta.Precificada, StatusProposta.Rascunho),
    ).toBe(false);
  });

  it('Gerada é estado final', () => {
    expect(TRANSICOES_STATUS_PROPOSTA[StatusProposta.Gerada]).toEqual([]);
    const r = transicionarStatus(StatusProposta.Gerada, StatusProposta.Rascunho);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain('estado final');
  });
});
