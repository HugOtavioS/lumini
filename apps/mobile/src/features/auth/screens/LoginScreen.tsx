import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type TextInput } from 'react-native';

import { AppText, Button, LuminiLogo, Screen, TextField } from '@/components';
import { useAppStore } from '@/store/AppStore';
import { colors, orange, semantic } from '@/theme';
import { isValidEmail } from '@/utils/format';
import { notify } from '@/utils/notify';

export default function LoginScreen() {
  const { login } = useAppStore();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    // RF01, 2a: campos vazios não enviam o formulário.
    const nextErrors: typeof errors = {};
    if (!email.trim()) nextErrors.email = 'Informe seu e-mail.';
    else if (!isValidEmail(email)) nextErrors.email = 'Por favor insira um e-mail válido.';
    if (!password) nextErrors.password = 'Informe sua senha.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      await login(email, password);
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : 'Não foi possível entrar.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen topColor={colors.background} contentStyle={styles.content}>
      <View style={styles.brand}>
        <LuminiLogo size={64} />
        <View style={styles.wordmark}>
          <AppText variant="display" weight="extrabold">
            Lumini
          </AppText>
          <View style={styles.dot} />
        </View>
        <AppText variant="bodySmall" color={colors.textSecondary} align="center">
          Plataforma solar para técnicos e instaladores
        </AppText>
      </View>

      <View style={styles.form}>
        <TextField
          label="E-mail"
          placeholder="tecnico@lumini.com"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <TextField
          ref={passwordRef}
          label="Senha"
          placeholder="Digite sua senha"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          secureTextEntry
          autoComplete="password"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />
        <Pressable
          style={styles.forgot}
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => notify('Recuperar senha', 'Peça ao gestor da sua empresa para redefinir sua senha.')}
        >
          <AppText variant="bodySmall" weight="semibold" color={orange[500]}>
            Esqueci minha senha
          </AppText>
        </Pressable>
        {errors.form && (
          <AppText variant="bodySmall" color={semantic.error} align="center">
            {errors.form}
          </AppText>
        )}
      </View>

      <View style={styles.footer}>
        <Button label="Entrar" onPress={handleSubmit} loading={loading} />
        <View style={styles.signup}>
          <AppText variant="bodySmall" color={colors.textSecondary}>
            Primeira vez?{' '}
          </AppText>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            // RF29: contas de técnico são criadas pelo gestor comercial.
            onPress={() =>
              notify('Cadastro', 'Seu acesso é criado pelo gestor comercial da sua empresa no painel web.')
            }
          >
            <AppText variant="bodySmall" weight="bold" color={orange[500]}>
              Cadastre-se
            </AppText>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 56, gap: 0 },
  brand: { alignItems: 'center', gap: 12, marginBottom: 48 },
  wordmark: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: orange[500], marginBottom: 12 },
  form: { gap: 18 },
  forgot: { alignSelf: 'flex-end', marginTop: -6 },
  footer: { marginTop: 'auto', paddingTop: 48, gap: 20 },
  signup: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
