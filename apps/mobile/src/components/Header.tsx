import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, navy } from '@/theme';
import { AppText } from './AppText';

interface HeaderProps {
  title?: string;
  /** Conteúdo ao lado do título (ex.: badge "Modo Leve"). */
  accessory?: ReactNode;
  right?: ReactNode;
  onBack?: () => void;
  showBack?: boolean;
  tone?: 'light' | 'dark';
}

export function Header({ title, accessory, right, onBack, showBack = true, tone = 'light' }: HeaderProps) {
  const fg = tone === 'dark' ? colors.textOnDark : colors.text;
  const handleBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));

  return (
    <View style={[styles.container, { backgroundColor: tone === 'dark' ? navy[900] : colors.surface }]}>
      {showBack && (
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={12}
          style={styles.back}
        >
          <ArrowLeft size={24} color={fg} strokeWidth={2} />
        </Pressable>
      )}
      <View style={styles.titleRow}>
        {title && (
          <AppText variant="h3" weight="bold" color={fg} numberOfLines={1} style={styles.title}>
            {title}
          </AppText>
        )}
        {accessory}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 12,
  },
  back: { marginLeft: -2 },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flexShrink: 1 },
});
