# ☀️ Lumini — Arquitetura do Projeto

> Aplicativo móvel offline-first para elaboração de orçamentos de sistemas de energia solar.  
> **Stack:** React Native · TypeScript · SQLite · ViroReact (AR) · Node.js (API)

---

## 📐 Princípios Arquiteturais

| Princípio | Descrição |
|---|---|
| **Clean Architecture** | Separação rígida entre domínio, dados e apresentação. Dependências apontam sempre para dentro (domain). |
| **Feature-based Routing** | Cada funcionalidade é um módulo isolado com suas próprias telas, hooks, componentes e serviços. |
| **Offline-first** | SQLite local como fonte primária de verdade, com Delta Sync para a API remota. |
| **Boundary de RA** | Toda lógica de Realidade Aumentada vive em `src/viro/`, isolada do restante da aplicação. |

---

## 🗂️ Estrutura de Pastas

```
src/
├── app/                        # ⚙️  Configuração e bootstrap da aplicação
│   ├── navigation/             #     Stacks, Tabs e rotas (React Navigation / Expo Router)
│   ├── providers/              #     Context Providers globais (Auth, Theme, Database)
│   ├── config/                 #     Constantes de ambiente, feature flags, configurações gerais
│   └── database/               #     Inicialização do SQLite, conexão e setup do banco
│
├── features/                   # 🧩  Módulos isolados por funcionalidade
│   ├── orcamento/              #     Criação, edição e gestão de orçamentos solares
│   │   ├── screens/            #     Telas (OrcamentoListScreen, OrcamentoFormScreen, etc.)
│   │   ├── components/         #     Componentes visuais exclusivos desta feature
│   │   ├── hooks/              #     Custom hooks (useOrcamento, useCalculoSolar, etc.)
│   │   ├── services/           #     Lógica de negócio local da feature (cálculos, validações)
│   │   └── types/              #     Tipos/interfaces TypeScript locais da feature
│   ├── clientes/               #     Cadastro e gestão de clientes
│   ├── configuracoes/          #     Preferências do usuário e configurações do app
│   └── dashboard/              #     Tela inicial com resumos e métricas
│
├── domain/                     # 🏛️  Camada de domínio (núcleo da Clean Architecture)
│   ├── entities/               #     Entidades de negócio (Cliente, Proposta, ItemOrcamento, Placa)
│   ├── interfaces/             #     Contratos/interfaces dos repositórios e serviços
│   ├── enums/                  #     Enumerações do domínio (StatusOrcamento, TipoTelhado, etc.)
│   └── value-objects/          #     Objetos de valor imutáveis (Endereco, Dimensao, Coordenada)
│
├── data/                       # 💾  Camada de infraestrutura e persistência
│   ├── repositories/           #     Implementações concretas das interfaces de domain/interfaces
│   ├── datasources/
│   │   ├── local/              #     Operações CRUD com SQLite (queries, inserts, updates)
│   │   └── remote/             #     Chamadas à API Node.js (REST/GraphQL)
│   ├── database/
│   │   ├── migrations/         #     Scripts de migração versionados do SQLite
│   │   └── schemas/            #     Definições de schema das tabelas
│   ├── sync/                   #     Lógica de Delta Sync (conflitos, fila de sync, timestamps)
│   └── mappers/                #     Conversores entre modelos do banco e entidades do domínio
│
├── viro/                       # 🥽  Módulo de Realidade Aumentada (ViroReact)
│   ├── scenes/                 #     Cenas AR (RoofMeasurementScene, PanelPlacementScene)
│   ├── components/             #     Componentes 3D reutilizáveis (marcadores, overlays, HUD)
│   ├── hooks/                  #     Hooks de AR (useARSession, useRoofDetection, useMeasurement)
│   ├── utils/                  #     Funções auxiliares (cálculos 3D, conversões de unidade)
│   └── models/                 #     Tipos e interfaces específicos do módulo AR
│
├── components/                 # 🎨  Componentes visuais genéricos e reutilizáveis
│   ├── ui/                     #     Primitivos de UI (Button, Badge, Avatar, Card, Chip)
│   ├── layout/                 #     Estruturas de layout (Container, Row, Spacer, Divider)
│   ├── feedback/               #     Feedback visual (Toast, Modal, Loading, EmptyState)
│   └── forms/                  #     Elementos de formulário (Input, Select, DatePicker, Switch)
│
├── assets/                     # 📦  Arquivos estáticos
│   ├── images/                 #     Imagens gerais (splash, backgrounds, illustrations)
│   ├── icons/                  #     Ícones customizados (SVG ou PNG)
│   ├── fonts/                  #     Tipografias do projeto (ex: Inter, Outfit)
│   └── models3d/               #     Modelos 3D (placa solar .obj/.glb para cena AR)
│
└── shared/                     # 🔗  Utilitários e tipos compartilhados globalmente
    ├── utils/                  #     Funções utilitárias (formatters, validators, date helpers)
    ├── constants/              #     Constantes da aplicação (cores, dimensões, API URLs)
    ├── hooks/                  #     Hooks globais (useDebounce, useNetworkStatus, useStorage)
    └── types/                  #     Tipos TypeScript globais (ApiResponse, Pagination, etc.)
```

---

## 🧩 Exemplo: Estrutura Interna de uma Feature

Usando `src/features/orcamento/` como referência:

```
features/orcamento/
├── screens/
│   ├── OrcamentoListScreen.tsx          # Lista de orçamentos com filtros e busca
│   ├── OrcamentoFormScreen.tsx          # Formulário de criação/edição do orçamento
│   └── OrcamentoDetailScreen.tsx        # Visualização detalhada com PDF preview
│
├── components/
│   ├── OrcamentoCard.tsx                # Card resumo exibido na listagem
│   ├── ItemOrcamentoRow.tsx             # Linha de item dentro do formulário
│   ├── ResumoFinanceiro.tsx             # Bloco com totais, descontos e impostos
│   └── SeletorPlacas.tsx                # Componente para selecionar modelo de placa
│
├── hooks/
│   ├── useOrcamento.ts                  # CRUD e estado do orçamento atual
│   ├── useOrcamentoList.ts              # Paginação, filtros e busca na listagem
│   └── useCalculoSolar.ts              # Cálculos de dimensionamento e payback
│
├── services/
│   ├── orcamentoCalculator.ts           # Regras de cálculo (kWp, ROI, quantidade de placas)
│   └── orcamentoValidator.ts            # Validações de negócio antes de salvar
│
├── types/
│   └── orcamento.types.ts               # Interfaces locais (OrcamentoFormData, FiltroOrcamento)
│
└── index.ts                             # Barrel export da feature
```

### 📏 Regras de Ouro para Features

1. **Isolamento:** Uma feature **nunca** importa diretamente de outra feature. Comunicação entre features acontece via `domain/` ou `shared/`.
2. **Barrel Exports:** Cada feature expõe apenas o necessário via `index.ts`.
3. **Screens são finas:** Telas só orquestram hooks e componentes — a lógica de negócio fica em `hooks/` e `services/`.
4. **Tipos locais vs globais:** Se um tipo só é usado dentro da feature, ele fica em `types/`. Se é compartilhado, vai para `domain/entities/` ou `shared/types/`.

---

## 🔄 Fluxo de Dependências (Clean Architecture)

```
┌─────────────────────────────────────────────────────┐
│                    APRESENTAÇÃO                      │
│   features/  ←──  components/  ←──  app/navigation  │
└───────────────────────┬─────────────────────────────┘
                        │ depende de
                        ▼
┌─────────────────────────────────────────────────────┐
│                      DOMÍNIO                         │
│   domain/entities  ·  domain/interfaces  ·  enums   │
└───────────────────────┬─────────────────────────────┘
                        │ implementado por
                        ▼
┌─────────────────────────────────────────────────────┐
│                  INFRAESTRUTURA                      │
│   data/repositories  ·  data/datasources  ·  sync   │
└─────────────────────────────────────────────────────┘
```

> **Regra:** `domain/` **nunca** importa de `data/` ou `features/`. As dependências apontam para dentro (Dependency Inversion).

---

## 🥽 Módulo de Realidade Aumentada (`src/viro/`)

Este módulo é um **boundary explícito**. A feature de orçamento chama o módulo AR através de uma interface definida em `domain/interfaces/`, nunca diretamente. Isso permite:

- Substituir ViroReact por outro SDK sem impactar o restante do app
- Testar a lógica de negócio de orçamentos sem dependência de AR
- Lazy-loading do módulo AR (é pesado e só carrega quando necessário)

---

## 💾 Estratégia Offline-First

```
[SQLite Local]  ←→  [Delta Sync Engine]  ←→  [API Node.js]
     ↑                                              ↑
  Fonte de                                    Fonte remota
  verdade                                  (quando online)
```

- Todas as operações de leitura/escrita priorizam o SQLite local
- O `src/data/sync/` gerencia a fila de sincronização com timestamps
- Conflitos são resolvidos com estratégia **last-write-wins** (configurável)

---

## 🚀 Começando

```bash
# Criar a estrutura de pastas (caso precise recriar)
chmod +x scripts/create-structure.sh
./scripts/create-structure.sh

# Instalar dependências
npm install

# Rodar o app
npx react-native start
```

---

> **Mantido por:** Equipe Lumini  
> **Última atualização:** Outubro 2026
