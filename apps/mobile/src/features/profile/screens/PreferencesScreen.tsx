import { router } from 'expo-router';
import { Database, RefreshCw } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppText, Button, Header, Screen, SectionTitle } from '@/components';
import type { AppPreferences } from '@/domain/entities';
import { useAppStore } from '@/store/AppStore';
import { colors, navy, orange, radius, semantic } from '@/theme';
import { formatElapsed } from '@/utils/format';
import { notify } from '@/utils/notify';

// SCRUM-402 — Preferências. Escopo decidido para o MVP: medição (Modo Leve,
// RF19), quais notificações receber (SCRUM-401), a base de contingência
// (SCRUM-85) e rever o onboarding (RNF03 / SCRUM-114). Idioma e tema ficam
// fora: o app é só em português e segue a identidade visual fixa.

export default function PreferencesScreen() {
  const { preferences, setPreference, contingency, checkContingencyNow, replayOnboarding, isOnline, syncMode } = useAppStore();

  function toggle<K extends keyof AppPreferences>(key: K) {
    return (value: boolean) => setPreference(key, value as AppPreferences[K]);
  }

  async function handleCheck() {
    const result = await checkContingencyNow();
    switch (result.status) {
      case 'atualizada':
        notify('Base atualizada', `Você já tem a versão mais recente (${result.version}).`);
        break;
      case 'instalada':
        notify('Nova versão instalada', `Base de contingência ${result.version} instalada.`);
        break;
      case 'offline':
        notify('Sem conexão', 'A verificação acontece sozinha assim que a conexão voltar.');
        break;
      case 'sem_servidor':
        notify('Modo de demonstração', 'Sem servidor configurado, o app usa a base embutida.');
        break;
      case 'erro':
        notify('Não foi possível verificar', `${result.message} O app continua com a base atual.`);
        break;
    }
  }

  const lastCheck = contingency.lastCheckAt ? formatElapsed(contingency.lastCheckAt) : 'ainda não verificada';

  return (
    <Screen header={<Header title="Preferências" />} contentStyle={styles.content}>
      <SectionTitle title="Medição" />
      <View style={styles.group}>
        <ToggleRow
          label="Modo Leve"
          description="Medição manual, sem realidade aumentada. Use em aparelhos sem suporte à RA."
          value={preferences.lightMode}
          onChange={toggle('lightMode')}
        />
      </View>

      <SectionTitle title="Notificações" />
      <View style={styles.group}>
        <ToggleRow
          label="Respostas do gestor"
          description="Upgrade atendido, proposta aprovada, recusada ou reaberta."
          value={preferences.notifyManagerUpdates}
          onChange={toggle('notifyManagerUpdates')}
        />
        <ToggleRow
          label="Falhas de sincronização"
          description="Quando uma proposta não sobe e precisa da sua ação."
          value={preferences.notifySyncFailures}
          onChange={toggle('notifySyncFailures')}
          last
        />
      </View>

      <SectionTitle title="Dados offline" />
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Database size={20} color={navy[600]} />
          <View style={styles.flex}>
            <AppText variant="bodySmall" weight="bold">
              Base de contingência (HSP por estado)
            </AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              Versão {contingency.version} · última verificação: {lastCheck}
            </AppText>
          </View>
        </View>
        {contingency.lastResult?.status === 'erro' && (
          <AppText variant="caption" color={semantic.errorText}>
            {contingency.lastResult.message}
          </AppText>
        )}
        <ToggleRow
          label="Atualizar automaticamente"
          description="Verifica uma vez por dia, só quando houver conexão."
          value={preferences.autoUpdateContingency}
          onChange={toggle('autoUpdateContingency')}
          last
          compact
        />
        <Button
          label={contingency.checking ? 'Verificando...' : 'Verificar agora'}
          variant="secondary"
          icon={RefreshCw}
          loading={contingency.checking}
          disabled={!isOnline && syncMode === 'api'}
          onPress={handleCheck}
        />
      </View>

      <SectionTitle title="Ajuda" />
      <View style={styles.group}>
        <Pressable
          onPress={() => {
            replayOnboarding();
            router.push('/onboarding');
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.row, styles.lastRow, pressed && { backgroundColor: navy[50] }]}
        >
          <AppText variant="body" style={styles.flex}>
            Rever o tutorial de primeiro acesso
          </AppText>
        </Pressable>
      </View>
    </Screen>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
  last,
  compact,
}: {
  label: string;
  description: ReactNode;
  value: boolean;
  onChange: (value: boolean) => void;
  last?: boolean;
  compact?: boolean;
}) {
  return (
    <View style={[styles.row, last && styles.lastRow, compact && styles.compactRow]}>
      <View style={styles.flex}>
        <AppText variant="body">{label}</AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          {description}
        </AppText>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: orange[500], false: navy[300] }}
        thumbColor="#FFFFFF"
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14 },
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lastRow: { borderBottomWidth: 0 },
  compactRow: { paddingHorizontal: 0 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
});
