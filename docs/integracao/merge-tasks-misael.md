# Integração da branch `Tasks_misael` (SCRUM-17, 18, 24, 66, 88, 405)

A branch do Misael criava uma segunda estrutura de app em `src/` na raiz do
repositório (sem `package.json`, testes no formato Jest), em paralelo ao
monorepo (`apps/mobile`, `packages/domain`, `packages/sync`). O merge preservou
o commit dele no histórico e, em seguida, cada parte foi levada para o lugar
certo, sem duplicar o que já existia.

## Para onde foi cada coisa

| Entrega do Misael (`src/…`) | Destino no monorepo | Observação |
|---|---|---|
| `domain/energia/projecaoGeracao.ts` | `packages/domain/src/energia/` | sem mudança |
| `domain/financeiro/calcularAnaliseFinanceira.ts`, `PrecoTotalProposta.ts` (SCRUM-24) | `packages/domain/src/financeiro/` | exportado em `@lumini/domain` |
| `domain/ambiental/calcularCO2Evitado.ts` (SCRUM-88) | `packages/domain/src/ambiental/` | exportado em `@lumini/domain` |
| testes de financeiro e CO₂ | ao lado dos arquivos, em Vitest | `jest` → `vitest`, mesmos casos |
| — | `apps/mobile/src/domain/services/viability.ts` | agora é um adaptador: as telas usam as fórmulas do Misael com as premissas do app (`parameters.ts`) |
| `data/database/migrations/*`, `MigracaoSql.ts` (SCRUM-17/66) | `apps/mobile/src/data/database/migracoes.ts` | runner novo (`schema_migracoes`), uma transação por migração |
| migração `hsp_contingencia` + `seed_versao` | idem | + colunas `latitude`, `rotulo`, `publicada_em` (a base do app é por UF com latitude) |
| `data/seeds/carregarSeedHsp.ts` | `apps/mobile/src/data/contingency/contingencyStore.ts` | mesma idempotência (versão + troca atômica); grava a base embutida e as baixadas pelo `ContingencyUpdater` (SCRUM-85) |
| `data/seeds/hspContingencia.ts` | — | **não trazido**: os valores eram de exemplo; o app já tem a base por UF (`contingencyBase.ts`) |
| `data/repositories/HspRepositorySqlite.ts`, `domain/repositories/HspRepository.ts` | — | **não trazido**: a regra "tempo real → contingência" já existe em `obterHsp` (`@lumini/domain`, Pedro, SCRUM-8) |
| `data/sync/syncLock.ts` (SCRUM-18) | `apps/mobile/src/data/sync/syncLock.ts` | sobre o `BancoSql` do `@lumini/sync` |
| `app/background/registerSyncTask.ts` (SCRUM-18) | `apps/mobile/src/data/sync/backgroundSync.native.ts` + `backgroundSyncRunner.ts` | `expo-task-manager` + `expo-background-task`; a rodada usa a fila do `@lumini/sync` |
| `data/sync/SyncService.ts`, `syncQueue.ts`, `backoff.ts`, `ErroEnvioSync.ts`, `networkMonitor.ts`, `datasources/remote/SyncApiHttp.ts` | — | **não trazidos**: duplicavam a fila, o backoff, o transporte HTTP e a reconexão do `@lumini/sync` (Pedro, SCRUM-82/83) |
| migração `fila_sync_propostas` | — | seria uma segunda fila; do arquivo ficou só a tabela `sync_lock` |
| `domain/proposta/podeSincronizar.ts` (SCRUM-405) | `apps/mobile/src/data/sync/registros.ts` → `motivosBloqueioSync` | a regra extra (dimensionamento, preço e PDF concluídos) passou a valer junto com o RN07 |
| `domain/proposta/StatusProposta.ts` | — | os status (RASCUNHO, DIMENSIONADA…) não são os da ERS; o app e o `@lumini/sync` usam os da ERS |
| `app/config/env.ts` | `apps/mobile/src/data/config.ts` | aceita `EXPO_PUBLIC_API_URL` **e** `EXPO_PUBLIC_LUMINI_API_URL` |
| `features/orcamento/*`, `components/ui/*`, `shared/utils/formatadores.ts` | — | telas e formatadores paralelos aos do app; a viabilidade já aparece no detalhe da proposta |
| `scripts/create-structure.sh` e pastas vazias | — | removidos (a estrutura é a do monorepo) |

## Como testar

```bash
npm test                         # domain (211), sync (118), mobile (33)
cd apps/mobile && npx tsc --noEmit
```

A tarefa em segundo plano precisa de *development build* (módulo nativo), não
roda no Expo Go, e só é registrada com `EXPO_PUBLIC_API_URL` definida.

## Pendências que continuam do Misael

- `FATOR_EMISSAO_SIN` está `null` no domínio; o app usa 0,07 kg/kWh
  (`parameters.ts`) até o negócio confirmar o fator do MCTI.
- Reajuste tarifário: o padrão do domínio é 0; o app usa 4% a.a. — definir com o negócio.
- JWT na tarefa em segundo plano: entra com o login real (SCRUM-397), lido do armazenamento seguro.
