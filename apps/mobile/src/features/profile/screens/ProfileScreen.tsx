import { router } from 'expo-router';
import { ChevronRight, RefreshCw, User } from 'lucide-react-native';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppText, Button, Header, Screen } from '@/components';
import { isSyncable } from '@/domain/services/proposalRules';
import { useAppStore } from '@/store/AppStore';
import { colors, navy, orange, radius, semantic } from '@/theme';
import { formatElapsed } from '@/utils/format';
import { confirmAction, notify } from '@/utils/notify';

// Perfil (RF14) com o estado de sincronização (RF16) e o Modo Leve (RF19).
export default function ProfileScreen() {
  const { technician, proposals, lastSyncAt, isSyncing, isOnline, syncNow, logout, lightMode, setLightMode, upgradeRequest } =
    useAppStore();
  const pending = proposals.filter((p) => p.syncStatus !== 'sincronizado' && isSyncable(p.status)).length;

  async function handleSync() {
    const outcome = await syncNow();
    if (outcome === 'offline') notify('Sem conexão', 'Não há conexão no momento. Tentaremos novamente assim que ela voltar.');
    if (outcome === 'nada_pendente') notify('Tudo sincronizado', 'Não há propostas pendentes de sincronização.');
  }

  async function handleLogout() {
    const confirmed = await confirmAction(
      'Sair da conta',
      pending > 0
        ? `Você tem ${pending} proposta(s) pendente(s) de sincronização. Elas continuam salvas neste dispositivo.`
        : 'Deseja realmente sair?',
      'Sair',
      true,
    );
    if (confirmed) logout();
  }

  return (
    <Screen header={<Header title="Perfil" onBack={() => router.navigate('/')} />} inTabs contentStyle={styles.content}>
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <User size={40} color={navy[500]} strokeWidth={1.5} />
        </View>
        <AppText variant="h3" weight="bold">
          {technician?.name}
        </AppText>
        <AppText variant="bodySmall" weight="bold" color={orange[500]} style={styles.caps}>
          Técnico Instalador
        </AppText>
        <AppText variant="bodySmall" color={colors.textSecondary}>
          {technician?.email}
        </AppText>
      </View>

      <View style={styles.syncWrapper}>
        <View style={styles.syncCard}>
          <View style={styles.syncStatus}>
            <View style={[styles.dot, { backgroundColor: isOnline ? semantic.success : navy[400] }]} />
            <AppText variant="bodySmall" color={colors.textSecondary}>
              Última sincronização: {formatElapsed(lastSyncAt)}
            </AppText>
          </View>
          <Button label="Tentar Sincronizar Agora" variant="secondary" icon={RefreshCw} loading={isSyncing} onPress={handleSync} />
          {pending > 0 ? (
            <AppText variant="bodySmall" color={orange[600]}>
              {pending} {pending === 1 ? 'proposta pendente' : 'propostas pendentes'} de sincronização
            </AppText>
          ) : (
            <AppText variant="bodySmall" color={semantic.successText}>
              Todas as propostas estão sincronizadas
            </AppText>
          )}
        </View>
      </View>

      <View style={styles.menu}>
        <MenuRow
          label="Sincronização"
          onPress={() =>
            notify(
              'Sincronização',
              `${pending} pendente(s). ${upgradeRequest ? `Solicitação de upgrade: ${upgradeRequest.status}.` : ''}`.trim(),
            )
          }
        />
        <MenuRow label="Notificações" onPress={() => notify('Notificações', 'Você será avisado quando o gestor responder às suas solicitações.')} />
        <View style={styles.row}>
          <View style={styles.flex}>
            <AppText variant="body">Modo Leve</AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              Medição manual, sem realidade aumentada
            </AppText>
          </View>
          <Switch
            value={lightMode}
            onValueChange={setLightMode}
            trackColor={{ true: orange[500], false: navy[300] }}
            thumbColor="#FFFFFF"
            accessibilityLabel="Modo Leve"
          />
        </View>
        <MenuRow label="Sobre o Lumini" onPress={() => notify('Lumini', 'Versão 1.0.0 — UNISA TECNOLOGIA · Projeto Integrador Interdisciplinar IV')} />
        <Pressable onPress={handleLogout} accessibilityRole="button" style={styles.row}>
          <AppText variant="body" weight="semibold" color={semantic.error}>
            Sair da Conta
          </AppText>
        </Pressable>
      </View>
    </Screen>
  );
}

function MenuRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && { backgroundColor: navy[50] }]}>
      <AppText variant="body" style={styles.flex}>
        {label}
      </AppText>
      <ChevronRight size={18} color={navy[400]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 0, paddingTop: 0, gap: 0 },
  identity: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 24,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: navy[200],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  caps: { textTransform: 'uppercase', letterSpacing: 0.3 },
  syncWrapper: { backgroundColor: colors.surface, padding: 16 },
  syncCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    gap: 12,
  },
  syncStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  menu: { backgroundColor: colors.surface, marginTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  flex: { flex: 1 },
});
