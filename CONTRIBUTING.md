# Como Contribuir — Lumini

Este documento registra as convenções de branching, commits e pull requests da equipe (tarefa SCRUM-69 do backlog). Ele deve ser seguido pelos 3 integrantes para manter o histórico do repositório consistente.

## Estratégia de Branching

- **`main`** — sempre em estado estável e apresentável (usado nas entregas das Sprints oficiais e na demonstração final).
- **`develop`** — branch de integração contínua entre os integrantes; features terminadas e testadas manualmente entram aqui antes de ir para `main`.
- **`feature/<nome-curto>`** — uma branch por item do backlog (ex.: `feature/scrum-12-dimensionamento`), criada a partir de `develop` e mergeada de volta via pull request.
- **`hotfix/<nome-curto>`** — correções urgentes, criadas a partir de `main` e mergeadas em `main` **e** em `develop`.

> **Pendência:** a branch `mvp` existe no repositório remoto, mas não faz parte desta convenção e ainda não tem um papel definido. A equipe deve decidir se ela vira uma branch de release estável (ex.: renomeada para `release/mvp`) ou se é removida para evitar confusão com `develop`/`main`.

## Commits

- Mensagens descritivas, no imperativo, em português ou inglês (manter consistência dentro de um mesmo PR).
- Preferir commits pequenos e frequentes a um commit grande no final da sprint interna.
- Referenciar o ID do item do backlog quando existir (ex.: `SCRUM-12: implementa cálculo de kWp`).

## Pull Requests

- Usar o [template de PR](.github/pull_request_template.md) — ele já traz o checklist mínimo.
- Todo PR passa pelo workflow de CI (lint + testes) antes do merge — ver [`.github/workflows/ci.yml`](.github/workflows/ci.yml).
- Preferir revisão por pelo menos 1 dos outros 2 integrantes antes do merge em `develop` ou `main`.

## Linter, Formatter e Convenções de Código

O item SCRUM-68 (ESLint/Prettier e convenções de nomenclatura) está marcado como concluído no Jira, mas a configuração ainda não está commitada neste repositório. Quem tiver essa configuração deve adicioná-la em um PR próprio (`.eslintrc`, `.prettierrc` e a documentação das convenções de pastas/componentes/commits).
