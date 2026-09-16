# Lumini — API (Backend)

API NestJS única para os dois clientes (app mobile e painel web), com controle de acesso baseado em papel (RBAC).

## Responsabilidades

**Somente** autenticação (JWT com refresh token), autorização (RBAC + isolamento por empresa), sincronização (pull e push) e persistência dos dados enviados pelos clientes, incluindo a contagem do limite do plano Freemium. **A API não executa cálculos** — dimensionamento, precificação e viabilidade são calculados no app e na web, usando o pacote `packages/domain`.

## Estrutura planejada (a criar)

```
apps/api/src/
  modules/
    auth/
    users/
    companies/
    clients/
    proposals/
    equipment/
    pricing/
    weather/      # integração + fallback de contingência
    sync/
  common/         # guards, interceptors, decorators (RBAC/JWT)
  config/
prisma/ ou /migrations
test/
```

## Stack

Node.js + NestJS (API REST) · PostgreSQL no Amazon RDS · JWT com refresh token · hospedagem AWS ainda em definição (tarefa NOVO-102 do backlog).

> Código ainda não implementado — esta pasta contém apenas este README como marcador da estrutura inicial (Sprint 1).
