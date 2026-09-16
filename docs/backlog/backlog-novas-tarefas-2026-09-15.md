# Backlog Lumini — Novas Tarefas e Ajustes (15/09/2026)

> Complemento ao `backlog-lumini-reestruturado.md`, gerado a partir do *Registro de Decisões de Escopo e Arquitetura* (D01–D23) e do *Adendo 1 à ERS*. Mesmas colunas do backlog original. Os IDs `NOVO-101` em diante são provisórios, até a criação no Jira. SP com `*` são estimativas desta revisão (Fibonacci), a validar em grooming.
>
> Conferência feita antes de criar: o backlog **não tinha** tarefas para escolher o framework web, a hospedagem na AWS, o serviço de clima, o pacote de cálculo compartilhado, a regra de edição por status, a solicitação de upgrade pelo técnico, a gestão de usuários, a atualização dos diagramas e o ajuste da tela de Equipamentos.

---

## 1. Novas tarefas

| ID | Tipo | Item | Descrição | SP | Subtasks | Prioridade | Épico | Sprint interna | Observação |
|---|---|---|---|---|---|---|---|---|---|
| NOVO-101 | Task | Definir framework do frontend web (painel do gestor) | Escolher e documentar o framework da SPA web (TypeScript), considerando o reuso do pacote de cálculo (NOVO-107) e do template de PDF. Registrar a decisão no DAS (Seção 8). | 2* | — | Obrigatório | 6 | 2 | Precisa estar decidido antes do Sprint 4 (SCRUM-31) |
| NOVO-102 | Task | Definir e configurar a hospedagem AWS da API NestJS e da interface web | Escolher o serviço AWS de execução da API e a publicação estática da web com HTTPS, configurando o ambiente de homologação ligado ao RDS. | 5* | 1) Decisão e registro no DAS; 2) Ambiente de homologação da API; 3) Publicação da web | Obrigatório | 6 | 3–4 | O backlog só previa CI "sem deploy automático" (SCRUM-69) |
| NOVO-103 | Task | Selecionar o serviço externo de clima/irradiação e mapear o payload de HSP | Escolher a API de clima (critérios: gratuidade, cobertura do Brasil, formato JSON) e documentar o mapeamento dos campos usados pelo SCRUM-8 e pela base de contingência (SCRUM-17). | 2* | — | Obrigatório | 3 | 1 | Bloqueia SCRUM-8 e SCRUM-111 |
| NOVO-104 | Story | Como técnico, quero solicitar ao gestor um upgrade de plano pelo app, para não ficar travado quando o limite mensal for atingido (RF28) | Tela mobile com o consumo do limite da empresa e o botão "Solicitar upgrade ao gestor". A solicitação sincroniza e aparece em "Plano e Assinatura" na web. O técnico não contrata planos. | 3* | 1) Tela mobile; 2) Endpoint de sincronização da solicitação; 3) Lista de solicitações na web | Desejável | 6 | 4 | Telas já desenhadas: `Limite Proposta Gerada`, `Modal Upgrade Enviado` |
| NOVO-105 | Task | Gestão de usuários e parâmetros comerciais da empresa (RF29) | Tela web para o gestor cadastrar, editar e inativar técnicos e gestores e configurar o limite de ajuste de preço, a margem e os custos padrão. Até a tela ficar pronta, os usuários são criados por script. | 5* | 1) Script de carga de empresa e usuários (**obrigatório**); 2) Tela de usuários; 3) Tela de parâmetros | Desejável (o script é obrigatório) | 6 | 4 | Parâmetros usados por REV-1 e RF18 |
| NOVO-106 | Task | Implementar a regra de edição por status da proposta (RN11) no app, na web e na API | Técnico edita apenas "Em elaboração" e "Reaberta"; gestor edita apenas "Gerada" e "Em negociação"; "Aprovada" e "Recusada" são somente leitura. A API rejeita gravações fora da regra. | 3* | — | Obrigatório | 4 | 2 | Complementa SCRUM-83, REV-3 e REV-5 |
| NOVO-107 | Task | Configurar o pacote de cálculo compartilhado (`packages/domain`) e os casos de referência | Criar o pacote TypeScript com dimensionamento, RN03, viabilidade e sombreamento, usado pelo app e pela web. A API **não** usa o pacote (é apenas de sincronização). Incluir casos de teste de referência. | 3* | — | Obrigatório | 1 | 1 | Base do SCRUM-12 e do NOVO-81 |
| NOVO-108 | Task | Atualizar os diagramas (casos de uso, classes, DER) conforme o Adendo 1 à ERS | Incluir os UC14 e UC15, as entidades Instalação, Item da Proposta, Solicitação de Upgrade e os logs, e ajustar o DER local para SQLite. | 5* | 1) Casos de uso; 2) Classes; 3) DER local e nuvem | Obrigatório | 1 | 1 | Arquivo `Lumini_Diagramas.drawio` |
| NOVO-109 | Task | Ajustar a tela de Equipamentos: remover o "Kit Sugerido" e exibir a seleção feita pelo técnico | Refletir a decisão D09 no protótipo: busca e seleção pelo técnico, potência total selecionada × dimensionada e alertas de compatibilidade. | 2* | — | Obrigatório | 2 | 1 | Responsável: Hugo |

---

## 2. Ajustes em tickets existentes

| Ticket | O que ajustar | Decisão |
|---|---|---|
| SCRUM-75 (NOVO-11) | Título e descrição: em vez de "seleção/orientação de módulos compatíveis, priorizando o Kit Sugerido", passa a ser "validar a compatibilidade dos equipamentos **escolhidos pelo técnico** com o kWp calculado". | D09 |
| SCRUM-27 | Trocar "Como gestor comercial…" por "Como técnico, quero simular o sombreamento…". Acrescentar a subtask "Exibir o resultado do sombreamento no detalhe da proposta (web)". | D06 |
| SCRUM-28, SCRUM-32, SCRUM-95 | Limite de **25 propostas/mês por empresa** (não por conta), contado na primeira passagem para "Gerada". Revalidar na sincronização e sinalizar as propostas geradas offline acima do limite. | D11 |
| SCRUM-94 (NOVO-30) | O upgrade é realizado **pelo gestor** na web e atende as solicitações do NOVO-104. Cobrança simulada. | D07 |
| SCRUM-30 | Trocar "Node.js ou Python" por "NestJS". A API é **somente de sincronização e persistência**, sem cálculo. | D15, D23 |
| SCRUM-397 (NOVO-71) | Trocar "`role` (técnico/vendedor/gestor)" por "`role` (técnico/gestor)". Acrescentar à descrição: "API restrita a sincronização e persistência; cálculo nos clientes". | D23 |
| REV-1 | Camada 1: o ajuste por item fica limitado ao percentual da empresa, com log. Camada 2: a margem incide sobre serviços e materiais, e o desconto geral é aplicado apenas pelo gestor no editor web. | D08, D10 |
| NOVO-81 | O recálculo no editor web usa o pacote compartilhado no navegador (depende do NOVO-107); inclui as transições de status do REV-5. | D21, D23 |
| SCRUM-99 (NOVO-35) | Papéis do RBAC: apenas Técnico e Gestor Comercial (sem Vendedor e sem Administrador). As histórias escritas "como vendedor" continuam como estão, apenas para contexto. | D14 |
| SCRUM-97 (NOVO-33) | Especificar SQLCipher como solução de criptografia do SQLite. | D16 |
| SCRUM-39, SCRUM-66 | Textos concluídos citam "SQLite/Realm": considerar apenas SQLite. | D16 |
| SCRUM-103 (NOVO-39) | Reavaliar a prioridade: o log de auditoria passa a ser a única forma de histórico de preços e é usado pelo RF18 e pelo NOVO-83. Sugestão: Obrigatório. | D17 |
| SCRUM-5, SCRUM-11 | Nos documentos, a RA passa a **Obrigatória** (a prioridade não é usada no Jira). | D02 |
| NOVO-84 → SCRUM-371, NOVO-85 → SCRUM-372, NOVO-86 → SCRUM-398, NOVO-87 → SCRUM-399, NOVO-88 → SCRUM-375, NOVO-71 → SCRUM-397 | Atualizar os IDs no backlog reestruturado. | — |
| SCRUM-37 | Marcar como concluído no backlog reestruturado (já está concluído no Jira). | — |
