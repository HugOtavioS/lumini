import { router } from 'expo-router';
import { Pencil, Search, Upload } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Header, Screen, SwipeableRow, TextField } from '@/components';
import { useAppStore } from '@/store/AppStore';
import { useDraft } from '@/store/DraftStore';
import { colors, orange, semantic } from '@/theme';
import { ProposalCardContent } from '../components/ProposalCard';
import { editProposal } from '../editProposal';
import { shareViaWhatsApp } from '../share';

// Histórico (RF13): consulta offline, mais recente primeiro, com status de sincronização (RF16).
export default function HistoryScreen() {
  const { proposals } = useAppStore();
  const draft = useDraft();
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    const term = query.trim().toLowerCase();
    return [...proposals]
      .sort((a, b) => (b.generatedAt ?? b.createdAt).localeCompare(a.generatedAt ?? a.createdAt))
      .filter((p) => !term || p.client.name.toLowerCase().includes(term) || p.number.toLowerCase().includes(term));
  }, [proposals, query]);

  return (
    <Screen header={<Header title="Histórico" onBack={() => router.navigate('/')} />} inTabs contentStyle={styles.content}>
      <TextField placeholder="Buscar proposta..." icon={Search} value={query} onChangeText={setQuery} />

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
              { key: 'reenviar', label: 'Reenviar', icon: Upload, color: semantic.infoStrong, onPress: () => shareViaWhatsApp(proposal) },
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
  empty: { gap: 12, paddingTop: 48 },
});
