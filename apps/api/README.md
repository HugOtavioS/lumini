# Lumini — API (NestJS)

Autenticação (JWT com refresh token e papel), sincronização (`POST /sync/push` e `/sync/pull`) com as regras do `@lumini/sync` (RN07, RN11, conflito com Log de Auditoria), base de contingência (`/contingencia/*`) e rotas do painel do gestor (`/admin/*`). **A API não calcula** (D15).

## Rodar local (banco SQLite)

```bash
npm install          # na raiz do monorepo
npm run api          # http://localhost:3000  (banco em apps/api/dados/lumini.db)
npm run painel       # outro terminal: http://localhost:5173
```

Na primeira execução a API cria a empresa de demonstração **Solar Vale Energia** com 8 propostas e o catálogo inicial. Senha de desenvolvimento `lumini123`:

| E-mail | Papel |
|---|---|
| gestora@solarvale.com.br | Gestora (painel web) |
| carlos@lumini.com | Técnico (mesmo id do app: `tec-001`) |
| ana@solarvale.com.br | Técnica |

Para o app sincronizar de verdade: `EXPO_PUBLIC_API_URL=http://<ip-do-computador>:3000` em `apps/mobile/.env.local`.

Variáveis (opcional, `apps/api/.env`): `PORT`, `LUMINI_DB`, `JWT_SECRET` (obrigatória em produção), `LUMINI_SEED=nao`, `CORS_ORIGENS`.

## Banco

`src/db/migracoes.ts` (SCRUM-29): empresa, usuário, assinatura, catálogo, `registro_sync` (registros versionados do contrato) com views `vw_cliente`, `vw_instalacao`, `vw_proposta`, `vw_item_proposta`, logs de auditoria e de sincronização, base de contingência. Toda tabela de negócio tem `id_empresa`.

## Migrar para o Amazon RDS (PostgreSQL)

Só a pasta `src/db/` muda:
1. `banco.ts`: trocar `node:sqlite` por `pg` (Pool com `DATABASE_URL`, SSL).
2. `migracoes.ts`: `TEXT` JSON → `JSONB`, `json_extract(dados,'$.x')` → `dados->>'x'`, `json_each` → `jsonb_array_elements`, datas → `TIMESTAMPTZ`, `INTEGER 0/1` → `BOOLEAN`.
3. `armazenamentoSqlite.ts` → `armazenamentoPostgres.ts` implementando a mesma porta `ArmazenamentoServidor` do `@lumini/sync`. Como o `pg` é assíncrono, a porta e o `ServidorSincronizacao` passam a ter versão `async` (mudança mecânica: `await` nas chamadas).
4. Os testes de `test/api.test.ts` rodam iguais contra o RDS de homologação.

## Testes

`npm test -w @lumini/api` — 11 testes de ponta a ponta (login, 401/403, a fila real do app enviando por HTTP, RN11 no painel, carteira do técnico no pull, multi-tenant, catálogo, usuários, persistência após reiniciar).
