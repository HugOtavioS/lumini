import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Badge, Callout, FooterActions, Header, Screen, SelectField, TextField } from '@/components';
import type { Orientation } from '@/domain/entities';
import { orientationLabels, orientations } from '@/domain/labels';
import { useDraft } from '@/store/DraftStore';
import { generateId, parseDecimal } from '@/utils/format';
import { useARAvailability } from '@/viro/capabilities';

const orientationOptions = orientations.map((value) => ({ value, label: orientationLabels[value] }));

// Medição Manual — Modo Leve (RF05 / RN09): área, inclinação e orientação obrigatórias.
export default function ManualMeasurementScreen() {
  const draft = useDraft();
  const { supported: arSupported } = useARAvailability();
  const previous = draft.measurement?.source === 'Manual' ? draft.measurement.sections[0] : undefined;
  const [area, setArea] = useState(previous ? String(previous.areaM2) : '');
  const [inclination, setInclination] = useState(previous ? String(previous.inclinationDeg) : '');
  const [orientation, setOrientation] = useState<Orientation | null>(previous?.orientation ?? 'N');
  const [errors, setErrors] = useState<{ area?: string; inclination?: string; orientation?: string }>({});

  function handleSubmit() {
    const areaValue = parseDecimal(area);
    const inclinationValue = parseDecimal(inclination);
    const next: typeof errors = {};
    // RF05, 5a/5b.
    if (!(areaValue > 0)) next.area = 'Informe uma área maior que zero.';
    if (!(inclinationValue >= 0 && inclinationValue <= 90)) next.inclination = 'A inclinação deve estar entre 0° e 90°.';
    if (!orientation) next.orientation = 'Selecione a orientação.';
    setErrors(next);
    if (Object.keys(next).length > 0 || !orientation) return;

    draft.setMeasurement({
      source: 'Manual',
      sections: [{ id: generateId(), areaM2: areaValue, inclinationDeg: inclinationValue, orientation }],
      measuredAt: new Date().toISOString(),
    });
    router.push('/instalacao/sombreamento');
  }

  return (
    <Screen
      header={<Header title="Medição Manual" accessory={<Badge label="Modo Leve" tone="amber" shape="tag" />} />}
      footer={<FooterActions withBack primaryLabel="Avançar" onPrimary={handleSubmit} />}
      contentStyle={styles.content}
    >
      <TextField
        label="Área do telhado (m²)"
        placeholder="45"
        value={area}
        onChangeText={setArea}
        error={errors.area}
        keyboardType="decimal-pad"
      />
      <TextField
        label="Inclinação (°)"
        placeholder="15"
        value={inclination}
        onChangeText={setInclination}
        error={errors.inclination}
        keyboardType="decimal-pad"
      />
      <SelectField
        label="Orientação do telhado"
        value={orientation}
        options={orientationOptions}
        onChange={setOrientation}
        error={errors.orientation}
      />
      {arSupported && (
        <Callout tone="info" message="Para medições mais precisas, utilize o modo AR com a câmera do dispositivo." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 20 },
});
