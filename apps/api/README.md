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

## Regras que a API precisa aplicar no push (já prontas em `@lumini/sync`)

O servidor de referência (`packages/sync/src/servidor/servidorReferencia.ts`) é a especificação executável do `POST /sync/push` e do `POST /sync/pull`. A API importa as regras do pacote em vez de reescrevê-las.

### RN11 — quem edita em cada status (SCRUM-406)

Para cada operação de `Proposta`, depois do RN07 e da dependência e **antes** da resolução de conflito (`resolverConflito`):

```ts
import { verificarGravacaoRN11 } from '@lumini/sync';

// guardada: versão atual no PostgreSQL (ou null)
// statusNaBase: status da versão cujo updated_at = op.baseUpdatedAt (tabela de histórico ou log de auditoria)
const rn11 = verificarGravacaoRN11({
  papel: usuario.role === 'gestor' ? 'Gestor' : 'Tecnico',   // vem do JWT (SCRUM-397)
  statusAtual: guardada?.status_proposta ?? null,
  statusBase: guardada ? statusNaBase ?? guardada.status_proposta : null,
  statusNovo: op.versao.dados.status_proposta,
});
if (!rn11.permitido) {
  return { idOperacao: op.idOperacao, situacao: 'rejeitada', codigo: 'RN11', mensagem: rn11.mensagem, retentavel: false };
}
```

Exceção: se o conteúdo recebido é igual ao guardado (reenvio de resposta perdida), não é edição e não passa pela RN11. Os cenários estão em `servidor.test.ts` (bloco "RN11") e devem passar contra a API quando ela existir.

> Código ainda não implementado — esta pasta contém apenas este README como marcador da estrutura inicial (Sprint 1).
