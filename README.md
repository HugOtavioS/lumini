# ☀️ Lumini

**Demanda:** Otimização no Processo de Instalação de Placas Solares.
**Empresa / Área:** UNISA TECNOLOGIA — demanda cadastrada na Plataforma SAGA SENAI de Inovação.
**Contexto acadêmico:** Projeto Integrador Interdisciplinar IV — ADS, 4º semestre, Faculdade de Tecnologia SENAI Félix Guisard.
**Equipe:** Hugo Otávio dos Santos de Paula, Misael Bonifácio Morgado, Pedro Gabriel Moreira dos Santos.

---

## Índice

- [O Problema](#o-problema)
- [A Solução](#a-solução)
- [Escopo do MVP](#escopo-do-mvp)
- [Arquitetura e Tecnologias](#arquitetura-e-tecnologias)
- [Estrutura do Repositório](#estrutura-do-repositório)
- [Como Executar](#como-executar)
- [Documentação](#documentação)
- [Como Contribuir](#como-contribuir)

## O Problema

Instaladoras e integradoras de energia solar ainda planejam e precificam seus projetos de forma manual, sem metodologia padronizada. Isso resulta em:

- até 3 horas de trabalho manual para gerar uma única proposta comercial;
- cálculos técnicos inconsistentes entre técnicos da mesma empresa;
- erros nas fórmulas de irradiação solar, perdas do sistema e dimensionamento;
- desconexão entre dados técnicos e comerciais, sem visão do funil de vendas;
- propostas com preços desatualizados por falta de integração com fornecedores.

## A Solução

O Lumini automatiza, em um aplicativo mobile **offline-first**, o dimensionamento técnico, a precificação e a geração de propostas comerciais de sistemas fotovoltaicos, padronizando o processo entre todos os técnicos. Uma **interface web** conecta esses dados à gestão comercial da empresa (funil de vendas, catálogo de equipamentos, editor de propostas e plano de assinatura).

**Metas mensuráveis:** reduzir o tempo de elaboração de propostas de até 3 horas para menos de 10 minutos; eliminar erros técnicos por meio de fórmulas automatizadas; manter funcionamento confiável mesmo sem conexão constante à internet.

## Escopo do MVP

O MVP cobre o fluxo completo do técnico em campo (cadastro do cliente/instalação, medição do telhado, dimensionamento, seleção de equipamentos, precificação, viabilidade e proposta em PDF — tudo funcionando offline) e a gestão comercial na interface web (propostas, catálogo, editor de propostas, funil de vendas e plano de assinatura).

Todas as funcionalidades da demanda original fazem parte do MVP, classificadas como **Obrigatórias** (precisam funcionar na entrega) ou **Desejáveis** (implementação prevista, cedem prioridade em caso de atraso). Destaque: a **medição por Realidade Aumentada é obrigatória**, por exigência da unidade curricular de Realidade Aumentada.

Detalhamento completo em [`docs/Lumini_MVP_v1.4.md`](docs/Lumini_MVP_v1.4.md).

## Arquitetura e Tecnologias

Arquitetura client-server com estratégia **offline-first** no cliente mobile: todo o cálculo (dimensionamento, precificação, viabilidade) acontece nos clientes (app e web); a API é responsável apenas por autenticação, autorização e sincronização/persistência dos dados.

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript em todas as frentes (mobile, web e API) |
| App mobile | React Native com Expo Prebuild |
| Realidade Aumentada | ViroReact (ARKit no iOS / ARCore no Android), com Modo Leve como fallback |
| Banco local (mobile) | SQLite com criptografia SQLCipher |
| Interface web | SPA em TypeScript (framework em definição — tarefa NOVO-101) |
| Backend / API | Node.js com NestJS (API REST, apenas sincronização e persistência) |
| Banco central | PostgreSQL no Amazon RDS, multi-tenant por `id_empresa` |
| Autenticação | JWT com refresh token, papéis Técnico e Gestor Comercial |
| Cálculo compartilhado | Pacote `packages/domain` (TypeScript), usado pelo app e pela web — a API não calcula |

Detalhamento completo no [Documento de Arquitetura de Software](docs/arquitetura/Lumini_Arquitetura_v1.2.md) e na [documentação das stacks mobile](docs/arquitetura/Stacks_Mobile_v1.1.md).

## Estrutura do Repositório

```
lumini/
├── apps/
│   ├── mobile/     # App React Native (Técnico) — offline-first
│   ├── web/        # Painel do Gestor Comercial
│   └── api/        # Backend NestJS (sincronização e persistência)
├── packages/
│   ├── domain/     # Regras de cálculo compartilhadas (app + web)
│   ├── pdf/         # Template da proposta comercial
│   └── contracts/  # Tipos e schemas dos payloads de sincronização
├── docs/           # ERS, arquitetura, dicionário de dados e backlog
└── .github/        # PR template e workflow de CI
```

> A estrutura interna de cada pasta ainda está sendo implementada — ver o `README.md` de cada uma para o estado atual.

## Como Executar

Em definição junto com a escolha do framework web (NOVO-101) e da hospedagem AWS (NOVO-102). Este README será atualizado com instruções de instalação e execução (mobile, web e API) conforme cada parte for implementada.

## Documentação

Toda a documentação do projeto está em [`docs/`](docs/): Especificação de Requisitos de Software (ERS) e seu adendo, Documento de Arquitetura de Software (DAS), Dicionário de Dados, backlog e o registro de decisões de escopo e arquitetura. Veja o [índice em `docs/README.md`](docs/README.md).

## Como Contribuir

Convenções de branching, commits e pull requests estão em [`CONTRIBUTING.md`](CONTRIBUTING.md).
