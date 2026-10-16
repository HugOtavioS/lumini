import { Stack } from 'expo-router';

import { colors } from '@/theme';

// Fluxo da nova instalação: cadastro → medição → dimensionamento →
// equipamentos → precificação → viabilidade → proposta (DAS 3.2).
export default function InstallationLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
