import { router } from 'expo-router';
import { CircleCheck, Info, TriangleAlert } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { AppText, Button, Card, Header, Screen } from '@/components';
import { orientationLabels } from '@/domain/labels';
import { getClimateData } from '@/domain/services/climate';
import { rateShading, simulateShading, type ShadingRating } from '@/domain/services/shading';
import { MissingDraft } from '@/features/proposal/components/MissingDraft';
import { useDraft } from '@/store/DraftStore';
import { colors, fontFamily, navy, orange, radius, semantic } from '@/theme';

const ratingCopy: Record<ShadingRating, { label: string; color: string; bg: string }> = {
  excelente: { label: 'Excelente desempenho solar', color: semantic.successStrong, bg: semantic.successSoft },
  bom: { label: 'Bom desempenho solar', color: semantic.warningText, bg: semantic.warningSoft },
  atencao: { label: 'Desempenho comprometido pelo sombreamento', color: semantic.errorText, bg: semantic.errorSoftStrong },
};

// Hemisfério sul: o sol percorre o céu pelo lado norte (ângulo em graus, 0 = leste).
const SUN_ANGLE_DEG = 115;

// Simulação de Sombreamento (RF06).
export default function ShadingScreen() {
  const draft = useDraft();
  const measurement = draft.measurement;
  const installation = draft.installation;

  const result = useMemo(() => {
    if (!measurement || !installation) return null;
    const { latitude } = getClimateData(installation.state);
    const totalArea = measurement.sections.reduce((sum, s) => sum + s.areaM2, 0);
    // Média ponderada pela área de cada seção.
    const pct = Math.round(
      measurement.sections.reduce(
        (sum, s) => sum + simulateShading(s.orientation, s.inclinationDeg, latitude) * s.areaM2,
        0,
      ) / totalArea,
    );
    const main = [...measurement.sections].sort((a, b) => b.areaM2 - a.areaM2)[0];
    return { pct, main, rating: rateShading(pct) };
  }, [measurement, installation]);

  if (!result) return <MissingDraft title="Sombreamento" />;

  const { pct, main, rating } = result;
  const copy = ratingCopy[rating];
  const RatingIcon = rating === 'excelente' ? CircleCheck : TriangleAlert;
  const angle = (SUN_ANGLE_DEG * Math.PI) / 180;
  const sun = { x: 170 + 108 * Math.cos(angle), y: 135 - 108 * Math.sin(angle) };

  function handleContinue() {
    draft.setShading(pct);
    router.push('/instalacao/resumo-tecnico');
  }

  return (
    <Screen header={<Header title="Sombreamento" />} footer={<Button label="Continuar" onPress={handleContinue} />}>
      <Card style={styles.diagramCard}>
        <Svg width="100%" height={260} viewBox="0 0 340 260">
          <SvgText x={170} y={22} fontSize={12} fontFamily={fontFamily.bold} fill={navy[500]} textAnchor="middle">N</SvgText>
          <SvgText x={170} y={252} fontSize={12} fontFamily={fontFamily.bold} fill={navy[500]} textAnchor="middle">S</SvgText>
          <SvgText x={14} y={139} fontSize={12} fontFamily={fontFamily.bold} fill={navy[500]} textAnchor="middle">O</SvgText>
          <SvgText x={326} y={139} fontSize={12} fontFamily={fontFamily.bold} fill={navy[500]} textAnchor="middle">L</SvgText>
          <Circle cx={170} cy={135} r={108} stroke={orange[500]} strokeWidth={2} strokeDasharray="6 6" fill="none" />
          <Rect x={110} y={85} width={140} height={88} rx={6} fill={navy[200]} stroke={navy[500]} strokeWidth={1.5} />
          <Line x1={110} x2={250} y1={113} y2={113} stroke={navy[500]} strokeWidth={1.5} />
          <SvgText x={180} y={132} fontSize={13} fontFamily={fontFamily.bold} fill={navy[600]} textAnchor="middle">
            {`Telhado ${orientationLabels[main.orientation]}`}
          </SvgText>
          <SvgText x={180} y={148} fontSize={11} fontFamily={fontFamily.regular} fill={navy[400]} textAnchor="middle">
            {`Inclin. ${main.inclinationDeg}°`}
          </SvgText>
          <SunMarker x={sun.x} y={sun.y} />
        </Svg>
        <View style={styles.legend}>
          <LegendItem color={orange[500]} label="Trajetória Solar" />
          <LegendItem color={navy[200]} label="Área de Painéis" />
        </View>
      </Card>

      <Card style={styles.result}>
        <View style={[styles.resultIcon, { backgroundColor: copy.bg }]}>
          <RatingIcon size={26} color={copy.color} strokeWidth={2} />
        </View>
        <View style={styles.resultText}>
          <AppText variant="h3" weight="bold">
            Sombreamento: {pct}%
          </AppText>
          <AppText variant="bodySmall" weight="semibold" color={copy.color}>
            {copy.label}
          </AppText>
        </View>
      </Card>

      <View style={styles.basis}>
        <Info size={14} color={colors.textSecondary} />
        <AppText variant="bodySmall" color={colors.textSecondary}>
          Baseado na orientação {orientationLabels[main.orientation]} e inclinação {main.inclinationDeg}°
        </AppText>
      </View>
    </Screen>
  );
}

function SunMarker({ x, y }: { x: number; y: number }) {
  const rays = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (deg * Math.PI) / 180);
  return (
    <G>
      <Circle cx={x} cy={y} r={13} fill={orange[500]} />
      <Circle cx={x} cy={y} r={3.5} fill="#FFFFFF" />
      {rays.map((a) => (
        <Line
          key={a}
          x1={x + 5.5 * Math.cos(a)}
          y1={y + 5.5 * Math.sin(a)}
          x2={x + 8 * Math.cos(a)}
          y2={y + 8 * Math.sin(a)}
          stroke="#FFFFFF"
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      ))}
    </G>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <AppText variant="caption" weight="semibold" color={navy[600]}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  diagramCard: { padding: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  legend: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    backgroundColor: navy[100],
    borderRadius: radius.md,
    padding: 8,
    gap: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 10, height: 10, borderRadius: 2 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: colors.border },
  resultIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  resultText: { flex: 1, gap: 2 },
  basis: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
