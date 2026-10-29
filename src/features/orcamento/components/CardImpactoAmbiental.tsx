/**
 * CardImpactoAmbiental.tsx
 *
 * SCRUM-88 — Impacto ambiental da proposta: CO₂ evitado no 1º ano, total no
 * horizonte e gráfico do acumulado.
 *
 * ⚠️ Componente de apresentação: recebe o resultado de useImpactoAmbiental.
 * ⚠️ Equivalências (árvores etc.) aguardam a definição do Apêndice A.
 */

import React from 'react';
import {
  FatorEmissaoRede,
  ImpactoAmbiental,
  KG_POR_TONELADA,
} from '@/domain/ambiental/calcularCO2Evitado';
import { CardResumo } from '@/components/ui/CardResumo';
import { GraficoBarras } from '@/components/ui/GraficoBarras';
import { formatarNumero } from '@/shared/utils/formatadores';

interface CardImpactoAmbientalProps {
  impacto: ImpactoAmbiental | null;
  fator: FatorEmissaoRede | null;
  fatorPendente: boolean;
}

const COR_SERIE_AMBIENTAL = '#1BAF7A';

export const CardImpactoAmbiental: React.FC<CardImpactoAmbientalProps> = ({
  impacto,
  fator,
  fatorPendente,
}) => {
  if (fatorPendente || !impacto) {
    return (
      <CardResumo
        titulo="Impacto ambiental"
        aviso={
          fatorPendente
            ? 'Fator de emissão da rede não configurado. O CO₂ evitado não pode ser calculado.'
            : 'Aguardando a geração estimada do sistema.'
        }
        metricas={[]}
      />
    );
  }

  return (
    <CardResumo
      titulo="Impacto ambiental"
      rodape={fator ? `Fator de emissão: ${fator.fonte} (${fator.anoReferencia}).` : undefined}
      metricas={[
        {
          rotulo: 'CO₂ evitado por ano',
          valor: `${formatarNumero(impacto.co2AnoUmKg)} kg`,
          detalhe: 'no 1º ano',
        },
        {
          rotulo: 'CO₂ evitado total',
          valor: `${formatarNumero(impacto.co2TotalToneladas, 1)} t`,
          detalhe: `em ${impacto.horizonteAnos} anos`,
        },
      ]}
    >
      <GraficoBarras
        titulo={`CO₂ evitado acumulado por ano, em ${impacto.horizonteAnos} anos`}
        dados={impacto.serie.map((a) => ({
          rotulo: `Ano ${a.ano}`,
          valor: a.co2AcumuladoKg / KG_POR_TONELADA,
        }))}
        formatarValor={(t) => `${formatarNumero(t, 1)} t CO₂`}
        cor={COR_SERIE_AMBIENTAL}
      />
    </CardResumo>
  );
};
