import { router, useLocalSearchParams } from 'expo-router';
import { Check, CircleCheck, FileText, MessageCircle } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Header, IconBox, Screen, SyncNotice } from '@/components';
import { useAppStore } from '@/store/AppStore';
import { colors, navy, orange, radius, semantic } from '@/theme';
import { notify } from '@/utils/notify';
import { proposalFileName, shareViaWhatsApp } from '../share';

// Proposta Gerada com Sucesso (RF12, passos 5–6).
export default function ProposalGeneratedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getProposal, syncNow, isSyncing } = useAppStore();
  const proposal = id ? getProposal(id) : undefined;
  const goHome = () => router.dismissTo('/');

  if (!proposal) {
    return (
      <Screen header={<Header onBack={goHome} />}>
        <AppText variant="body" align="center">
          Proposta não encontrada.
        </AppText>
      </Screen>
    );
  }

  async function handleSync() {
    const outcome = await syncNow(proposal!.id);
    if (outcome === 'offline') {
      notify('Sem conexão', 'A proposta será enviada automaticamente quando a conexão voltar.');
    }
  }

  return (
    <Screen
      header={<Header onBack={goHome} />}
      footer={
        <>
          <Button
            label="Compartilhar via WhatsApp"
            variant="outlineSuccess"
            icon={MessageCircle}
            onPress={() => shareViaWhatsApp(proposal)}
          />
          <Button label="Voltar ao Início" variant="ghost" onPress={goHome} />
        </>
      }
      contentStyle={styles.content}
    >
      <View style={styles.success}>
        <View style={styles.check}>
          <Check size={40} color={semantic.success} strokeWidth={2.5} />
        </View>
        <AppText variant="h2" weight="bold" align="center">
          Proposta Gerada com Sucesso!
        </AppText>
      </View>

      <Card style={styles.file}>
        <IconBox icon={FileText} size={44} background={navy[100]} color={orange[500]} />
        <View style={styles.flex}>
          <AppText variant="body" weight="bold" numberOfLines={1}>
            {proposalFileName(proposal)}
          </AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            {proposal.number} · PDF · 3 páginas
          </AppText>
        </View>
      </Card>

      {/* RN07 / RF16: proposta gerada entra na fila de sincronização. */}
      {proposal.syncStatus === 'sincronizado' ? (
        <View style={styles.synced}>
          <CircleCheck size={20} color={semantic.successStrong} />
          <AppText variant="bodySmall" weight="semibold" color={semantic.successText} style={styles.flex}>
            Proposta sincronizada com o painel do gestor.
          </AppText>
        </View>
      ) : (
        <SyncNotice>
          <AppText variant="bodySmall" weight="semibold" color={orange[600]}>
            Projeto salvo offline. Sincronização pendente.
          </AppText>
          <Pressable onPress={handleSync} disabled={isSyncing} accessibilityRole="button" hitSlop={8}>
            <AppText variant="bodySmall" weight="bold" color={navy[800]} style={styles.link}>
              {isSyncing ? 'Sincronizando...' : 'Sincronizar agora'}
            </AppText>
          </Pressable>
        </SyncNotice>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 24, paddingTop: 24 },
  success: { alignItems: 'center', gap: 20 },
  check: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: semantic.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  file: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: colors.border },
  flex: { flex: 1 },
  link: { textDecorationLine: 'underline' },
  synced: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: semantic.success,
    backgroundColor: semantic.successSoft,
  },
});
