import { router } from 'expo-router';
import { ChevronRight, Pencil, RefreshCw, User } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppText, Button, Callout, Header, Screen } from '@/components';
import { isSyncable } from '@/domain/services/proposalRules';
import { useAppStore } from '@/store/AppStore';
import { notifySyncOutcome } from '../syncFeedback';
import { colors, navy, orange, radius, semantic } from '@/theme';
import { formatElapsed } from '@/utils/format';
import { confirmAction, notify } from '@/utils/notify';

// Perfil (RF14) com o estado de sincronização (RF16), o Modo Leve (RF19) e o
// menu de Notificações e Preferências (SCRUM-401/402).
export default function ProfileScreen() {
  const {
    technician,
    proposals,
    lastSyncAt,
    isSyncing,
    isOnline,
    syncNow,
    syncSummary,
    syncMode,
    logout,
    lightMode,
    setLightMode,
    upgradeRequest,
    unreadNotifications,
  } = useAppStore();
  // Propostas pendentes (RN07) + registros na fila que ainda não são propostas.
  const pending = proposals.filter((p) => p.syncStatus !== 'sincronizado' && isSyncable(p.status)).length;
  const withError = proposals.filter((p) => p.syncStatus === 'erro').length;

  async function handleSync() {
    notifySyncOutcome(await syncNow());
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
          {technician?.photoUri ? (
            <Image source={{ uri: technician.photoUri }} style={styles.photo} accessibilityLabel="Foto do perfil" />
          ) : (
            <User size={40} color={navy[500]} strokeWidth={1.5} />
          )}
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
        {!!technician?.phone && (
          <AppText variant="bodySmall" color={colors.textSecondary}>
            {technician.phone}
          </AppText>
        )}
        {/* SCRUM-378 */}
        <Button
          label="Editar perfil"
          variant="outline"
          icon={Pencil}
          fullWidth={false}
          style={styles.editButton}
          onPress={() => router.push('/conta/editar')}
        />
      </View>

      <View style={styles.syncWrapper}>
        <View style={styles.syncCard}>
          <View style={styles.syncStatus}>
            <View style={[styles.dot, { backgroundColor: isOnline ? semantic.success : navy[400] }]} />
            <AppText variant="bodySmall" color={colors.textSecondary}>
              Última sincronização: {formatElapsed(lastSyncAt)}
            </AppText>
          </View>
          {/* SCRUM-404: esvazia a fila na hora, sem esperar o envio automático. */}
          <Button label="Forçar sincronização agora" variant="secondary" icon={RefreshCw} loading={isSyncing} onPress={handleSync} />
          {(syncSummary.persistentFailure || withError > 0) && (
            <Callout
              tone="error"
              message={
                syncSummary.lastError
                  ? `Falha repetida ao sincronizar: ${syncSummary.lastError}`
                  : `${withError} ${withError === 1 ? 'proposta com erro' : 'propostas com erro'} de sincronização. Toque em "Forçar sincronização agora".`
              }
            />
          )}
          {pending > 0 ? (
            <AppText variant="bodySmall" color={orange[600]}>
              {pending} {pending === 1 ? 'proposta pendente' : 'propostas pendentes'} de sincronização
            </AppText>
          ) : (
            <AppText variant="bodySmall" color={semantic.successText}>
              Todas as propostas estão sincronizadas
            </AppText>
          )}
          {syncMode === 'simulado' && (
            <AppText variant="caption" color={navy[400]}>
              Modo de demonstração: sem servidor configurado, a sincronização é simulada.
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
              [
                `${pending} proposta(s) pendente(s), ${withError} com erro.`,
                `Registros na fila: ${syncSummary.pending + syncSummary.withError}.`,
                upgradeRequest ? `Solicitação de upgrade: ${upgradeRequest.status}.` : '',
              ]
                .filter(Boolean)
                .join(' '),
            )
          }
        />
        <MenuRow label="Notificações" badge={unreadNotifications} onPress={() => router.push('/conta/notificacoes')} />
        <MenuRow label="Preferências" onPress={() => router.push('/conta/preferencias')} />
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

function MenuRow({ label, onPress, badge = 0 }: { label: string; onPress: () => void; badge?: number }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && { backgroundColor: navy[50] }]}>
      <AppText variant="body" style={styles.flex}>
        {label}
      </AppText>
      {badge > 0 && (
        <View style={styles.badge} accessibilityLabel={`${badge} não lidas`}>
          <AppText variant="caption" weight="bold" color="#FFFFFF">
            {badge > 9 ? '9+' : badge}
          </AppText>
        </View>
      )}
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
  photo: { width: 80, height: 80, borderRadius: 40 },
  editButton: { marginTop: 12, paddingHorizontal: 20 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: orange[500],
    alignItems: 'center',
    justifyContent: 'center',
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
