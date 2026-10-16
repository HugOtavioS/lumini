import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Header, Screen } from '@/components';
import { colors } from '@/theme';

/** Estado exibido quando uma etapa do fluxo é aberta sem instalação em andamento. */
export function MissingDraft({ title }: { title: string }) {
  return (
    <Screen header={<Header title={title} />} scroll={false}>
      <View style={styles.center}>
        <AppText variant="h3" weight="bold" align="center">
          Nenhuma instalação em andamento
        </AppText>
        <AppText variant="bodySmall" color={colors.textSecondary} align="center">
          Inicie uma nova instalação a partir do cadastro do cliente.
        </AppText>
        <Button label="Nova Instalação" onPress={() => router.replace('/instalacao/novo-cliente')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', gap: 12 },
});
