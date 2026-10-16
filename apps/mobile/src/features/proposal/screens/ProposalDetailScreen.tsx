import { router, useLocalSearchParams } from 'expo-router';
import { Copy, Ellipsis, MessageCircle, Pencil, RefreshCw } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  BottomSheet,
  Button,
  Card,
  Divider,
  Header,
  KeyValueRow,
  ProposalStatusBadge,
  Screen,
  SyncStatusBadge,
} from '@/components';
import { categoryLabels } from '@/domain/labels';
import { itemTotal } from '@/domain/services/pricing';
import { useAppStore } from '@/store/AppStore';
import { useDraft } from '@/store/DraftStore';
import { colors, navy, orange, radius, semantic } from '@/theme';
import { addDays, formatCurrency, formatDate, formatElapsed, formatNumber } from '@/utils/format';
import { notify } from '@/utils/notify';
import { duplicateProposal, editProposal } from '../editProposal';
import { shareViaWhatsApp } from '../share';

// Detalhe da Proposta (RF13, passo 4).
export default function ProposalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getProposal, syncNow, isSyncing } = useAppStore();
  const draft = useDraft();
  const [menuOpen, setMenuOpen] = useState(false);
  const proposal = id ? getProposal(id) : undefined;

  const header = (
    <Header
      title="Detalhe da Proposta"
      tone="dark"
      right={
        proposal && (
          <Pressable onPress={() => setMenuOpen(true)} accessibilityRole="button" accessibilityLabel="Mais ações" hitSlop={10}>
            <Ellipsis size={24} color="#FFFFFF" />
          </Pressable>
        )
      }
    />
  );

  if (!proposal) {
    return (
      <Screen header={header} topColor={navy[900]} statusBarStyle="light">
        <AppText variant="body" align="center">
          Proposta não encontrada.
        </AppText>
      </Screen>
    );
  }

  const { client, installation, sizing, pricing, viability } = proposal;
  const validUntil = addDays(proposal.generatedAt ?? proposal.createdAt, proposal.validityDays);
  const modules = proposal.items.filter((i) => i.category === 'modulo');
  const inverter = proposal.items.find((i) => i.category === 'inversor');
  const services = pricing.electricalMaterials + pricing.labor + pricing.projectAndApproval + pricing.freight + pricing.margin;

  async function handleSync() {
    setMenuOpen(false);
    const outcome = await syncNow(proposal!.id);
    if (outcome === 'offline') notify('Sem conexão', 'A proposta será enviada quando a conexão voltar.');
    if (outcome === 'nada_pendente') notify('Tudo certo', 'Esta proposta já está sincronizada.');
  }

  return (
    <Screen
      header={header}
      topColor={navy[900]}
      statusBarStyle="light"
      footer={
        <>
          <Button
            label="Abrir PDF"
            onPress={() => notify('PDF da proposta', 'A visualização do PDF será integrada ao template oficial da proposta (RF12).')}
          />
          <Button label="Duplicar Proposta" variant="outline" icon={Copy} onPress={() => duplicateProposal(proposal, draft.load)} />
          <Button label="Reenviar Proposta" variant="outlineDark" onPress={() => shareViaWhatsApp(proposal)} />
        </>
      }
      contentStyle={styles.content}
    >
      <Card style={styles.card}>
        <View style={styles.titleRow}>
          <AppText variant="h3" weight="bold" style={styles.shrink}>
            {client.name}
          </AppText>
          <ProposalStatusBadge status={proposal.status} />
        </View>
        <AppText variant="bodySmall" color={colors.textSecondary}>
          {installation.address} - {installation.city}, {installation.state}
        </AppText>
        <Divider style={styles.divider} />
        <View style={styles.metaRow}>
          <Meta label="Proposta Nº" value={proposal.number} />
          <Meta label="Validade" value={`${proposal.validityDays} Dias (até ${formatDate(validUntil)})`} alignEnd />
        </View>
        <View style={styles.syncRow}>
          <AppText variant="caption" color={colors.textSecondary}>
            Sincronização{proposal.lastSyncAttemptAt ? ` · ${formatElapsed(proposal.lastSyncAttemptAt)}` : ''}
          </AppText>
          <SyncStatusBadge status={proposal.syncStatus} />
        </View>
        {proposal.syncError && (
          <AppText variant="caption" color={semantic.errorText}>
            {proposal.syncError}
          </AppText>
        )}
      </Card>

      <Card style={styles.card}>
        <AppText variant="body" weight="bold">
          Resumo Técnico
        </AppText>
        <KeyValueRow label="Potência de Pico" value={`${formatNumber(proposal.systemKwp, 2)} kWp`} />
        {modules.map((m) => (
          <KeyValueRow key={m.equipmentId} label="Módulos" value={`${m.quantity}x ${m.name}`} />
        ))}
        {inverter && <KeyValueRow label="Inversor" value={inverter.name} />}
        <KeyValueRow label="Geração Estimada" value={`${formatNumber(proposal.monthlyGenerationKwh, 0)} kWh/mês`} />
        <KeyValueRow label="Sombreamento" value={`${proposal.shadingPct}% · perdas ${formatNumber(sizing.losses.totalPct, 0)}%`} />
      </Card>

      <View style={styles.viability}>
        <AppText variant="body" weight="bold">
          Viabilidade Financeira
        </AppText>
        <View>
          <AppText variant="h1" weight="extrabold" color={orange[500]}>
            {formatCurrency(pricing.total)}
          </AppText>
          <AppText variant="bodySmall" color={orange[600]}>
            Valor Total
          </AppText>
        </View>
        <View style={styles.kpis}>
          <MiniCard label="Retorno Estimado" value={`${formatNumber(viability.paybackYears, 1)} anos`} />
          <MiniCard label="ROI" value={`${formatNumber(viability.roiPct, 0)}%`} />
        </View>
        <Meta label="Economia em 25 anos" value={formatCurrency(viability.savings25y, 0)} />
        <Meta
          label="Economia Mensal"
          value={<AppText variant="body" weight="bold" color={semantic.successStrong}>~{formatCurrency(viability.monthlySavings, 0)}/mês</AppText>}
        />
      </View>

      <Card style={styles.card}>
        <AppText variant="body" weight="bold">
          Equipamentos
        </AppText>
        {proposal.items.map((item) => (
          <KeyValueRow
            key={item.equipmentId}
            label={`${item.category === 'modulo' || item.category === 'estrutura' ? `${categoryLabels[item.category]} ` : ''}${item.name} (x${item.quantity})`}
            value={formatCurrency(itemTotal(item), 0)}
          />
        ))}
        <Divider style={styles.divider} />
        <KeyValueRow label="Subtotal" value={formatCurrency(pricing.equipment, 0)} />
        <KeyValueRow label="Serviços, materiais e margem" value={formatCurrency(services, 0)} />
        <KeyValueRow label="Total" value={formatCurrency(pricing.total)} bold />
      </Card>

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <View style={styles.menu}>
          <MenuItem icon={<RefreshCw size={20} color={navy[700]} />} label={isSyncing ? 'Sincronizando...' : 'Sincronizar agora'} onPress={handleSync} />
          <MenuItem
            icon={<MessageCircle size={20} color={navy[700]} />}
            label="Compartilhar via WhatsApp"
            onPress={() => {
              setMenuOpen(false);
              shareViaWhatsApp(proposal);
            }}
          />
          <MenuItem
            icon={<Pencil size={20} color={navy[700]} />}
            label="Editar proposta"
            onPress={() => {
              setMenuOpen(false);
              editProposal(proposal, draft.load);
            }}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}

function Meta({ label, value, alignEnd }: { label: string; value: ReactNode; alignEnd?: boolean }) {
  return (
    <View style={alignEnd && styles.alignEnd}>
      <AppText variant="caption" color={colors.textSecondary}>
        {label}
      </AppText>
      {typeof value === 'string' ? (
        <AppText variant="body" weight="bold">
          {value}
        </AppText>
      ) : (
        value
      )}
    </View>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniCard}>
      <AppText variant="caption" color={colors.textSecondary}>
        {label}
      </AppText>
      <AppText variant="h3" weight="bold">
        {value}
      </AppText>
    </View>
  );
}

function MenuItem({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: navy[50] }]}>
      {icon}
      <AppText variant="body">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingHorizontal: 16 },
  card: { gap: 4, borderWidth: 1, borderColor: navy[100] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shrink: { flexShrink: 1 },
  divider: { marginVertical: 8 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  alignEnd: { alignItems: 'flex-end' },
  syncRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  viability: {
    backgroundColor: orange[50],
    borderWidth: 1,
    borderColor: orange[400],
    borderRadius: radius.xl,
    padding: 16,
    gap: 12,
  },
  kpis: { flexDirection: 'row', gap: 12 },
  miniCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12 },
  menu: { paddingBottom: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, minHeight: 56 },
});
