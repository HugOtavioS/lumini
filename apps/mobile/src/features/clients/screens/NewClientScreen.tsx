import { router } from 'expo-router';
import { Mail, Phone } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
import type { ConnectionType, RoofType } from '@/domain/entities';
import { brazilianStates, connectionTypeLabels, roofTypeLabels } from '@/domain/labels';
import { useDraft } from '@/store/DraftStore';
import { navy } from '@/theme';
import { isValidEmail, maskCep, maskPhone, parseDecimal } from '@/utils/format';
import { useARAvailability } from '@/viro/capabilities';

interface FormState {
  name: string;
  whatsapp: string;
  email: string;
  cep: string;
  address: string;
  city: string;
  state: string | null;
  consumerUnit: string;
  consumption: string;
  tariff: string;
  connectionType: ConnectionType;
  roofType: RoofType;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

const connectionOptions = (Object.keys(connectionTypeLabels) as ConnectionType[]).map((value) => ({
  value,
  label: connectionTypeLabels[value],
}));
const stateOptions = brazilianStates.map((uf) => ({ value: uf, label: uf }));

// RF03: cadastro do cliente e da instalação.
export default function NewClientScreen() {
  const draft = useDraft();
  const { supported: arSupported } = useARAvailability();
  const [form, setForm] = useState<FormState>(() => ({
    name: draft.client?.name ?? '',
    whatsapp: draft.client?.whatsapp ?? '',
    email: draft.client?.email ?? '',
    cep: draft.installation?.cep ?? '',
    address: draft.installation?.address ?? '',
    city: draft.installation?.city ?? '',
    state: draft.installation?.state ?? null,
    consumerUnit: draft.installation?.consumerUnit ?? '',
    consumption: draft.installation ? String(draft.installation.monthlyConsumptionKwh) : '',
    tariff: draft.installation ? String(draft.installation.tariffPerKwh).replace('.', ',') : '',
    connectionType: draft.installation?.connectionType ?? 'monofasica',
    roofType: draft.installation?.roofType ?? 'ceramica',
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
    if (form.cep && form.cep.replace(/\D/g, '').length !== 8) next.cep = 'CEP inválido.';
    if (!form.address.trim()) next.address = 'Informe o endereço.';
    if (!form.city.trim()) next.city = 'Informe a cidade.';
    if (!form.state) next.state = 'Selecione.';
    const consumption = parseDecimal(form.consumption);
    // RF03, 4a: consumo ≤ 0 ou não numérico.
    if (!(consumption > 0)) next.consumption = 'Informe um consumo maior que zero.';
    const tariff = parseDecimal(form.tariff);
    if (!(tariff > 0)) next.tariff = 'Informe uma tarifa maior que zero.';
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
        city: form.city.trim(),
        state: form.state ?? '',
        consumerUnit: form.consumerUnit.trim(),
        monthlyConsumptionKwh: parseDecimal(form.consumption),
        tariffPerKwh: parseDecimal(form.tariff),
        connectionType: form.connectionType,
        roofType: form.roofType,
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
        label="Endereço"
        placeholder="Rua, número"
        value={form.address}
        onChangeText={(v) => update('address', v)}
        error={errors.address}
      />
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
          Tipo de conexão
        </AppText>
        <SegmentedControl options={connectionOptions} value={form.connectionType} onChange={(v) => update('connectionType', v)} />
      </View>

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14 },
  half: { width: '48%' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  flex: { flex: 1 },
  stateField: { width: 136 },
  group: { gap: 8 },
});
