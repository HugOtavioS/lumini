# Lumini — Painel Web (Gestor Comercial)

Interface web usada pelo Gestor Comercial da empresa.

## Responsabilidades

Login, listagem e detalhamento de propostas (incluindo o sombreamento obtido em campo), editor de propostas com recálculo em tempo real (mesmo pacote de domínio do app), dashboard com funil de vendas e relatórios, gestão do catálogo de equipamentos e preços, plano e assinatura (incluindo upgrade e atendimento de solicitações) e gestão de usuários da empresa.

## Estrutura planejada (a criar)

```
apps/web/src/
  pages/        # dashboard, propostas, catálogo, plano
  components/
  services/     # chamadas à API
  hooks/
public/
```

## Stack

Framework da SPA em TypeScript ainda **em definição** (tarefa NOVO-101 do backlog — precisa estar decidido antes do Sprint 4). Reutiliza o pacote `packages/domain` para o recálculo no editor de propostas.

## RN11 no editor de propostas (SCRUM-406)

A regra de quem edita em cada status já está em `@lumini/sync` (o mesmo código usado pelo app e pela API). O editor web só precisa consultá-la para decidir o que mostrar:

```ts
import { acoesDoGestor, motivoBloqueio } from '@lumini/sync';

const acoes = acoesDoGestor(proposta.status_proposta);
// "Gerada":        editar, mover_negociacao, gerar_nova_versao, reabrir, aprovar, recusar
// "Em negociação": editar, gerar_nova_versao, reabrir, aprovar, recusar
// "Reaberta", "Em elaboração", "Aprovada", "Recusada": []  → editor somente leitura
const aviso = motivoBloqueio('Gestor', proposta.status_proposta); // texto para o banner, ou null
```

Mesmo que a tela deixe passar, a API recusa a gravação fora da regra (código `RN11`).

> Código ainda não implementado — esta pasta contém apenas este README como marcador da estrutura inicial (Sprint 1).
