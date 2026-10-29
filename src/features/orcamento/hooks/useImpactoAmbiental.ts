/**
 * useImpactoAmbiental.ts
 *
 * SCRUM-88 — Conecta o cálculo de CO₂ evitado (domain) ao estado React.
 *
 * Enquanto o fator de emissão oficial não for configurado (FATOR_EMISSAO_SIN = null),
 * retorna `fatorPendente: true` e nenhum número, para não exibir valor inventado.
 */

import { useMemo } from 'react';
import {
  calcularSerieCO2Evitado,
  FATOR_EMISSAO_SIN,
  FatorEmissaoRede,
  ImpactoAmbiental,
} from '@/domain/ambiental/calcularCO2Evitado';

interface ParametrosImpactoAmbiental {
  /** Geração no primeiro ano, em kWh. null enquanto não dimensionado. */
  geracaoAnualKwh: number | null;
  fatorEmissao?: FatorEmissaoRede | null;
  degradacaoAnual?: number;
  horizonteAnos?: number;
}

interface UseImpactoAmbientalReturn {
  impacto: ImpactoAmbiental | null;
  fator: FatorEmissaoRede | null;
  fatorPendente: boolean;
  erro: string | null;
}

export function useImpactoAmbiental({
  geracaoAnualKwh,
  fatorEmissao = FATOR_EMISSAO_SIN,
  degradacaoAnual,
  horizonteAnos,
}: ParametrosImpactoAmbiental): UseImpactoAmbientalReturn {
  return useMemo<UseImpactoAmbientalReturn>(() => {
    if (!fatorEmissao) {
      return { impacto: null, fator: null, fatorPendente: true, erro: null };
    }
    if (geracaoAnualKwh === null) {
      return { impacto: null, fator: fatorEmissao, fatorPendente: false, erro: null };
    }
    try {
      const impacto = calcularSerieCO2Evitado({
        geracaoAnualKwh,
        fatorEmissao: fatorEmissao.kgCo2PorKwh,
        degradacaoAnual,
        horizonteAnos,
      });
      return { impacto, fator: fatorEmissao, fatorPendente: false, erro: null };
    } catch (e) {
      return {
        impacto: null,
        fator: fatorEmissao,
        fatorPendente: false,
        erro: e instanceof Error ? e.message : String(e),
      };
    }
  }, [geracaoAnualKwh, fatorEmissao, degradacaoAnual, horizonteAnos]);
}
