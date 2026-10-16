import type { TextStyle } from 'react-native';

// Escala tipográfica (Inter) do design system.
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

export type FontWeight = keyof typeof fontFamily;

export const typography = {
  display: { fontFamily: fontFamily.bold, fontSize: 32, lineHeight: 40 },
  h1: { fontFamily: fontFamily.bold, fontSize: 24, lineHeight: 32 },
  h2: { fontFamily: fontFamily.semibold, fontSize: 20, lineHeight: 28 },
  h3: { fontFamily: fontFamily.semibold, fontSize: 18, lineHeight: 26 },
  body: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 24 },
  bodySmall: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16 },
  overline: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
