import { describe, expect, it } from 'vitest';

import { describePaymentCondition } from '@/domain/labels';
import { commercialParameters } from '@/domain/parameters';
import { electricalComplement, priceProposal } from './pricing';

const brl = (v: number) => `R$ ${v.toFixed(2)}`;

describe('SCRUM-375 — material elétrico complementar', () => {
  it('até a distância incluída não cobra nada; o excedente é por metro', () => {
    const p = commercialParameters;
    expect(electricalComplement({ roofToPanelDistanceM: p.includedPanelDistanceM, panelUpgradeNeeded: false })).toBe(0);
    expect(electricalComplement({ roofToPanelDistanceM: p.includedPanelDistanceM + 4, panelUpgradeNeeded: false })).toBe(4 * p.extraCablePerMeter);
    expect(electricalComplement({ roofToPanelDistanceM: null, panelUpgradeNeeded: true })).toBe(p.panelUpgradeFee);
  });

  it('entra nos materiais elétricos e no total (RN03), com margem', () => {
    const sem = priceProposal([], 5, 0, { roofToPanelDistanceM: 0, panelUpgradeNeeded: false });
    const com = priceProposal([], 5, 0, { roofToPanelDistanceM: 0, panelUpgradeNeeded: true });
    expect(com.electricalMaterials - sem.electricalMaterials).toBe(commercialParameters.panelUpgradeFee);
    expect(com.total).toBeGreaterThan(sem.total + commercialParameters.panelUpgradeFee);
  });
});

describe('SCRUM-399 — condição de pagamento', () => {
  it('descreve cada condição', () => {
    expect(describePaymentCondition({ type: 'a_vista', installments: 1, downPaymentPct: 0 }, 1000, brl)).toBe('À vista: R$ 1000.00');
    expect(describePaymentCondition({ type: 'parcelado', installments: 10, downPaymentPct: 0 }, 1000, brl)).toBe('Parcelado em 10x de R$ 100.00');
    expect(describePaymentCondition({ type: 'entrada_parcelas', installments: 4, downPaymentPct: 20 }, 1000, brl)).toBe(
      'Entrada de R$ 200.00 (20%) + 4x de R$ 200.00',
    );
  });
});
