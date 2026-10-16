import type { LucideIcon } from 'lucide-react-native';
import { forwardRef, useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { colors, fontFamily, navy, orange, radius, semantic } from '@/theme';
import { AppText } from './AppText';

interface TextFieldProps extends Omit<TextInputProps, 'style' | 'editable'> {
  label?: string;
  error?: string;
  helper?: string;
  icon?: LucideIcon;
  right?: ReactNode;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, helper, icon: Icon, right, disabled, containerStyle, multiline, onFocus, onBlur, ...inputProps },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? semantic.error : focused ? orange[500] : colors.border;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <AppText variant="bodySmall" weight="medium" color={navy[700]}>
          {label}
        </AppText>
      )}
      <View
        style={[
          styles.field,
          multiline && styles.multiline,
          { borderColor, borderWidth: focused || error ? 1.5 : 1 },
          disabled && styles.disabled,
        ]}
      >
        {Icon && <Icon size={20} color={navy[400]} strokeWidth={1.75} />}
        <TextInput
          ref={ref}
          {...inputProps}
          multiline={multiline}
          editable={!disabled}
          placeholderTextColor={navy[400]}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, multiline && styles.inputMultiline, disabled && { color: navy[400] }]}
        />
        {right}
      </View>
      {error ? (
        <AppText variant="caption" color={semantic.error}>
          {error}
        </AppText>
      ) : helper ? (
        <AppText variant="caption" color={colors.textSecondary}>
          {helper}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: 8 },
  field: {
    minHeight: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  multiline: { minHeight: 88, alignItems: 'flex-start', paddingVertical: 12 },
  disabled: { backgroundColor: navy[100] },
  input: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 12,
    minWidth: 0,
    // Remove o contorno azul padrão do navegador no preview web.
    outlineStyle: 'none',
  } as object,
  inputMultiline: { paddingVertical: 0, minHeight: 64, textAlignVertical: 'top' },
});
