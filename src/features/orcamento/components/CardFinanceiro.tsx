/**
 * CardFinanceiro.tsx
 *
 * SCRUM-24 — Resumo financeiro da proposta: payback, ROI, economia acumulada
 * e gráfico da economia acumulada ano a ano com a linha do investimento.
 *
 * ⚠️ Componente de apresentação: recebe a análise pronta (useAnaliseFinanceira).
 */

import React from 'react';
import type { AnaliseFinanceira, Payback } from '@/domain/financeiro/calcularAnaliseFinanceira';
import { CardResumo } from '@/components/ui/CardResumo';
import { GraficoBarras } from '@/components/ui/GraficoBarras';
import { formatarMoeda, formatarPercentual } from '@/shared/utils/formatadores';

interface CardFinanceiroProps {
  analise: AnaliseFinanceira;
}

export function formatarPayback(payback: Payback | null, horizonteAnos: number): string {
  if (!payback) return `Acima de ${horizonteAnos} anos`;
  const anos = payback.anos === 1 ? '1 ano' : `${payback.anos} anos`;
  if (payback.meses === 0) return anos;
  const meses = payback.meses === 1 ? '1 mês' : `${payback.meses} meses`;
  return payback.anos === 0 ? meses : `${anos} e ${meses}`;
}

export const CardFinanceiro: React.FC<CardFinanceiroProps> = ({ analise }) => {
  const { horizonteAnos, reajusteTarifarioAnual, degradacaoAnualModulos } = analise.premissas;

  return (
    <CardResumo
      titulo="Retorno do investimento"
      rodape={
        `Premissas: reajuste da tarifa de ${formatarPercentual(reajusteTarifarioAnual * 100, 1)} a.a. ` +
        `e degradação dos módulos de ${formatarPercentual(degradacaoAnualModulos * 100, 1)} a.a.`
      }
      aviso={
        analise.payback
          ? undefined
          : `O investimento não se paga dentro de ${horizonteAnos} anos com as premissas atuais.`
      }
      metricas={[
        {
          rotulo: 'Payback',
          valor: formatarPayback(analise.payback, horizonteAnos),
          detalhe: analise.anoRetorno ? `retorno no ${analise.anoRetorno}º ano` : undefined,
        },
        {
          rotulo: 'ROI',
          valor: formatarPercentual(analise.roiPercentual),
          detalhe: `em ${horizonteAnos} anos`,
        },
        {
          rotulo: 'Economia acumulada',
          valor: formatarMoeda(analise.economiaAcumulada),
          detalhe: `em ${horizonteAnos} anos`,
        },
        { rotulo: 'Investimento', valor: formatarMoeda(analise.investimento) },
      ]}
    >
      <GraficoBarras
        titulo={`Economia acumulada por ano, em ${horizonteAnos} anos, comparada ao investimento`}
        dados={analise.serie.map((a) => ({
          rotulo: `Ano ${a.ano}`,
          valor: a.economiaAcumulada,
        }))}
        formatarValor={(v) => formatarMoeda(v)}
        linhaReferencia={{ valor: analise.investimento, rotulo: 'Investimento' }}
      />
    </CardResumo>
  );
};
