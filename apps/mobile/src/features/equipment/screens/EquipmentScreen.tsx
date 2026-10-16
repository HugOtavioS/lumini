import { router } from 'expo-router';
import { PackageSearch, Search, Tag } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Callout, Card, Header, ProgressBar, Screen } from '@/components';
import { categoryLabels } from '@/domain/labels';
import { checkCompatibility } from '@/domain/services/compatibility';
import { equipmentSubtotal, netAdjustmentPct, unitPrice } from '@/domain/services/pricing';
import { EquipmentDetailSheet } from '@/features/equipment/components/EquipmentDetailSheet';
import { EquipmentSearchSheet } from '@/features/equipment/components/EquipmentSearchSheet';
import { MissingDraft } from '@/features/proposal/components/MissingDraft';
import { useDraft } from '@/store/DraftStore';
import { colors, navy, orange, radius, semantic } from '@/theme';
import { formatCurrency, formatNumber } from '@/utils/format';
import { confirmAction } from '@/utils/notify';

// Equipamentos (RF09 / D09 / NOVO-109): o técnico escolhe os itens; o app não
// sugere kit, só compara com a potência dimensionada e valida a compatibilidade.
export default function EquipmentScreen() {
  const draft = useDraft();
  const [searchOpen, setSearchOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!draft.calculation || !draft.installation) return <MissingDraft title="Equipamentos" />;

  const { sizing } = draft.calculation;
  const compatibility = checkCompatibility(draft.items, sizing.requiredKwp, draft.installation.connectionType);
  const editingItem = draft.items.find((i) => i.equipmentId === editingId) ?? null;
  const powerRatio = sizing.requiredKwp > 0 ? compatibility.selectedKwp / sizing.requiredKwp : 0;

  async function goToPricing() {
    if (compatibility.blocking) return;
    if (compatibility.needsConfirmation) {
      const confirmed = await confirmAction(
        'Potência divergente',
        'A potência selecionada está muito diferente da dimensionada. Deseja continuar mesmo assim?',
        'Continuar',
      );
      if (!confirmed) return;
    }
    router.push('/instalacao/precificacao');
  }

  return (
    <Screen
      header={
        <Header
          title="Equipamentos"
          right={
            <Pressable
              onPress={() => setSearchOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Buscar equipamentos"
              style={styles.searchButton}
            >
              <Search size={20} color={navy[900]} />
            </Pressable>
          }
        />
      }
      footer={<Button label="Ver Precificação" onPress={goToPricing} disabled={compatibility.blocking} />}
    >
      <Card style={styles.power}>
        <View style={styles.powerRow}>
          <View>
            <AppText variant="caption" color={colors.textSecondary}>
              Potência selecionada
            </AppText>
            <AppText variant="h3" weight="bold">
              {formatNumber(compatibility.selectedKwp, 2)} kWp
            </AppText>
          </View>
          <View style={styles.alignEnd}>
            <AppText variant="caption" color={colors.textSecondary}>
              Dimensionada
            </AppText>
            <AppText variant="h3" weight="bold" color={orange[500]}>
              {formatNumber(sizing.requiredKwp, 2)} kWp
            </AppText>
          </View>
        </View>
        <ProgressBar
          progress={powerRatio}
          color={compatibility.needsConfirmation ? semantic.warning : orange[500]}
          track={navy[100]}
        />
      </Card>

      {draft.items.length === 0 ? (
        <Card style={styles.empty}>
          <PackageSearch size={36} color={navy[400]} strokeWidth={1.5} />
          <AppText variant="body" weight="semibold" align="center">
            Nenhum equipamento selecionado
          </AppText>
          <AppText variant="bodySmall" color={colors.textSecondary} align="center">
            Busque no catálogo os módulos, o inversor e a estrutura desta instalação.
          </AppText>
          <Button label="Buscar no catálogo" variant="outline" icon={Search} onPress={() => setSearchOpen(true)} />
        </Card>
      ) : (
        draft.items.map((item) => {
          const adjustment = netAdjustmentPct(item.discountPct, item.markupPct);
          return (
            <Card
              key={item.equipmentId}
              onPress={() => setEditingId(item.equipmentId)}
              accessibilityLabel={`Editar ${item.name}`}
              style={styles.item}
            >
              <AppText variant="overline" color={orange[500]}>
                {categoryLabels[item.category]}
              </AppText>
              <AppText variant="body" weight="bold">
                {item.name}
              </AppText>
              <View style={styles.itemBottom}>
                <AppText variant="bodySmall" color={colors.textSecondary}>
                  Quantidade: {item.quantity}
                </AppText>
                <View style={styles.price}>
                  {adjustment !== 0 && (
                    <AppText variant="caption" weight="semibold" color={adjustment > 0 ? semantic.successStrong : orange[600]}>
                      {adjustment > 0 ? '+' : ''}
                      {formatNumber(adjustment, 1)}%
                    </AppText>
                  )}
                  <AppText variant="body" weight="bold">
                    {formatCurrency(unitPrice(item))}/un
                  </AppText>
                  <Tag size={16} color={orange[500]} />
                </View>
              </View>
            </Card>
          );
        })
      )}

      {draft.items.length > 0 &&
        compatibility.alerts.map((alert) => (
          <Callout key={alert.code} tone={alert.level === 'error' ? 'error' : 'caution'} message={alert.message} />
        ))}

      {draft.items.length > 0 && (
        <View style={styles.subtotal}>
          <AppText variant="body" color={colors.textSecondary}>
            Subtotal Equipamentos
          </AppText>
          <AppText variant="h3" weight="bold">
            {formatCurrency(equipmentSubtotal(draft.items))}
          </AppText>
        </View>
      )}

      <EquipmentSearchSheet
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onAdd={(selection) => {
          draft.addEquipment(selection);
          setSearchOpen(false);
        }}
      />
      <EquipmentDetailSheet
        item={editingItem}
        onClose={() => setEditingId(null)}
        onSave={(patch) => {
          if (editingItem) draft.updateItem(editingItem.equipmentId, patch);
          setEditingId(null);
        }}
        onRemove={() => {
          if (editingItem) draft.removeItem(editingItem.equipmentId);
          setEditingId(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md + 2,
    backgroundColor: navy[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  power: { gap: 12 },
  powerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  alignEnd: { alignItems: 'flex-end' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 28 },
  item: { gap: 4 },
  itemBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  price: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  subtotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
});
