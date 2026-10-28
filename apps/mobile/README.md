# Lumini — App Mobile (Técnico)

Aplicativo React Native (Expo, SDK 57, Expo Router) usado pelo técnico de instalação em campo, com arquitetura **offline-first**.

## Como rodar

O app faz parte do monorepo (npm workspaces) e usa os pacotes `@lumini/sync` e `@lumini/domain`. Instale **na raiz** do repositório:

```bash
npm install            # na raiz (Node.js 22.13+). No PowerShell, use npm.cmd
npm run start -w lumini-mobile      # ou: cd apps/mobile && npx expo start
npm test -w lumini-mobile           # testes da lógica (vitest)
npx tsc --noEmit -p apps/mobile     # typecheck
```

### Modo de demonstração × API

- **Sem** `EXPO_PUBLIC_API_URL`: modo de demonstração. Os dados são de exemplo e a sincronização é simulada (o Perfil avisa).
- **Com** `EXPO_PUBLIC_API_URL` (arquivo `apps/mobile/.env.local`), no aparelho: a fila real do `@lumini/sync` assume — SQLite (`expo-sqlite`), retentativa com backoff, RN07 e resolução de conflito, enviando para `POST /sync/push` da API (SCRUM-30).

## Estrutura

```
src/
  app/          # rotas (Expo Router): (tabs), instalacao/, proposta/[id], conta/
  features/     # telas por funcionalidade (auth, clients, measurement, equipment, pricing, proposal, profile, plan)
  domain/       # entidades, regras e cálculos do app (RN07/RN11 vêm do @lumini/sync)
  data/
    sync/         # ponte com o @lumini/sync: registros do contrato, serviço de sincronização
    contingency/  # base de contingência versionada e o job de atualização (SCRUM-85)
    mock/         # dados de demonstração
  store/        # AppStore (sessão, propostas, sync, notificações, preferências) e DraftStore (instalação em andamento)
  components/   # design system (SCRUM-70)
  viro/         # cenas de RA
```

## Tarefas do Hugo (SCRUM) neste app

| Tarefa | Onde |
|---|---|
| SCRUM-371, 372, 375, 398, 400 — cadastro completo do cliente e da instalação | `features/clients/screens/NewClientScreen.tsx`, `domain/entities.ts` |
| SCRUM-375 — custo de material elétrico complementar | `domain/services/pricing.ts` (`electricalComplement`) |
| SCRUM-399 — condição de pagamento | `features/pricing/screens/PricingScreen.tsx`, `domain/labels.ts` |
| SCRUM-378 — editar perfil (RF14) | `features/profile/screens/EditProfileScreen.tsx` |
| SCRUM-401 / 402 — Notificações e Preferências | `features/profile/screens/` |
| SCRUM-404 — "Forçar sincronização agora" (Perfil e Histórico) | `store/AppStore.tsx` (`syncNow`), `data/sync/syncService.ts` |
| SCRUM-84 — indicadores de sincronização | Home (faixa de pendências), Histórico (resumo), Perfil (alerta de falha) |
| SCRUM-85 — atualização da base de contingência | `data/contingency/` |
| SCRUM-406 — RN11 no app | `domain/services/proposalRules.ts` (usa `@lumini/sync`) |

## Pendências conhecidas

- Persistência das propostas em SQLite/SQLCipher (RF15): o app ainda guarda propostas em memória; a fila de sincronização já é persistente.
- Login real com JWT (RF01 / SCRUM-397): `getToken` devolve `null` até lá.
- Pull (baixar alterações do gestor): `aplicarPull` do `@lumini/sync` está pronto; falta o repositório local para gravar.
- O perfil editado (RF14) fica no aparelho: o contrato de sincronização ainda não tem a entidade Usuário (SCRUM-67).
