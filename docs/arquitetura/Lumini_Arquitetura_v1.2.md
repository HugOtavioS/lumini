**LUMINI** — **DOCUMENTO DE ARQUITETURA DE SOFTWARE (DAS)**

Versão 1.2 — Setembro de 2026

# 1. Introdução

## 1.1 Objetivo do Documento

Este documento especifica a arquitetura de software do sistema Lumini: o padrão arquitetural adotado, a organização do backend, a estratégia de sincronização offline, o modelo de dados, a divisão de responsabilidades entre cliente e servidor, a segurança e a infraestrutura. Ele orienta a equipe na implementação técnica e serve de referência para os épicos e tickets de engenharia.

## 1.2 Escopo

A arquitetura contempla as duas frentes do produto: o aplicativo mobile offline-first, usado pelos técnicos em campo, e a interface web, usada pelo gestor comercial. As duas frentes compartilham uma única API backend, responsável por autenticação, controle de acesso, sincronização e persistência.

## 1.3 Visão Geral da Arquitetura

O técnico precisa concluir o orçamento mesmo sem conectividade. Por isso, **todo o cálculo acontece no dispositivo**: o aplicativo mantém uma cópia local dos dados necessários e usa a API apenas para autenticação e sincronização. Nesta fase, a API é uma **camada de sincronização e persistência**: recebe, guarda e entrega dados com controle de acesso, sem executar regras de cálculo. Nenhum cliente acessa o banco de dados central diretamente.

## 1.4 Alterações desta Versão (v1.2)

- Papéis de acesso consolidados em Técnico e Gestor Comercial (que também gerencia os usuários da empresa); o cliente final é ator externo.
- Stack fechada: Node.js/NestJS, PostgreSQL no Amazon RDS e SQLite com SQLCipher no mobile.
- Regra de propriedade de edição por status da proposta e separação entre status comercial e status de sincronização.
- Catálogo editável apenas na web; o técnico ajusta preços somente dentro da proposta.
- Novas entidades Instalação, Item da Proposta, Solicitação de Upgrade e Log de Auditoria (a entidade de preço versionado foi substituída pelo log).
- Novas seções de Segurança (7) e Infraestrutura (8) e pacote de domínio compartilhado entre os clientes (2.3).
- API restrita a sincronização e persistência: o cálculo é executado apenas nos clientes, preservando o offline-first.

# 2. Padrão Arquitetural Geral

## 2.1 Arquitetura Client-Server

A arquitetura segue o padrão client-server, com estratégia offline-first no cliente mobile. O aplicativo mobile e a interface web são clientes distintos de uma API central, que concentra autenticação, autorização, sincronização e acesso ao banco de dados. As regras de cálculo ficam nos clientes. Essa decisão evita fontes de verdade duplicadas para os dados e controla as permissões de todos os papéis em um único ponto, sem tornar o cálculo dependente de conexão.

## 2.2 Responsabilidades das Camadas

| Camada | Responsabilidade |
|---|---|
| Aplicativo mobile | Interface de campo, operação offline, cadastro de cliente e instalação, medição por RA ou manual, simulação de sombreamento, cálculo exibido ao usuário, seleção de equipamentos, ajuste de preço na proposta, geração de PDF e fila de sincronização. |
| Interface web | Recálculo local no editor de propostas (mesmo pacote de domínio do app) e gestão comercial: listagem e detalhe de propostas (incluindo o sombreamento obtido em campo), editor de propostas, funil de vendas e relatórios, catálogo e preços, plano e assinatura, solicitações de upgrade e usuários da empresa. |
| API backend | Autenticação, autorização (RBAC), isolamento por empresa, sincronização (pull e push), persistência dos dados enviados pelos clientes e contagem do limite do plano. **Não executa cálculos.** |
| Banco central | Fonte de verdade para empresas, usuários, clientes, instalações, propostas, equipamentos, assinaturas e logs. |
| Banco local | Cópia operacional dos dados necessários ao mobile e armazenamento das operações pendentes de envio. |

## 2.3 Linguagem Única e Pacote de Domínio Compartilhado

O backend também será escrito em JavaScript/TypeScript: o NestJS é um framework para Node.js, e o React Native e a interface web usam a mesma linguagem. O projeto pode ser organizado como um monorepo, em que as regras de cálculo existem em um único lugar e são importadas pelos dois clientes (app e web). A API usa apenas os tipos dos payloads:

```
apps/mobile      aplicativo React Native (Expo Prebuild + ViroReact)
apps/web         interface web do gestor comercial
apps/api         API NestJS
packages/domain  cálculo (usado só pelo app e pela web)
packages/pdf     template da proposta (usado no app e na web)
packages/contracts  tipos e schemas dos payloads de sincronização
```

Com isso, a regra de "não duplicar a lógica de cálculo" (Seção 6) é garantida pela estrutura do código, e não apenas por convenção.

# 3. Backend e API

## 3.1 API Única e RBAC

O sistema usa uma API única para os dois clientes, com controle de acesso baseado em papel (RBAC — Role-Based Access Control). Backends distintos por plataforma foram descartados porque criariam múltiplas fontes de verdade, especialmente no catálogo e na tabela de preços. Nesta fase, a API é somente de sincronização e persistência; ela não calcula dimensionamento, preço ou viabilidade.

| Papel | Interface | Acesso principal |
|---|---|---|
| Técnico | Mobile | Clientes e instalações, medições, sombreamento, dimensionamento, seleção de equipamentos, ajuste de preço **somente na proposta** (dentro do limite da empresa), geração e compartilhamento de PDF, histórico, sincronização, catálogo em **leitura** e solicitação de upgrade ao gestor. |
| Gestor Comercial | Web | Propostas da empresa (listagem, detalhe, sombreamento, editor, desconto comercial e mudança de status), funil e relatórios, catálogo (cadastro, edição de preço e inativação), plano e assinatura (incluindo o **upgrade**) e atendimento das solicitações de upgrade. |

> O **cliente final** é ator externo: recebe e avalia a proposta em PDF, sem acesso ao sistema.

## 3.2 Autenticação

A autenticação usa JWT (JSON Web Token) com refresh token para renovar a sessão de forma controlada. O token de acesso carrega o identificador do usuário, da empresa e o papel. A API valida esses dados antes de cada operação e aplica o filtro por empresa em todas as consultas, impedindo que um usuário consulte ou altere registros de outra empresa. No mobile, a última sessão válida fica em cache criptografado para permitir o uso offline após o primeiro login.

## 3.3 Stack Tecnológica

| Componente | Tecnologia ou decisão |
|---|---|
| Backend / API | Node.js com NestJS (TypeScript), API REST |
| Banco central | PostgreSQL no Amazon RDS, esquema único com coluna `id_empresa` (multi-tenant) |
| Acesso a dados | ORM/Query builder com migrações versionadas (escolha da equipe de backend) |
| Persistência mobile | SQLite com criptografia SQLCipher e migrações versionadas |
| Autenticação | JWT de curta duração com refresh token; senhas com hash bcrypt |
| Comunicação | HTTPS/TLS, REST com payloads versionados (`/v1`) e idempotência por UUID |
| Controle de acesso | RBAC por papel e isolamento por empresa |
| Documentação | OpenAPI/Swagger gerado pela API |

## 3.4 Grupos de Endpoints

| Grupo | Papéis | Finalidade |
|---|---|---|
| `/auth` | Todos | Login, refresh e logout |
| `/sync` | Técnico | Pull de dados autorizados e push da fila de operações |
| `/propostas` | Gestor | Listagem, filtros e detalhe; gravação das edições, status e novas versões calculadas na web |
| `/catalogo` | Gestor (escrita); Técnico (leitura via sync) | Cadastro, edição de preço e inativação de equipamentos |
| `/plano` | Gestor | Consumo do limite, upgrade e solicitações de upgrade |
| `/solicitacoes-upgrade` | Técnico (criar) | Pedido de upgrade enviado ao gestor |
| `/usuarios` | Gestor | Gestão de usuários da empresa |
| `/indicadores` | Gestor | Funil de vendas e relatórios |
| `/integracoes` (especificação) | — | Pontos de integração futura com ERP/CRM (documentados, não implementados) |

# 4. Sincronização Offline

## 4.1 Estratégia de Sincronização

A sincronização é o componente mais sensível da arquitetura, pois concilia o trabalho em campo com a fonte de dados central. A estratégia combina **pull on login/refresh** e **push on reconnect**.

| Momento | Operação |
|---|---|
| Login ou refresh | Baixar catálogo, preços, parâmetros técnicos e comerciais, concessionárias, base de HSP, contador do plano e propostas reabertas para o técnico. |
| Uso offline | Salvar clientes, instalações, medições, simulações, propostas, itens e solicitações de upgrade no SQLite, com `sync_status = Pendente`. |
| Reconexão | Enviar a fila em ordem de dependência (cliente → instalação → medição → proposta → itens), com retentativa e backoff exponencial. |
| Após sincronizar | Marcar `sync_status = Sincronizado`, registrar data de envio e aplicar as alterações recebidas do servidor. |
| Falha no envio | Manter o item na fila com `sync_status = Erro`, registrar a mensagem e permitir nova tentativa automática ou manual. |
| Atualização manual (RF17, Desejável) | O técnico força o download do catálogo sem esperar o próximo login. |

## 4.2 Regras de Envio

- **RN07:** somente propostas com status "Gerada" ou posterior entram na fila. Propostas "Em elaboração" permanecem apenas no dispositivo.
- **Idempotência:** todo registro criado no mobile recebe um UUID no próprio dispositivo; reenviar o mesmo registro não o duplica no servidor.
- **Log de sincronização (RNF11):** cada tentativa grava data/hora, status e quantidade de registros, com sucesso ou falha.

## 4.3 Propriedade de Edição e Resolução de Conflitos

Para reduzir conflitos na origem, cada status da proposta define **quem pode editá-la**. Assim, técnico e gestor nunca editam a mesma proposta ao mesmo tempo em condições normais.

| Status da proposta | Quem edita | Transições |
|---|---|---|
| Em elaboração | Técnico (mobile) | → Gerada (PDF gerado; conta no limite do plano) |
| Gerada | Gestor (web) | → Em negociação, Reaberta, Aprovada ou Recusada; o gestor pode gerar nova versão do PDF |
| Em negociação | Gestor (web) | → Reaberta, Aprovada ou Recusada |
| Reaberta | Técnico (mobile) | → Gerada (nova versão; não consome novo item do limite) |
| Aprovada / Recusada | Ninguém (somente leitura) | Estados finais |

O **status de sincronização** (`sync_status`: Pendente, Sincronizado, Erro) é um campo separado do status comercial e existe apenas no banco local.

O catálogo é editado somente na web (gestor comercial) e chega ao mobile por pull, portanto não gera conflito. Nos casos residuais (por exemplo, uma proposta reaberta no servidor enquanto o técnico ainda enviava uma versão antiga), vale a regra **last-write-wins** por `updated_at`, com registro no log de auditoria e aviso ao usuário cuja alteração foi sobrescrita. Toda entidade sincronizável possui, no mínimo, `updated_at`, `updated_by` e, no banco local, `sync_status`.

## 4.4 Limite do Plano com Operação Offline

O limite do plano Freemium é de **25 propostas por mês por empresa**, contadas quando a proposta passa a "Gerada" pela primeira vez. Offline, o app usa o contador recebido no último pull somado às propostas geradas localmente e bloqueia a geração ao atingir o limite. Como vários técnicos podem estar offline ao mesmo tempo, a API revalida o limite na sincronização: propostas geradas offline acima do limite são **aceitas e sinalizadas** (`excedeu_limite_plano`) para o gestor, evitando a perda do trabalho feito em campo.

# 5. Modelo de Dados — Núcleo

A entidade Empresa é o limite de isolamento dos dados: todas as tabelas de negócio possuem `id_empresa`, e as consultas da API sempre filtram pela empresa do usuário autenticado. O detalhamento campo a campo está no Dicionário de Dados v1.2.

| Entidade | Descrição | Relacionamentos principais |
|---|---|---|
| Empresa | Instaladora cliente da plataforma e seus parâmetros comerciais. | Usuário; Assinatura; Cliente; Equipamento |
| Usuário | Técnico ou Gestor Comercial. | Empresa; Proposta; Log de Auditoria |
| Assinatura | Plano (Freemium, Mensal ou Anual) e limite mensal. | Empresa |
| Solicitação de Upgrade | Pedido de upgrade feito pelo técnico ao gestor. | Empresa; Usuário |
| Cliente | Pessoa física ou jurídica atendida pela instaladora. | Empresa; Instalação |
| Instalação | Local de instalação: endereço, unidade consumidora, dados elétricos e telhado. | Cliente; Concessionária; Medição; Proposta |
| Concessionária | Distribuidora de energia e tarifa de referência. | Instalação |
| Localidade Climática | HSP e irradiação por cidade (base de contingência). | Instalação (por cidade/UF) |
| Medição do Telhado | Área, inclinação e orientação, por RA ou manual. | Instalação; Simulação de Sombreamento |
| Simulação de Sombreamento | Resultado da trajetória solar e percentual de sombreamento. | Medição do Telhado |
| Equipamento | Catálogo de módulos, inversores, estruturas, string box, cabos e conectores. | Empresa; Item da Proposta |
| Proposta | Dimensionamento, precificação, viabilidade e status comercial. | Instalação; Usuário; Item da Proposta |
| Item da Proposta | Equipamento, quantidade e preço unitário usado na proposta. | Proposta; Equipamento |
| Log de Auditoria | Alterações de preço, desconto e status (valor anterior e novo). | Usuário; qualquer entidade auditada |
| Log de Sincronização | Tentativas de sincronização por usuário e dispositivo. | Usuário |

# 6. Responsabilidade de Cálculo Técnico

A lógica de dimensionamento, precificação e viabilidade tem uma única fonte de verdade: o pacote `packages/domain` (Seção 2.3). **O cálculo é executado no dispositivo**, sem chamada de rede, garantindo o offline-first. A interface web usa o mesmo pacote, no navegador, quando o gestor edita uma proposta. A API **não recalcula** nem valida os resultados: ela apenas persiste os valores calculados pelos clientes. A consistência é garantida por fórmulas, parâmetros, regras de arredondamento e casos de teste de referência únicos no pacote.

| Grupo de regras | Dados de entrada | Resultado esperado |
|---|---|---|
| Dimensionamento (RN01) | Consumo, HSP, perdas (temperatura, sujeira, cabeamento, sombreamento) | Potência necessária (kWp) e geração estimada |
| Compatibilidade | Módulos e inversor escolhidos pelo técnico, tipo de ligação | Validação elétrica (tensão/corrente) e alertas |
| Precificação (RN03) | Itens da proposta, materiais elétricos, mão de obra, ART, frete, margem e desconto | Valor total da proposta |
| Viabilidade (RN04, RN10) | Valor total, tarifa, geração e fator de emissão | Payback, ROI, economia em 25 anos e CO₂ evitado |
| Sombreamento (RF06) | Coordenadas, data, orientação, inclinação e obstáculos | Percentual de sombreamento e impacto na geração |

A regra de precificação adotada é:

```
Equipamentos = Σ (preço unitário na proposta × quantidade)
Serviços     = materiais elétricos + mão de obra + ART + frete
Margem       = Serviços × margem %
Valor total  = Equipamentos + Serviços + Margem − Desconto comercial
```

O preço de venda do catálogo já contém a margem de cada equipamento. Por isso, a margem de lucro da proposta incide sobre serviços e materiais, evitando margem em duplicidade.

# 7. Segurança

| Aspecto | Medida |
|---|---|
| Transporte (RNF06) | HTTPS/TLS obrigatório em todas as chamadas; tráfego HTTP recusado |
| Autenticação | JWT de curta duração e refresh token com rotação; revogação no logout e na inativação do usuário |
| Senhas | Hash bcrypt, nunca armazenadas em texto puro |
| Autorização (RNF07) | RBAC por papel em cada endpoint e filtro obrigatório por `id_empresa` |
| Dados em repouso no mobile (RNF05) | SQLite criptografado com SQLCipher; chave guardada no Keychain (iOS) ou Keystore (Android) |
| Auditoria (RNF11) | Log de auditoria de preços, descontos e status; log de sincronização |
| LGPD | Coleta mínima de dados pessoais do cliente, finalidade declarada na proposta e levantamento de conformidade (SCRUM-102) |

# 8. Infraestrutura e Implantação

| Componente | Decisão |
|---|---|
| Banco central | Amazon RDS for PostgreSQL, acessível apenas pela API |
| API | Aplicação NestJS publicada na AWS (serviço de execução a definir — tarefa NOVO-102) |
| Interface web | Aplicação estática publicada com HTTPS (framework a definir — tarefa NOVO-101) |
| Aplicativo mobile | Builds nativos Android/iOS via Expo Prebuild (necessário para o ViroReact) |
| Serviço de clima | API externa de irradiação consumida pelo app quando online, com base de contingência local (serviço a definir — tarefa NOVO-103) |
| Integração contínua | GitHub Actions executando lint e testes a cada pull request (SCRUM-69/SCRUM-108) |

# 9. Considerações Finais

A arquitetura do Lumini se apoia em uma API central com controle de acesso por papel, PostgreSQL como fonte de verdade, SQLite criptografado no mobile, fila de sincronização com pull e push, e regras de edição por status que evitam conflitos na origem. O cálculo acontece no dispositivo, e a API se limita a sincronizar e persistir os dados. O uso de TypeScript em todas as frentes permite um pacote de domínio único para os cálculos do app e da web, reduzindo o risco de divergência entre eles.

Essas decisões formam a base técnica para os tickets de desenvolvimento, os diagramas e os testes do projeto, e atendem à integração entre técnicos e gestores sem comprometer o trabalho em áreas com baixa conectividade.
