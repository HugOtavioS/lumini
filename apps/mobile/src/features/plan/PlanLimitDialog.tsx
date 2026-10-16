import { Lock } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Dialog } from '@/components';
import { amber, colors, orange } from '@/theme';

interface PlanLimitDialogProps {
  visible: boolean;
  limit: number;
  onClose: () => void;
  onRequestUpgrade: () => void;
  onSaveLocally: () => void;
}

// Limite Proposta Gerada (RF12, 3a / RN05): bloqueia a geração e oferece a
// solicitação de upgrade ao gestor (RF28).
export function PlanLimitDialog({ visible, limit, onClose, onRequestUpgrade, onSaveLocally }: PlanLimitDialogProps) {
  return (
    <Dialog visible={visible} onClose={onClose}>
      <View style={styles.content}>
        <View style={styles.icon}>
          <Lock size={28} color={orange[500]} strokeWidth={2} />
        </View>
        <AppText variant="h2" weight="bold" align="center">
          Limite Atingido
        </AppText>
        <AppText variant="bodySmall" color={colors.textSecondary} align="center">
          Você atingiu o limite de {limit} propostas do Plano Free este mês.
        </AppText>
        <View style={styles.actions}>
          <Button label="Solicitar Upgrade para Pro — R$ 49/mês" size="md" onPress={onRequestUpgrade} />
          <Button label="Continuar sem geração (salvar localmente)" size="md" variant="neutral" onPress={onSaveLocally} />
        </View>
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', gap: 10 },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: amber[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  actions: { alignSelf: 'stretch', gap: 10, marginTop: 14 },
});
