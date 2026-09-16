**LUMINI** — **REGISTRO DE DECISÕES DE ESCOPO E ARQUITETURA**

Versão 1.0 — 15 de setembro de 2026

# 1. Finalidade

Este documento registra as decisões de escopo, regras de negócio e arquitetura tomadas pela equipe em 15/09/2026, após a revisão cruzada dos documentos do projeto. Ele garante que cada mudança seja explícita e rastreável, e indica quais documentos foram atualizados e quais pontos da ERS v1.0 foram superados.

# 2. Decisões Registradas

| Nº | Tema | Decisão | Documentos afetados |
|---|---|---|---|
| D01 | Classificação do escopo | Itens "Desejáveis" do Apêndice A **fazem parte do MVP**, mas sem compromisso obrigatório de entrega. As classificações Obrigatório/Desejável permanecem explícitas nos documentos (no Jira a equipe usa outra organização). | MVP, Lista Priorizada, Especificação, Roteiro de Produto |
| D02 | Realidade Aumentada | RF04 passa a **Obrigatório** por exigência da unidade curricular de Realidade Aumentada; RNF09 passa a Essencial. | MVP, Lista, Especificação, Stacks |
| D03 | Sombreamento e upgrade | Simulação de sombreamento e fluxo de upgrade continuam no MVP como Desejáveis. O acompanhamento do plano e o limite mensal seguem Obrigatórios (RF24/RN05). | MVP, Lista, Especificação |
| D04 | Funil de vendas | Dashboard com funil (RF21) e relatórios (RF26) estão **dentro** do MVP, como Desejáveis. | MVP, Lista, Especificação, DAS |
| D05 | Itens fora do escopo | Nenhuma funcionalidade da demanda foi postergada. Permanecem fora apenas os itens excluídos pela ERS (1.2) e o processamento real de pagamento, que é simulado. | MVP |
| D06 | Quem vê o sombreamento | O técnico executa e vê a simulação no app; o gestor consulta o resultado na web, no detalhe da proposta. | MVP, Especificação (RF06, RF23), DAS, Dicionário |
| D07 | Upgrade de plano | O gestor realiza o upgrade na web. No app, o técnico apenas **solicita** o upgrade ao gestor por uma tela própria (novo RF28). | MVP, Especificação (RF24, RF28), Dicionário |
| D08 | Preços | O técnico ajusta o preço de equipamentos **somente dentro da proposta**, até o limite da empresa. Cadastro e edição de preços do catálogo são exclusivos do gestor. RF18 e RN06 foram reescritos. | Todos |
| D09 | Seleção de equipamentos | O técnico escolhe os equipamentos; o app **não sugere kit**. O app apenas valida a compatibilidade elétrica e alerta sobre potência muito diferente da dimensionada. | MVP, Especificação (RF09), backlog |
| D10 | Precificação | A RN03 é a base: equipamentos + materiais elétricos + mão de obra + ART + frete + margem − desconto comercial. **Esclarecimento da equipe técnica:** a margem de lucro incide sobre serviços e materiais, porque o preço de venda do equipamento já inclui a margem do item. | MVP, DAS, Dicionário, Lista, Especificação |
| D11 | Limite freemium | **25 propostas por mês por empresa**, contadas na primeira passagem para "Gerada". Propostas geradas offline acima do limite são aceitas e sinalizadas ao gestor. | Todos |
| D12 | Status | Campos separados: `status_proposta` (Em elaboração, Gerada, Em negociação, Reaberta, Aprovada, Recusada) e `sync_status` (Pendente, Sincronizado, Erro — só no dispositivo). Nova RN11 define quem edita em cada status. | DAS, Dicionário, Lista, Especificação |
| D13 | Catálogo manual (RF17) | Permanece Desejável e será implementado. O download automático no login faz parte do RF15 (Obrigatório); o RF17 cobre a atualização manual. | MVP, DAS, Lista, Especificação |
| D14 | Papéis de acesso | Apenas **Técnico** e **Gestor Comercial**. Não há papel de Vendedor (as menções no backlog servem só para contexto) nem de Administrador: a interface do gestor faz a gestão de usuários e parâmetros (novo RF29). O cliente final é ator externo. | DAS, Dicionário, Lista, Especificação |
| D15 | Backend | Node.js com NestJS (TypeScript) e PostgreSQL no Amazon RDS. Por enquanto, a API é **apenas de sincronização e persistência**: o cálculo acontece no dispositivo, para não quebrar o offline-first. As regras de cálculo ficam em um pacote compartilhado entre app e web. | MVP, DAS, Stacks, Especificação |
| D16 | Banco local | SQLite com criptografia SQLCipher. Realm descartado. | MVP, DAS, Stacks, Dicionário, Lista, Especificação |
| D17 | Histórico de preços | Não haverá tabela de preços versionados: apenas o **Log de Auditoria** (quem, quando, campo, valor anterior e valor novo). | DAS, Dicionário |
| D18 | Instalação | Nova entidade **Instalação** (endereço, UC/NIS, dados elétricos e telhado), ligada ao Cliente e à Proposta; um cliente pode ter várias instalações. | DAS, Dicionário, Especificação (RF02/RF03) |
| D19 | Campos duplicados | Mantidos `tipo_ligacao` (termo da ERS) e `categoria`; removidos `tipo_conexao` e `tipo_equipamento`. | Dicionário |
| D20 | Cronograma | O cronograma oficial é o das Sprints do Projeto Integrador (17/09, 29/10, 03/12 e apresentação em 07/12). As sprints internas do backlog se encaixam nele, e o MVP foi alinhado ao backlog. | MVP |
| D21 | Editor web | O Editor de Propostas Web, obrigatório desde o MVP v1.2, ganhou requisito próprio (RF27), que também cobre a mudança de status do funil. | Lista, Especificação |
| D22 | Nome da unidade curricular | Os documentos passam a usar "Projeto Integrador Interdisciplinar IV", conforme o cabeçalho do Roteiro do Projeto. | Todos os documentos atualizados |
| D23 | API somente de sincronização | O cálculo não é executado nem validado pela API; a web recalcula no navegador ao editar propostas. | MVP, DAS, Stacks, Especificação |

# 3. Documentos Atualizados

| Documento | Versão | Principais mudanças |
|---|---|---|
| Documento de Escopo do MVP | 1.4 | Classificação explícita, escopo completo, limites, tecnologias, cronograma oficial e sprints internas |
| Documento de Arquitetura de Software | 1.2 | Papéis, stack, pacote de domínio, edição por status, limite offline, modelo de dados, segurança e infraestrutura |
| Dicionário de Dados | 1.2 | 16 tabelas, convenções, Instalação, Item da Proposta, logs e status separados |
| Lista Priorizada de RF, RNF e RN | 1.1 | Novas prioridades, RF27–RF29, RN11, RN05/RN06 reescritas |
| Especificação de Fluxos RF/RNF | 1.1 | Fluxos revisados (RF03, RF04, RF06, RF09, RF12, RF18, RF24) e novos RF27–RF29 |
| Documentação das Stacks Mobile | 1.1 | SQLite/SQLCipher, RA obrigatória, pacote de domínio e testes revisados |
| Roteiro de Produto | — | Limite de 25 propostas, papel do gestor, riscos e MVP atualizados |
| Adendo 1 à ERS (novo) | 1.0 | RF27, RF28, RF29 e RN11, alterações em requisitos existentes e matriz de rastreabilidade |
| Backlog — Novas Tarefas e Ajustes (novo) | — | Tarefas para as pendências e para os requisitos novos, e ajustes em tickets existentes |

# 4. Divergências com a ERS v1.0

A ERS v1.0 (agosto de 2026) é um documento já entregue e não foi alterada. Os pontos abaixo prevalecem sobre ela a partir desta data:

- RF04 passou de Desejável para Obrigatório (D02).
- RF03 ampliou o cadastro com os dados da instalação (D18).
- RF18 e RN06 passaram a tratar do ajuste de preço na proposta (D08).
- RN05 passou a ter limite definido de 25 propostas/mês por empresa (D11).
- RN10 e RNF03 passaram a Essencial, em linha com a demanda.
- RNF05, RNF14 e a Seção 5.2 citam "SQLite/Realm"; vale apenas SQLite (D16).
- O Gestor Comercial passou a gerenciar os usuários da empresa (D14), e foram criados RF27, RF28, RF29 e RN11 — ver *Adendo 1 à ERS*.
- A matriz de rastreabilidade (Seção 4.3) passa a incluir RF27 → UC14 (novo), RF28 → UC13 e RF29 → UC15 (novo), conforme o Adendo 1 à ERS.

# 5. Pendências Decorrentes

- Atualizar os diagramas (`Lumini_Diagramas.drawio`): casos de uso (UC14, UC15 e novos RFs), classes e DER (Instalação, Item da Proposta, Solicitação de Upgrade e logs).
- As pendências viraram tarefas no documento *Backlog — Novas Tarefas e Ajustes (15/09/2026)*: NOVO-101 (framework web), NOVO-102 (hospedagem AWS), NOVO-103 (API de clima), NOVO-104 a NOVO-106 (RF28, RF29 e RN11), NOVO-107 (pacote de domínio), NOVO-108 (diagramas) e NOVO-109 (tela de Equipamentos), além dos ajustes em tickets existentes.
- Os requisitos novos estão consolidados no *Adendo 1 à ERS*.
