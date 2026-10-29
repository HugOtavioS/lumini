# data — Sprint 3

| Caminho | Task | Conteúdo |
|---|---|---|
| `database/SqlExecutor.ts` | 17 / 18 | Porta mínima de SQL (`executar`, `consultar`, `transacao`). No merge, criar um adaptador para a conexão do SCRUM-66. |
| `database/migrations/` | 17 / 18 | `2026102401_hsp_contingencia` (tabelas `hsp_contingencia` e `seed_versao`) e `2026102402_fila_sync_propostas` (tabelas `fila_sync_propostas` e `sync_lock`). `MIGRACOES_SPRINT_3` deve ser registrada no runner do SCRUM-66. |
| `database/testing/` | — | `SqlExecutor` sobre `node:sqlite` em memória, **só para testes** (Node ≥ 22.13). |
| `seeds/` | SCRUM-17 | `hspContingencia.ts` (dados de **EXEMPLO**, TODO oficial) e `carregarSeedHsp`, idempotente por `VERSAO_SEED_HSP` com substituição atômica. |
| `repositories/HspRepositorySqlite.ts` | SCRUM-17 | Tenta o tempo real (com timeout e checagem de rede). Se falhar, usa a contingência: cidade (IBGE) → cidade (nome) → média da UF. |
| `sync/` | SCRUM-18 | `SyncService` (fila, retry com backoff exponencial, lock, RN07), `syncQueue` (`FilaSyncSqlite`), `syncLock` (lock persistente com expiração), `networkMonitor` (forma do NetInfo, sem importar a lib), `backoff`, `ErroEnvioSync`. |
| `datasources/remote/SyncApiHttp.ts` | SCRUM-18 | POST com `Idempotency-Key` = ID da proposta. Separa erro retentável (rede, timeout, 408/425/429/5xx) de erro definitivo (demais 4xx). |

Ciclo de vida do item na fila: `pendente → sincronizando → sincronizada`. Se o envio falhar, o item vai para `erro` com `proximo_envio_em` reagendado. Com `proximo_envio_em = NULL`, o item não é reenviado automaticamente.
