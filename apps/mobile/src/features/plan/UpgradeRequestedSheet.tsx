import { Send } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, BottomSheet, Button } from '@/components';
import { colors, navy, orange, radius, semantic } from '@/theme';

interface UpgradeRequestedSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Já havia uma solicitação pendente (RF28, 2a): não duplica. */
  alreadyPending?: boolean;
}

const nextSteps = [
  'Seu gestor receberá uma notificação',
  'Ele poderá aprovar o upgrade pelo painel web',
  'Você será notificado assim que o plano for ativado',
];

// Modal Upgrade Enviado (RF28 / D07): o técnico só solicita; o gestor faz o upgrade na web.
export function UpgradeRequestedSheet({ visible, onClose, alreadyPending }: UpgradeRequestedSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} contentStyle={styles.sheet}>
      <View style={styles.iconRing}>
        <View style={styles.iconCircle}>
          <Send size={26} color="#FFFFFF" strokeWidth={2} />
        </View>
      </View>
      <AppText variant="h2" weight="bold" align="center">
        {alreadyPending ? 'Solicitação já enviada' : 'Solicitação Enviada!'}
      </AppText>
      <AppText variant="bodySmall" color={colors.textSecondary} align="center" style={styles.description}>
        {alreadyPending
          ? 'Você já tem uma solicitação de upgrade para o Plano Pro aguardando o gestor da sua empresa.'
          : 'Sua solicitação de upgrade para o Plano Pro foi enviada ao gestor da sua empresa.'}
      </AppText>

      <View style={styles.steps}>
        <AppText variant="body" weight="bold" color={semantic.infoText}>
          O que acontece agora?
        </AppText>
        {nextSteps.map((step, index) => (
          <View key={step} style={styles.step}>
            <AppText variant="bodySmall" weight="bold" color={semantic.infoText}>
              {index + 1}.
            </AppText>
            <AppText variant="bodySmall" color={semantic.infoText} style={styles.stepText}>
              {step}
            </AppText>
          </View>
        ))}
      </View>

      <Button label="Entendi" onPress={onClose} />
      <Pressable onPress={onClose} accessibilityRole="button" style={styles.secondary} hitSlop={8}>
        <AppText variant="bodySmall" weight="medium" color={navy[500]}>
          Continuar com o Plano Free
        </AppText>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 24, gap: 12 },
  iconRing: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: orange[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: orange[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: { paddingHorizontal: 8 },
  steps: {
    backgroundColor: semantic.infoSoft,
    borderWidth: 1,
    borderColor: semantic.infoBorder,
    borderRadius: radius.lg,
    padding: 16,
    gap: 8,
    marginVertical: 12,
  },
  step: { flexDirection: 'row', gap: 8 },
  stepText: { flex: 1 },
  secondary: { alignSelf: 'center', paddingVertical: 8 },
});
