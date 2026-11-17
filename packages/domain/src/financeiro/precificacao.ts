/**
 * precificacao.ts — SCRUM-419 / SCRUM-421 (Editor de Proposta na web) e RN03.
 *
 * Recalcula os valores de uma proposta quando o gestor troca equipamentos,
 * muda quantidades ou aplica o desconto comercial no painel. Roda no navegador
 * (D23: a API não calcula; ela só confere o resultado com esta mesma função).
 *
 * RN03 / D10:
 *   equipamentos = Σ preço unitário × quantidade
 *   serviços     = materiais elétricos + mão de obra + ART/homologação + frete
 *   margem       = serviços × margem %   (o preço do equipamento já tem margem)
 *   bruto        = equipamentos + serviços + margem
 *   desconto     = bruto × desconto comercial %   (só o gestor, no editor web)
 *   total        = bruto − desconto
 *
 * O preço unitário parte do preço de catálogo e recebe o ajuste do item
 * (RN06 / RF18), limitado ao percentual configurado pela empresa.
 *
 * ⚠️ Função pura: sem banco, rede ou React.
 */

import { arredondar } from '../util/numeros';
import { calcularAnaliseFinanceira, type PremissasEconomicas } from './calcularAnaliseFinanceira';

export interface ItemPrecificavel {
  quantidade: number;
  /** Preço de venda do catálogo copiado quando o item entrou na proposta. */
  precoCatalogo: number;
  /** Ajuste do item em %, entre −limite e +limite da empresa (RN06). */
  ajustePercentual: number;
}

export interface ServicosProposta {
  materiaisEletricos: number;
  maoDeObra: number;
  artHomologacao: number;
  logisticaFrete: number;
}

export interface EntradaPrecificacao<T extends ItemPrecificavel = ItemPrecificavel> {
  itens: readonly T[];
  servicos: ServicosProposta;
  margemPercentual: number;
  /** Desconto comercial do gestor, em % do valor bruto (0 a 100). */
  descontoComercialPerc?: number;
}

export interface ItemPrecificado<T extends ItemPrecificavel = ItemPrecificavel> {
  item: T;
  precoUnitario: number;
  subtotal: number;
}

export interface Precificacao<T extends ItemPrecificavel = ItemPrecificavel> {
  itens: ItemPrecificado<T>[];
  valorEquipamentos: number;
  valorServicos: number;
  valorMargem: number;
  valorBruto: number;
  descontoComercialPerc: number;
  valorDesconto: number;
  valorTotal: number;
}

/** Preço unitário do item na proposta: catálogo × (1 + ajuste/100). */
export function precoUnitarioItem(precoCatalogo: number, ajustePercentual: number): number {
  return arredondar(precoCatalogo * (1 + ajustePercentual / 100), 2);
}

/** Erros de validação da edição (mensagens em português, para a tela). */
export function validarItensEDesconto(
  itens: readonly ItemPrecificavel[],
  descontoComercialPerc: number,
  limiteAjustePerc: number,
): string[] {
  const erros: string[] = [];
  if (itens.length === 0) erros.push('A proposta precisa de pelo menos um equipamento.');
  itens.forEach((item, i) => {
    const n = i + 1;
    if (!Number.isInteger(item.quantidade) || item.quantidade <= 0) erros.push(`Item ${n}: a quantidade deve ser um número inteiro maior que zero.`);
    if (!Number.isFinite(item.precoCatalogo) || item.precoCatalogo <= 0) erros.push(`Item ${n}: preço de catálogo inválido.`);
    if (!Number.isFinite(item.ajustePercentual) || Math.abs(item.ajustePercentual) > limiteAjustePerc + 1e-9) {
      erros.push(`Item ${n}: o ajuste de preço deve ficar entre −${limiteAjustePerc}% e +${limiteAjustePerc}%.`);
    }
  });
  if (!Number.isFinite(descontoComercialPerc) || descontoComercialPerc < 0 || descontoComercialPerc >= 100) {
    erros.push('O desconto comercial deve ficar entre 0% e 99,99%.');
  }
  return erros;
}

export function precificarProposta<T extends ItemPrecificavel>(entrada: EntradaPrecificacao<T>): Precificacao<T> {
  const itens = entrada.itens.map((item) => {
    const precoUnitario = precoUnitarioItem(item.precoCatalogo, item.ajustePercentual);
    return { item, precoUnitario, subtotal: arredondar(precoUnitario * item.quantidade, 2) };
  });
  const s = entrada.servicos;
  const valorEquipamentos = arredondar(itens.reduce((t, i) => t + i.subtotal, 0), 2);
  const valorServicos = arredondar(s.materiaisEletricos + s.maoDeObra + s.artHomologacao + s.logisticaFrete, 2);
  const valorMargem = arredondar((valorServicos * entrada.margemPercentual) / 100, 2);
  const valorBruto = arredondar(valorEquipamentos + valorServicos + valorMargem, 2);
  const descontoComercialPerc = entrada.descontoComercialPerc ?? 0;
  const valorDesconto = arredondar((valorBruto * descontoComercialPerc) / 100, 2);
  return {
    itens,
    valorEquipamentos,
    valorServicos,
    valorMargem,
    valorBruto,
    descontoComercialPerc,
    valorDesconto,
    valorTotal: arredondar(valorBruto - valorDesconto, 2),
  };
}

export interface EntradaViabilidade {
  valorTotal: number;
  geracaoMensalKwh: number;
  tarifaKwh: number;
  premissas?: Partial<PremissasEconomicas>;
}

export interface Viabilidade {
  economiaMensal: number;
  /** null quando não se paga dentro do horizonte. */
  paybackMeses: number | null;
  roiPercentual: number;
  economia25Anos: number;
}

/** Payback e ROI depois da edição (RN04), com o mesmo cálculo do app. */
export function recalcularViabilidade(entrada: EntradaViabilidade): Viabilidade {
  const economiaMensal = arredondar(entrada.geracaoMensalKwh * entrada.tarifaKwh, 2);
  if (entrada.valorTotal <= 0 || entrada.geracaoMensalKwh <= 0) {
    return { economiaMensal, paybackMeses: null, roiPercentual: 0, economia25Anos: 0 };
  }
  const a = calcularAnaliseFinanceira({
    precoTotal: { valorTotal: entrada.valorTotal },
    geracaoAnualKwh: entrada.geracaoMensalKwh * 12,
    tarifaKwh: entrada.tarifaKwh,
    premissas: entrada.premissas,
  });
  return {
    economiaMensal,
    paybackMeses: a.payback ? a.payback.totalMeses : null,
    roiPercentual: arredondar(a.roiPercentual, 1),
    economia25Anos: arredondar(a.economiaAcumulada, 2),
  };
}
