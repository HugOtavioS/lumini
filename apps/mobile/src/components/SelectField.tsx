import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, navy, orange, radius, semantic } from '@/theme';
import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';

interface SelectFieldProps<T extends string> {
  label?: string;
  placeholder?: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  error?: string;
  sheetTitle?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function SelectField<T extends string>({
  label,
  placeholder = 'Selecione',
  value,
  options,
  onChange,
  error,
  sheetTitle,
  containerStyle,
}: SelectFieldProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <AppText variant="bodySmall" weight="medium" color={navy[700]}>
          {label}
        </AppText>
      )}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholder}
        accessibilityValue={{ text: selected?.label }}
        style={[styles.field, { borderColor: error ? semantic.error : colors.border, borderWidth: error ? 1.5 : 1 }]}
      >
        <AppText variant="body" color={selected ? colors.text : navy[400]} numberOfLines={1} style={styles.value}>
          {selected?.label ?? placeholder}
        </AppText>
        <ChevronDown size={18} color={navy[400]} />
      </Pressable>
      {error && (
        <AppText variant="caption" color={semantic.error}>
          {error}
        </AppText>
      )}

      <BottomSheet visible={open} onClose={() => setOpen(false)} maxHeight="70%">
        <AppText variant="h3" weight="bold" style={styles.sheetTitle}>
          {sheetTitle ?? label ?? placeholder}
        </AppText>
        <FlatList
          data={options}
          keyExtractor={(option) => option.value}
          renderItem={({ item }) => {
            const isSelected = item.value === value;
            return (
              <Pressable
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => [styles.option, pressed && { backgroundColor: navy[50] }]}
              >
                <AppText variant="body" weight={isSelected ? 'semibold' : 'regular'} color={isSelected ? orange[600] : colors.text}>
                  {item.label}
                </AppText>
                {isSelected && <Check size={20} color={orange[500]} />}
              </Pressable>
            );
          }}
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  field: {
    minHeight: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  value: { flex: 1 },
  sheetTitle: { paddingHorizontal: 20, paddingBottom: 8 },
  option: {
    minHeight: 52,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
