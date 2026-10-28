import { Stack } from 'expo-router';

import { colors } from '@/theme';

// Telas abertas pelo menu do Perfil: editar perfil, notificações e preferências.
export default function AccountLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
