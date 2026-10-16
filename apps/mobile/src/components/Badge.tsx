import { StyleSheet, View } from 'react-native';

import type { ProposalStatus, SyncStatus } from '@/domain/entities';
import { proposalStatusLabels, syncStatusLabels } from '@/domain/labels';
import { amber, navy, orange, radius, semantic } from '@/theme';
import { AppText } from './AppText';

export type BadgeTone = 'success' | 'warning' | 'neutral' | 'error' | 'info' | 'orange' | 'amber';

const tones: Record<BadgeTone, { bg: string; fg: string }> = {
  success: { bg: semantic.successSoft, fg: semantic.successText },
  warning: { bg: amber[100], fg: amber[600] },
  amber: { bg: amber[100], fg: semantic.warningText },
  neutral: { bg: navy[100], fg: navy[600] },
  error: { bg: semantic.errorSoftStrong, fg: semantic.errorText },
  info: { bg: semantic.infoBorder, fg: semantic.infoText },
  orange: { bg: orange[100], fg: orange[700] },
};

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  /** "pill" para status; "tag" para rótulos retangulares (categoria, Modo Leve). */
  shape?: 'pill' | 'tag';
}

export function Badge({ label, tone = 'neutral', shape = 'pill' }: BadgeProps) {
  const { bg, fg } = tones[tone];
  return (
    <View style={[styles.base, shape === 'pill' ? styles.pill : styles.tag, { backgroundColor: bg }]}>
      <AppText variant="caption" weight={shape === 'pill' ? 'semibold' : 'medium'} color={fg} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

const proposalStatusTone: Record<ProposalStatus, BadgeTone> = {
  em_elaboracao: 'neutral',
  gerada: 'info',
  em_negociacao: 'warning',
  reaberta: 'orange',
  aprovada: 'success',
  recusada: 'error',
};

const syncStatusTone: Record<SyncStatus, BadgeTone> = {
  sincronizado: 'success',
  pendente: 'amber',
  erro: 'error',
};

export function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  return <Badge label={proposalStatusLabels[status]} tone={proposalStatusTone[status]} />;
}

export function SyncStatusBadge({ status }: { status: SyncStatus }) {
  return <Badge label={syncStatusLabels[status]} tone={syncStatusTone[status]} />;
}

const styles = StyleSheet.create({
  base: { alignSelf: 'flex-start', justifyContent: 'center' },
  pill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm + 2 },
});
