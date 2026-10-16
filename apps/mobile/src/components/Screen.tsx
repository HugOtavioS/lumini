import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme';

interface ScreenProps {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  /** Pinta a área do status bar (ex.: cabeçalho escuro). */
  topColor?: string;
  statusBarStyle?: 'light' | 'dark';
  contentStyle?: StyleProp<ViewStyle>;
  /** Tela dentro das abas: a tab bar já cuida da área segura inferior. */
  inTabs?: boolean;
}

export function Screen({
  children,
  header,
  footer,
  scroll = true,
  topColor = colors.surface,
  statusBarStyle = 'dark',
  contentStyle,
  inTabs,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = footer || inTabs ? 0 : insets.bottom;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style={statusBarStyle} />
      <View style={{ height: insets.top, backgroundColor: topColor }} />
      {header}
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: 24 + bottomInset }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, styles.content, { paddingBottom: bottomInset }, contentStyle]}>{children}</View>
      )}
      {footer && <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>{footer}</View>}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, gap: 16, flexGrow: 1 },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
});
