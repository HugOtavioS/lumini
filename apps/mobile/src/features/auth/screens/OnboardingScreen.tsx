import { Camera, FileText, RefreshCw, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Screen } from '@/components';
import { useAppStore } from '@/store/AppStore';
import { colors, navy, orange, radius } from '@/theme';

interface Slide {
  icon: LucideIcon;
  title: string;
  description: string;
}

// Guia Inicial (RNF03): dispensa treinamento formal.
const slides: Slide[] = [
  {
    icon: Camera,
    title: 'Meça o telhado',
    description: 'Use a câmera com realidade aumentada para medir área, inclinação e orientação em poucos toques.',
  },
  {
    icon: FileText,
    title: 'Gere sua proposta',
    description: 'Cálculos automáticos de dimensionamento solar e geração de PDF comercial prontinho para o cliente.',
  },
  {
    icon: RefreshCw,
    title: 'Trabalhe offline',
    description: 'Tudo funciona sem internet. Suas propostas sincronizam sozinhas quando a conexão voltar.',
  },
];

export default function OnboardingScreen() {
  const { completeOnboarding } = useAppStore();
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const isLast = index === slides.length - 1;
  const Icon = slide.icon;

  return (
    <Screen topColor={colors.background} scroll={false} contentStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.circle}>
          <Icon size={44} color={orange[500]} strokeWidth={1.5} />
        </View>
        <AppText variant="h1" weight="bold" align="center">
          {slide.title}
        </AppText>
        <AppText variant="body" color={colors.textSecondary} align="center" style={styles.description}>
          {slide.description}
        </AppText>
      </View>

      <View style={styles.dots} accessibilityLabel={`Passo ${index + 1} de ${slides.length}`}>
        {slides.map((s, i) => (
          <View key={s.title} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable onPress={completeOnboarding} accessibilityRole="button" hitSlop={12}>
          <AppText variant="body" weight="semibold" color={navy[500]}>
            Pular
          </AppText>
        </Pressable>
        <Button
          label={isLast ? 'Começar' : 'Próximo'}
          fullWidth={false}
          style={styles.next}
          onPress={() => (isLast ? completeOnboarding() : setIndex(index + 1))}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 48, paddingBottom: 24 },
  hero: { flex: 1, alignItems: 'center', gap: 20 },
  circle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#F8EBE0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  description: { maxWidth: 320 },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 28 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: navy[300] },
  dotActive: { width: 24, backgroundColor: orange[500] },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  next: { minWidth: 112, borderRadius: radius.xl },
});
