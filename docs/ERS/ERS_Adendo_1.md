**LUMINI** — **ESPECIFICAÇÃO DE REQUISITOS DE SOFTWARE (ERS) — ADENDO 1**

Versão 1.0 — 15 de setembro de 2026

# 1. Finalidade

A Especificação de Requisitos de Software (ERS) v1.0 foi entregue na Sprint 1. Este adendo registra, sem alterar o documento entregue, os **requisitos novos** criados depois dela e as **alterações em requisitos existentes** decididas em 15/09/2026. A partir desta data, ERS v1.0 e Adendo 1 devem ser lidos em conjunto; em caso de conflito, prevalece o adendo.

O detalhamento completo (fluxos, subfluxos e exceções) de todos os requisitos está na *Especificação Textual de Fluxos* v1.1, e a priorização, na *Lista Priorizada* v1.1. As decisões que motivaram cada mudança estão no *Registro de Decisões de Escopo e Arquitetura*.

# 2. Atores Atualizados

| Ator | Descrição |
|---|---|
| Técnico | Profissional de campo que usa o aplicativo mobile para cadastrar clientes e instalações, medir o telhado, dimensionar, escolher equipamentos, precificar e gerar a proposta. Solicita upgrade de plano ao gestor. |
| Gestor Comercial | Usuário da interface web: acompanha propostas e o funil de vendas, edita propostas sincronizadas, mantém o catálogo e os preços e realiza o upgrade de plano da empresa. **Novo:** também cadastra, edita e inativa os usuários da empresa e configura os parâmetros comerciais (RF29). |
| Cliente final | Ator externo: recebe e avalia a proposta em PDF; não interage com o sistema. |
| Serviço de Clima | Ator secundário (sistema externo) que fornece HSP e irradiação. |

# 3. Novos Requisitos Funcionais

| ID | Descrição | Ator | Prioridade | Caso de uso |
|---|---|---|---|---|
| RF27 | O sistema deve permitir que o gestor edite uma proposta sincronizada (trocar equipamentos, alterar quantidades e aplicar desconto comercial), recalcule o total em tempo real e atualize seu status (Em negociação, Reaberta, Aprovada ou Recusada). | Gestor Comercial | Obrigatório | UC14 (novo) |
| RF28 | O sistema deve permitir que o técnico solicite ao gestor da empresa um upgrade de plano, pelo aplicativo mobile. | Técnico | Desejável | UC13 |
| RF29 | O sistema deve permitir que o gestor comercial cadastre, edite e inative usuários da empresa e configure os parâmetros comerciais (limite de ajuste de preço, margem e custos padrão). | Gestor Comercial | Desejável | UC15 (novo) |

## 3.1 RF27 — Editar Proposta e Atualizar Status (Web)

**Justificativa:** o Editor de Propostas Web é obrigatório desde o MVP v1.2 (tela `Web Editor Proposta-Web`), mas não tinha requisito próprio na ERS. A mudança de status também não era coberta por nenhum requisito, apesar de ser a base do funil de vendas (RF21).

**Pré-condições:** proposta com status "Gerada" ou "Em negociação" (RN11).

***Fluxo Principal***

1. Gestor abre o editor a partir do detalhe da proposta (RF23).
2. Gestor troca ou inclui equipamentos do catálogo e ajusta quantidades.
3. Gestor aplica desconto comercial.
4. A interface web recalcula precificação e viabilidade no navegador, com o mesmo pacote de cálculo do aplicativo; a API apenas grava o resultado.
5. Gestor salva e escolhe: mover para "Em negociação", gerar nova versão do PDF, reabrir para o técnico ("Reaberta") ou marcar como "Aprovada" ou "Recusada".
6. Sistema registra a alteração no log de auditoria.

***Exceções***

- Combinação eletricamente incompatível: alerta e bloqueio.
- Proposta "Aprovada" ou "Recusada": somente leitura.

## 3.2 RF28 — Solicitar Upgrade de Plano ao Gestor

**Justificativa:** o upgrade é realizado apenas pelo gestor na web, mas o técnico é quem encontra o limite em campo (telas `Limite Proposta Gerada` e `Modal Upgrade Enviado`).

**Pré-condições:** técnico autenticado.

***Fluxo Principal***

1. Sistema exibe o consumo do limite mensal da empresa.
2. Técnico seleciona "Solicitar upgrade ao gestor" e, opcionalmente, escreve uma mensagem.
3. Sistema registra a solicitação como "Pendente" e a envia na próxima sincronização.
4. O gestor visualiza a solicitação em "Plano e Assinatura" (RF24) e a atende ou recusa.

***Exceções***

- Sem conexão: envio na próxima sincronização.
- Solicitação pendente já existente: o sistema não duplica.

## 3.3 RF29 — Gerenciar Usuários da Empresa

**Justificativa:** o RF01 pressupõe usuários cadastrados "pelo Gestor Comercial/Administrador", mas nenhum requisito descrevia esse cadastro. Não foi criado um papel de Administrador: a própria interface do gestor faz essa gestão.

**Pré-condições:** usuário com papel Gestor Comercial. Enquanto a tela não estiver pronta, os usuários iniciais são criados por script de carga.

***Fluxo Principal***

1. Sistema lista os usuários da empresa com papel e situação.
2. Gestor cadastra (nome, e-mail, papel e senha provisória), edita ou inativa usuários.
3. Gestor ajusta os parâmetros comerciais da empresa.
4. Sistema persiste as alterações e registra o log de auditoria.

***Exceções***

- E-mail já utilizado: validação.
- Tentativa de inativar o único gestor ativo da empresa: operação bloqueada.

# 4. Nova Regra de Negócio

| ID | Descrição |
|---|---|
| RN11 | Cada status da proposta define quem pode editá-la: o técnico edita em "Em elaboração" e "Reaberta"; o gestor edita em "Gerada" e "Em negociação"; ninguém edita em "Aprovada" e "Recusada". A primeira passagem para "Gerada" conta no limite do plano; uma nova geração após "Reaberta" não conta. |

# 5. Alterações em Requisitos da ERS v1.0

| ID | ERS v1.0 | A partir deste adendo | Motivo |
|---|---|---|---|
| RF03 | Consumo, tipo de ligação, tarifa, cidade e estado | Inclui dados do cliente (CPF/CNPJ, contatos) e da instalação (endereço, UC/NIS, modalidade tarifária, disjuntor, telhado e quadro) | Cadastro B2B (Épico 11) |
| RF04 | Desejável | **Obrigatório** | Exigência da unidade curricular de Realidade Aumentada |
| RF09 | Seleção de equipamentos compatíveis | O técnico escolhe os equipamentos; o sistema **não sugere kit** e apenas valida a compatibilidade | Decisão da equipe |
| RF18 | Atualização manual do preço de um equipamento | Ajuste do preço de um equipamento **somente na proposta**, dentro do limite da empresa; o catálogo não é alterado | Catálogo exclusivo do gestor |
| RF24 | Acompanhar plano e limite | Inclui o atendimento das solicitações de upgrade e o **upgrade realizado pelo gestor** (fluxo de upgrade Desejável) | Decisão da equipe |
| RN03 | Soma de equipamentos, materiais, mão de obra, ART, frete e margem | Mesma soma, menos o desconto comercial aplicado pelo gestor; a margem incide sobre serviços e materiais | Editor web e margem já embutida no preço do equipamento |
| RN05 | Limite mensal (sem valor definido) | **25 propostas por mês por empresa** | Decisão da equipe |
| RN06 | Técnico atualiza o preço do equipamento | Técnico ajusta o preço apenas na proposta; log de auditoria | Catálogo exclusivo do gestor |
| RN10 | (sem prioridade na ERS) | Essencial | Impacto ambiental é obrigatório na demanda |
| RNF03 | (sem prioridade na ERS) | Essencial | Interface sem treinamento é obrigatória na demanda |
| RNF05 / RNF14 | SQLite/Realm | SQLite com criptografia SQLCipher | Realm descontinuado pelo fornecedor |
| 3.4.2 | API Backend: sincronização, autenticação e atualização do catálogo | API **somente de sincronização e persistência**; o cálculo é executado nos clientes | Preservar o offline-first |

# 6. Novos Casos de Uso

| ID | Nome | Ator principal | Resumo |
|---|---|---|---|
| UC14 | Editar Proposta (Web) | Gestor Comercial | Editar proposta sincronizada, recalcular, gerar nova versão e mudar o status. |
| UC15 | Gerenciar Usuários | Gestor Comercial | Cadastrar, editar e inativar usuários e configurar parâmetros comerciais. |

# 7. Matriz de Rastreabilidade Atualizada

| Requisitos Funcionais | Casos de Uso Relacionados |
|---|---|
| RF01, RF14 | UC01 |
| RF02, RF03 | UC02 |
| RF04, RF05, RF06, RF19 | UC03 |
| RF07, RF08 | UC04 |
| RF09, RF17, RF18 | UC05 |
| RF10, RF11 | UC06 |
| RF12 | UC07 |
| RF13 | UC08 |
| RF15, RF16 | UC09 |
| RF20 | UC10 |
| RF21, RF22, RF23, RF26 | UC11 |
| RF25 | UC12 |
| RF24, RF28 | UC13 |
| RF27 | UC14 |
| RF29 | UC15 |

# 8. Considerações Finais

Este adendo mantém a rastreabilidade entre a ERS entregue e o escopo atual do MVP. Os diagramas de casos de uso, classes e DER devem ser atualizados para refletir os casos de uso UC14 e UC15 e as novas entidades (tarefa NOVO-108 do backlog).
