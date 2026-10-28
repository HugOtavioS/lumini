import { router } from 'expo-router';
import { Mail, Phone } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import {
  AppText,
  Chip,
  ChipGroup,
  FooterActions,
  Header,
  Screen,
  SectionTitle,
  SegmentedControl,
  SelectField,
  TextField,
} from '@/components';
import type { ConnectionType, RoofType, TariffModality } from '@/domain/entities';
import { brazilianStates, connectionTypeLabels, roofTypeLabels, tariffModalityLabels } from '@/domain/labels';
import { commercialParameters } from '@/domain/parameters';
import { useDraft } from '@/store/DraftStore';
import { colors, navy, orange } from '@/theme';
import { isValidEmail, maskCep, maskPhone, parseDecimal } from '@/utils/format';
import { useARAvailability } from '@/viro/capabilities';

interface FormState {
  name: string;
  whatsapp: string;
  email: string;
  cep: string;
  address: string;
  number: string;
  district: string;
  city: string;
  state: string | null;
  consumerUnit: string;
  consumption: string;
  tariff: string;
  tariffModality: TariffModality;
  connectionType: ConnectionType;
  breakerAmps: string;
  roofType: RoofType;
  panelDistance: string;
  panelUpgradeNeeded: boolean;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

const connectionOptions = (Object.keys(connectionTypeLabels) as ConnectionType[]).map((value) => ({
  value,
  label: connectionTypeLabels[value],
}));
const tariffModalityOptions = (Object.keys(tariffModalityLabels) as TariffModality[]).map((value) => ({
  value,
  label: tariffModalityLabels[value],
}));
const stateOptions = brazilianStates.map((uf) => ({ value: uf, label: uf }));

// RF03 (Adendo 1): cadastro do cliente e da instalação — SCRUM-371, 372, 375, 398, 400.
export default function NewClientScreen() {
  const draft = useDraft();
  const { supported: arSupported } = useARAvailability();
  const [form, setForm] = useState<FormState>(() => ({
    name: draft.client?.name ?? '',
    whatsapp: draft.client?.whatsapp ?? '',
    email: draft.client?.email ?? '',
    cep: draft.installation?.cep ?? '',
    address: draft.installation?.address ?? '',
    number: draft.installation?.number ?? '',
    district: draft.installation?.district ?? '',
    city: draft.installation?.city ?? '',
    state: draft.installation?.state ?? null,
    consumerUnit: draft.installation?.consumerUnit ?? '',
    consumption: draft.installation ? String(draft.installation.monthlyConsumptionKwh) : '',
    tariff: draft.installation ? String(draft.installation.tariffPerKwh).replace('.', ',') : '',
    tariffModality: draft.installation?.tariffModality ?? 'convencional',
    connectionType: draft.installation?.connectionType ?? 'monofasica',
    breakerAmps: draft.installation ? String(draft.installation.mainBreakerAmps) : '',
    roofType: draft.installation?.roofType ?? 'ceramica',
    panelDistance:
      draft.installation?.roofToPanelDistanceM != null ? String(draft.installation.roofToPanelDistanceM).replace('.', ',') : '',
    panelUpgradeNeeded: draft.installation?.panelUpgradeNeeded ?? false,
  }));
  const [errors, setErrors] = useState<FormErrors>({});

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!form.name.trim()) next.name = 'Informe o nome do cliente.';
    if (form.whatsapp && form.whatsapp.replace(/\D/g, '').length < 10) next.whatsapp = 'WhatsApp incompleto.';
    if (form.email && !isValidEmail(form.email)) next.email = 'Por favor insira um e-mail válido.';
    // SCRUM-398: sem contato, o botão de compartilhar o PDF não tem para onde enviar.
    if (!form.whatsapp && !form.email.trim()) next.whatsapp = 'Informe o WhatsApp ou o e-mail do cliente para enviar a proposta.';
    // SCRUM-372: endereço completo é obrigatório (busca de HSP e PDF).
    if (form.cep.replace(/\D/g, '').length !== 8) next.cep = form.cep ? 'CEP inválido.' : 'Informe o CEP.';
    if (!form.address.trim()) next.address = 'Informe o logradouro.';
    if (!form.number.trim()) next.number = 'Informe o número (ou S/N).';
    if (!form.district.trim()) next.district = 'Informe o bairro.';
    if (!form.city.trim()) next.city = 'Informe a cidade.';
    if (!form.state) next.state = 'Selecione.';
    const consumption = parseDecimal(form.consumption);
    // RF03, 4a: consumo ≤ 0 ou não numérico.
    if (!(consumption > 0)) next.consumption = 'Informe um consumo maior que zero.';
    const tariff = parseDecimal(form.tariff);
    if (!(tariff > 0)) next.tariff = 'Informe uma tarifa maior que zero.';
    // SCRUM-371
    if (!form.consumerUnit.trim()) next.consumerUnit = 'Informe o número da instalação (UC).';
    const breaker = parseDecimal(form.breakerAmps);
    if (!(breaker > 0) || !Number.isInteger(breaker)) next.breakerAmps = 'Informe a amperagem do disjuntor (ex.: 40).';
    // SCRUM-375: opcional, mas, se informada, não pode ser negativa.
    if (form.panelDistance.trim() && !(parseDecimal(form.panelDistance) >= 0)) next.panelDistance = 'Distância inválida.';
    return next;
  }

  function handleSubmit() {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    draft.setClientData(
      { name: form.name.trim(), whatsapp: form.whatsapp, email: form.email.trim() },
      {
        cep: form.cep,
        address: form.address.trim(),
        number: form.number.trim(),
        district: form.district.trim(),
        city: form.city.trim(),
        state: form.state ?? '',
        consumerUnit: form.consumerUnit.trim(),
        monthlyConsumptionKwh: parseDecimal(form.consumption),
        tariffPerKwh: parseDecimal(form.tariff),
        tariffModality: form.tariffModality,
        connectionType: form.connectionType,
        mainBreakerAmps: parseDecimal(form.breakerAmps),
        roofType: form.roofType,
        roofToPanelDistanceM: form.panelDistance.trim() ? parseDecimal(form.panelDistance) : null,
        panelUpgradeNeeded: form.panelUpgradeNeeded,
      },
    );
    // RF19 / RN09: sem RA, a medição manual continua obrigatória.
    router.push(arSupported ? '/instalacao/medicao-ar' : '/instalacao/medicao-manual');
  }

  return (
    <Screen
      header={<Header title="Novo Cliente" />}
      footer={<FooterActions withBack primaryLabel="Avançar" onPrimary={handleSubmit} />}
      contentStyle={styles.content}
    >
      <SectionTitle title="Dados do cliente" />
      <TextField
        label="Nome completo"
        placeholder="Digite o nome do cliente"
        value={form.name}
        onChangeText={(v) => update('name', v)}
        error={errors.name}
        autoCapitalize="words"
      />
      <TextField
        label="WhatsApp"
        placeholder="(62) 99999-0000"
        icon={Phone}
        value={form.whatsapp}
        onChangeText={(v) => update('whatsapp', maskPhone(v))}
        error={errors.whatsapp}
        keyboardType="phone-pad"
      />
      <TextField
        label="E-mail"
        placeholder="cliente@email.com"
        icon={Mail}
        value={form.email}
        onChangeText={(v) => update('email', v)}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <SectionTitle title="Endereço da instalação" />
      <TextField
        label="CEP"
        placeholder="00000-000"
        value={form.cep}
        onChangeText={(v) => update('cep', maskCep(v))}
        error={errors.cep}
        keyboardType="number-pad"
        containerStyle={styles.half}
      />
      <TextField
        label="Logradouro"
        placeholder="Rua, avenida..."
        value={form.address}
        onChangeText={(v) => update('address', v)}
        error={errors.address}
      />
      <View style={styles.row}>
        <TextField
          label="Número"
          placeholder="Nº"
          value={form.number}
          onChangeText={(v) => update('number', v)}
          error={errors.number}
          containerStyle={styles.numberField}
        />
        <TextField
          label="Bairro"
          placeholder="Bairro"
          value={form.district}
          onChangeText={(v) => update('district', v)}
          error={errors.district}
          containerStyle={styles.flex}
        />
      </View>
      <View style={styles.row}>
        <TextField
          label="Cidade"
          placeholder="Cidade"
          value={form.city}
          onChangeText={(v) => update('city', v)}
          error={errors.city}
          containerStyle={styles.flex}
        />
        <SelectField
          label="Estado"
          value={form.state}
          options={stateOptions}
          onChange={(v) => update('state', v)}
          error={errors.state}
          sheetTitle="Selecione o estado"
          containerStyle={styles.stateField}
        />
      </View>

      <SectionTitle title="Dados da unidade consumidora" />
      <TextField
        label="Nº da Instalação (UC)"
        placeholder="Número na conta de luz"
        value={form.consumerUnit}
        onChangeText={(v) => update('consumerUnit', v)}
        error={errors.consumerUnit}
        keyboardType="number-pad"
      />
      <TextField
        label="Consumo médio mensal (kWh)"
        placeholder="Ex: 450"
        value={form.consumption}
        onChangeText={(v) => update('consumption', v)}
        error={errors.consumption}
        keyboardType="decimal-pad"
      />
      <TextField
        label="Valor da tarifa (R$/kWh)"
        placeholder="0,85"
        value={form.tariff}
        onChangeText={(v) => update('tariff', v)}
        error={errors.tariff}
        keyboardType="decimal-pad"
      />
      <View style={styles.group}>
        <AppText variant="bodySmall" weight="medium" color={navy[700]}>
          Modalidade tarifária
        </AppText>
        <SegmentedControl options={tariffModalityOptions} value={form.tariffModality} onChange={(v) => update('tariffModality', v)} />
      </View>
      <View style={styles.group}>
        <AppText variant="bodySmall" weight="medium" color={navy[700]}>
          Tipo de conexão
        </AppText>
        <SegmentedControl options={connectionOptions} value={form.connectionType} onChange={(v) => update('connectionType', v)} />
      </View>
      <TextField
        label="Disjuntor principal (A)"
        placeholder="Ex: 40"
        value={form.breakerAmps}
        onChangeText={(v) => update('breakerAmps', v.replace(/\D/g, ''))}
        error={errors.breakerAmps}
        keyboardType="number-pad"
        containerStyle={styles.half}
      />

      <SectionTitle title="Dados do telhado" />
      <View style={styles.group}>
        <AppText variant="bodySmall" weight="medium" color={navy[700]}>
          Tipo de telhado
        </AppText>
        <ChipGroup>
          {(Object.keys(roofTypeLabels) as RoofType[]).map((type) => (
            <Chip key={type} label={roofTypeLabels[type]} selected={form.roofType === type} onPress={() => update('roofType', type)} />
          ))}
        </ChipGroup>
      </View>

      {/* SCRUM-375: entram no custo de material elétrico complementar (RN03). */}
      <SectionTitle title="Quadro de carga" />
      <TextField
        label="Distância do telhado ao quadro (m)"
        placeholder="Ex: 15"
        value={form.panelDistance}
        onChangeText={(v) => update('panelDistance', v)}
        error={errors.panelDistance}
        helper={`Até ${commercialParameters.includedPanelDistanceM} m já está incluído no material elétrico; o excedente é cobrado por metro.`}
        keyboardType="decimal-pad"
      />
      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <AppText variant="body">O quadro precisa de adequação</AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            Troca de disjuntores, DPS ou barramento antes da instalação
          </AppText>
        </View>
        <Switch
          value={form.panelUpgradeNeeded}
          onValueChange={(v) => update('panelUpgradeNeeded', v)}
          trackColor={{ true: orange[500], false: navy[300] }}
          thumbColor="#FFFFFF"
          accessibilityLabel="O quadro precisa de adequação"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14 },
  half: { width: '48%' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  flex: { flex: 1 },
  stateField: { width: 136 },
  numberField: { width: 104 },
  group: { gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
