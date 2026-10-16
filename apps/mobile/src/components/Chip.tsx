import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, navy, orange, radius } from '@/theme';
import { AppText } from './AppText';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** "outline" (fundo branco) ou "soft" (fundo cinza, usado nos filtros). */
  tone?: 'outline' | 'soft';
}

export function Chip({ label, selected, onPress, tone = 'outline' }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        tone === 'soft' ? styles.soft : styles.outline,
        selected && styles.selected,
        pressed && !selected && { backgroundColor: navy[100] },
      ]}
    >
      <AppText
        variant="bodySmall"
        weight={selected ? 'semibold' : 'medium'}
        color={selected ? colors.textOnPrimary : tone === 'soft' ? navy[600] : colors.text}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export function ChipGroup({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outline: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md + 2 },
  soft: { backgroundColor: navy[100], borderColor: navy[200] },
  selected: { backgroundColor: orange[500], borderColor: orange[500] },
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
