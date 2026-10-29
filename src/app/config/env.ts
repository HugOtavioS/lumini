/**
 * env.ts
 *
 * SCRUM-18 — Configuração por ambiente (sem URLs nem segredos no código).
 *
 * Usa variáveis `EXPO_PUBLIC_*`, que o Expo injeta em build a partir de `.env`
 * (.env.development, .env.production...). O acesso precisa ser literal
 * (`process.env.EXPO_PUBLIC_X`) para o bundler conseguir substituir o valor.
 *
 * ⚠️ PENDÊNCIA: se o projeto for React Native bare, trocar por react-native-config.
 *    Variáveis EXPO_PUBLIC_* ficam visíveis no bundle: nunca coloque segredos aqui.
 */

export class ConfiguracaoAusenteError extends Error {
  constructor(variavel: string) {
    super(`Variável de ambiente ${variavel} não configurada.`);
    this.name = 'ConfiguracaoAusenteError';
  }
}

/** URL base da API Node.js (ex.: definida em .env.production). */
export function obterApiBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_LUMINI_API_URL;
  if (!url) throw new ConfiguracaoAusenteError('EXPO_PUBLIC_LUMINI_API_URL');
  return url.replace(/\/+$/, '');
}
