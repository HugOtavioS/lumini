# app — Sprint 3

| Caminho | Task | Conteúdo |
|---|---|---|
| `database/initDatabase.ts` | SCRUM-17 | `inicializarBancoDeDados`: roda as migrações (runner do SCRUM-66) e depois a carga idempotente do seed de HSP. |
| `background/registerSyncTask.ts` | SCRUM-18 | `definirTarefaSync` (escopo global), `registrarTarefaSync` (expo-background-task, 15 min) e `iniciarSyncAoReconectar` (NetInfo, primeiro plano). As limitações de iOS e Android estão documentadas no cabeçalho do arquivo. |
| `config/env.ts` | SCRUM-18 | `obterApiBaseUrl()` lê `EXPO_PUBLIC_LUMINI_API_URL`. Não há URL nem segredo no código. |

Dependências nativas que precisam estar no `package.json`: `expo-task-manager`, `expo-background-task` e `@react-native-community/netinfo`.
