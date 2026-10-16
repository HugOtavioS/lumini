// Paleta do design system Lumini (01_Desing/lumini_design_system.png).

export const orange = {
  50: '#FFF7ED',
  100: '#FFEDD5',
  200: '#FED7AA',
  300: '#FDBA74',
  400: '#FB923C',
  500: '#F97316',
  600: '#EA580C',
  700: '#C2410C',
} as const;

export const navy = {
  50: '#F8FAFC',
  100: '#F1F5F9',
  200: '#E2E8F0',
  300: '#CBD5E1',
  400: '#94A3B8',
  500: '#64748B',
  600: '#475569',
  700: '#334155',
  800: '#1E293B',
  900: '#0F172A',
} as const;

export const amber = {
  50: '#FFFBEB',
  100: '#FEF3C7',
  200: '#FDE68A',
  400: '#FBBF24',
  500: '#F59E0B',
  600: '#D97706',
} as const;

export const semantic = {
  success: '#22C55E',
  successStrong: '#16A34A',
  successText: '#15803D',
  successSoft: '#DCFCE7',
  warning: '#EAB308',
  warningText: '#A16207',
  warningSoft: '#FEF9C3',
  error: '#EF4444',
  errorText: '#B91C1C',
  errorSoft: '#FEF2F2',
  errorSoftStrong: '#FEE2E2',
  info: '#3B82F6',
  infoStrong: '#2563EB',
  infoText: '#1D4ED8',
  infoSoft: '#EFF6FF',
  infoBorder: '#DBEAFE',
  whatsapp: '#22C55E',
} as const;

export const colors = {
  primary: orange[500],
  primaryPressed: orange[600],
  primarySoft: orange[50],
  secondary: navy[900],
  accent: amber[400],

  background: navy[50],
  surface: '#FFFFFF',
  border: navy[200],
  borderStrong: navy[300],
  overlay: 'rgba(15, 23, 42, 0.55)',

  text: navy[900],
  textSecondary: navy[500],
  textMuted: navy[400],
  textOnPrimary: '#FFFFFF',
  textOnDark: '#FFFFFF',

  disabled: navy[200],
  disabledText: navy[400],
} as const;
