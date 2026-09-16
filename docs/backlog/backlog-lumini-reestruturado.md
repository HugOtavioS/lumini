# Backlog Lumini — Revisado (pronto para Jira: descrição, story points, subtasks)

> Base: `backlog-lumini-reestruturado.md`, cruzado com ERS, Arquitetura, Apêndice A, `cronograma_sprints.png`, export do Jira (`Jira.csv`) e protótipo Figma. IDs mostram o número real do Jira (antigo `NOVO-`/`REV-` entre parênteses). **Item**: título no mesmo estilo (mais longo, com contexto embutido) do backlog original. **Descrição**: texto pronto pro campo Descrição do Jira, pra qualquer pessoa da equipe entender a tarefa sem puxar o histórico da conversa. **Story Points**: valores sem `*` vieram do campo "Story point estimate" do Jira; com `*` são estimativa desta revisão (Fibonacci: 1-2-3-5-8-13-21-34-55), a validar em grooming. **Subtasks**: só onde vale a pena quebrar — "—" significa task única.

---

## EPIC 1 — Fundação Técnica & Documentação (Sprint 0)
*Praticamente concluído — só SCRUM-37 e SCRUM-69 seguem abertos.*

| ID | Tipo | Item | Descrição | SP | Subtasks | Prioridade | Status | Observação |
|---|---|---|---|---|---|---|---|---|
| SCRUM-34 | Task | Redigir ERS (requisitos funcionais, não funcionais, regras de negócio) | Documentar cada requisito funcional (RF01–RF26) e não funcional (RNF01–RNF14) com descrição, ator envolvido e critério de aceite testável, além das regras de negócio (RN01–RN10), incluindo as fórmulas de dimensionamento e precificação. Documento-mãe do projeto — qualquer item do backlog que não referencie um RF/RNF/RN dele merece ser questionado. | 21 | — | Obrigatório | Concluído | — |
| SCRUM-36 | Task | Diagrama de Casos de Uso (atores: Técnico, Vendedor, Gestor Comercial) | Mapear os 13 UCs entre os atores, com fluxo principal, fluxos alternativos e pré-condições de cada um. Produzir a matriz de rastreabilidade RF×UC, que vira a base do checklist de entrega do Épico 10. | 21 | — | Obrigatório | Concluído | Usar seção 4.3 do ERS como checklist |
| SCRUM-53 | Task | Diagrama de Classes (renomear — não confundir com "Casos de Uso") | Modelar as classes lógicas do domínio — Cliente, Proposta, Equipamento, Usuário, Sincronização — com atributos, tipos e relacionamentos (1:N, N:N) entre elas. Serve de base direta pro DER (SCRUM-39). | 13 | — | Obrigatório | Concluído | Título no Jira ainda diz "Casos de Uso" — corrigir |
| SCRUM-54 | Task | Diagrama de sequência dos processos críticos (medição → cálculo → PDF) | Desenhar 2 diagramas mostrando a interação entre app mobile, banco local e API nos fluxos mais críticos: (1) "Medir→Calcular→Precificar"; (2) "Gerar PDF→Sincronizar". Evitar usar login como um dos dois, conforme o roteiro do Projeto Integrador. | 13 | 1) Sequência de medição/cálculo; 2) Sequência de geração/sincronização | Obrigatório | Concluído | — |
| SCRUM-37 | Task | Refinar Histórias de Usuário e Critérios de Aceite no Jira | Para cada história já criada, escrever o critério de aceite em formato objetivo (Given/When/Then ou lista de condições), de forma que qualquer pessoa da equipe saiba quando a tarefa pode ser marcada como "Concluída". | 13 | — | Obrigatório | Em andamento | Único item aberto junto com SCRUM-69 |
| SCRUM-39 | Task | Modelo Conceitual e Lógico (DER) — SQLite/Realm local + PostgreSQL nuvem | Modelar o Diagrama de Entidade-Relacionamento dos dois bancos: local (SQLite/Realm, leitura offline) e nuvem (PostgreSQL, multi-tenant). Definir chaves primárias/estrangeiras e como os esquemas se relacionam via sincronização. | 21 | 1) DER banco local; 2) DER banco em nuvem | Obrigatório | Concluído | Sustenta as regras de sync do Épico 4 |
| SCRUM-41 | Task | Dicionário de Dados (kWp, HSP, tarifas, identificadores) | Documentar campo a campo os dados críticos: tipo, tamanho, obrigatoriedade, valores válidos e origem (ex: kWp — decimal, calculado; HSP — decimal, vindo da API de clima ou do banco de contingência). | 13 | — | Obrigatório | Concluído | Atualizar com campos B2B do Épico 11 |
| SCRUM-35 | Task | Documento de Arquitetura de Software (topologia offline-first ↔ API ↔ nuvem) | Descrever a topologia completa: app mobile ↔ API REST (NestJS) ↔ banco em nuvem (PostgreSQL), como e quando cada componente se comunica, o padrão de sincronização (Push on Reconnect) e as decisões de infraestrutura (RDS, Expo Prebuild). | 34 | 1) Diagrama de arquitetura lógica; 2) Descrição dos componentes; 3) Fluxo de dados ponta a ponta | Obrigatório | Concluído | Maior item do Épico 1 |
| SCRUM-65 (NOVO-1) | Task | Diagrama de componentes/deployment (mobile, API, banco nuvem, serviços externos de clima) | Mostrar onde cada peça roda fisicamente: app mobile, API (servidor NestJS), banco de dados (RDS/PostgreSQL) e serviços externos consumidos (API de clima/irradiação). | 21 | — | Obrigatório | Concluído | — |
| SCRUM-66 (NOVO-2) | Task | Definir estratégia de versionamento de schema local (migrações SQLite/Realm) | Definir como o app atualiza a estrutura do banco local em dispositivos que já têm dados salvos de uma versão anterior, sem perder propostas já geradas. | 21 | — | Obrigatório | Concluído | Decidir antes do Sprint 1 gravar dados reais |
| SCRUM-67 (NOVO-3) | Task | Definir contrato de payload de sincronização (schema JSON de upload/download) | Especificar o schema JSON exato usado na sincronização: o que o app envia no upload de proposta e o que o backend devolve (ex: atualização de catálogo/preços). Trava a interface entre Épico 4 e Épico 6. | 13 | — | Obrigatório | Concluído | Interface entre Épico 4 e Épico 6 |
| SCRUM-10 | Task | Configurar ambiente mobile — decisão fechada: React Native + Expo Prebuild (não Expo Go, pois o ViroReact exige código nativo/ARKit-ARCore) | Setup do projeto com Expo Prebuild, necessário porque o ViroReact (RA) exige código nativo. Inclui configurar builds nativos iOS e Android básicos, mesmo antes da RA ser codificada. | 13 | — | Obrigatório | Concluído | Decisão já se paga com a RA de volta ao MVP |
| SCRUM-68 (NOVO-4) | Task | Configurar linter, formatter e convenções de código (mobile e backend) | Configurar ESLint/Prettier (ou equivalente) e documentar convenções de nomenclatura de pastas, componentes e commits, pra manter o código consistente entre os 3 membros da equipe. | 13 | — | Desejável | Concluído | — |
| SCRUM-69 (NOVO-5) | Task | Configurar repositório Git: branching strategy, PR template, CI básico (GitHub Actions rodando lint + testes a cada PR, sem deploy automático por enquanto) | Criar o repositório com branching (ex: main/dev/feature), template de PR com checklist, e pipeline básico no GitHub Actions. | 8 | 1) Branching strategy + PR template; 2) GitHub Actions (lint + testes) | Obrigatório | Em andamento | Segundo item ainda aberto do Sprint 0 |
| NOVO-70 | Task | Estruturar pastas do projeto mobile: `src/app`, `src/features`, `src/domain`, `src/data`, `src/viro`, `src/components`, `src/assets` | Criar a estrutura de pastas (navegação/providers, lógica por funcionalidade, regras de negócio puras, acesso a banco/API, componentes de RA), pra manter o código organizado desde o início. | 3* | — | Obrigatório | **Não encontrado no Jira** | Confirmar se existe com outro número |
| NOVO-71 | Task | Fechar stack de backend — decisão: NestJS (API REST) + PostgreSQL no Amazon RDS, autenticação JWT com refresh token carregando o `role` | Formalizar e documentar a decisão de stack: NestJS, PostgreSQL/RDS, JWT com o campo `role` do usuário (técnico/vendedor/gestor) no token. | 5* | — | Obrigatório | **Não encontrado no Jira** | Sustenta RNF06/RNF07 (Épico 7) |

---

## EPIC 2 — Design & Experiência do Usuário

| ID | Tipo | Item | Descrição | SP | Subtasks | Prioridade | Status | Observação |
|---|---|---|---|---|---|---|---|---|
| SCRUM-43 | Task | Identidade Visual e Guia de Estilos (paleta, tipografia, componentes) | Definir paleta de cores (incluindo cor de alerta pra superdimensionamento e espaço insuficiente), tipografia e estilo dos componentes, documentado num guia único pra design e dev seguirem. | 13 | — | Obrigatório | Concluído | Garante RNF13 |
| SCRUM-44 | Task | Wireframes de baixa fidelidade (mobile + painel web) | Esboçar a estrutura de todas as telas do app mobile e do painel web — só disposição dos elementos, sem cor ou tipografia ainda. | 13 | — | Obrigatório | Concluído | — |
| SCRUM-45 | Task | Protótipo navegável de alta fidelidade (Figma), fluxo completo até o PDF | Desenhar no Figma o fluxo completo, do login até a geração do PDF, incluindo as telas web de catálogo e editor de proposta. Referência oficial usada nesta revisão — qualquer divergência entre código e protótipo deve ser tratada como bug. | 13 | — | Obrigatório | Concluído | Base do cruzamento desta revisão |
| SCRUM-46 | Task | Modelar template visual do PDF comercial | Desenhar o layout estático do PDF gerado pelo app: capa, dados do cliente, resumo técnico, viabilidade financeira e termos — 3 páginas, identidade visual profissional. | 13 | — | Obrigatório | Concluído | Ligado a RNF13 |
| SCRUM-70 (NOVO-6) | Task | Especificar biblioteca/design system de componentes reutilizáveis (botões, inputs, cards) | Criar um conjunto de componentes reutilizáveis no Figma e/ou como componentes de código, pra acelerar a implementação e manter consistência visual. | 8 | — | Desejável | Concluído | — |
| SCRUM-71 (NOVO-7) | Story | Como técnico instalador, quero uma interface tão simples que eu não precise de treinamento, para começar a usar o app no primeiro dia | Validação: um técnico que nunca viu o app completa sozinho o fluxo de medição+proposta usando só o onboarding (Épico 9), sem ajuda externa. | 5* | — | Obrigatório | A fazer | RNF03 |
| SCRUM-72 (NOVO-8) | Task | Teste de usabilidade do protótipo com 2–3 usuários reais (técnico/vendedor) antes de codar as telas | Rodar a sessão de teste usando o protótipo do Figma — pelo menos 1 participante deve ser um técnico de instalação real, não só alguém da equipe. | 5* | — | Desejável | A fazer | Incluir técnico de campo real |
| SCRUM-73 (NOVO-9) | Task | Especificar estados de UI: loading, offline, erro de sincronização, erro de API externa | Especificar visualmente e por escrito cada estado — carregando, offline, erro de sync, erro de API — com tela/mensagem própria, não um spinner genérico. | 5* | 1) Estado "limite freemium atingido"; 2) Estado "permissão de localização negada" | Obrigatório | A fazer | 3 estados de sync já desenhados; faltam 2 |
| REV-2 | Task | Especificar e implementar tela de edição de perfil do Técnico (RF14) | Adicionar botão/tela de "Editar Perfil" onde o técnico atualiza nome, foto e contato — hoje `Perfil.png` é só um hub de configurações sem esse botão visível. | 3* | — | Desejável | Não criado | Confirmar com o time se ficou de fora por decisão consciente |
| REV-6 | Story | Especificar e desenhar a tela "Notificações" referenciada no menu de Perfil | Decidir o conteúdo (alertas de sincronização? novidades do sistema?) antes de detalhar a implementação — hoje sem tela própria no protótipo. | 3* | — | Desejável | Não criado | — |
| REV-7 | Story | Especificar e desenhar a tela "Preferências" referenciada no menu de Perfil | Decidir o escopo (idioma? notificações? tema?) antes de detalhar a implementação — hoje sem tela própria no protótipo. | 3* | — | Desejável | Não criado | — |

---

## EPIC 3 — Medição e Dimensionamento Técnico (Coleta de Dados)

| ID | Tipo | Item | Descrição | SP | Subtasks | Prioridade | Status | Observação |
|---|---|---|---|---|---|---|---|---|
| SCRUM-7 | Story | Como técnico instalador, quero inserir área/inclinação manualmente em "modo leve", para gerar orçamentos em smartphones sem suporte 3D | Formulário simples pra digitar área (m²), inclinação (°) e orientação quando não usar RA. Fluxo alternativo ao SCRUM-5, não o principal. | 5 | — | Obrigatório | A fazer | RF05 |
| SCRUM-8 | Story | Como técnico, quero que o app calcule o HSP automaticamente pela minha localização | Buscar o HSP (Horas de Sol Pleno) pela localização GPS, sem procura manual. Sem internet, usa a base de contingência (SCRUM-17) em vez de travar. | 8 | — | Obrigatório | A fazer | RF07/08 com fallback offline (RN02) |
| SCRUM-9 | Story | Como engenheiro/técnico, quero que o app calcule kWp necessário e perdas do sistema automaticamente | Calcular a potência necessária (kWp) e as perdas a partir do consumo informado, aplicando a fórmula RN01: kWp = Consumo / (HSP × 30 × (1 − Perdas)). | 8 | — | Obrigatório | A fazer | RF07 + fórmula RN01 |
| SCRUM-12 | Task | Implementar lógica matemática de dimensionamento fotovoltaico (client-side) | Implementar 100% no dispositivo (sem chamada de rede) o cálculo de kWp, aplicação de perdas e geração estimada. Precisa rodar em até 3s (RNF01) mesmo em aparelho de entrada. | 8 | 1) Função de cálculo de kWp; 2) Função de cálculo de perdas; 3) Testes unitários da fórmula | Obrigatório | A fazer | — |
| SCRUM-74 (NOVO-10) | Task | Implementar cálculo de perdas do sistema (temperatura, sujeira, cabeamento) como módulo isolado e testável | Extrair o cálculo de perdas pra uma função isolada, testável separadamente, facilitando os testes do Épico 8. | 5 | — | Obrigatório | A fazer | Facilita SCRUM-104/REV-4 |
| SCRUM-75 (NOVO-11) | Task | Implementar seleção/orientação de módulos e inversores compatíveis com o kWp calculado | A partir do kWp, sugerir módulos/inversores compatíveis (potência/tensão) do catálogo, priorizando o "Kit Sugerido" já desenhado no protótipo (`Equipamentos.png`). | 8 | — | Obrigatório | A fazer | — |
| SCRUM-76 (NOVO-12) | Task | Modelar e popular catálogo local de equipamentos (módulos, inversores, estruturas: potência, preço, fabricante) | Modelar a estrutura de dados e popular com itens reais: módulos, inversores, estruturas, string box, cabos e conectores — as 6 categorias confirmadas no protótipo. | 13 | 1) Modelo de dados do catálogo; 2) Seed inicial de equipamentos; 3) Filtros (marca/preço/disponibilidade) | Obrigatório | A fazer | — |
| SCRUM-77 (NOVO-13) | Task | Implementar validação de inputs manuais no modo leve (limites plausíveis de área/inclinação) | Validar valores digitados antes de avançar: inclinação 0–90°, área > 0, orientação dentro das opções válidas, com mensagem de erro clara. | 3 | — | Obrigatório | A fazer | — |
| SCRUM-5 | Story | Como técnico instalador, quero usar a câmera (RA) para medir área/inclinação/orientação do telhado | Fluxo: caminhar ao redor do telhado marcando vértices na tela, o app reconstrói o polígono e calcula as métricas, com fallback claro se o tracking falhar. | 55 | 1) Setup ViroReact/ARKit/ARCore; 2) Captura de vértices do telhado; 3) Cálculo de área/inclinação/orientação a partir da malha; 4) Tratamento de erro de tracking/perda de superfície | Desejável | A fazer | **De volta ao MVP** — maior item do board por larga margem |
| SCRUM-11 | Task | Integrar bibliotecas de RA (ARKit iOS / ARCore Android) | Integração via ViroReact, incluindo config de plugin no Expo Prebuild e builds nativos pras duas plataformas. Base técnica de que SCRUM-5 depende diretamente. | 34 | 1) Config plugin no `app.json` (Expo Prebuild); 2) Build nativo iOS; 3) Build nativo Android | Desejável | A fazer | **De volta ao MVP** — atualizar nota "Postergado V2.0" no Jira |
| SCRUM-78 (NOVO-14) | Task | Implementar fallback automático para "modo leve" quando o dispositivo não suportar RA | Detectar automaticamente dispositivo sem suporte a RA e cair pro formulário manual sem exigir ação do técnico nem travar/dar erro genérico. | 5 | — | Obrigatório | A fazer | Volta a ser fallback de verdade |
| ~~REV-8~~ | ~~Task~~ | ~~Remover/ocultar menção a "modo AR" na tela Medição Manual~~ | — | — | — | Cancelado | — | Com RA de volta, o texto do protótipo já está correto |
| SCRUM-79 (NOVO-15) | Task | Calibração/validação da medição RA contra medida manual conhecida (teste de precisão) | Comparar a RA com uma medida manual conhecida (ex: cômodo de dimensão já sabida) antes de confiar nela em campo real. | 5 | — | Desejável | A fazer | De volta ao MVP |
| SCRUM-27 | Story | Como gestor comercial, quero visualizar simulação de sombreamento (sun path) para validar viabilidade técnica | Ver o sun path do telhado ao longo do dia/ano, pra validar se a posição do sol compromete a geração estimada. | 13 | — | Desejável | A fazer | RF06 |
| SCRUM-80 (NOVO-16) | Task | Implementar cálculo de trajetória solar (sun path) por coordenadas geográficas e data | Calcular a posição do sol ao longo do dia/ano usando um algoritmo padrão de posicionamento solar. | 8 | — | Desejável | A fazer | RF06 |
| SCRUM-81 (NOVO-17) | Task | Renderizar visualização 2D/3D simplificada de sombreamento sobre o telhado medido | Avaliar se um gráfico 2D simplificado já comunica o mesmo valor que uma renderização 3D completa, com bem menos esforço de engenharia. | 13 | — | Desejável | A fazer | Avaliar 2D antes de ir pra 3D completo |
| NOVO-72 | Task | Suportar múltiplas seções de telhado (telhados de duas ou mais águas): somar área total para o kit, mas calcular perdas por orientação separadamente | Quando o telhado tiver mais de uma água (comum no Brasil), somar áreas e calcular perdas de cada seção separadamente, já que orientações diferentes geram perdas diferentes. Hoje o protótipo só suporta 1 seção. | 8* | — | Desejável | Não criado | Reavaliar prioridade — comum no Brasil |
| NOVO-73 | Task | Implementar alerta de espaço insuficiente: comparar área exigida pelo kit dimensionado com a área medida do telhado e avisar o técnico se não couber | Alertar visualmente quando o kit sugerido não cabe na área medida, antes de avançar pra precificação. | 3* | — | Obrigatório | Não criado | Já desenhado no protótipo (`Resumo_Técnico.png`) |
| NOVO-74 | Task | Implementar alerta de superdimensionamento: se a geração estimada exceder o consumo em ~15–20%, avisar que a concessionária pode recusar a homologação (Lei 14.300) | Alertar quando o sistema dimensionado é maior que o necessário, citando o risco de recusa na homologação pela distribuidora. | 3* | — | Obrigatório | Não criado | Já desenhado no protótipo (`Resumo_Técnico.png`) |
| NOVO-75 | Task | Implementar validação de compatibilidade elétrica inversor × módulos (tensão/corrente — string sizing), bloqueando ou alertando sobre combinações incompatíveis | Validar se o inversor é eletricamente compatível com os módulos, bloqueando/alertando combinações incompatíveis. | 8* | — | Obrigatório | Não criado | Depende do campo "Tipo de conexão" (REV-9) |

---

## EPIC 4 — Arquitetura Offline-First & Sincronização

| ID | Tipo | Item | Descrição | SP | Subtasks | Prioridade | Status | Observação |
|---|---|---|---|---|---|---|---|---|
| SCRUM-13 | Story | Como usuário em campo, quero realizar todo o fluxo sem internet, usando banco local pré-carregado | Completar cadastro, medição, cálculo, precificação e PDF sem nenhuma conexão, usando dados pré-carregados no banco local. | 21 | — | Obrigatório | A fazer | RNF02 |
| SCRUM-17 | Task | Script de carga inicial de contingência (dados climáticos e HSP base) | Popular o banco local com HSP médio por região/cidade, usado quando o app não consegue buscar o HSP em tempo real (SCRUM-8). | 13 | — | Obrigatório | A fazer | Alimenta o fallback de SCRUM-8 |
| SCRUM-18 | Task | Rotina de sincronização em background (upload ao detectar rede) | Rotina que roda em background, verifica conectividade e dispara o envio das propostas pendentes assim que detecta rede, sem ação manual do técnico. | 13 | — | Obrigatório | A fazer | RF15/UC09 |
| SCRUM-82 (NOVO-18) | Task | Implementar fila de sincronização persistente (retry com backoff exponencial em falha de rede) | Fila persistente (sobrevive a fechar o app) de propostas aguardando sync, com retry automático e backoff exponencial. | 8 | — | Obrigatório | A fazer | — |
| SCRUM-83 (NOVO-19) | Task | Estratégia de resolução de conflito — last-write-wins por timestamp, com log de auditoria de quem alterou o quê | Quando a mesma proposta é editada em dois lugares, a versão mais recente por timestamp vence, e cada sobrescrita fica em log de auditoria. | 8 | — | Obrigatório | A fazer | — |
| SCRUM-84 (NOVO-20) | Task | Indicador visual de status de sincronização (pendente / sincronizado / erro) na UI | Mostrar por proposta o status de sync e um indicador global no topo mostrando se o app está online ou offline. | 5 | — | Obrigatório | A fazer | Incluir indicador global (`Home_Dashboard.png`) |
| SCRUM-85 (NOVO-21) | Task | Job periódico/rotina de verificação de atualização do banco de contingência quando online | Checar periodicamente (quando online) se a base de HSP/preços está desatualizada, baixando versão nova se houver. | 5 | — | Desejável | A fazer | RF17 |
| SCRUM-86 (NOVO-22) | Task | Testes de integração do fluxo completo offline → reconexão → sincronização | Simular o ciclo completo: propostas offline → reconexão → sync automática → dados corretos no backend, incluindo o cenário de conflito (SCRUM-83). | 8 | — | Obrigatório | A fazer | RNF02 e RNF11 na prática |
| SCRUM-87 (NOVO-23) | Task | Definir e implementar limite de armazenamento local (política de retenção/limpeza de propostas antigas sincronizadas) | Definir quanto espaço em disco o app pode ocupar com propostas antigas, e como avisar/permitir liberar espaço manualmente, sem apagar nada sem avisar. | 3 | — | Desejável | A fazer | Cuidado com RNF14 |
| NOVO-76 | Task | Implementar botão "Forçar sincronização agora" no app (tela de Perfil/Histórico), para o técnico esvaziar a fila manualmente sem depender só do listener automático | Botão manual pra quando o técnico não quiser esperar o retry automático. | 2* | — | Desejável | Não criado | — |
| REV-3 | Task | Implementar validação de máquina de estados da proposta (RN07): bloquear sincronização até que o status seja "Gerada" | Uma proposta só pode ir pra fila de sincronização quando dimensionamento + precificação + PDF estiverem concluídos. | 5* | — | Obrigatório | Não criado | Regra do ERS sem validação ticketada no backlog original |

---

## EPIC 5 — Geração de Propostas Comerciais

| ID | Tipo | Item | Descrição | SP | Subtasks | Prioridade | Status | Observação |
|---|---|---|---|---|---|---|---|---|
| SCRUM-20 | Story | Como vendedor, quero que o app consolide dados técnicos e financeiros em proposta com layout profissional | Montar automaticamente um documento com dados técnicos e financeiros num layout profissional, pronto pra mostrar ao cliente. | 13 | — | Obrigatório | A fazer | RF12/UC07 |
| SCRUM-21 | Story | Como vendedor, quero exportar a proposta em PDF para enviar via WhatsApp/e-mail | Exportar a proposta como PDF e compartilhar direto pelo WhatsApp ou e-mail do celular, sem passos extras. | 8 | — | Obrigatório | A fazer | — |
| SCRUM-22 | Task | Integrar biblioteca de geração de PDF no ambiente mobile | Escolher e integrar uma lib de geração de PDF client-side compatível com Expo Prebuild (ex: `pdf-lib`), gerando o documento direto no dispositivo. | 8 | — | Obrigatório | A fazer | — |
| SCRUM-23 | Task | Desenvolver template visual do relatório técnico e comercial | Implementar em código o template desenhado em SCRUM-46, garantindo que o PDF gerado bate com o protótipo (RNF13). | 5 | — | Obrigatório | A fazer | Ligado a SCRUM-46 |
| REV-1 | Task | Implementar motor de precificação da proposta (RF10/RN03): consolidar equipamentos, materiais, mão de obra, ART/homologação, logística e margem em preço final | Duas camadas: (1) preço unitário por equipamento, com desconto/markup individual dentro de limite definido pelo gestor; (2) preço total = equipamentos + materiais + mão de obra + ART + logística + margem − desconto geral. Alimenta diretamente o payback (SCRUM-24). | 13* | 1) Camada 1 — preço unitário por equipamento (desconto/markup); 2) Camada 2 — total da proposta (soma + margem − desconto geral) | **Obrigatório (alta)** | Não criado | SCRUM-24 depende deste item e vem depois, não em paralelo |
| SCRUM-24 | Task | Implementar lógica de cálculo financeiro (payback, ROI, economia acumulada) | A partir do preço total de REV-1, calcular e exibir payback, ROI e economia acumulada em 25 anos. | 5 | — | Obrigatório | A fazer | Implementa RF11/RN04; depende de REV-1 |
| SCRUM-88 (NOVO-24) | Task | Implementar cálculo de impacto ambiental (CO₂ evitado) exigido no Apêndice A | Calcular o CO₂ que deixa de ser emitido por ano com o sistema dimensionado, exibindo como argumento de venda na proposta. | 3 | — | Obrigatório | A fazer | RF11/RN10 |
| ~~SCRUM-89 (NOVO-25)~~ | ~~Task~~ | ~~Implementar botão de compartilhamento nativo (WhatsApp/e-mail) com o PDF anexado~~ | — | — | — | Consolidar | A fazer | Mesma história que SCRUM-21 — manter só um |
| SCRUM-90 (NOVO-26) | Task | Versionamento de propostas (permitir gerar nova versão da mesma proposta sem perder a anterior) | Quando uma proposta já sincronizada é editada, decidir e implementar se isso cria nova versão ou sobrescreve. | 5 | — | Desejável | A fazer | Ligado a NOVO-80 |
| SCRUM-91 (NOVO-27) | Task | Testes automatizados de renderização do PDF (valores corretos, sem overflow de layout) | Gerar PDFs de exemplo e verificar que o layout não quebra (texto cortado, sobreposição) em Android e iOS. | 5 | — | Obrigatório | A fazer | RNF13 |
| NOVO-78 | Task | Implementar campo editável "Validade da proposta" (dias), estampado no PDF ("Proposta válida até DD/MM/AAAA") | Campo editável que aparece estampado no PDF, informando até quando os preços cotados valem. | 2* | — | Obrigatório | Não criado | Já desenhado no protótipo (`Precificação.png`) |
| NOVO-79 | Task | Implementar "Duplicar proposta" a partir de uma já existente, mantendo dados do cliente e permitindo trocar equipamentos/preços | Ação que gera uma cópia de uma proposta existente, usada como ponto de partida pra uma proposta parecida sem redigitar tudo. | 3* | — | Desejável | Não criado | — |
| NOVO-80 | Story | Como técnico, quero reenviar o PDF de uma proposta já gerada a partir do histórico, para atender pedidos do cliente sem refazer o orçamento | Ação já desenhada (`Histórico.png`); falta esclarecer o que "Editar" faz numa proposta já Sincronizada. | 3* | — | Desejável | Não criado | — |

---

## EPIC 6 — Backend, Interface Web & Gestão Comercial

| ID | Tipo | Item | Descrição | SP | Subtasks | Prioridade | Status | Observação |
|---|---|---|---|---|---|---|---|---|
| SCRUM-29 | Task | Modelar banco de dados relacional em nuvem (PostgreSQL) | Modelar o banco que guarda os dados consolidados de todas as propostas (produto B2B multi-cliente). Decidir isolamento entre empresas: schema separado ou coluna `tenant_id`. | 21 | — | Obrigatório | A fazer | Decisão de multi-tenant é bloqueante |
| SCRUM-30 | Task | Desenvolver API REST (Node.js ou Python) para recebimento de dados sincronizados | Receber as propostas enviadas pelo app durante a sincronização e gravar no banco em nuvem, validando contra o contrato do SCRUM-67. | 13 | — | Obrigatório | A fazer | RF15/RF16 (lado servidor) |
| SCRUM-40 | Task | Documentar API REST (Swagger/OpenAPI): endpoints, payloads, erros | Documentar todos os endpoints, gerando referência que o time mobile consulta sem ler o código do backend. | 13 | — | Obrigatório | A fazer | — |
| SCRUM-31 | Task | Construir front-end web do painel gerencial | Implementar o front-end web cobrindo dashboard, catálogo e editor de proposta previstos nos UC10–UC13. | 13 | — | Obrigatório | A fazer | — |
| SCRUM-26 | Story | Como gestor comercial, quero visualizar dashboard com histórico de propostas e funil de vendas | Dashboard com histórico de propostas e o andamento de cada uma no funil (nova→negociação→aprovada/recusada). | 21 | — | Obrigatório | A fazer | RF21; depende de REV-5 |
| REV-5 | Story | Implementar transição de status da proposta no painel web (Aprovada/Recusada/Em negociação) | Status já aparece no protótipo (`Home_Dashboard.png`) mas nenhum item implementava a mudança de estado; SCRUM-26 e SCRUM-93 dependem disso. | 5* | — | Obrigatório | Não criado | — |
| SCRUM-92 (NOVO-28) | Task | Implementar endpoints de listagem/filtro de propostas por período, vendedor e status | Endpoints pra listar e filtrar propostas, alimentando o dashboard (SCRUM-26). | 8 | — | Obrigatório | A fazer | RF22 |
| SCRUM-93 (NOVO-29) | Task | Implementar cálculo de métricas do funil (taxa de conversão, tempo médio de fechamento) | Calcular métricas agregadas a partir dos dados de status de REV-5. | 8 | — | Desejável | A fazer | Depende de REV-5 |
| SCRUM-28 | Story | Como usuário do modelo freemium, quero acesso limitado às funcionalidades para viabilizar custo de infraestrutura | Regra confirmada: até 10 propostas geradas/exportadas por mês, sem bloquear o resto do app. | 21 | — | Obrigatório | A fazer | RF24/RN05 |
| SCRUM-32 | Task | Estruturar sistema de controle de requisições e limitação de uso (API Gateway/Rate Limiting) | Contagem de propostas geradas no mês por conta, bloqueando geração/exportação quando o limite é atingido, com mensagem clara. | 13 | — | Obrigatório | A fazer | RN05 |
| SCRUM-94 (NOVO-30) | Task | Implementar tela/fluxo de upgrade de plano (free → pago) no painel web | Tela onde o usuário do plano gratuito solicita upgrade — no MVP pode ser só formulário de interesse, sem pagamento real. | 8 | — | Desejável | A fazer | UC13 |
| SCRUM-95 (NOVO-31) | Task | Implementar contagem e exibição de uso restante do plano gratuito para o usuário | Mostrar quantas propostas já foram usadas e quantas restam no mês, evitando surpresa no bloqueio. | 5 | — | Obrigatório | A fazer | Limite confirmado: 10 propostas/mês |
| SCRUM-96 (NOVO-32) | Task | Especificar (documentar, não implementar) pontos de integração futura com ERP/CRM | Documentar onde o Lumini poderia se integrar com ERP/CRM — já fora do escopo do MVP segundo o ERS (1.2). | 3 | — | Desejável | A fazer | — |
| NOVO-81 | Task | Desenvolver tela web "Editor de Proposta": gestor troca equipamento, aplica desconto comercial, recalcula total em tempo real, reabre para o técnico ou aprova e gera novo PDF | Fluxo completo de edição de proposta sincronizada pelo painel, sem depender do técnico refazer no celular. | 8* | — | **Obrigatório** | Não criado | **[REVISÃO]** subiu de Desejável — confirmado no `Lumini_MVP.docx` v1.2; tela já prototipada (`Web_Editor_PropostaWeb.png`) |
| NOVO-82 | Task | Desenvolver formulário web "Adicionar Equipamento ao Catálogo" (categoria, fabricante, modelo, especificações técnicas, fornecedor, preço de custo, margem %, preço de venda auto-calculado, status ativo/oculto) | Formulário completo de cadastro, com preço de venda calculado automaticamente a partir de custo e margem. | 8* | — | Obrigatório | Não criado | RF25. Confirmado no MVP v1.2: catálogo vai por tela web, não só seed |
| NOVO-83 | Task | Implementar edição inline de preço na tabela de catálogo web (duplo clique), registrando "última atualização" e "atualizado por" para auditoria | Editar o preço direto na linha da tabela, sem formulário separado, com trilha de auditoria completa. | 5* | — | Obrigatório | Não criado | RF25 e RNF11 |

---

## EPIC 7 — Segurança & Conformidade de Dados
*Ausente do backlog original, mas citado explicitamente na contribuição de UC "Cibersegurança" do Apêndice A.*

| ID | Tipo | Item | Descrição | SP | Subtasks | Prioridade | Status | Observação |
|---|---|---|---|---|---|---|---|---|
| SCRUM-97 (NOVO-33) | Task | Implementar criptografia do banco local (SQLite/Realm) em repouso | Criptografar o banco local pra que dados pessoais do cliente não fiquem legíveis em texto puro se o celular for perdido/roubado. | 8 | — | Obrigatório | A fazer | RNF05. Risco: dados coletados desde Sprint 1, criptografia só no Sprint 4 |
| SCRUM-98 (NOVO-34) | Task | Implementar autenticação de usuário (login técnico/vendedor/gestor) | Login validando e-mail/senha e devolvendo token JWT válido pra sessão. | 8 | — | Obrigatório | A fazer | RF01/RF20 |
| SCRUM-99 (NOVO-35) | Task | Implementar autorização por papel (RBAC: técnico, vendedor, gestor) na API e no app | Cada endpoint e cada tela verifica se o `role` do usuário logado tem permissão pra aquela ação. | 8 | — | Obrigatório | A fazer | RNF07 |
| SCRUM-100 (NOVO-36) | Task | Implementar HTTPS/TLS obrigatório e validação de certificado na sincronização | Forçar todas as chamadas entre app/painel e API a usarem HTTPS/TLS com validação de certificado. | 5 | — | Obrigatório | A fazer | RNF06 |
| SCRUM-101 (NOVO-37) | Task | Implementar hashing seguro de senha e política de expiração de sessão/token | Senha com hash seguro (bcrypt ou equivalente), nunca texto puro, e expiração de sessão após inatividade. | 5 | — | Obrigatório | A fazer | Complementa RNF06 |
| SCRUM-102 (NOVO-38) | Task | Levantamento de conformidade com a LGPD para dados de clientes coletados (consumo, endereço) | Levantar quais dados pessoais são coletados (Épico 11) e o que a LGPD exige, documentando adequações necessárias. | 5 | — | Obrigatório | A fazer | — |
| SCRUM-103 (NOVO-39) | Task | Log de auditoria de alterações em preços/tarifas (rastreabilidade de quem editou o quê) | Registrar quem alterou, quando, e valor antes/depois, alimentando a trilha de auditoria de NOVO-83. | 3 | — | Desejável | A fazer | — |

---

## EPIC 8 — Qualidade, Testes & CI/CD
*Ausente do backlog original, apesar de "eliminar 100% dos erros de cálculo" ser meta central do produto.*

| ID | Tipo | Item | Descrição | SP | Subtasks | Prioridade | Status | Observação |
|---|---|---|---|---|---|---|---|---|
| SCRUM-104 (NOVO-40) | Task | Escrever testes unitários do motor de cálculo (kWp, HSP, perdas, payback, ROI) | Cobrir todas as fórmulas, incluindo o motor de precificação (REV-1) — casos normais e casos-limite (consumo zero, perdas 100%). | 8 | — | Obrigatório | A fazer | Item mais crítico do épico |
| SCRUM-105 (NOVO-41) | Task | Escrever testes unitários da lógica de sincronização e resolução de conflito | Testar a lógica de sync, incluindo o cenário de conflito (SCRUM-83) com edições concorrentes. | 5 | — | Obrigatório | A fazer | Cobre SCRUM-83 |
| SCRUM-106 (NOVO-42) | Task | Escrever testes de integração API ↔ banco em nuvem | Validar que a API (SCRUM-30) grava e lê corretamente do banco (SCRUM-29), sem mockar o banco. | 5 | — | Obrigatório | A fazer | Cobre SCRUM-29/30 |
| SCRUM-107 (NOVO-43) | Task | Criar matriz de testes manuais de RA em diferentes aparelhos (top/médio/entrada) | Rodar a mesma medição por RA em 3 faixas de aparelho, documentando onde o tracking falha ou fica impreciso. | 5 | — | Desejável | A fazer | De volta ao MVP junto com a RA |
| SCRUM-108 (NOVO-44) | Task | Configurar pipeline de CI (build + testes automatizados a cada PR) | Pipeline que roda build + testes a cada PR, bloqueando merge se algo quebrar. | 5 | — | Obrigatório | A fazer | Depende do CI básico de SCRUM-69 |
| SCRUM-109 (NOVO-45) | Task | Criar plano de testes de aceitação do MVP mapeado aos critérios do Apêndice A | Mapear cada item do Apêndice A pra um teste que comprova a entrega — usado na revisão final (SCRUM-117). | 5 | — | Obrigatório | A fazer | Rastreabilidade crítica pra nota |
| SCRUM-110 (NOVO-46) | Task | Teste de carga básico na API (simulação de picos de sincronização) | Simular múltiplos dispositivos sincronizando ao mesmo tempo, verificando se a API aguenta o pico esperado. | 3 | — | Desejável | A fazer | Risco baixo dado o volume real |
| REV-4 | Task | Escrever teste de desempenho do motor de dimensionamento (RNF01) | Validar que o cálculo (SCRUM-12) roda em até 3s offline em aparelho de entrada — requisito do ERS sem verificação ticketada. | 3* | — | Obrigatório | Não criado | RNF01 sem cenário de verificação |

---

## EPIC 9 — Resiliência a Falhas Externas & Onboarding
*Cobre mitigações de risco descritas no Apêndice A que não viraram tickets.*

| ID | Tipo | Item | Descrição | SP | Subtasks | Prioridade | Status | Observação |
|---|---|---|---|---|---|---|---|---|
| SCRUM-111 (NOVO-47) | Task | Implementar tratamento de falha da API de clima com fallback silencioso para base de contingência | Quando a API externa de clima não responder, cair automaticamente pra base de contingência (SCRUM-17) sem travar nem mostrar erro técnico. | 5 | — | Obrigatório | A fazer | RNF12 + RN02 |
| SCRUM-112 (NOVO-48) | Task | Implementar mensagens de erro amigáveis (sem travar o app) para falhas de API externa | Trocar erros técnicos por mensagens em português claro, explicando o que aconteceu e o que fazer. | 3 | — | Obrigatório | A fazer | Reforço prático de RNF03 |
| SCRUM-113 (NOVO-49) | Story | Como técnico com pouca familiaridade digital, quero um onboarding guiado no primeiro uso, para entender o fluxo sem treinamento | Passo a passo guiado na primeira vez que o técnico abre o app. | 3 | — | Obrigatório | A fazer | RNF03 |
| SCRUM-114 (NOVO-50) | Task | Implementar tela de onboarding (3–4 passos) na primeira execução do app | Tela mostrada automaticamente na primeira execução, acessível de novo pelo menu de Perfil. | 5 | — | Obrigatório | A fazer | Mesma base de RNF03 |
| SCRUM-115 (NOVO-51) | Task | Implementar tooltips/ajuda contextual nos campos técnicos (HSP, kWp, inclinação) | Ícones de ajuda explicando em uma frase o que cada campo técnico significa pra quem não é engenheiro. | 3 | — | Desejável | A fazer | — |

---

## EPIC 10 — Gestão do Projeto & Entrega Final

| ID | Tipo | Item | Descrição | SP | Subtasks | Prioridade | Status | Observação |
|---|---|---|---|---|---|---|---|---|
| SCRUM-48 | Task | Elaborar Relatório Técnico Final (especificações, decisões, resultados) | Consolidar decisões de arquitetura, escopo do MVP, resultados e lições aprendidas — entregável do Checkpoint 3 (03/12). | 8 | — | Obrigatório | A fazer | — |
| SCRUM-49 | Task | Montar apresentação de pitch para banca avaliadora | Apresentação usada na Apresentação Pública (07/12), cobrindo problema, solução e demonstração do MVP. | 8 | — | Obrigatório | A fazer | — |
| SCRUM-50 | Task | Gravar vídeo de demonstração do MVP | Vídeo mostrando o MVP funcionando ponta a ponta — serve de contingência se a demo ao vivo falhar. | 8 | — | Obrigatório | A fazer | — |
| SCRUM-51 | Task | Atualizar e manter backlog no Jira (grooming semanal) | Revisar o board toda semana: fechar itens concluídos, reestimar o que mudou, manter o Jira fiel à realidade do projeto. | 8 | — | Obrigatório | A fazer | Processo contínuo, não entrega pontual |
| SCRUM-116 (NOVO-52) | Task | Checklist de rastreabilidade: cada requisito da ERS ↔ ticket(s) que o implementam | Cruzar cada requisito (RF/RNF/RN) com o(s) ticket(s), usando a matriz RF×UC (ERS 4.3) como ponto de partida. | 5 | — | Desejável | A fazer | — |
| SCRUM-117 (NOVO-53) | Task | Revisão final do escopo entregue vs. tabela Obrigatório/Desejável/Fora do escopo do Apêndice A | Revisar se tudo que o Apêndice A pede como Obrigatório foi entregue e se as classificações deste backlog ainda batem com o documento oficial. | 5 | — | Obrigatório | A fazer | Junto com SCRUM-109 |

---

## EPIC 11 — Cadastro Completo do Cliente e do Local (B2B)
*Campos identificados como ausentes na revisão do protótipo: o app é B2B — o técnico representa a instaladora e o documento final é usado para homologação e contrato, não só para venda.*

> **Ainda não existe como Epic no Jira** — criar antes do Sprint 1 começar.

| ID | Tipo | Item | Descrição | SP | Subtasks | Prioridade | Status | Observação |
|---|---|---|---|---|---|---|---|---|
| NOVO-84 | Task | Expandir formulário "Novo Cliente" com: Número da Instalação (UC/NIS), Modalidade Tarifária (Convencional/Branca), Tipo de Telhado (Cerâmica/Fibrocimento/Laje/Metálico), Amperagem do Disjuntor Principal | UC e tipo de telhado já aparecem no protótipo; modalidade tarifária e disjuntor não foram vistos — confirmar se ficaram de fora por engano. | 8* | — | Obrigatório | Não criado | — |
| NOVO-85 | Task | Adicionar campos de endereço completo (CEP, logradouro, cidade, estado) — obrigatórios tanto para a busca de HSP quanto para constar no PDF | CEP, logradouro, número, bairro, cidade, estado — com preenchimento automático por CEP se possível. | 3* | — | Obrigatório | Não criado | Já implementado no protótipo |
| NOVO-86 | Task | Adicionar campo de contato do cliente (WhatsApp/e-mail) — necessário para o botão de compartilhamento do PDF funcionar | WhatsApp e e-mail, usados depois pra reenviar a proposta (NOVO-80). | 2* | — | Obrigatório | Não criado | Já implementado no protótipo |
| NOVO-87 | Task | Adicionar campo de condição de pagamento (à vista, parcelado, entrada + parcelas), refletido no PDF final | Não aparece no cadastro do cliente no protótipo atual; provavelmente pertence à etapa de Precificação (Épico 5) — confirmar em qual tela deveria estar. | 3* | — | Obrigatório | Não criado | — |
| NOVO-88 | Task | Adicionar campos de distância do telhado ao quadro de carga e necessidade de adequação do quadro — usados no cálculo de custo de material elétrico complementar | Não visto em nenhuma tela do protótipo até agora; provavelmente falta desenhar a tela antes de implementar. | 3* | — | Desejável | Não criado | — |
| REV-9 | Task | Adicionar campo "Tipo de conexão" (Monofásica/Bifásica/Trifásica) ao cadastro do cliente, alimentando a validação de compatibilidade elétrica (NOVO-75) | Já existe desenhado no protótipo (`Novo_Cliente.png`), mas nenhum item cobria o campo. | 2* | — | Obrigatório | Não criado | — |

**Fórmula de dimensionamento confirmada** (referência para SCRUM-12): `kWp = Consumo (kWh) / (HSP × 30 × (1 − Fator de Perdas))`. Validar contra cenário de referência conhecido antes de codar.
**Fórmula de precificação (RN03), usada por REV-1:** `Preço Total = Custo Equipamentos + Materiais Elétricos + Mão de Obra + ART/Homologação + Logística/Frete + Margem − Desconto`.

---

## Distribuição por sprint — com datas oficiais do checkpoint

- **Checkpoint 1 — 17/09/2026** · **Checkpoint 2 — 29/10/2026** · **Checkpoint 3 — 03/12/2026** · **Apresentação pública — 07/12/2026**

- **Sprint 0** (até ~17/09): Épico 1 completo + início do Épico 2 — ✅ Checkpoint 1
- **Sprint 1** (17/09–01/10): Épico 2 (restante) + Épico 3 (modo leve) + Épico 11
- **Sprint 2** (01/10–15/10): Épico 4 (offline-first e sincronização)
- **Sprint 3** (15/10–29/10): Épico 5 (PDF, incluindo REV-1) — ✅ Checkpoint 2, MVP obrigatório fechado
- **Sprint 4** (29/10–12/11): Épico 6 (web/dashboard/freemium/catálogo/editor) + Épico 7 (segurança)
- **Sprint 5** (12/11–26/11): Épico 3 completo — **RA de volta** (89 SP) + sombreamento + Épico 9 — sprint mais pesado do plano
- **Sprint 6** (26/11–**03/12**): Épico 8 (testes/CI) + Épico 10 (entrega) — ⚠️ Checkpoint 3, ~7 dias em vez de 14

**Risco aceito conscientemente:** com a RA de volta ao MVP, o Sprint 5 volta a carregar os 89 SP de SCRUM-5/SCRUM-11, e a decisão da equipe foi manter tudo e aceitar o aperto no Sprint 6, sem cortar sombreamento nem reduzir escopo de RA. Mitigação sem custo de escopo: rodar os testes do motor de RA (SCRUM-104) de forma incremental já no Sprint 5.

**Atualização — Gestão de Catálogo (Web) e Editor de Proposta (Web) de volta ao MVP:** o `Lumini_MVP.docx` (v1.2) confirma que NOVO-81/82/83 (Épico 6, Sprint 4) saem do Roadmap V2.0 — justificativa: telas já prototipadas e apoio de IA para o prazo apertado. Isso não mexe no Sprint 6, mas engorda um pouco o Sprint 4 — vale monitorar se ele também começa a apertar contra o Checkpoint 3.
