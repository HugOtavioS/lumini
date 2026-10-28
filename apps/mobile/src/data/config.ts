// Configuração lida das variáveis EXPO_PUBLIC_* (arquivo .env.local do app).
//
// Sem EXPO_PUBLIC_API_URL o app roda em modo de demonstração: a sincronização é
// simulada e nada sai do aparelho. Com a API do Misael no ar (SCRUM-30), basta
// definir a URL para a fila real do @lumini/sync assumir:
//
//   EXPO_PUBLIC_API_URL=https://api.lumini.app

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '') ?? '';

export const config = {
  /** Endereço da API, sem a barra final; vazio = modo de demonstração. */
  apiUrl,
  hasApi: apiUrl.length > 0,
} as const;
