import { Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Badge, BottomSheet, Button, Chip, ChipGroup, Divider, Overline, QuantityStepper, TextField } from '@/components';
import { catalog } from '@/data/mock/catalog';
import type { Equipment, EquipmentCategory } from '@/domain/entities';
import { categoryLabels } from '@/domain/labels';
import { colors, navy, orange, radius, shadows } from '@/theme';
import { formatCurrency } from '@/utils/format';

const priceRanges = [
  { id: 'ate-500', label: 'Até R$500', min: 0, max: 500 },
  { id: '500-2000', label: 'R$500 - R$2.000', min: 500, max: 2000 },
  { id: '2000-5000', label: 'R$2.000 - R$5.000', min: 2000, max: 5000 },
  { id: 'acima-5000', label: 'Acima de R$5.000', min: 5000, max: Number.POSITIVE_INFINITY },
] as const;

type PriceRangeId = (typeof priceRanges)[number]['id'];

interface EquipmentSearchSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (selection: { equipment: Equipment; quantity: number }[]) => void;
}

// Modal Busca Equipamentos (RF09): catálogo local com busca e filtros.
export function EquipmentSearchSheet({ visible, onClose, onAdd }: EquipmentSearchSheetProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<EquipmentCategory | null>('modulo');
  const [priceRange, setPriceRange] = useState<PriceRangeId | null>(null);
  const [manufacturer, setManufacturer] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const manufacturers = useMemo(
    () => [...new Set(catalog.filter((e) => !category || e.category === category).map((e) => e.manufacturer))],
    [category],
  );

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    const range = priceRanges.find((r) => r.id === priceRange);
    return catalog.filter(
      (e) =>
        (!category || e.category === category) &&
        (!manufacturer || e.manufacturer === manufacturer) &&
        (!range || (e.price >= range.min && e.price < range.max)) &&
        (!term || e.name.toLowerCase().includes(term) || e.manufacturer.toLowerCase().includes(term)),
    );
  }, [query, category, priceRange, manufacturer]);

  const selectedUnits = Object.values(quantities).reduce((sum, q) => sum + q, 0);

  function toggleCategory(value: EquipmentCategory) {
    setCategory((current) => (current === value ? null : value));
    setManufacturer(null);
  }

  function close() {
    setQuantities({});
    onClose();
  }

  function handleAdd() {
    const selection = catalog
      .filter((e) => (quantities[e.id] ?? 0) > 0)
      .map((equipment) => ({ equipment, quantity: quantities[equipment.id] }));
    onAdd(selection);
    setQuantities({});
  }

  return (
    <BottomSheet visible={visible} onClose={close} maxHeight="94%">
      <View style={styles.header}>
        <AppText variant="h2" weight="bold">
          Buscar Equipamentos
        </AppText>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Fechar" style={styles.close}>
          <X size={16} color={navy[700]} strokeWidth={2.5} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <TextField placeholder="Pesquisar por nome ou modelo..." icon={Search} value={query} onChangeText={setQuery} />

        <Overline>Categorias</Overline>
        <ChipGroup>
          {(Object.keys(categoryLabels) as EquipmentCategory[]).map((c) => (
            <Chip key={c} tone="soft" label={categoryLabels[c]} selected={category === c} onPress={() => toggleCategory(c)} />
          ))}
        </ChipGroup>

        <Overline>Faixa de preço</Overline>
        <ChipGroup>
          {priceRanges.map((r) => (
            <Chip
              key={r.id}
              tone="soft"
              label={r.label}
              selected={priceRange === r.id}
              onPress={() => setPriceRange((current) => (current === r.id ? null : r.id))}
            />
          ))}
        </ChipGroup>

        <Overline>Marca / Fabricante</Overline>
        <ChipGroup>
          {manufacturers.map((m) => (
            <Chip
              key={m}
              tone="soft"
              label={m}
              selected={manufacturer === m}
              onPress={() => setManufacturer((current) => (current === m ? null : m))}
            />
          ))}
        </ChipGroup>

        <Overline>{`Resultados encontrados (${results.length})`}</Overline>
        {results.length === 0 && (
          <AppText variant="bodySmall" color={colors.textSecondary}>
            Nenhum item do catálogo corresponde aos filtros. Atualize o catálogo ou fale com o gestor.
          </AppText>
        )}
        {results.map((equipment) => (
          <View key={equipment.id} style={styles.result}>
            <View style={styles.resultTop}>
              <Badge label={categoryLabels[equipment.category]} tone="orange" shape="tag" />
              <Badge label={equipment.available ? 'Disponível' : 'Indisponível'} tone={equipment.available ? 'success' : 'neutral'} />
            </View>
            <View>
              <AppText variant="body" weight="bold">
                {equipment.name}
              </AppText>
              <AppText variant="h3" weight="bold" color={orange[500]}>
                {formatCurrency(equipment.price)}
              </AppText>
            </View>
            <Divider />
            <View style={styles.resultBottom}>
              <AppText variant="bodySmall" color={colors.textSecondary}>
                Garantia: {equipment.warrantyYears} anos
              </AppText>
              {equipment.available && (
                <QuantityStepper
                  value={quantities[equipment.id] ?? 0}
                  onChange={(q) => setQuantities((current) => ({ ...current, [equipment.id]: q }))}
                />
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Button label={`Adicionar Selecionados (${selectedUnits})`} onPress={handleAdd} disabled={selectedUnits === 0} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: navy[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  result: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: navy[100],
    ...shadows.level1,
  },
  resultTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footer: { paddingHorizontal: 20, paddingTop: 12 },
});
