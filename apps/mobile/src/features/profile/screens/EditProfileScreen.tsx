import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Phone, User } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Callout, FooterActions, Header, Screen, SectionTitle, TextField } from '@/components';
import { useAppStore } from '@/store/AppStore';
import { colors, navy, orange } from '@/theme';
import { maskPhone } from '@/utils/format';
import { notify } from '@/utils/notify';

// RF14 / SCRUM-378: o técnico edita telefone e foto. Nome, e-mail, papel e
// empresa aparecem sem edição (alterados só pelo gestor, RF14 1.1 / RF29).
export default function EditProfileScreen() {
  const { technician, updateProfile, isOnline } = useAppStore();
  const [phone, setPhone] = useState(technician?.phone ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(technician?.photoUri ?? null);
  const [error, setError] = useState<string | undefined>();

  if (!technician) return null;

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      notify('Permissão necessária', 'Permita o acesso às fotos para escolher a imagem do perfil.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 0.6 });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  }

  function save() {
    try {
      updateProfile({ phone, photoUri });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dados inválidos.');
      return;
    }
    notify('Perfil atualizado', isOnline ? 'Suas alterações foram salvas.' : 'Alterações salvas no aparelho. Elas sobem quando a conexão voltar.');
    router.back();
  }

  return (
    <Screen
      header={<Header title="Editar Perfil" />}
      footer={<FooterActions withBack primaryLabel="Salvar" onPrimary={save} />}
      contentStyle={styles.content}
    >
      <View style={styles.photoArea}>
        <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel="Alterar foto do perfil" style={styles.avatar}>
          {photoUri ? <Image source={{ uri: photoUri }} style={styles.photo} /> : <User size={44} color={navy[500]} strokeWidth={1.5} />}
          <View style={styles.cameraBadge}>
            <Camera size={16} color="#FFFFFF" />
          </View>
        </Pressable>
        <View style={styles.photoActions}>
          <Pressable onPress={pickPhoto} accessibilityRole="button" hitSlop={8}>
            <AppText variant="bodySmall" weight="bold" color={orange[500]}>
              {photoUri ? 'Trocar foto' : 'Adicionar foto'}
            </AppText>
          </Pressable>
          {photoUri && (
            <Pressable onPress={() => setPhotoUri(null)} accessibilityRole="button" hitSlop={8}>
              <AppText variant="bodySmall" weight="semibold" color={colors.textSecondary}>
                Remover
              </AppText>
            </Pressable>
          )}
        </View>
      </View>

      <SectionTitle title="Contato" />
      <TextField
        label="Telefone"
        placeholder="(12) 99999-0000"
        icon={Phone}
        value={phone}
        onChangeText={(v) => {
          setPhone(maskPhone(v));
          setError(undefined);
        }}
        error={error}
        keyboardType="phone-pad"
      />

      <SectionTitle title="Dados da conta" />
      <TextField label="Nome" value={technician.name} disabled />
      <TextField label="E-mail" value={technician.email} disabled />
      <TextField label="Empresa" value={technician.companyName} disabled />
      <TextField label="Papel" value="Técnico Instalador" disabled />
      <Callout tone="info" message="Nome, e-mail, papel e empresa são alterados pelo gestor comercial no painel web." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14 },
  photoArea: { alignItems: 'center', gap: 12, paddingVertical: 8 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: navy[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: { width: 96, height: 96, borderRadius: 48 },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: orange[500],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  photoActions: { flexDirection: 'row', gap: 20 },
});
