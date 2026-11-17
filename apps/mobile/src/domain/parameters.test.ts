import { describe, expect, it } from 'vitest';

import { applyCompanyParameters, commercialParameters } from './parameters';

describe('applyCompanyParameters (SCRUM-433)', () => {
  it('aplica os valores do gestor e ignora inválidos', () => {
    const antes = { ...commercialParameters };
    applyCompanyParameters({ limiteAjustePrecoPerc: 10, margemPadraoPerc: 30, fretePadrao: -1, validadePadraoDias: 20 });
    expect(commercialParameters.priceAdjustLimitPct).toBe(10);
    expect(commercialParameters.marginPct).toBe(30);
    expect(commercialParameters.freightFee).toBe(antes.freightFee);
    expect(commercialParameters.defaultValidityDays).toBe(20);
    Object.assign(commercialParameters, antes);
  });
});
