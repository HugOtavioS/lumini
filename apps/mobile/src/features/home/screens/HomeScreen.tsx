import { router } from 'expo-router';
import { ArrowRight, Plus, Zap } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, IconBox, ProgressBar, Screen } from '@/components';
import { PLAN_WARNING_RATIO } from '@/domain/parameters';
import { isSyncable } from '@/domain/services/proposalRules';
import { UpgradeRequestedSheet } from '@/features/plan/UpgradeRequestedSheet';
import { ProposalCard } from '@/features/proposal/components/ProposalCard';
import { useAppStore } from '@/store/AppStore';
import { useDraft } from '@/store/DraftStore';
import { colors, navy, orange, radius, semantic } from '@/theme';
import { formatNumber, initials } from '@/utils/format';

function isThisMonth(iso: string | undefined): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

export default function HomeScreen() {
  const { technician, isOnline, proposals, planUsed, planLimit, requestUpgrade, isSyncing } = useAppStore();
  // SCRUM-84: pendências e erros no indicador global.
  const pendingSync = proposals.filter((p) => p.syncStatus !== 'sincronizado' && isSyncable(p.status));
  const syncErrors = pendingSync.filter((p) => p.syncStatus === 'erro').length;
  const draft = useDraft();
  const [upgradeSheet, setUpgradeSheet] = useState({ visible: false, alreadyPending: false });

  const stats = useMemo(() => {
    const monthly = proposals.filter((p) => isThisMonth(p.generatedAt));
    return {
      installations: monthly.length,
      kwp: monthly.reduce((sum, p) => sum + p.systemKwp, 0),
    };
  }, [proposals]);

  const recent = useMemo(
    () => [...proposals].sort((a, b) => (b.generatedAt ?? b.createdAt).localeCompare(a.generatedAt ?? a.createdAt)).slice(0, 4),
    [proposals],
  );

  const planRatio = planUsed / planLimit;

  function startInstallation() {
    draft.start();
    router.push('/instalacao/novo-cliente');
  }

  function handleUpgrade() {
    const { alreadyPending } = requestUpgrade();
    setUpgradeSheet({ visible: true, alreadyPending });
  }

  const header = (
    <View style={styles.header}>
      <View style={styles.avatar}>
        <AppText variant="body" weight="bold" color="#FFFFFF">
          {initials(technician?.name ?? '')}
        </AppText>
      </View>
      <View style={styles.greeting}>
        <AppText variant="bodySmall" color={navy[300]}>
          Olá, bem-vindo
        </AppText>
        <AppText variant="h3" weight="bold" color="#FFFFFF" numberOfLines={1}>
          {technician?.name}
        </AppText>
      </View>
      {/* RF16: indicador global online/offline. */}
      <View style={[styles.connection, !isOnline && styles.connectionOffline]} accessibilityRole="text">
        <View style={[styles.connectionDot, { backgroundColor: isOnline ? semantic.success : navy[400] }]} />
        <AppText variant="bodySmall" weight="semibold" color={isOnline ? semantic.success : navy[300]}>
          {isOnline ? 'Online' : 'Offline'}
        </AppText>
      </View>
    </View>
  );

  const syncStrip =
    pendingSync.length > 0 || isSyncing ? (
      <Pressable
        onPress={() => router.navigate('/historico')}
        accessibilityRole="button"
        style={[styles.syncStrip, syncErrors > 0 && styles.syncStripError]}
      >
        <View style={[styles.connectionDot, { backgroundColor: syncErrors > 0 ? semantic.error : orange[500] }]} />
        <AppText variant="bodySmall" weight="semibold" style={styles.flex}>
          {isSyncing
            ? 'Sincronizando...'
            : syncErrors > 0
              ? `${syncErrors} proposta${syncErrors > 1 ? 's' : ''} com erro de sincronização`
              : `${pendingSync.length} proposta${pendingSync.length > 1 ? 's' : ''} aguardando sincronização`}
        </AppText>
        <ArrowRight size={16} color={navy[500]} />
      </Pressable>
    ) : null;

  return (
    <Screen header={header} topColor={navy[900]} statusBarStyle="light" inTabs>
      {syncStrip}
      {/* RF24 / RN05: consumo do limite mensal da empresa. */}
      <View style={[styles.plan, planRatio >= PLAN_WARNING_RATIO && styles.planWarning]}>
        <IconBox icon={Zap} size={40} background={orange[100]} />
        <View style={styles.planBody}>
          <AppText variant="bodySmall" weight="semibold">
            Plano Free: {planUsed}/{planLimit} propostas este mês
          </AppText>
          <ProgressBar progress={planRatio} />
        </View>
        <Pressable onPress={handleUpgrade} accessibilityRole="button" hitSlop={8}>
          <AppText variant="bodySmall" weight="bold" color={orange[500]}>
            Upgrade
          </AppText>
        </Pressable>
      </View>

      <View style={styles.stats}>
        <Card style={styles.stat}>
          <AppText variant="caption" color={colors.textSecondary}>
            Este Mês
          </AppText>
          <AppText variant="h2" weight="bold">
            {stats.installations} Inst.
          </AppText>
        </Card>
        <Card style={styles.stat}>
          <AppText variant="caption" color={colors.textSecondary}>
            Geração
          </AppText>
          <AppText variant="h2" weight="bold">
            {formatNumber(stats.kwp, 1)} kWp
          </AppText>
        </Card>
      </View>

      <Button label="Nova Instalação" icon={Plus} onPress={startInstallation} />

      <View style={styles.sectionHeader}>
        <AppText variant="h3" weight="bold">
          Propostas Recentes
        </AppText>
        <Pressable
          onPress={() => router.navigate('/historico')}
          accessibilityRole="button"
          style={styles.seeAll}
          hitSlop={8}
        >
          <AppText variant="bodySmall" weight="semibold" color={orange[500]}>
            Ver todas
          </AppText>
          <ArrowRight size={16} color={orange[500]} />
        </Pressable>
      </View>

      <View style={styles.list}>
        {recent.map((proposal, index) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            badge="status"
            withTime={index === 0}
            onPress={() => router.push({ pathname: '/proposta/[id]', params: { id: proposal.id } })}
          />
        ))}
      </View>

      <UpgradeRequestedSheet
        visible={upgradeSheet.visible}
        alreadyPending={upgradeSheet.alreadyPending}
        onClose={() => setUpgradeSheet((s) => ({ ...s, visible: false }))}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: navy[900],
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: orange[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: { flex: 1 },
  flex: { flex: 1 },
  syncStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: orange[50],
    borderWidth: 1,
    borderColor: orange[200],
  },
  syncStripError: { backgroundColor: semantic.errorSoft, borderColor: semantic.error },
  connection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  connectionOffline: { backgroundColor: 'rgba(148, 163, 184, 0.2)' },
  connectionDot: { width: 8, height: 8, borderRadius: 4 },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: orange[200],
    backgroundColor: orange[50],
  },
  planWarning: { borderColor: orange[400] },
  planBody: { flex: 1, gap: 8 },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, gap: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  list: { gap: 12 },
});
