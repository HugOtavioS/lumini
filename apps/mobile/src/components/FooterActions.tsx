import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from './Button';

interface FooterActionsProps {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  /** Mostra "Voltar" à esquerda (Novo Cliente, Medição Manual). */
  withBack?: boolean;
  onBack?: () => void;
}

export function FooterActions({ primaryLabel, onPrimary, primaryDisabled, primaryLoading, withBack, onBack }: FooterActionsProps) {
  if (!withBack) {
    return <Button label={primaryLabel} onPress={onPrimary} disabled={primaryDisabled} loading={primaryLoading} />;
  }
  return (
    <View style={styles.row}>
      <Button label="Voltar" variant="ghost" fullWidth={false} style={styles.back} onPress={onBack ?? (() => router.back())} />
      <Button
        label={primaryLabel}
        fullWidth={false}
        style={styles.primary}
        onPress={onPrimary}
        disabled={primaryDisabled}
        loading={primaryLoading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  back: { flex: 1 },
  primary: { flex: 1 },
});
