**LUMINI** — **LISTA PRIORIZADA DE REQUISITOS FUNCIONAIS, REQUISITOS NÃO FUNCIONAIS E REGRAS DE NEGÓCIO**

Versão 1.1 — Setembro de 2026

# 1. Introdução e Critério de Priorização

Este documento consolida, em ordem de prioridade, os requisitos funcionais (RF01–RF29), os requisitos não funcionais (RNF01–RNF14) e as regras de negócio (RN01–RN11) do sistema Lumini.

Nesta versão, a classificação dos requisitos funcionais segue a decisão da equipe registrada no Documento de Escopo do MVP v1.4: **Obrigatório** e **Desejável** fazem parte do MVP.

- **Obrigatório (MVP):** precisa estar funcionando na entrega.
- **Desejável (MVP):** tem implementação prevista no MVP, mas cede prioridade aos obrigatórios em caso de atraso.

Os requisitos não funcionais e as regras de negócio seguem três níveis, definidos pelo impacto sobre o fluxo principal (cadastro, medição, dimensionamento, precificação, viabilidade, proposta em PDF e sincronização):

- **Essencial (MVP):** sua ausência impede a conclusão ou a confiabilidade do fluxo principal.
- **Importante (MVP):** não impede o fluxo principal, mas afeta qualidade, manutenção ou adoção.
- **Desejável (MVP):** agrega valor e será incorporado de forma incremental.

**Resumo quantitativo:**

- Requisitos funcionais: 22 Obrigatórios e 7 Desejáveis.
- Requisitos não funcionais: 9 Essenciais, 3 Importantes e 2 Desejáveis.
- Regras de negócio: 9 Essenciais e 2 Importantes.

A descrição completa de cada requisito está na *Especificação Textual de Fluxos dos Requisitos Funcionais e Cenários de Verificação dos Requisitos Não Funcionais* v1.1.

## 1.1 Alterações desta Versão (v1.1)

- **RF04 (Realidade Aumentada):** passa a Obrigatório, por exigência da unidade curricular de Realidade Aumentada. Com isso, **RNF09** passa a Essencial.
- **RF06, RF14, RF17, RF21 e RF26:** permanecem Desejáveis, agora como parte do MVP.
- **RF09:** o técnico escolhe os equipamentos; o sistema não sugere kit.
- **RF18 e RN06:** o técnico ajusta o preço somente dentro da proposta; o catálogo é editado apenas pelo gestor.
- **Novos requisitos:** RF27 (Editor de Propostas Web), RF28 (Solicitar Upgrade ao Gestor), RF29 (Gerenciar Usuários) e RN11 (edição por status).
- **RN05:** limite de 25 propostas por mês por empresa.
- **RN10:** passa a Essencial, pois o impacto ambiental é obrigatório na demanda.
- **RNF03:** passa a Essencial, pois a interface sem treinamento é obrigatória na demanda.
- **Papéis:** Técnico e Gestor Comercial; o gestor também gerencia os usuários (RF29).

# 2. Lista Priorizada de Requisitos Funcionais

Requisitos ordenados por prioridade e, dentro de cada nível, pela ordem natural do fluxo do produto.

| Prioridade | ID | Requisito Funcional | Ator | Principal Dependência |
|---|---|---|---|---|
| **Obrigatório (MVP)** | **RF01** | Efetuar Login do Técnico | Técnico / Sistema | Nenhuma |
| **Obrigatório (MVP)** | **RF02** | Iniciar Nova Instalação Vinculada a um Cliente | Técnico | RF01 |
| **Obrigatório (MVP)** | **RF03** | Cadastrar Dados do Cliente e da Instalação | Técnico | RF02 |
| **Obrigatório (MVP)** | **RF04** | Medir Telhado via Realidade Aumentada | Técnico | RF03; RNF09 |
| **Obrigatório (MVP)** | **RF05** | Inserir Medições do Telhado Manualmente (Modo Leve) | Técnico | RF03; RN09 |
| **Obrigatório (MVP)** | **RF07** | Calcular Dimensionamento Técnico | Sistema | RF03, RF04/RF05, RF08; RN01 |
| **Obrigatório (MVP)** | **RF08** | Obter Dados Climáticos com Fallback para Contingência | Sistema | RF03 |
| **Obrigatório (MVP)** | **RF09** | Selecionar Equipamentos Compatíveis | Técnico | RF07 |
| **Obrigatório (MVP)** | **RF10** | Calcular Precificação da Proposta | Sistema | RF09, RF18; RN03 |
| **Obrigatório (MVP)** | **RF11** | Calcular Payback, ROI e Impacto Ambiental | Sistema | RF10; RN04, RN10 |
| **Obrigatório (MVP)** | **RF12** | Gerar Proposta Comercial em PDF | Técnico | RF07, RF09–RF11; RN05, RN07 |
| **Obrigatório (MVP)** | **RF13** | Manter Histórico de Propostas (Consulta Offline) | Técnico | RF12, RF15, RF16 |
| **Obrigatório (MVP)** | **RF15** | Operar em Modo Offline-First com Sincronização | Sistema | Base para RF13, RF16, RF17 |
| **Obrigatório (MVP)** | **RF16** | Exibir Status de Sincronização | Sistema / Técnico | RF15 |
| **Obrigatório (MVP)** | **RF18** | Ajustar o Preço de um Equipamento na Proposta | Técnico | RF09; RN06 |
| **Obrigatório (MVP)** | **RF19** | Oferecer "Modo Leve" | Técnico / Sistema | RF04, RF05; RN09 |
| **Obrigatório (MVP)** | **RF20** | Efetuar Login do Gestor Comercial (Web) | Gestor Comercial | Nenhuma |
| **Obrigatório (MVP)** | **RF22** | Listar e Filtrar Propostas | Gestor Comercial | RF15, RF20 |
| **Obrigatório (MVP)** | **RF23** | Visualizar Detalhamento Técnico e Comercial da Proposta | Gestor Comercial | RF22 |
| **Obrigatório (MVP)** | **RF24** | Acompanhar Plano de Assinatura e Limite Mensal | Gestor Comercial | RF20; RN05 |
| **Obrigatório (MVP)** | **RF25** | Gerenciar Catálogo de Equipamentos | Gestor Comercial | RF20 |
| **Obrigatório (MVP)** | **RF27** | Editar Proposta e Atualizar Status (Web) | Gestor Comercial | RF23; RN03, RN11 |
| **Desejável (MVP)** | **RF06** | Simular Sombreamento (Sun Path) | Sistema; Técnico; Gestor (consulta) | RF04/RF05; RF08 |
| **Desejável (MVP)** | **RF14** | Visualizar e Editar Perfil do Técnico | Técnico | RF01, RF15 |
| **Desejável (MVP)** | **RF17** | Baixar Catálogo/Tabela de Preços Atualizada (manual) | Técnico / Sistema | RF15 |
| **Desejável (MVP)** | **RF21** | Exibir Dashboard com Funil de Vendas e Indicadores | Gestor Comercial | RF22, RF27 |
| **Desejável (MVP)** | **RF26** | Gerar Relatórios e Indicadores Analíticos | Gestor Comercial | RF21, RF22 |
| **Desejável (MVP)** | **RF28** | Solicitar Upgrade de Plano ao Gestor | Técnico | RF24 |
| **Desejável (MVP)** | **RF29** | Gerenciar Usuários da Empresa | Gestor Comercial | RF20 |

> O download automático do catálogo no login (pull) é parte do RF15 e, portanto, obrigatório. O RF17 trata apenas da atualização manual solicitada pelo técnico.

# 3. Lista Priorizada de Requisitos Não Funcionais

| Prioridade | ID | Categoria | Requisito (resumo) | Justificativa |
|---|---|---|---|---|
| **Essencial (MVP)** | **RNF01** | Desempenho | Cálculo de dimensionamento em até 3 segundos no dispositivo, sem internet. | *Percebido diretamente pelo técnico no fluxo principal.* |
| **Essencial (MVP)** | **RNF02** | Confiabilidade | App 100% funcional offline (exceto clima em tempo real), com base de contingência. | *Condição de existência do produto (offline-first).* |
| **Essencial (MVP)** | **RNF03** | Usabilidade | Interface sem treinamento formal, com onboarding no primeiro acesso. | *Item obrigatório da demanda (Apêndice A).* |
| **Essencial (MVP)** | **RNF04** | Portabilidade | App multiplataforma (Android e iOS) em React Native. | *Decisão de base que condiciona todo o desenvolvimento mobile.* |
| **Essencial (MVP)** | **RNF05** | Segurança | Dados sensíveis locais (SQLite) criptografados em repouso (SQLCipher). | *Protege dados pessoais do cliente no dispositivo.* |
| **Essencial (MVP)** | **RNF06** | Segurança | Comunicação com a API autenticada (JWT) e criptografada (HTTPS/TLS). | *Pré-requisito de qualquer sincronização.* |
| **Essencial (MVP)** | **RNF07** | Segurança | Acesso conforme o perfil (Técnico ou Gestor Comercial) e a empresa. | *Isolamento entre empresas e entre perfis.* |
| **Essencial (MVP)** | **RNF09** | Compatibilidade | RA com ARKit (iOS) e ARCore (Android) via ViroReact. | *A RA (RF04) é obrigatória no MVP.* |
| **Essencial (MVP)** | **RNF12** | Resiliência | Falhas na API de clima não travam o app nem impedem a proposta. | *Sem isso, o fluxo offline-first fica comprometido.* |
| **Importante (MVP)** | **RNF10** | Manutenibilidade | Backend evolui de forma independente do mobile e da web. | *Facilita a evolução, mas não é visível na demonstração.* |
| **Importante (MVP)** | **RNF11** | Auditabilidade | Toda tentativa de sincronização registrada em log. | *Suporta a confiabilidade da sincronização.* |
| **Importante (MVP)** | **RNF14** | Armazenamento | Propostas offline limitadas apenas pelo armazenamento do dispositivo. | *Relevante para uso prolongado em campo.* |
| **Desejável (MVP)** | **RNF08** | Escalabilidade / Custo | Nuvem suporta crescimento de empresas respeitando o teto do plano Freemium. | *Relevante quando a base de clientes crescer.* |
| **Desejável (MVP)** | **RNF13** | Padronização Visual | PDF com identidade visual consistente entre plataformas. | *Refinamento visual; o template único já reduz o risco.* |

# 4. Lista Priorizada de Regras de Negócio

| Prioridade | ID | Regra de Negócio (resumo) | Justificativa |
|---|---|---|---|
| **Essencial (MVP)** | **RN01** | A potência (kWp) é calculada a partir do consumo mensal, do HSP médio da localidade e das perdas do sistema (temperatura, sujeira, cabeamento e sombreamento). | *Regra central do dimensionamento (RF07).* |
| **Essencial (MVP)** | **RN02** | Com a API de clima indisponível, o sistema usa automaticamente a base de contingência local, sem interromper o cálculo. | *Garante o offline-first (RNF02/RNF12).* |
| **Essencial (MVP)** | **RN03** | O valor total da proposta é a soma dos equipamentos, materiais elétricos complementares, mão de obra, ART/homologação, logística/frete e margem de lucro, menos o desconto comercial aplicado pelo gestor. A margem incide sobre serviços e materiais, pois o preço de venda do equipamento já inclui sua margem. | *Base da precificação (RF10).* |
| **Essencial (MVP)** | **RN04** | O payback é calculado a partir do valor total e da economia mensal estimada (tarifa × geração prevista). | *Resultado comercial exigido na proposta (RF11/RF12).* |
| **Essencial (MVP)** | **RN07** | Uma proposta só é sincronizada quando o status é "Gerada" ou posterior. | *Integridade dos dados no painel web.* |
| **Essencial (MVP)** | **RN08** | Cada proposta pertence a um único técnico responsável. | *Rastreabilidade comercial, indicadores e isolamento.* |
| **Essencial (MVP)** | **RN09** | O modo leve desativa a RA, mas mantém obrigatória a coleta manual de área, inclinação e orientação. | *Garante o fluxo em dispositivos sem RA.* |
| **Essencial (MVP)** | **RN10** | O impacto ambiental (CO₂ evitado) é estimado a partir da geração e de fatores de emissão de referência. | *Item obrigatório da demanda (PDF com impacto ambiental).* |
| **Essencial (MVP)** | **RN11** | Cada status da proposta define quem pode editá-la: técnico em "Em elaboração" e "Reaberta"; gestor em "Gerada" e "Em negociação"; ninguém em "Aprovada" e "Recusada". | *Evita conflitos de edição entre mobile e web.* |
| **Importante (MVP)** | **RN05** | Empresas no plano Freemium podem gerar até 25 propostas por mês (contadas na primeira passagem para "Gerada"). Ao atingir o limite, novas gerações são bloqueadas e o upgrade é sinalizado. Somente o gestor realiza o upgrade. | *Sustenta o modelo Freemium (RF24).* |
| **Importante (MVP)** | **RN06** | O técnico pode ajustar o preço unitário de um equipamento apenas dentro da proposta, até o limite percentual definido pela empresa. O ajuste é registrado em log e não altera o catálogo, que é mantido somente pelo gestor. | *Mitiga preços desatualizados sem perder o controle do catálogo (RF18).* |

# 5. Considerações Finais

Esta priorização orienta a decomposição do backlog das Sprints oficiais 2 e 3. Os itens Obrigatórios e Essenciais são implementados primeiro para viabilizar o fluxo principal de ponta a ponta. Os Importantes e Desejáveis também fazem parte do MVP e são incorporados de forma incremental, seguindo o princípio de escopo do Roteiro do Projeto Integrador: "uma solução menor, funcional, testada e bem documentada é superior a uma proposta extensa que não conclua o fluxo principal". A priorização é revisada a cada sprint.
