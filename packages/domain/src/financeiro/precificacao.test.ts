import { describe, expect, it } from 'vitest';

import { precificarProposta, precoUnitarioItem, recalcularViabilidade, validarItensEDesconto } from './precificacao';

const servicos = { materiaisEletricos: 1000, maoDeObra: 3000, artHomologacao: 1200, logisticaFrete: 800 };

describe('precificarProposta (RN03, editor web)', () => {
  it('soma equipamentos, serviços e margem só sobre serviços', () => {
    const r = precificarProposta({
      itens: [{ quantidade: 10, precoCatalogo: 1000, ajustePercentual: 0 }, { quantidade: 1, precoCatalogo: 5000, ajustePercentual: -10 }],
      servicos,
      margemPercentual: 25,
    });
    expect(r.itens.map((i) => i.subtotal)).toEqual([10000, 4500]);
    expect(r.valorEquipamentos).toBe(14500);
    expect(r.valorServicos).toBe(6000);
    expect(r.valorMargem).toBe(1500);
    expect(r.valorTotal).toBe(22000);
  });

  it('aplica o desconto comercial sobre o valor bruto', () => {
    const r = precificarProposta({ itens: [{ quantidade: 1, precoCatalogo: 10000, ajustePercentual: 0 }], servicos, margemPercentual: 0, descontoComercialPerc: 5 });
    expect(r.valorBruto).toBe(16000);
    expect(r.valorDesconto).toBe(800);
    expect(r.valorTotal).toBe(15200);
  });

  it('arredonda o preço unitário em centavos', () => {
    expect(precoUnitarioItem(1290, 3.333)).toBe(1333);
    expect(precoUnitarioItem(999.9, -7.5)).toBe(924.91);
  });
});

describe('validarItensEDesconto', () => {
  it('aceita edição válida e recusa ajuste fora do limite, quantidade e desconto inválidos', () => {
    expect(validarItensEDesconto([{ quantidade: 2, precoCatalogo: 100, ajustePercentual: 10 }], 5, 10)).toEqual([]);
    const erros = validarItensEDesconto([{ quantidade: 0, precoCatalogo: 100, ajustePercentual: 12 }], 100, 10);
    expect(erros).toHaveLength(3);
    expect(validarItensEDesconto([], 0, 10)).toContain('A proposta precisa de pelo menos um equipamento.');
  });
});

describe('recalcularViabilidade (RN04)', () => {
  it('payback e ROI diminuem quando o total cai', () => {
    const caro = recalcularViabilidade({ valorTotal: 30000, geracaoMensalKwh: 500, tarifaKwh: 1, premissas: { reajusteTarifarioAnual: 0, degradacaoAnualModulos: 0 } });
    const barato = recalcularViabilidade({ valorTotal: 24000, geracaoMensalKwh: 500, tarifaKwh: 1, premissas: { reajusteTarifarioAnual: 0, degradacaoAnualModulos: 0 } });
    expect(caro.economiaMensal).toBe(500);
    expect(barato.paybackMeses).toBe(48);
    expect(caro.paybackMeses!).toBeGreaterThan(barato.paybackMeses!);
    expect(barato.roiPercentual).toBeGreaterThan(caro.roiPercentual);
  });

  it('sem geração não há payback', () => {
    expect(recalcularViabilidade({ valorTotal: 1000, geracaoMensalKwh: 0, tarifaKwh: 1 }).paybackMeses).toBeNull();
  });
});
