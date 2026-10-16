import { router } from 'expo-router';
import { Zap } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Callout, Card, Divider, IconBox, KeyValueRow, Overline, Screen, Header } from '@/components';
import { MissingDraft } from '@/features/proposal/components/MissingDraft';
import { useDraft } from '@/store/DraftStore';
import { colors, navy, orange } from '@/theme';
import { formatNumber } from '@/utils/format';

// Resumo Técnico (RF07): resultado do dimensionamento e alertas.
export default function TechnicalSummaryScreen() {
  const { calculation } = useDraft();
  if (!calculation) return <MissingDraft title="Resumo Técnico" />;

  const { sizing } = calculation;
  const metrics = [
    { label: 'Potência do Sistema', value: `${formatNumber(sizing.installedKwp, 2)} kWp` },
    {
      label: 'HSP Média',
      value: `${formatNumber(sizing.hsp, 1)} h/dia`,
      note: sizing.hspSource === 'contingencia' ? 'Base de contingência local' : undefined,
    },
    { label: 'Fator de Perdas', value: `${formatNumber(sizing.losses.totalPct, 0)}%` },
  ];

  return (
    <Screen
      header={<Header title="Resumo Técnico" />}
      footer={<Button label="Selecionar Equipamentos" onPress={() => router.push('/instalacao/equipamentos')} />}
    >
      <Overline color={navy[900]}>Dimensionamento Solar</Overline>
      {metrics.map((metric) => (
        <Card key={metric.label} style={styles.metric}>
          <IconBox icon={Zap} />
          <View style={styles.metricText}>
            <AppText variant="bodySmall" color={colors.textSecondary}>
              {metric.label}
            </AppText>
            <AppText variant="h3" weight="bold">
              {metric.value}
            </AppText>
            {metric.note && (
              <AppText variant="caption" color={navy[400]}>
                {metric.note}
              </AppText>
            )}
          </View>
        </Card>
      ))}

      <Card style={styles.production}>
        <Overline>Estimativa de Produção</Overline>
        <KeyValueRow
          label={`Módulos necessários (${sizing.referenceModuleW} W)`}
          value={`${sizing.moduleCount} unidades`}
          valueColor={orange[500]}
        />
        <Divider />
        <KeyValueRow label="Geração estimada" value={`${formatNumber(sizing.estimatedMonthlyKwh, 0)} kWh/mês`} />
      </Card>

      {sizing.alerts.map((alert) => (
        <Callout key={alert.code} tone={alert.level === 'error' ? 'error' : 'warning'} message={alert.message} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  metric: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  metricText: { flex: 1 },
  production: { gap: 8 },
});
