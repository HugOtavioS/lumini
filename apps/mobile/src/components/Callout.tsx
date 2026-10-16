import { TriangleAlert } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { amber, navy, orange, radius, semantic } from '@/theme';
import { AppText } from './AppText';

export type CalloutTone = 'error' | 'warning' | 'caution' | 'info';

const tones: Record<CalloutTone, { bg: string; border: string; icon: string; text: string; solidIcon: boolean }> = {
  // Resumo Técnico: ícone em quadrado sólido.
  error: { bg: semantic.errorSoft, border: semantic.error, icon: semantic.error, text: navy[800], solidIcon: true },
  warning: { bg: '#FEFCE8', border: semantic.warning, icon: semantic.warning, text: navy[800], solidIcon: true },
  // Equipamentos: alerta laranja com ícone vazado.
  caution: { bg: orange[50], border: orange[500], icon: orange[500], text: navy[800], solidIcon: false },
  info: { bg: semantic.infoSoft, border: semantic.info, icon: semantic.info, text: semantic.infoText, solidIcon: false },
};

interface CalloutProps {
  tone: CalloutTone;
  message?: string;
  children?: ReactNode;
}

export function Callout({ tone, message, children }: CalloutProps) {
  const t = tones[tone];

  return (
    <View style={[styles.container, { backgroundColor: t.bg, borderLeftColor: t.border }]} accessibilityRole="alert">
      {t.solidIcon ? (
        <View style={[styles.iconBox, { backgroundColor: t.icon }]}>
          <TriangleAlert size={18} color={tone === 'warning' ? navy[900] : '#FFFFFF'} strokeWidth={2.25} />
        </View>
      ) : tone === 'info' ? (
        <View style={[styles.infoDot, { backgroundColor: t.icon }]}>
          <AppText variant="caption" weight="bold" color="#FFFFFF">
            i
          </AppText>
        </View>
      ) : (
        <TriangleAlert size={22} color={t.icon} strokeWidth={2} />
      )}
      <View style={styles.body}>
        {message && (
          <AppText variant="bodySmall" color={t.text}>
            {message}
          </AppText>
        )}
        {children}
      </View>
    </View>
  );
}

/** Aviso de sincronização com borda completa (Proposta Gerada). */
export function SyncNotice({ children }: { children: ReactNode }) {
  return (
    <View style={styles.notice}>
      <TriangleAlert size={20} color={orange[500]} strokeWidth={2} />
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: radius.lg,
    borderLeftWidth: 4,
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 6 },
  notice: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: amber[400],
    backgroundColor: amber[100],
  },
});
