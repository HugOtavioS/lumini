import { X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, BottomSheet, Button, QuantityStepper, SelectField, TextField } from '@/components';
import { findEquipment } from '@/data/mock/catalog';
import type { ProposalItem } from '@/domain/entities';
import { categoryLabels } from '@/domain/labels';
import { commercialParameters } from '@/domain/parameters';
import { isAdjustmentWithinLimit, netAdjustmentPct, unitPrice } from '@/domain/services/pricing';
import { colors, navy, orange, radius, semantic } from '@/theme';
import { formatCurrency, formatNumber, parseDecimal } from '@/utils/format';

interface EquipmentDetailSheetProps {
  item: ProposalItem | null;
  onClose: () => void;
  onSave: (patch: Partial<ProposalItem>) => void;
  onRemove: () => void;
}

function percentText(value: number): string {
  return `${formatNumber(value, value % 1 === 0 ? 0 : 1)}%`;
}

// Modal Detalhes Equipamento: quantidade e ajuste de preço só na proposta (RF18 / RN06).
export function EquipmentDetailSheet({ item, onClose, onSave, onRemove }: EquipmentDetailSheetProps) {
  const [quantity, setQuantity] = useState(1);
  const [discount, setDiscount] = useState('0%');
  const [markup, setMarkup] = useState('0%');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!item) return;
    setQuantity(item.quantity);
    setDiscount(percentText(item.discountPct));
    setMarkup(percentText(item.markupPct));
    setSupplier(item.supplier);
    setNotes(item.notes);
  }, [item]);

  if (!item) return null;

  const suppliers = findEquipment(item.equipmentId)?.suppliers ?? [item.supplier];
  const discountPct = parseDecimal(discount.replace('%', '')) || 0;
  const markupPct = parseDecimal(markup.replace('%', '')) || 0;
  const limit = commercialParameters.priceAdjustLimitPct;
  const invalidRange = discountPct < 0 || discountPct >= 100 || markupPct < 0;
  const withinLimit = isAdjustmentWithinLimit(discountPct, markupPct, limit);
  const net = netAdjustmentPct(discountPct, markupPct);
  const subtotal = item.catalogPrice * quantity;
  const adjusted = unitPrice({ catalogPrice: item.catalogPrice, discountPct, markupPct }) * quantity;
  const adjustedLabel =
    discountPct === 0 ? `Com Markup (${percentText(markupPct)})` : `Com ajuste (${net >= 0 ? '+' : ''}${formatNumber(net, 1)}%)`;
  const error = invalidRange
    ? 'Informe percentuais válidos.'
    : !withinLimit
      ? `O ajuste líquido (${formatNumber(net, 1)}%) excede o limite de ±${limit}% definido pela empresa.`
      : undefined;

  function handleSave() {
    if (error) return;
    onSave({ quantity, discountPct, markupPct, supplier, notes: notes.trim() });
  }

  return (
    <BottomSheet visible onClose={onClose} maxHeight="94%">
      <View style={styles.header}>
        <View style={styles.flex}>
          <AppText variant="overline" color={orange[500]}>
            {categoryLabels[item.category]}
          </AppText>
          <AppText variant="h3" weight="bold">
            {item.name}
          </AppText>
        </View>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar" style={styles.close}>
          <X size={16} color={navy[700]} strokeWidth={2.5} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.quantityRow}>
          <View>
            <AppText variant="body" weight="semibold">
              Quantidade
            </AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              Unidades do item
            </AppText>
          </View>
          <QuantityStepper value={quantity} onChange={setQuantity} min={1} variant="boxed" />
        </View>

        <TextField
          label="Preço Unitário"
          value={formatCurrency(item.catalogPrice)}
          disabled
          helper={`Preço do catálogo. Ajuste por desconto ou markup, até ±${limit}%.`}
        />

        <View style={styles.row}>
          <TextField
            label="Desconto (%)"
            value={discount}
            onChangeText={setDiscount}
            keyboardType="decimal-pad"
            containerStyle={styles.flex}
          />
          <TextField
            label="Markup (%)"
            value={markup}
            onChangeText={setMarkup}
            keyboardType="decimal-pad"
            containerStyle={styles.flex}
          />
        </View>
        {error && (
          <AppText variant="caption" color={semantic.error}>
            {error}
          </AppText>
        )}

        <SelectField
          label="Fornecedor"
          value={supplier}
          options={suppliers.map((s) => ({ value: s, label: s }))}
          onChange={setSupplier}
        />
        <TextField
          label="Observações"
          placeholder="Ex: Adicionar observação sobre o frete ou prazo de entrega..."
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <View style={styles.summary}>
          <View style={styles.flex}>
            <AppText variant="caption" color={colors.textSecondary}>
              Subtotal
            </AppText>
            <AppText variant="body" weight="bold">
              {formatCurrency(subtotal)}
            </AppText>
          </View>
          <View style={styles.summaryDivider} />
          <View style={[styles.flex, styles.alignEnd]}>
            <AppText variant="caption" color={colors.textSecondary}>
              {adjustedLabel}
            </AppText>
            <AppText variant="body" weight="bold" color={net < 0 ? orange[600] : semantic.successStrong}>
              {formatCurrency(adjusted)}
            </AppText>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Salvar Alterações" onPress={handleSave} disabled={Boolean(error)} />
        <Button label="Excluir Equipamento" variant="outlineDanger" onPress={onRemove} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingBottom: 8 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: navy[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: 20, paddingBottom: 8, gap: 16 },
  quantityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  alignEnd: { alignItems: 'flex-end' },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: navy[50],
  },
  summaryDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.border },
  footer: { paddingHorizontal: 20, paddingTop: 12, gap: 10 },
});
