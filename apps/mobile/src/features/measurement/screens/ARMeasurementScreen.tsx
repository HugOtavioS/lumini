import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, Camera, Check, Plus, ScanLine, Undo2 } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button } from '@/components';
import type { RoofSection } from '@/domain/entities';
import { orientationLabels } from '@/domain/labels';
import { useDraft } from '@/store/DraftStore';
import { colors, navy, orange, radius, semantic, shadows } from '@/theme';
import { formatNumber, generateId } from '@/utils/format';
import { notify } from '@/utils/notify';
import { ARMeasurementScene } from '@/viro/ARMeasurementScene';
import { sectionArea, simulatedSections } from '@/viro/simulatedCapture';

const VERTICES_PER_SECTION = 4;

// Medição AR (RF04) com a folha inferior expandida ou recolhida.
export default function ARMeasurementScreen() {
  const insets = useSafeAreaInsets();
  const draft = useDraft();
  const [sections, setSections] = useState<RoofSection[]>([]);
  const [pointCount, setPointCount] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const preset = simulatedSections[sections.length % simulatedSections.length];
  const sectionNumber = sections.length + 1;
  const isClosed = pointCount === VERTICES_PER_SECTION;
  const current: RoofSection | null = isClosed
    ? {
        id: `sec-${sectionNumber}`,
        areaM2: Math.round(sectionArea(preset.edgeLengths)),
        inclinationDeg: preset.inclinationDeg,
        orientation: preset.orientation,
      }
    : null;
  const allSections = current ? [...sections, current] : sections;
  const shown = current ?? sections[sections.length - 1] ?? null;
  const sectionLabel = (n: number, s: RoofSection | null) =>
    `Seção ${n} — ${orientationLabels[(s ?? preset).orientation]}`;

  function capture() {
    if (isClosed) return;
    const next = pointCount + 1;
    setPointCount(next);
    if (next === VERTICES_PER_SECTION) setExpanded(true);
  }

  function undo() {
    if (pointCount > 0) setPointCount(pointCount - 1);
  }

  // RF04, 3.2: outra água do telhado.
  function addSection() {
    if (!current) {
      notify('Seção incompleta', 'Marque os 4 vértices da seção atual antes de adicionar outra.');
      return;
    }
    setSections((list) => [...list, { ...current, id: generateId() }]);
    setPointCount(0);
    setExpanded(false);
  }

  function confirm() {
    if (allSections.length === 0) return;
    draft.setMeasurement({ source: 'RA', sections: allSections, measuredAt: new Date().toISOString() });
    router.push('/instalacao/sombreamento');
  }

  const statCards = [
    { label: 'Área', value: shown ? formatNumber(shown.areaM2, 0) : '—', unit: 'm²' },
    { label: 'Inclinação', value: shown ? String(shown.inclinationDeg) : '—', unit: 'graus (°)' },
    { label: 'Orientação', value: shown ? orientationLabels[shown.orientation] : '—', unit: 'azimute' },
  ];

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ARMeasurementScene
        points={preset.points.slice(0, pointCount)}
        edgeLengths={preset.edgeLengths}
        closed={isClosed}
      />

      <View style={[styles.topBar, { top: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Voltar" style={styles.back}>
          <ArrowLeft size={22} color={navy[900]} />
        </Pressable>
        <View style={styles.pill}>
          <View style={[styles.dot, { backgroundColor: orange[500] }]} />
          <AppText variant="caption" weight="semibold" color="#FFFFFF" numberOfLines={1}>
            {isClosed ? 'Capturado' : 'Medindo...'} {sectionLabel(sectionNumber, current)}
          </AppText>
        </View>
        <View style={[styles.pill, styles.pillStatus]}>
          <View style={[styles.dot, { backgroundColor: semantic.success }]} />
          <AppText variant="caption" weight="semibold" color="#FFFFFF">
            AR Ativo
          </AppText>
        </View>
      </View>

      {!expanded && (
        <>
          <View style={[styles.tools, { top: insets.top + 230 }]}>
            <ToolButton label="Desfazer ponto" onPress={undo}>
              <Undo2 size={20} color={navy[900]} />
            </ToolButton>
            <ToolButton label="Adicionar seção" onPress={addSection}>
              <Plus size={20} color={orange[500]} />
            </ToolButton>
            <ToolButton label="Registrar foto" onPress={() => notify('Foto registrada', 'A foto do telhado foi anexada à medição.')}>
              <Camera size={20} color={navy[900]} />
            </ToolButton>
          </View>

          <View style={styles.captureArea}>
            <Pressable
              onPress={capture}
              disabled={isClosed}
              accessibilityRole="button"
              accessibilityLabel="Capturar posição"
              style={({ pressed }) => [styles.capture, (pressed || isClosed) && { opacity: 0.8 }]}
            >
              <ScanLine size={28} color="#FFFFFF" />
            </Pressable>
            <AppText variant="bodySmall" weight="bold" color="#FFFFFF" style={styles.captureLabel}>
              {isClosed ? 'Seção capturada' : `Capturar Posição (${pointCount}/${VERTICES_PER_SECTION})`}
            </AppText>
          </View>
        </>
      )}

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Recolher painel' : 'Expandir painel'}
          style={styles.handleArea}
        >
          <View style={styles.handle} />
        </Pressable>

        {expanded ? (
          <View style={styles.expanded}>
            <View>
              <AppText variant="h3" weight="bold">
                {shown ? 'Medição Capturada' : 'Aguardando captura'}
              </AppText>
              <AppText variant="bodySmall" color={colors.textSecondary}>
                {shown
                  ? 'Os dados do telhado foram mapeados automaticamente'
                  : 'Marque os 4 vértices da seção com o botão de captura'}
              </AppText>
            </View>
            <View style={styles.statRow}>
              {statCards.map((stat) => (
                <View key={stat.label} style={styles.statCard}>
                  <AppText variant="bodySmall" color={colors.textSecondary}>
                    {stat.label}
                  </AppText>
                  <AppText variant={stat.value.length > 4 ? 'h2' : 'display'} weight="bold" numberOfLines={1}>
                    {stat.value}
                  </AppText>
                  <AppText variant="caption" color={navy[400]}>
                    {stat.unit}
                  </AppText>
                </View>
              ))}
            </View>
            <SectionChips sections={allSections} label={sectionLabel} />
            <Pressable onPress={addSection} accessibilityRole="button" style={styles.addSection}>
              <Plus size={18} color={orange[500]} />
              <AppText variant="body" weight="semibold" color={orange[500]}>
                Adicionar Seção do Telhado
              </AppText>
            </Pressable>
            <Pressable
              onPress={() => router.replace('/instalacao/medicao-manual')}
              accessibilityRole="button"
              style={styles.lightMode}
            >
              <AppText variant="bodySmall" weight="semibold" color={orange[500]} style={styles.underline}>
                Usar Modo Leve (sem AR)
              </AppText>
            </Pressable>
            <Button label="Confirmar Medição" onPress={confirm} disabled={allSections.length === 0} />
          </View>
        ) : (
          <View style={styles.collapsed}>
            <View style={styles.summaryRow}>
              <SummaryChip label="Área:" value={shown ? `${formatNumber(shown.areaM2, 0)} m²` : '—'} />
              <SummaryChip label="Inclinação:" value={shown ? `${shown.inclinationDeg}°` : '—'} />
              <SummaryChip label="Orie.:" value={shown ? orientationLabels[shown.orientation] : '—'} />
            </View>
            <View style={styles.collapsedActions}>
              <SectionChips sections={allSections} label={sectionLabel} fallback={sectionLabel(sectionNumber, null)} />
              <Pressable
                onPress={confirm}
                disabled={allSections.length === 0}
                accessibilityRole="button"
                style={[styles.confirmSmall, allSections.length === 0 && styles.confirmDisabled]}
              >
                <AppText variant="body" weight="bold" color="#FFFFFF">
                  Confirmar
                </AppText>
                <Check size={16} color="#FFFFFF" strokeWidth={3} />
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function ToolButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.tool}>
      {children}
    </Pressable>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryChip}>
      <AppText variant="caption" color={colors.textSecondary}>
        {label}
      </AppText>
      <AppText variant="bodySmall" weight="bold" numberOfLines={1}>
        {value}
      </AppText>
    </View>
  );
}

function SectionChips({
  sections,
  label,
  fallback,
}: {
  sections: RoofSection[];
  label: (n: number, s: RoofSection | null) => string;
  fallback?: string;
}) {
  const items = sections.length > 0 ? sections.map((s, i) => label(i + 1, s)) : fallback ? [fallback] : [];
  return (
    <View style={styles.sectionChips}>
      {items.map((text) => (
        <View key={text} style={styles.sectionChip}>
          <AppText variant="bodySmall" weight="semibold" color={orange[500]}>
            {text}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: navy[900] },
  topBar: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.level2,
  },
  pill: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
  },
  pillStatus: { flexShrink: 0, backgroundColor: 'rgba(51, 65, 85, 0.9)' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  tools: { position: 'absolute', right: 20, gap: 14 },
  tool: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.level2,
  },
  captureArea: { position: 'absolute', left: 0, right: 0, bottom: 150, alignItems: 'center', gap: 8 },
  capture: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: orange[500],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.level3,
  },
  captureLabel: { textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl + 4,
    borderTopRightRadius: radius.xxl + 4,
    paddingHorizontal: 20,
    ...shadows.level3,
  },
  handleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: navy[300] },
  expanded: { gap: 14 },
  statRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 12,
    ...shadows.level2,
  },
  addSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: orange[400],
  },
  lightMode: { alignSelf: 'center', paddingVertical: 2 },
  underline: { textDecorationLine: 'underline' },
  collapsed: { gap: 12 },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: navy[100],
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  collapsedActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, flexShrink: 1 },
  sectionChip: {
    borderWidth: 1,
    borderColor: orange[400],
    backgroundColor: orange[50],
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  confirmSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: orange[500],
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    height: 40,
  },
  confirmDisabled: { backgroundColor: navy[300] },
});
