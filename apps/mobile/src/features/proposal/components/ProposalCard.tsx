import { StyleSheet, View } from 'react-native';

import { AppText, Card, ProposalStatusBadge, SyncStatusBadge } from '@/components';
import type { Proposal } from '@/domain/entities';
import { colors, navy } from '@/theme';
import { formatCurrency, formatNumber, formatRelativeDay } from '@/utils/format';

interface ProposalCardProps {
  proposal: Proposal;
  /** Home mostra o status comercial; o Histórico, o de sincronização (RF13/RF16). */
  badge: 'status' | 'sync';
  withTime?: boolean;
  onPress?: () => void;
}

export function ProposalCard({ proposal, badge, withTime, onPress }: ProposalCardProps) {
  return (
    <Card onPress={onPress} style={styles.card} accessibilityLabel={`Proposta de ${proposal.client.name}`}>
      <ProposalCardContent proposal={proposal} badge={badge} withTime={withTime} />
    </Card>
  );
}

export function ProposalCardContent({ proposal, badge, withTime }: Omit<ProposalCardProps, 'onPress'>) {
  return (
    <View style={styles.content}>
      <View style={styles.row}>
        <AppText variant="body" weight="bold" numberOfLines={1} style={styles.flex}>
          {proposal.client.name}
        </AppText>
        <AppText variant="caption" color={navy[400]}>
          {formatRelativeDay(proposal.generatedAt ?? proposal.createdAt, withTime)}
        </AppText>
      </View>
      <View style={styles.row}>
        <AppText variant="body" weight="bold" style={styles.flex}>
          {formatCurrency(proposal.pricing.total)}
        </AppText>
        <AppText variant="bodySmall" color={colors.textSecondary}>
          {formatNumber(proposal.systemKwp, 1)} kWp
        </AppText>
        {badge === 'status' ? (
          <ProposalStatusBadge status={proposal.status} />
        ) : (
          <SyncStatusBadge status={proposal.syncStatus} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 14 },
  content: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
});
