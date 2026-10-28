import { router } from 'expo-router';
import { Bell, CloudOff, FileText, Info, TrendingUp, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Header, IconBox, Screen } from '@/components';
import type { AppNotification, AppNotificationKind } from '@/domain/entities';
import { useAppStore } from '@/store/AppStore';
import { colors, navy, orange, radius, semantic } from '@/theme';
import { formatElapsed } from '@/utils/format';

// SCRUM-401 — Notificações do técnico. Conteúdo decidido para o MVP:
// respostas do gestor (upgrade, proposta aprovada/recusada/reaberta),
// problemas de sincronização que pedem ação (RF16, 1a) e avisos do sistema
// (ex.: base de contingência atualizada). O que o técnico recebe é controlado
// em Preferências.

const kindStyle: Record<AppNotificationKind, { icon: LucideIcon; color: string; background: string }> = {
  upgrade: { icon: TrendingUp, color: orange[600], background: orange[100] },
  proposta: { icon: FileText, color: semantic.infoText, background: semantic.infoSoft },
  sincronizacao: { icon: CloudOff, color: semantic.errorText, background: semantic.errorSoft },
  sistema: { icon: Info, color: navy[600], background: navy[100] },
};

export default function NotificationsScreen() {
  const { notifications, markNotificationsRead } = useAppStore();

  // Abrir a tela marca tudo como lido (o ponto laranja some ao sair).
  useEffect(() => () => markNotificationsRead(), [markNotificationsRead]);

  return (
    <Screen header={<Header title="Notificações" />} contentStyle={styles.content}>
      {notifications.length === 0 ? (
        <View style={styles.empty}>
          <IconBox icon={Bell} size={56} background={navy[100]} color={navy[500]} />
          <AppText variant="body" weight="semibold" align="center">
            Nenhuma notificação
          </AppText>
          <AppText variant="bodySmall" color={colors.textSecondary} align="center">
            Você será avisado aqui quando o gestor responder suas solicitações ou quando uma proposta precisar de atenção.
          </AppText>
        </View>
      ) : (
        notifications.map((n) => <NotificationRow key={n.id} notification={n} />)
      )}
    </Screen>
  );
}

function NotificationRow({ notification }: { notification: AppNotification }) {
  const style = kindStyle[notification.kind];
  const open = notification.proposalId
    ? () => router.push({ pathname: '/proposta/[id]', params: { id: notification.proposalId! } })
    : undefined;
  return (
    <Pressable
      onPress={open}
      disabled={!open}
      accessibilityRole={open ? 'button' : 'text'}
      style={({ pressed }) => [styles.row, !notification.read && styles.unread, pressed && { backgroundColor: navy[50] }]}
    >
      <IconBox icon={style.icon} size={40} background={style.background} color={style.color} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <AppText variant="bodySmall" weight="bold" style={styles.flex}>
            {notification.title}
          </AppText>
          <AppText variant="caption" color={navy[400]}>
            {formatElapsed(notification.createdAt)}
          </AppText>
        </View>
        <AppText variant="bodySmall" color={colors.textSecondary}>
          {notification.message}
        </AppText>
      </View>
      {!notification.read && <View style={styles.dot} accessibilityLabel="Não lida" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: 10 },
  empty: { alignItems: 'center', gap: 12, paddingTop: 64, paddingHorizontal: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unread: { borderColor: orange[200], backgroundColor: orange[50] },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: orange[500], marginTop: 6 },
});
