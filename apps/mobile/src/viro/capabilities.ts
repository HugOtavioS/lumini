import { useAppStore } from '@/store/AppStore';

/**
 * Verifica se a medição por RA está disponível (RF19 / RNF09).
 *
 * Nesta etapa a cena de RA é simulada em `ARMeasurementScene`, então a medição
 * por RA fica disponível sempre que o Modo Leve não foi ativado. Ao integrar o
 * ViroReact (development build), trocar por `ViroUtils.isARSupportedOnDevice`
 * e cair no Modo Leve quando a verificação for inconclusiva (RF19, 1a).
 */
export function useARAvailability(): { supported: boolean } {
  const { lightMode } = useAppStore();
  return { supported: !lightMode };
}
