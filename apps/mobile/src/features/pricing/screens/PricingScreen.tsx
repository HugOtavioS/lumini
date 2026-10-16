import { router } from 'expo-router';
import { Calendar, Tag } from 'lucide-react-native';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button, Card, Header, IconBox, KeyValueRow, Screen, TextField } from '@/components';
import { MissingDraft } from '@/features/proposal/components/MissingDraft';
import { useDraft } from '@/store/DraftStore';
import { colors, fontFamily, navy, orange, radius } from '@/theme';
import { formatCurrency } from '@/utils/format';

// Precificação (RF10 / RN03).
export default function PricingScreen() {
  const draft = useDraft();
  if (!draft.calculation) return <MissingDraft title="Precificação" />;

  const { pricing } = draft.calculation;
  const rows = [
    { label: 'Equipamentos', value: pricing.equipment },
    { label: 'Materiais Elétricos', value: pricing.electricalMaterials },
    { label: 'Mão de Obra', value: pricing.labor },
    { label: 'Projeto e Homologação', value: pricing.projectAndApproval },
    { label: 'Frete', value: pricing.freight },
    { label: `Margem (${pricing.marginPct}%)`, value: pricing.margin },
  ];

  return (
    <Screen
      header={<Header title="Precificação" />}
      footer={<Button label="Calcular Viabilidade" onPress={() => router.push('/instalacao/viabilidade')} />}
      contentStyle={styles.content}
    >
      <Card style={styles.breakdown}>
        {rows.map((row) => (
          <KeyValueRow key={row.label} label={row.label} value={formatCurrency(row.value)} divider />
        ))}
        <AppText variant="caption" color={navy[400]} style={styles.note}>
          A margem incide sobre serviços e materiais; o preço dos equipamentos já inclui a margem do item.
        </AppText>
      </Card>

      <View style={styles.total}>
        <AppText variant="overline" color={orange[500]}>
          Valor total
        </AppText>
        <AppText variant="display" weight="extrabold" color="#FFFFFF">
          {formatCurrency(pricing.total)}
        </AppText>
      </View>

      {/* RN03: o desconto comercial é aplicado apenas pelo gestor no editor web (RF27). */}
      <TextField
        label="Desconto"
        value={formatCurrency(pricing.commercialDiscount)}
        disabled
        right={<Tag size={18} color={orange[500]} />}
        helper="Desconto comercial aplicado pelo gestor no painel web."
      />

      <View style={styles.validity}>
        <IconBox icon={Calendar} size={32} />
        <AppText variant="bodySmall" weight="semibold" style={styles.flex}>
          Validade da Proposta:
        </AppText>
        <View style={styles.validityInput}>
          <TextInput
            value={String(draft.validityDays)}
            onChangeText={(text) => {
              const days = Number(text.replace(/\D/g, ''));
              draft.setValidityDays(Math.min(90, days));
            }}
            onBlur={() => draft.validityDays < 1 && draft.setValidityDays(1)}
            keyboardType="number-pad"
            maxLength={2}
            accessibilityLabel="Validade da proposta em dias"
            style={styles.validityText}
          />
          <AppText variant="bodySmall" weight="semibold">
            dias
          </AppText>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 20 },
  breakdown: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: radius.xxl },
  note: { paddingVertical: 10 },
  total: {
    backgroundColor: navy[900],
    borderRadius: radius.xl,
    padding: 20,
    gap: 4,
  },
  validity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  validityInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1.5,
    borderColor: orange[500],
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    height: 40,
    backgroundColor: colors.surface,
  },
  validityText: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: colors.text,
    width: 24,
    textAlign: 'right',
    padding: 0,
    outlineStyle: 'none',
  } as object,
});
