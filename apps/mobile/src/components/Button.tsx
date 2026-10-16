import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, navy, orange, radius, semantic } from '@/theme';
import { AppText } from './AppText';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'outlineDark'
  | 'outlineDanger'
  | 'outlineSuccess'
  | 'neutral'
  | 'ghost';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const palette: Record<ButtonVariant, { bg: string; pressedBg: string; fg: string; border?: string }> = {
  primary: { bg: orange[500], pressedBg: orange[600], fg: '#FFFFFF' },
  secondary: { bg: navy[900], pressedBg: navy[800], fg: '#FFFFFF' },
  outline: { bg: '#FFFFFF', pressedBg: orange[50], fg: orange[500], border: orange[500] },
  outlineDark: { bg: '#FFFFFF', pressedBg: navy[100], fg: navy[900], border: navy[900] },
  outlineDanger: { bg: '#FFFFFF', pressedBg: semantic.errorSoft, fg: semantic.error, border: semantic.error },
  outlineSuccess: { bg: '#FFFFFF', pressedBg: semantic.successSoft, fg: semantic.successStrong, border: semantic.success },
  neutral: { bg: '#FFFFFF', pressedBg: navy[100], fg: navy[900], border: navy[200] },
  ghost: { bg: 'transparent', pressedBg: navy[100], fg: navy[500] },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon: Icon,
  disabled,
  loading,
  fullWidth = true,
  style,
}: ButtonProps) {
  const tone = palette[variant];
  const isDisabled = disabled || loading;
  const fg = isDisabled && variant === 'primary' ? colors.disabledText : tone.fg;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        fullWidth && styles.fullWidth,
        {
          backgroundColor: isDisabled && variant === 'primary' ? colors.disabled : pressed ? tone.pressedBg : tone.bg,
          borderColor: tone.border ?? 'transparent',
          borderWidth: tone.border ? 1.5 : 0,
          opacity: isDisabled && variant !== 'primary' ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.content}>
          {Icon && <Icon size={20} color={fg} strokeWidth={2} />}
          <AppText variant={size === 'lg' ? 'body' : 'bodySmall'} weight="semibold" color={fg}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg + 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  lg: { minHeight: 52 },
  md: { minHeight: 40, borderRadius: radius.lg },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
