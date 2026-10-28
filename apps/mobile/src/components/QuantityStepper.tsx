import { Minus, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, navy, orange, radius } from '@/theme';
import { AppText } from './AppText';

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Incremento de cada toque (padrão 1). */
  step?: number;
  /** "round": botões circulares (busca); "boxed": caixa com bordas (detalhes). */
  variant?: 'round' | 'boxed';
}

export function QuantityStepper({ value, onChange, min = 0, max = 999, step = 1, variant = 'round' }: QuantityStepperProps) {
  const decrement = () => onChange(Math.max(min, value - step));
  const increment = () => onChange(Math.min(max, value + step));
  const boxed = variant === 'boxed';

  return (
    <View style={[styles.row, boxed && styles.boxed]}>
      <Pressable
        onPress={decrement}
        disabled={value <= min}
        accessibilityRole="button"
        accessibilityLabel="Diminuir quantidade"
        hitSlop={6}
        style={[styles.button, boxed ? styles.boxedButton : styles.minus, value <= min && styles.disabled]}
      >
        <Minus size={boxed ? 18 : 14} color={navy[700]} strokeWidth={2.5} />
      </Pressable>
      <AppText variant={boxed ? 'h3' : 'body'} weight="semibold" style={[styles.value, boxed && styles.boxedValue]}>
        {value}
      </AppText>
      <Pressable
        onPress={increment}
        disabled={value >= max}
        accessibilityRole="button"
        accessibilityLabel="Aumentar quantidade"
        hitSlop={6}
        style={[styles.button, boxed ? styles.boxedButton : styles.plus, value >= max && styles.disabled]}
      >
        <Plus size={boxed ? 18 : 14} color={boxed ? navy[700] : '#FFFFFF'} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  boxed: {
    backgroundColor: navy[100],
    borderRadius: radius.lg,
    padding: 4,
    gap: 4,
  },
  button: { alignItems: 'center', justifyContent: 'center' },
  minus: { width: 28, height: 28, borderRadius: 14, backgroundColor: navy[100] },
  plus: { width: 28, height: 28, borderRadius: 14, backgroundColor: orange[500] },
  boxedButton: { width: 34, height: 34, borderRadius: radius.md, backgroundColor: colors.surface },
  disabled: { opacity: 0.4 },
  value: { minWidth: 20, textAlign: 'center' },
  boxedValue: { minWidth: 44 },
});
