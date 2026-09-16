# Lumini — App Mobile (Técnico)

Aplicativo React Native (Expo Prebuild) usado pelo técnico de instalação em campo, com arquitetura **offline-first**.

## Responsabilidades

Autenticação, cadastro de cliente e instalação, medição do telhado (Realidade Aumentada via ViroReact ou Modo Leve), simulação de sombreamento, dimensionamento fotovoltaico, seleção de equipamentos, ajuste de preço na proposta, precificação, viabilidade financeira, geração da proposta em PDF, histórico local e fila de sincronização com a API.

## Estrutura planejada (a criar)

```
apps/mobile/src/
  app/          # navegação e providers
  features/     # auth, clients, measurement, shading, equipment, pricing, proposal, plan
  data/         # local (SQLite), remote (API) e repositories
  viro/         # cenas de RA, medição e obstáculos
  components/   # componentes visuais reutilizáveis
  assets/       # ícones, imagens e recursos
```

Referência completa: [`docs/arquitetura/Stacks_Mobile_v1.1.md`](../../docs/arquitetura/Stacks_Mobile_v1.1.md) (Seção 4.1) e tarefa NOVO-70 do backlog.

## Stack

React Native + Expo Prebuild (necessário para o ViroReact) · TypeScript · ViroReact (ARKit/ARCore) · SQLite + SQLCipher.

> Código ainda não implementado — esta pasta contém apenas este README como marcador da estrutura inicial (Sprint 1).
