import { router } from 'expo-router';
import { Pencil, RefreshCw, Search, Upload } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Header, Screen, SwipeableRow, TextField } from '@/components';
import { isSyncable } from '@/domain/services/proposalRules';
import { notifySyncOutcome } from '@/features/profile/syncFeedback';
import { useAppStore } from '@/store/AppStore';
import { useDraft } from '@/store/DraftStore';
import { amber, colors, navy, orange, radius, semantic } from '@/theme';
import { ProposalCardContent } from '../components/ProposalCard';
import { editProposal } from '../editProposal';
import { shareProposal } from '../share';

// Histórico (RF13): consulta offline, mais recente primeiro, com status de sincronização (RF16).
export default function HistoryScreen() {
  const { proposals, syncNow, isSyncing } = useAppStore();
  const pending = proposals.filter((p) => p.syncStatus === 'pendente' && isSyncable(p.status)).length;
  const withError = proposals.filter((p) => p.syncStatus === 'erro').length;
  const draft = useDraft();
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    const term = query.trim().toLowerCase();
    return [...proposals]
      .sort((a, b) => (b.generatedAt ?? b.createdAt).localeCompare(a.generatedAt ?? a.createdAt))
      .filter((p) => !term || p.client.name.toLowerCase().includes(term) || p.number.toLowerCase().includes(term));
  }, [proposals, query]);

  return (
    <Screen
      header={
        <Header
          title="Histórico"
          onBack={() => router.navigate('/')}
          right={
            // SCRUM-404: forçar a sincronização também pelo Histórico.
            <Pressable
              onPress={async () => notifySyncOutcome(await syncNow())}
              disabled={isSyncing}
              accessibilityRole="button"
              accessibilityLabel="Forçar sincronização agora"
              hitSlop={10}
            >
              {isSyncing ? <ActivityIndicator color={orange[500]} /> : <RefreshCw size={22} color={navy[700]} />}
            </Pressable>
          }
        />
      }
      inTabs
      contentStyle={styles.content}
    >
      <TextField placeholder="Buscar proposta..." icon={Search} value={query} onChangeText={setQuery} />

      {/* SCRUM-84: resumo da fila, além do status de cada proposta. */}
      {(pending > 0 || withError > 0) && (
        <View style={[styles.syncBar, withError > 0 && styles.syncBarError]}>
          <AppText variant="bodySmall" weight="semibold" color={withError > 0 ? semantic.errorText : semantic.warningText} style={styles.flex}>
            {[pending > 0 && `${pending} pendente${pending > 1 ? 's' : ''}`, withError > 0 && `${withError} com erro`].filter(Boolean).join(' · ')}
          </AppText>
          <Pressable onPress={async () => notifySyncOutcome(await syncNow())} disabled={isSyncing} accessibilityRole="button" hitSlop={8}>
            <AppText variant="bodySmall" weight="bold" color={navy[800]} style={styles.link}>
              {isSyncing ? 'Sincronizando...' : 'Forçar sincronização agora'}
            </AppText>
          </Pressable>
        </View>
      )}

      {proposals.length === 0 ? (
        <View style={styles.empty}>
          <AppText variant="body" weight="semibold" align="center">
            Nenhuma proposta ainda
          </AppText>
          <AppText variant="bodySmall" color={colors.textSecondary} align="center">
            Inicie uma nova instalação para gerar sua primeira proposta.
          </AppText>
          <Button
            label="Nova Instalação"
            onPress={() => {
              draft.start();
              router.push('/instalacao/novo-cliente');
            }}
          />
        </View>
      ) : list.length === 0 ? (
        <AppText variant="bodySmall" color={colors.textSecondary} align="center">
          Nenhuma proposta encontrada para “{query}”.
        </AppText>
      ) : (
        list.map((proposal) => (
          <SwipeableRow
            key={proposal.id}
            accessibilityLabel={`Proposta de ${proposal.client.name}`}
            onPress={() => router.push({ pathname: '/proposta/[id]', params: { id: proposal.id } })}
            actions={[
              { key: 'reenviar', label: 'Reenviar', icon: Upload, color: semantic.infoStrong, onPress: () => shareProposal(proposal) },
              { key: 'editar', label: 'Editar', icon: Pencil, color: orange[500], onPress: () => editProposal(proposal, draft.load) },
            ]}
          >
            <ProposalCardContent proposal={proposal} badge="sync" />
          </SwipeableRow>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  syncBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: amber[100],
  },
  syncBarError: { backgroundColor: semantic.errorSoft },
  flex: { flex: 1 },
  link: { textDecorationLine: 'underline' },
  empty: { gap: 12, paddingTop: 48 },
});
