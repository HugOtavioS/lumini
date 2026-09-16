**LUMINI** — **DOCUMENTO DE ESCOPO DO MÍNIMO PRODUTO VIÁVEL (MVP)**

Versão 1.4 — Setembro de 2026

# 1. Introdução

## 1.1 Objetivo do Documento

Este documento especifica o escopo técnico e funcional do Mínimo Produto Viável (MVP) do sistema Lumini. Seu objetivo é alinhar a equipe de desenvolvimento, a orientação acadêmica e os avaliadores sobre quais funcionalidades serão codificadas e entregues na primeira versão do software, qual é a classificação de cada uma (Obrigatória ou Desejável) e como o trabalho está distribuído no cronograma oficial do Projeto Integrador Interdisciplinar IV.

## 1.2 Critério de Classificação do Escopo

A demanda original cadastrada pela UNISA TECNOLOGIA na Plataforma SAGA SENAI (Apêndice A) classifica as funcionalidades em dois grupos. A equipe decidiu que **ambos os grupos fazem parte do MVP**. A diferença entre eles não é "dentro" ou "fora" do escopo, e sim o nível de compromisso de entrega:

- **Obrigatório:** item que precisa estar funcionando na entrega. Sem ele, o MVP não atende à demanda ou à avaliação acadêmica.
- **Desejável:** item planejado e com implementação prevista no MVP. Em caso de atraso, ele cede prioridade aos itens obrigatórios, mas não foi retirado do escopo.

| Funcionalidade da demanda | Classificação no MVP | Observação |
|---|---|---|
| Cálculo automatizado de dimensionamento (kWp, HSP, perdas) | Obrigatório | Conforme Apêndice A |
| Geração de proposta em PDF com payback, ROI e impacto ambiental | Obrigatório | Conforme Apêndice A |
| Funcionamento offline com sincronização posterior | Obrigatório | Conforme Apêndice A |
| Interface simples, sem necessidade de treinamento | Obrigatório | Conforme Apêndice A |
| Banco de dados de contingência local | Obrigatório | Conforme Apêndice A |
| Medição de telhado e visualização 3D via Realidade Aumentada | **Obrigatório** | Elevado pela equipe: exigência da unidade curricular de Realidade Aumentada |
| Simulação de sombreamento por trajetória solar (sun path) | Desejável | Implementação prevista no MVP |
| Histórico de propostas com dashboard de funil de vendas | Desejável | O histórico é obrigatório (RF13/RF22); o funil é desejável (RF21) |
| Integração futura com ERP/CRM | Desejável | No MVP, os pontos de integração são especificados e documentados |

## 1.3 Histórico das Decisões de Escopo

- **v1.2:** Realidade Aumentada, Gestão de Catálogo/Preços (Web) e Editor de Propostas (Web) voltaram ao escopo codificado.
- **v1.3:** Simulação de Sombreamento e Sistema Freemium/Upgrade também voltaram ao escopo.
- **Observação (Plano Freemium):** o controle do limite e a exibição do consumo seguem obrigatórios, como na ERS (RF24, RN05); o fluxo de upgrade é desejável.
- **v1.4 (esta versão):** a Realidade Aumentada passa a ser **Obrigatória**, e todos os itens "Desejáveis" são tratados como parte do MVP. Também foram consolidadas as decisões de regras de negócio, papéis de acesso, tecnologia e cronograma registradas no documento *Registro de Decisões de Escopo e Arquitetura*.

A equipe mantém consciente o risco de cronograma decorrente desse escopo ampliado, sem corte compensatório de funcionalidades. As mitigações estão na Seção 6.

# 2. Escopo do MVP

O MVP cobre o fluxo completo do técnico em campo (cadastro, medição, dimensionamento, seleção de equipamentos, precificação, viabilidade e proposta em PDF, mesmo sem internet) e a gestão comercial na interface web. Cada item abaixo indica a classificação **[Obrigatório]** ou **[Desejável]** e os requisitos da ERS relacionados.

## 2.1 Aplicativo Mobile (Técnico)

O aplicativo mobile será desenvolvido em React Native (Expo Prebuild) com estratégia offline-first. Todas as funcionalidades abaixo operam sem conexão, exceto quando indicado.

- **Autenticação [Obrigatório] (RF01):** login com e-mail e senha validado pela API, com sessão em cache para acesso offline após o primeiro login.
- **Nova Instalação e Cadastro do Cliente (B2B) [Obrigatório] (RF02, RF03):** dados do cliente (nome/razão social, CPF/CNPJ, WhatsApp e e-mail) e dados da instalação: endereço completo com CEP, número da instalação (UC/NIS), concessionária, tarifa, modalidade tarifária, tipo de ligação (mono/bi/trifásica), amperagem do disjuntor, consumo médio mensal, tipo de telhado, distância até o quadro e necessidade de adequação do quadro. Um mesmo cliente pode ter mais de uma instalação.
- **Medição do Telhado por Realidade Aumentada [Obrigatório] (RF04, RNF09):** captura de área (m²), inclinação (°) e orientação por ViroReact (ARKit/ARCore) como fluxo principal em dispositivos compatíveis. A calibração da medição contra uma medida manual conhecida faz parte do critério de aceite.
- **Modo Leve [Obrigatório] (RF05, RF19):** formulário manual de área, inclinação e orientação, acionado automaticamente quando o dispositivo não suporta RA ou por escolha do técnico. Garante que o dimensionamento nunca fique bloqueado por limitação de hardware.
- **Motor de Dimensionamento [Obrigatório] (RF07, RF08):** cálculo local de HSP (API de clima com fallback para a base de contingência), perdas (temperatura, sujeira, cabeamento e sombreamento), potência (kWp) e geração estimada. Inclui os alertas de espaço insuficiente no telhado e de superdimensionamento (Lei 14.300).
- **Simulação de Sombreamento (Sun Path) [Desejável] (RF06):** cálculo da trajetória solar a partir das coordenadas e da data, com visualização 2D do sombreamento sobre o telhado medido. O percentual obtido entra como perda no dimensionamento, e o resultado é sincronizado para consulta do gestor na web.
- **Seleção de Equipamentos [Obrigatório] (RF09):** o **técnico escolhe** os equipamentos no catálogo local (módulos, inversores, estruturas, string box, cabos e conectores), com busca e filtros. O app **não sugere kit**. Ele apenas valida a compatibilidade elétrica entre inversor e módulos e alerta ou bloqueia combinações incompatíveis.
- **Ajuste de Preço na Proposta [Obrigatório] (RF18):** o técnico pode ajustar o preço unitário dos equipamentos **somente dentro da proposta**, respeitando o limite percentual definido pelo gestor. O preço do catálogo não é alterado pelo técnico, e todo ajuste fica registrado no log de auditoria.
- **Precificação [Obrigatório] (RF10, RN03):** valor total composto pelos equipamentos, materiais elétricos complementares, mão de obra, engenharia/homologação (ART), logística/frete e margem de lucro, menos o desconto comercial, quando aplicado pelo gestor (fórmula na Seção 4.1).
- **Viabilidade Financeira e Ambiental [Obrigatório] (RF11):** economia mensal, payback, ROI, economia acumulada em 25 anos e CO₂ evitado.
- **Proposta em PDF [Obrigatório] (RF12):** documento de 3 páginas com identidade visual padronizada, validade da proposta e condição de pagamento, gerado no dispositivo e compartilhado por WhatsApp ou e-mail.
- **Histórico de Propostas [Obrigatório] (RF13, RF16):** consulta offline com status da proposta, status de sincronização, reenvio do PDF e opção de forçar a sincronização.
- **Indicador de Uso do Plano [Obrigatório] (RF24):** exibe quantas das **25 propostas mensais da empresa** já foram usadas, com alerta a partir de 80% do limite.
- **Solicitação de Upgrade ao Gestor [Desejável] (RF28):** tela em que o técnico pede ao gestor da empresa um upgrade de plano. O técnico **não** contrata planos.
- **Onboarding e Ajuda Contextual [Obrigatório] (RNF03):** guia de 3 a 4 passos no primeiro uso e dicas nos campos técnicos.
- **Perfil do Técnico [Desejável] (RF14):** visualização e edição de dados básicos (telefone, foto).
- **Banco Local SQLite Criptografado [Obrigatório] (RNF05, RNF14):** persistência de todos os dados de campo, com criptografia em repouso (SQLCipher).

## 2.2 Backend e Sincronização

- **API REST de Sincronização em Node.js/NestJS [Obrigatório] (RNF06, RNF10):** nesta fase, a API apenas autentica (JWT com refresh token), aplica o controle de acesso (RBAC e isolamento por empresa) e sincroniza e persiste os dados de app e web (propostas, catálogo, plano, solicitações de upgrade e usuários).
- **Banco Central PostgreSQL no Amazon RDS [Obrigatório]:** fonte de verdade de empresas, usuários, clientes, instalações, propostas, catálogo, assinaturas e logs.
- **Sincronização Pull + Push [Obrigatório] (RF15):** no login ou na atualização de sessão, o app baixa catálogo, preços, parâmetros técnicos e contador do plano (pull). Ao reconectar, envia a fila de operações pendentes, com retentativa e backoff exponencial (push). A atualização manual do catálogo pelo técnico (RF17) é **Desejável**.
- **Regra de Envio (RN07) [Obrigatório]:** só entram na fila propostas com status "Gerada" ou posterior.
- **Controle do Plano Freemium [Obrigatório] (RN05, RF24):** limite de **25 propostas por mês por empresa**, contadas quando a proposta passa a "Gerada". A API revalida o limite na sincronização.
- **Cálculo Somente nos Clientes [Obrigatório]:** a API não executa cálculos. Dimensionamento, precificação e viabilidade são calculados no dispositivo (e, no editor, no navegador do gestor), preservando o offline-first.
- **Especificação dos Pontos de Integração ERP/CRM [Desejável]:** documentação dos endpoints e eventos que uma integração futura consumiria, sem implementação de conectores.

## 2.3 Interface Web (Gestão Comercial)

- **Login do Gestor Comercial [Obrigatório] (RF20).**
- **Listagem e Detalhamento de Propostas [Obrigatório] (RF22, RF23):** filtros por técnico, status, período e cliente. O detalhe mostra o resumo técnico, a **simulação de sombreamento obtida pelo técnico**, a precificação, a viabilidade, o PDF e o histórico de alterações de preço.
- **Editor de Propostas e Mudança de Status [Obrigatório] (RF27):** o gestor troca equipamentos, aplica desconto comercial e recalcula o total em tempo real. Depois, reabre a proposta para o técnico ou gera nova versão do PDF, e move a proposta entre "Em negociação", "Aprovada" e "Recusada".
- **Dashboard com Funil de Vendas e Indicadores [Desejável] (RF21):** propostas por etapa do funil, valor em negociação, taxa de conversão e filtro por técnico.
- **Relatórios Analíticos [Desejável] (RF26):** taxa de fechamento, tempo médio de elaboração e propostas por técnico.
- **Gestão de Catálogo [Obrigatório] (RF25):** cadastro de equipamentos exclusivo do gestor (categoria, fabricante, modelo, especificações elétricas, fornecedor, preço de custo, margem e preço de venda calculado), edição inline de preço e inativação, com log de auditoria.
- **Plano e Assinatura [Obrigatório] (RF24):** plano vigente e consumo do limite mensal da empresa.
- **Upgrade de Plano [Desejável] (RF24, RF28):** o gestor vê as solicitações enviadas pelos técnicos e **realiza o upgrade** nesta tela. A cobrança é simulada no MVP (não há gateway de pagamento).
- **Gestão de Usuários da Empresa [Desejável] (RF29):** o gestor cadastra, edita e inativa os usuários da empresa e configura os parâmetros comerciais. Enquanto a tela não estiver pronta, os usuários iniciais são criados por script de carga.

# 3. Limites do Escopo

Nenhuma funcionalidade listada na demanda original foi postergada: todas as funcionalidades do Apêndice A integram o MVP, como obrigatórias ou desejáveis (Tabela 1). Permanecem fora do produto nesta fase apenas os itens já excluídos pela ERS (Seção 1.2) e um limite de implementação:

- integração automática com sistemas de homologação das concessionárias;
- módulo completo de gestão financeira da instaladora;
- marketplace de fornecedores dentro do aplicativo;
- suporte a outras fontes de energia renovável;
- processamento real de pagamento no upgrade de plano. O fluxo de upgrade existe, mas a cobrança é simulada.

# 4. Arquitetura e Tecnologias Aplicadas no MVP

A base arquitetural segue o padrão client-server com estratégia offline-first. Os detalhes estão no Documento de Arquitetura de Software (DAS) v1.2.

| Componente | Tecnologia ou decisão |
|---|---|
| Linguagem | TypeScript em todas as frentes (mobile, web e API), com pacote de cálculo compartilhado entre app e web |
| Frontend Mobile | React Native com Expo Prebuild (necessário para o ViroReact/RA) |
| Realidade Aumentada | ViroReact (ARKit/ARCore), com Modo Leve como fallback |
| Banco Local | SQLite com criptografia SQLCipher, migrações versionadas e seed de catálogo e HSP |
| Backend / API | Node.js com NestJS (API REST), restrita a sincronização e persistência |
| Banco Central | PostgreSQL no Amazon RDS, multi-tenant por coluna `id_empresa` |
| Autenticação | JWT com refresh token, contendo usuário, empresa e papel |
| Papéis (RBAC) | Técnico e Gestor Comercial. O cliente final é ator externo. |
| Sincronização | Pull no login/refresh e push na reconexão, com fila persistente |
| Geração de PDF | Biblioteca client-side (ex.: pdf-lib) com template compartilhado entre app e web |
| Interface Web | Aplicação SPA consumindo a mesma API (framework a definir — tarefa NOVO-101) |

## 4.1 Regra de Precificação (RN03)

```
Equipamentos = Σ (preço unitário na proposta × quantidade)
Serviços     = materiais elétricos + mão de obra + ART + frete
Margem       = Serviços × margem %
Valor total  = Equipamentos + Serviços + Margem − Desconto comercial
```

O preço unitário de cada equipamento parte do preço de venda do catálogo, que já inclui a margem do item. O técnico pode ajustá-lo dentro do limite da empresa. A margem de lucro da proposta incide sobre os serviços e materiais, evitando margem em duplicidade sobre os equipamentos. O desconto comercial é aplicado apenas pelo gestor, no editor web.

# 5. Cronograma e Distribuição de Tarefas

## 5.1 Sprints Oficiais do Projeto Integrador

| Sprint oficial | Data | Entregas | Situação |
|---|---|---|---|
| Sprint 1 | 17/09/2026 | ERS, pesquisa de anterioridade, escopo, diagramas, arquitetura, protótipo e backlog | Entregue |
| Sprint 2 | 29/10/2026 | Fluxo principal integrado e funcional, com persistência, interface, regras de negócio e evidências iniciais | Em andamento |
| Sprint 3 | 03/12/2026 | MVP estável, documentação final, testes, manuais, implantação e preparação da Mostra | Planejada |
| Apresentação Pública | 07/12/2026 | Apresentação pública e demonstração da solução | Planejada |

## 5.2 Sprints Internas

Entre as sprints oficiais, a equipe trabalha em sprints internas de duas semanas no Jira. O resultado final é o mesmo das sprints oficiais.

| Sprint interna | Período | Foco (épicos do backlog) | Sprint oficial |
|---|---|---|---|
| Sprint 0 | até 17/09 | Épico 1 — Fundação técnica e documentação | Sprint 1 |
| Sprint 1 | 17/09 – 01/10 | Épico 2 (restante), Épico 3 (Modo Leve e cálculo), Épico 11 (cadastro B2B) | Sprint 2 |
| Sprint 2 | 01/10 – 15/10 | Épico 4 — Offline-first e sincronização | Sprint 2 |
| Sprint 3 | 15/10 – 29/10 | Épico 5 — Precificação, viabilidade e PDF | Sprint 2 |
| Sprint 4 | 29/10 – 12/11 | Épico 6 (web, catálogo, editor, funil, plano) e Épico 7 (segurança) | Sprint 3 |
| Sprint 5 | 12/11 – 26/11 | Épico 3 completo (Realidade Aumentada e sombreamento) e Épico 9 | Sprint 3 |
| Sprint 6 | 26/11 – 03/12 | Épico 8 (testes/CI) e Épico 10 (entrega) | Sprint 3 |

## 5.3 Distribuição de Tarefas — Sprint Interna 1 (17/09 a 01/10)

- **Hugo Otávio (Mobile/UI):** telas Login, Home, Novo Cliente completo (campos do Épico 11) e Medição Manual; estados de interface (offline, erro de sincronização, limite do plano); estrutura de pastas do projeto mobile; ajuste da tela de Equipamentos sem "Kit Sugerido" (NOVO-109).
- **Misael Bonifácio (Dados/Backend):** esquema do banco local SQLite com migrações e criptografia; modelo de Cliente e Instalação do Épico 11; seed de HSP (contingência) e do catálogo de equipamentos; formalização da stack de backend (SCRUM-397); escolha da API de clima (NOVO-103).
- **Pedro Gabriel (Lógica/Cálculo):** motor de dimensionamento (kWp, perdas e geração) como pacote de domínio testável; validação dos campos do Modo Leve; busca de HSP com fallback; testes unitários das fórmulas; configuração do pacote de cálculo compartilhado (NOVO-107).
- **Equipe:** conclusão da configuração do repositório Git e do CI básico (SCRUM-69) e atualização dos diagramas (NOVO-108).

> A API NestJS, a sincronização e o PDF não fazem parte da Sprint Interna 1. Eles estão planejados, respectivamente, para as Sprints Internas 4, 2 e 3, e a integração do ViroReact (RA) para a Sprint Interna 5, conforme o backlog.

# 6. Riscos de Cronograma e Mitigações

| Risco | Mitigação |
|---|---|
| Sprint Interna 5 concentra a RA (maior esforço do backlog) e agora é obrigatória | Prova de conceito do ViroReact já na Sprint Interna 1 (build nativo com cena vazia); Modo Leve pronto desde o início como fallback |
| Sprint Interna 6 tem cerca de 7 dias antes do Checkpoint 3 | Testes do motor de cálculo e da RA escritos de forma incremental desde a Sprint Interna 1 |
| Sprint Interna 4 acumula catálogo, editor, funil, plano e segurança | Itens obrigatórios primeiro (catálogo, editor, listagem); funil e relatórios desejáveis ao final |
| Divergência de cálculo entre app e web | Pacote de domínio único em TypeScript, com casos de referência compartilhados; a API não calcula |

# 7. Considerações Finais

O escopo aqui estabelecido entrega o núcleo da dor do cliente (cálculo técnico rápido, padronizado e confiável e propostas profissionais geradas offline) e incorpora todas as funcionalidades da demanda original. A distinção entre itens obrigatórios e desejáveis orienta a ordem de execução sem retirar nenhum item do MVP. A Realidade Aumentada é tratada como obrigatória por exigência acadêmica.

A demonstração final apresentará em código a arquitetura offline-first, a medição por Realidade Aumentada, o motor de dimensionamento e precificação, a geração do PDF e a gestão comercial na web (catálogo, editor de propostas, funil, sombreamento e plano de assinatura).
