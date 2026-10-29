/**
 * useAnaliseFinanceira.ts
 *
 * SCRUM-24 — Conecta o cálculo financeiro puro (domain) ao estado React.
 *
 * ⚠️ O hook não calcula nada: delega para calcularAnaliseFinanceira.
 *    Recebe null enquanto a proposta ainda não tem preço (REV-1) ou geração.
 */

import { useMemo } from 'react';
import {
  AnaliseFinanceira,
  calcularAnaliseFinanceira,
  EntradaAnaliseFinanceira,
} from '@/domain/financeiro/calcularAnaliseFinanceira';

interface UseAnaliseFinanceiraReturn {
  analise: AnaliseFinanceira | null;
  erro: string | null;
}

export function useAnaliseFinanceira(
  entrada: EntradaAnaliseFinanceira | null,
): UseAnaliseFinanceiraReturn {
  const valorTotal = entrada?.precoTotal.valorTotal;
  const geracao = entrada?.geracaoAnualKwh;
  const tarifa = entrada?.tarifaKwh;
  const reajuste = entrada?.premissas?.reajusteTarifarioAnual;
  const degradacao = entrada?.premissas?.degradacaoAnualModulos;
  const horizonte = entrada?.premissas?.horizonteAnos;

  return useMemo<UseAnaliseFinanceiraReturn>(() => {
    if (valorTotal === undefined || geracao === undefined || tarifa === undefined) {
      return { analise: null, erro: null };
    }
    try {
      return {
        analise: calcularAnaliseFinanceira({
          precoTotal: { valorTotal },
          geracaoAnualKwh: geracao,
          tarifaKwh: tarifa,
          premissas: {
            ...(reajuste !== undefined && { reajusteTarifarioAnual: reajuste }),
            ...(degradacao !== undefined && { degradacaoAnualModulos: degradacao }),
            ...(horizonte !== undefined && { horizonteAnos: horizonte }),
          },
        }),
        erro: null,
      };
    } catch (e) {
      return { analise: null, erro: e instanceof Error ? e.message : String(e) };
    }
  }, [valorTotal, geracao, tarifa, reajuste, degradacao, horizonte]);
}
