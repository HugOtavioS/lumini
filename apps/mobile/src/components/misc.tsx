import type { LucideIcon } from 'lucide-react-native';
import { Sun } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, navy, orange, radius } from '@/theme';
import { AppText } from './AppText';

/** Título de seção com barra laranja (Novo Cliente). */
export function SectionTitle({ title }: { title: string }) {
  return (
    <View style={styles.sectionTitle}>
      <View style={styles.sectionBar} />
      <AppText variant="body" weight="bold" style={styles.sectionText}>
        {title}
      </AppText>
    </View>
  );
}

/** Rótulo de grupo em caixa alta (ex.: "DIMENSIONAMENTO SOLAR", "CATEGORIAS"). */
export function Overline({ children, color = navy[600], style }: { children: string; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <AppText variant="overline" color={color}>
        {children}
      </AppText>
    </View>
  );
}

/** Ícone sobre quadrado com fundo suave. */
export function IconBox({
  icon: Icon,
  size = 44,
  background = orange[50],
  color = orange[500],
  rounded = false,
}: {
  icon: LucideIcon;
  size?: number;
  background?: string;
  color?: string;
  rounded?: boolean;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: rounded ? size / 2 : radius.lg,
        backgroundColor: background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={size * 0.46} color={color} strokeWidth={2} />
    </View>
  );
}

export function ProgressBar({ progress, color = orange[500], track = orange[100], height = 6 }: { progress: number; color?: string; track?: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

/** Linha "rótulo ........ valor". */
export function KeyValueRow({
  label,
  value,
  valueColor = colors.text,
  bold = false,
  divider = false,
}: {
  label: string;
  value: ReactNode;
  valueColor?: string;
  bold?: boolean;
  divider?: boolean;
}) {
  return (
    <View style={[styles.kvRow, divider && styles.kvDivider]}>
      <AppText variant={bold ? 'body' : 'bodySmall'} weight={bold ? 'bold' : 'regular'} color={bold ? colors.text : navy[600]} style={styles.kvLabel}>
        {label}
      </AppText>
      {typeof value === 'string' ? (
        <AppText variant={bold ? 'body' : 'bodySmall'} weight="bold" color={valueColor} align="right">
          {value}
        </AppText>
      ) : (
        value
      )}
    </View>
  );
}

export function LuminiLogo({ size = 64 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: orange[500],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Sun size={size * 0.44} color="#FFFFFF" strokeWidth={1.75} />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  sectionBar: { width: 4, height: 20, borderRadius: 2, backgroundColor: orange[500] },
  sectionText: { textTransform: 'uppercase', letterSpacing: 0.2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  kvRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 6 },
  kvDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: 12 },
  kvLabel: { flexShrink: 1 },
});
