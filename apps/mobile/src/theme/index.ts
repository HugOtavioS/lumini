import { Platform, type ViewStyle } from 'react-native';

export * from './colors';
export * from './typography';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// Padrão Lumini: 12px a 16px para componentes de interface.
export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  pill: 999,
} as const;

function elevation(y: number, blur: number, opacity: number, androidElevation: number): ViewStyle {
  return Platform.select<ViewStyle>({
    web: { boxShadow: `0px ${y}px ${blur}px rgba(15, 23, 42, ${opacity})` },
    default: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: y },
      shadowOpacity: opacity,
      shadowRadius: blur / 2,
      elevation: androidElevation,
    },
  });
}

// Nível 1: cards · Nível 2: menus · Nível 3: modais.
export const shadows = {
  level1: elevation(1, 4, 0.06, 1),
  level2: elevation(4, 12, 0.08, 4),
  level3: elevation(12, 32, 0.16, 12),
} as const;
