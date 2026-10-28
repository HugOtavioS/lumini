import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { SplashScreen, Stack } from 'expo-router';
import { useEffect } from 'react';

import { AppStoreProvider, useAppStore } from '@/store/AppStore';
import { DraftStoreProvider } from '@/store/DraftStore';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <AppStoreProvider>
      <DraftStoreProvider>
        <RootNavigator />
      </DraftStoreProvider>
    </AppStoreProvider>
  );
}

function RootNavigator() {
  const { hasSeenOnboarding, technician } = useAppStore();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      {/* RNF03: onboarding no primeiro acesso. */}
      <Stack.Protected guard={!hasSeenOnboarding}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={hasSeenOnboarding && !technician}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={technician !== null}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="instalacao" />
        <Stack.Screen name="proposta/[id]" />
        <Stack.Screen name="conta" />
      </Stack.Protected>
    </Stack>
  );
}
