import { router } from 'expo-router';
import { TrendingUp } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Callout, Card, Header, ProgressBar, Screen } from '@/components';
import { countsTowardPlan, isPlanLimitReached } from '@/domain/services/proposalRules';
import { PlanLimitDialog } from '@/features/plan/PlanLimitDialog';
import { UpgradeRequestedSheet } from '@/features/plan/UpgradeRequestedSheet';
import { MissingDraft } from '@/features/proposal/components/MissingDraft';
import { useAppStore } from '@/store/AppStore';
import { useDraft } from '@/store/DraftStore';
import { colors, navy, orange, radius, semantic } from '@/theme';
import { formatCurrency, formatNumber } from '@/utils/format';
import { notify } from '@/utils/notify';

const MILESTONE_YEARS = [1, 5, 10, 15, 25];

// Viabilidade Financeira (RF11) e geração da proposta (RF12).
export default function ViabilityScreen() {
  const draft = useDraft();
  const { technician, proposals, planUsed, planLimit, saveProposal, requestUpgrade } = useAppStore();
  const [limitVisible, setLimitVisible] = useState(false);
  const [upgradeSheet, setUpgradeSheet] = useState({ visible: false, alreadyPending: false });

  if (!draft.calculation || !technician) return <MissingDraft title="Viabilidade Financeira" />;

  const { viability } = draft.calculation;
  const maxSavings = viability.cumulativeSavings[viability.cumulativeSavings.length - 1] ?? 1;
  const nextSequence = 48 + proposals.filter((p) => !p.id.startsWith('seed-')).length;

  function generate() {
    // RN05: a primeira passagem para "Gerada" consome o limite do plano.
    const counts = countsTowardPlan(draft.sourceStatus);
    if (counts && isPlanLimitReached(planUsed, planLimit)) {
      setLimitVisible(true);
      return;
    }
    const proposal = draft.toProposal(technician!.id, nextSequence, 'gerada');
    if (!proposal) return;
    saveProposal(proposal, counts);
    router.replace({ pathname: '/instalacao/proposta-gerada', params: { id: proposal.id } });
  }

  function saveLocally() {
    const proposal = draft.toProposal(technician!.id, nextSequence, 'em_elaboracao');
    if (!proposal) return;
    saveProposal(proposal, false);
    setLimitVisible(false);
    notify('Proposta salva', 'A proposta ficou salva no dispositivo como "Em elaboração".');
    router.dismissTo('/');
  }

  return (
    <Screen header={<Header title="Viabilidade Financeira" />} footer={<Button label="Gerar Proposta" onPress={generate} />}>
      <Card style={styles.hero}>
        <AppText variant="display" weight="semibold" color={orange[500]} align="center">
          {formatCurrency(viability.savings25y, 0)}
        </AppText>
        <AppText variant="bodySmall" weight="medium" color={colors.textSecondary} align="center" style={styles.caps}>
          Economia estimada em 25 anos
        </AppText>
      </Card>

      {viability.monthlySavings <= 0 && (
        <Callout tone="warning" message="Economia nula ou negativa: a proposta parece inviável. Revise a tarifa e o consumo." />
      )}

      <Card style={styles.returns}>
        <AppText variant="bodySmall" weight="bold" style={styles.caps}>
          Retorno acumulado
        </AppText>
        {MILESTONE_YEARS.map((year) => {
          const value = viability.cumulativeSavings[year - 1] ?? 0;
          return (
            <View key={year} style={styles.bar}>
              <AppText variant="bodySmall" color={navy[600]} style={styles.barLabel}>
                Ano {year}
              </AppText>
              <View style={styles.barTrack}>
                <ProgressBar progress={value / maxSavings} track={navy[200]} height={10} />
              </View>
              <AppText variant="bodySmall" weight="bold" style={styles.barValue}>
                {formatCurrency(value, 0)}
              </AppText>
            </View>
          );
        })}
        <View style={styles.payback}>
          <AppText variant="bodySmall" color={colors.textSecondary}>
            Tempo de Payback
          </AppText>
          <AppText variant="bodySmall" weight="bold" color={semantic.successStrong}>
            {Number.isFinite(viability.paybackYears)
              ? `Payback em ${formatNumber(viability.paybackYears, 1)} anos`
              : 'Sem payback em 25 anos'}
          </AppText>
        </View>
      </Card>

      <View style={styles.kpis}>
        <Kpi label="ROI" value={`${formatNumber(viability.roiPct, 0)}%`} />
        <Kpi label="CO₂ Evitado" value={`${formatNumber(viability.co2AvoidedTon, 1)} ton`} />
      </View>

      <PlanLimitDialog
        visible={limitVisible}
        limit={planLimit}
        onClose={() => setLimitVisible(false)}
        onSaveLocally={saveLocally}
        onRequestUpgrade={() => {
          const { alreadyPending } = requestUpgrade();
          setLimitVisible(false);
          setUpgradeSheet({ visible: true, alreadyPending });
        }}
      />
      <UpgradeRequestedSheet
        visible={upgradeSheet.visible}
        alreadyPending={upgradeSheet.alreadyPending}
        onClose={() => setUpgradeSheet((s) => ({ ...s, visible: false }))}
      />
    </Screen>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.kpi}>
      <View style={styles.kpiTop}>
        <AppText variant="bodySmall" color={colors.textSecondary}>
          {label}
        </AppText>
        <TrendingUp size={16} color={semantic.success} strokeWidth={2.5} />
      </View>
      <AppText variant="h2" weight="bold">
        {value}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { paddingVertical: 24, gap: 4, borderRadius: radius.xxl },
  caps: { textTransform: 'uppercase' },
  returns: { gap: 12, borderRadius: radius.xxl },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  barLabel: { width: 52 },
  barTrack: { flex: 1 },
  barValue: { minWidth: 88, textAlign: 'right' },
  payback: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  kpis: { flexDirection: 'row', gap: 12 },
  kpi: { flex: 1, gap: 4 },
  kpiTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
