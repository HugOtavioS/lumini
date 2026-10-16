import { Pressable, StyleSheet, View } from 'react-native';

import { colors, navy, orange, radius } from '@/theme';
import { AppText } from './AppText';

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <View style={styles.container} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && styles.selected]}
          >
            <AppText
              variant="bodySmall"
              weight={selected ? 'semibold' : 'medium'}
              color={selected ? colors.textOnPrimary : navy[700]}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: navy[100],
    borderRadius: radius.lg,
    padding: 4,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md + 2,
  },
  selected: { backgroundColor: orange[500] },
});
