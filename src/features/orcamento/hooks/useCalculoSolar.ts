/**
 * useCalculoSolar.ts
 *
 * Hook customizado para cálculos de dimensionamento solar.
 * Responsabilidades:
 * - Calcular quantidade de placas necessárias
 * - Estimar geração mensal de energia (kWh)
 * - Calcular payback e ROI do investimento
 *
 * ⚠️ As regras de cálculo puras ficam em services/orcamentoCalculator.ts.
 *    Este hook apenas conecta essas regras ao estado React.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  calcularQuantidadePlacas,
  calcularGeracaoMensal,
  calcularPayback,
} from '../services/orcamentoCalculator';

interface DadosCalculo {
  consumoMensalKwh: number;
  potenciaPlacaWp: number;
  areaDisponivelM2: number;
  irradiacaoLocal: number;       // HSP (Horas de Sol Pleno)
  custoPorWp: number;            // R$/Wp instalado
  tarifaEnergia: number;         // R$/kWh
}

interface ResultadoCalculo {
  quantidadePlacas: number;
  potenciaTotalKwp: number;
  geracaoMensalKwh: number;
  valorInstalacao: number;
  paybackMeses: number;
  roiAnual: number;
}

export function useCalculoSolar() {
  const [dados, setDados] = useState<DadosCalculo>({
    consumoMensalKwh: 0,
    potenciaPlacaWp: 550,        // Placa padrão de 550W
    areaDisponivelM2: 0,
    irradiacaoLocal: 4.5,        // HSP médio do Brasil
    custoPorWp: 4.5,
    tarifaEnergia: 0.85,
  });

  const resultado = useMemo<ResultadoCalculo>(() => {
    const qtdPlacas = calcularQuantidadePlacas(
      dados.consumoMensalKwh,
      dados.potenciaPlacaWp,
      dados.irradiacaoLocal,
    );

    const potenciaTotal = (qtdPlacas * dados.potenciaPlacaWp) / 1000;
    const geracao = calcularGeracaoMensal(potenciaTotal, dados.irradiacaoLocal);
    const valorInstalacao = potenciaTotal * 1000 * dados.custoPorWp;
    const payback = calcularPayback(
      valorInstalacao,
      geracao,
      dados.tarifaEnergia,
    );

    return {
      quantidadePlacas: qtdPlacas,
      potenciaTotalKwp: potenciaTotal,
      geracaoMensalKwh: geracao,
      valorInstalacao,
      paybackMeses: payback,
      roiAnual: ((geracao * 12 * dados.tarifaEnergia) / valorInstalacao) * 100,
    };
  }, [dados]);

  const atualizarDado = useCallback(
    <K extends keyof DadosCalculo>(campo: K, valor: DadosCalculo[K]) => {
      setDados((prev) => ({ ...prev, [campo]: valor }));
    },
    [],
  );

  return {
    dados,
    resultado,
    atualizarDado,
    setDados,
  };
}
