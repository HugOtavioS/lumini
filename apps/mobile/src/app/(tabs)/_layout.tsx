import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { History, House, ScanLine, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDraft } from '@/store/DraftStore';
import { colors, fontFamily, navy } from '@/theme';

export default function TabsLayout() {
  const draft = useDraft();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: navy[400],
        tabBarLabelStyle: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 68 + insets.bottom,
          paddingTop: 4,
          paddingBottom: 6 + insets.bottom,
        },
        tabBarItemStyle: { paddingVertical: 4 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="medicao"
        options={{ title: 'Medição', tabBarIcon: ({ color, size }) => <ScanLine color={color} size={size} /> }}
        listeners={{
          // A aba "Medição" inicia uma nova instalação em vez de abrir uma tela própria.
          tabPress: (event) => {
            event.preventDefault();
            draft.start();
            router.push('/instalacao/novo-cliente');
          },
        }}
      />
      <Tabs.Screen
        name="historico"
        options={{ title: 'Histórico', tabBarIcon: ({ color, size }) => <History color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: 'Perfil', tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
    </Tabs>
  );
}
