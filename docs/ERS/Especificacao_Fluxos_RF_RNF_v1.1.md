**LUMINI** — **ESPECIFICAÇÃO TEXTUAL DE FLUXOS DOS REQUISITOS FUNCIONAIS E CENÁRIOS DE VERIFICAÇÃO DOS REQUISITOS NÃO FUNCIONAIS**

Versão 1.1 — Setembro de 2026

# 1. Introdução

Este documento complementa a Especificação de Requisitos de Software (ERS) do sistema Lumini com a especificação textual dos fluxos, subfluxos, alternativas e exceções de todos os requisitos funcionais (RF01 a RF29) e com os cenários de verificação de todos os requisitos não funcionais (RNF01 a RNF14). As prioridades seguem a *Lista Priorizada de RF, RNF e RN* v1.1; as regras de negócio e os elementos de arquitetura seguem o Documento de Arquitetura de Software (DAS) v1.2 e o Documento de Escopo do MVP v1.4.

Cada requisito funcional traz objetivo, ator, prioridade, gatilho, pré-condições, fluxo principal numerado, subfluxos, fluxos alternativos e exceções, e dependências. Cada requisito não funcional traz componente afetado, ambiente, procedimento de verificação, métrica, resultado esperado e evidência a coletar.

## 1.1 Alterações desta Versão (v1.1)

- **Prioridades:** "Desejável" passa a significar implementação prevista no MVP, sem compromisso obrigatório de entrega; o RF04 (Realidade Aumentada) passa a Obrigatório.
- **RF03:** inclui os campos B2B do cliente e da instalação.
- **RF09:** o técnico escolhe os equipamentos, sem sugestão automática de kit.
- **RF18:** passa a tratar do ajuste de preço **na proposta**.
- **RF24:** o limite do plano é de 25 propostas por mês por empresa, e o upgrade é feito pelo gestor.
- **Status:** o status comercial da proposta e o status de sincronização passam a ser campos separados.
- **Novos requisitos:** RF27, RF28 e RF29.
- **Tecnologia:** banco local SQLite; papéis Técnico e Gestor Comercial (sem papel de Administrador; o gestor gerencia os usuários).

## 1.2 Status Utilizados

- **Status da proposta:** Em elaboração, Gerada, Em negociação, Reaberta, Aprovada e Recusada.
- **Status de sincronização (somente no dispositivo):** Pendente, Sincronizado e Erro.

# 2. Especificação Textual dos Requisitos Funcionais

### RF01 — Efetuar Login do Técnico

**Objetivo e Descrição:** permitir que o técnico se autentique no aplicativo mobile com e-mail e senha, com acesso seguro e individualizado.

**Ator:** Técnico; Sistema (validação das credenciais).

**Prioridade:** Obrigatório — MVP.

**Gatilho:** o técnico abre o aplicativo sem sessão ativa.

**Pré-condições:** técnico cadastrado pelo Gestor Comercial da empresa (RF29) ou por script de carga; aplicativo instalado.

***Fluxo Principal***

1. Sistema exibe a tela de login com e-mail e senha.
2. Técnico informa as credenciais.
3. Técnico confirma ("Entrar").
4. Sistema valida as credenciais pela API (online) ou pela sessão em cache (offline).
5. Sistema obtém o token de acesso (JWT) e o refresh token e executa o pull de dados (RF15).
6. Sistema abre a tela inicial (Home Dashboard).

***Subfluxos***

- 3.1. "Lembrar-me": o sistema guarda a sessão criptografada para reautenticação automática enquanto o token for válido.

***Fluxos Alternativos e Exceções***

- 2a. Campos vazios: o sistema exibe validação e não envia o formulário.
- 4a. Credenciais inválidas: mensagem "e-mail ou senha incorretos".
- 4b. Offline sem sessão em cache: o sistema informa que o primeiro login exige conexão.
- 4c. Conta inativa ou perfil sem acesso ao mobile (Gestor Comercial): mensagem específica orientando o uso da interface web ou o contato com o gestor.

**Dependências:** nenhuma. Origem: UC01; DAS 3.2; RNF06.

### RF02 — Iniciar Nova Instalação Vinculada a um Cliente

**Objetivo e Descrição:** permitir que o técnico inicie um orçamento criando uma instalação vinculada a um cliente novo ou existente.

**Ator:** Técnico. **Prioridade:** Obrigatório — MVP.

**Gatilho:** técnico seleciona "Nova Instalação" na Home. **Pré-condições:** técnico autenticado (RF01).

***Fluxo Principal***

1. Técnico seleciona "Nova Instalação".
2. Sistema pergunta se o cliente é novo ou já cadastrado.
3. Sistema cria a instalação e uma proposta com status "Em elaboração", vinculadas ao técnico autenticado (RN08).
4. Sistema exibe o formulário de cadastro (RF03).

***Subfluxos***

- 3.1. Instalação e proposta recebem UUID gerado no dispositivo, permitindo retomar o trabalho sem perda.

***Fluxos Alternativos e Exceções***

- 1a. Existe proposta "Em elaboração" não finalizada: o sistema pergunta se o técnico deseja retomá-la ou iniciar outra.

**Dependências:** RF01. Origem: UC02.

### RF03 — Cadastrar Dados do Cliente e da Instalação

**Objetivo e Descrição:** coletar os dados do cliente e da instalação necessários ao dimensionamento, à precificação, ao PDF e à homologação.

**Ator:** Técnico. **Prioridade:** Obrigatório — MVP.

**Gatilho:** avanço a partir do RF02. **Pré-condições:** instalação criada (RF02).

***Fluxo Principal***

1. Sistema exibe o formulário do cliente: tipo de pessoa, nome/razão social, CPF/CNPJ, WhatsApp e e-mail.
2. Sistema exibe o formulário da instalação: CEP e endereço completo, número da instalação (UC/NIS), concessionária, tarifa, modalidade tarifária, tipo de ligação (mono/bi/trifásica), amperagem do disjuntor, consumo médio mensal (kWh), tipo de telhado, distância até o quadro e necessidade de adequação do quadro.
3. Técnico preenche os campos e confirma ("Avançar").
4. Sistema valida os dados.
5. Sistema salva localmente (RF15) e avança para a medição (RF04/RF05).

***Subfluxos***

- 2.1. O sistema sugere a tarifa da concessionária selecionada (cache local), editável pelo técnico.
- 2.2. O sistema preenche o endereço a partir do CEP quando houver conexão e registra as coordenadas GPS do dispositivo.

***Fluxos Alternativos e Exceções***

- 4a. Consumo ≤ 0 ou não numérico: validação e formulário mantido aberto.
- 4b. Campos obrigatórios vazios ou CPF/CNPJ inválido: o sistema impede o avanço e destaca os campos.
- 2a. Offline sem CEP em cache: o técnico preenche o endereço manualmente.

**Dependências:** RF02. Origem: UC02; RN01; Épico 11.

### RF04 — Medir Telhado via Realidade Aumentada

**Objetivo e Descrição:** medir área, inclinação e orientação do telhado pela câmera do dispositivo, com reconhecimento de superfícies em Realidade Aumentada.

**Ator:** Técnico. **Prioridade:** **Obrigatório — MVP** (exigência da unidade curricular de Realidade Aumentada). Em dispositivos incompatíveis, o Modo Leve (RF05) assume a etapa.

**Gatilho:** técnico escolhe a medição por RA. **Pré-condições:** RF03 concluído; dispositivo compatível (RNF09); permissão de câmera.

***Fluxo Principal***

1. Sistema verifica a compatibilidade com RA e solicita a permissão de câmera, se necessário.
2. Sistema inicializa a cena de RA (ViroReact).
3. Técnico aponta a câmera e marca os vértices da superfície.
4. Sistema calcula área, inclinação (sensores) e orientação (bússola).
5. Sistema oferece a simulação de sombreamento (RF06), quando habilitada.
6. Técnico confirma a medição.
7. Sistema registra a medição (método "RA", data/hora) e avança para o dimensionamento (RF07).

***Subfluxos***

- 3.1. O técnico reposiciona ou remove vértices antes de confirmar.
- 3.2. O técnico adiciona outra seção (água) do telhado, quando houver.
- 6.1. O técnico repete a captura se o resultado parecer inconsistente.

***Fluxos Alternativos e Exceções***

- 1a. Permissão negada: instrução para concedê-la e oferta do Modo Leve.
- 1b. Dispositivo sem ARKit/ARCore: direcionamento automático ao Modo Leve (RN09).
- 3a. Rastreamento perdido: alerta de reposicionamento; após falhas repetidas, oferta do Modo Leve.

**Dependências:** RF03; RNF09. Origem: UC03. Critério de aceite: calibração contra medida manual conhecida (SCRUM-79).

### RF05 — Inserir Medições do Telhado Manualmente (Modo Leve)

**Objetivo e Descrição:** permitir a inserção manual de área, inclinação e orientação quando não houver RA ou por escolha do técnico.

**Ator:** Técnico. **Prioridade:** Obrigatório — MVP.

**Gatilho:** dispositivo incompatível, falha da RA ou Modo Leve ativo (RF19). **Pré-condições:** RF03 concluído.

***Fluxo Principal***

1. Sistema exibe o formulário: área (m²), inclinação (°) e orientação (N, NE, L, SE, S, SO, O, NO).
2. Técnico preenche com base em medição própria.
3. Técnico opcionalmente informa um percentual de sombreamento ou solicita a simulação (RF06).
4. Técnico confirma.
5. Sistema valida os valores.
6. Sistema registra a medição (método "Manual") e avança para o RF07.

***Subfluxos***

- 3.1. Sem sombreamento informado nem simulado, o sistema usa o valor padrão da empresa (Parâmetros Técnicos).

***Fluxos Alternativos e Exceções***

- 5a. Área ≤ 0 ou inclinação fora de 0–90°: validação.
- 5b. Orientação não selecionada: o sistema impede o avanço.

**Dependências:** RF03; RN09. Origem: UC03.

### RF06 — Simular Sombreamento (Sun Path)

**Objetivo e Descrição:** estimar o sombreamento no telhado ao longo do dia e do ano a partir da trajetória solar, da orientação, da inclinação e de obstáculos, e disponibilizar o resultado ao gestor.

**Ator:** Sistema (processamento); Técnico (execução no app); Gestor Comercial (consulta na web). **Prioridade:** Desejável — MVP.

**Gatilho:** conclusão da medição (RF04/RF05) ou solicitação explícita do técnico. **Pré-condições:** medição registrada; coordenadas da instalação disponíveis.

***Fluxo Principal***

1. Sistema calcula a trajetória solar para as coordenadas e a data de referência.
2. Sistema cruza a trajetória com a geometria do telhado e, quando houver, com os obstáculos marcados na cena de RA.
3. Sistema calcula o percentual de sombreamento médio e por mês.
4. Sistema exibe ao técnico uma visualização 2D e o percentual.
5. Sistema usa o percentual como perda no dimensionamento (RF07).
6. Após a sincronização, o resultado fica visível no detalhe da proposta na web (RF23).

***Subfluxos***

- 2.1. Medição manual sem obstáculos: a simulação considera apenas orientação e inclinação.

***Fluxos Alternativos e Exceções***

- 1a. Sem coordenadas GPS: o sistema usa as coordenadas da cidade (Localidade Climática).
- 3a. Simulação não executada: aplica-se o sombreamento informado ou o padrão (RF05, 3.1).

**Dependências:** RF04/RF05; RF08. Origem: UC03/UC04/UC11.

### RF07 — Calcular Dimensionamento Técnico

**Objetivo e Descrição:** calcular HSP, perdas (temperatura, sujeira, cabeamento e sombreamento), potência necessária (kWp) e geração estimada.

**Ator:** Sistema. **Prioridade:** Obrigatório — MVP.

**Gatilho:** medição concluída e dados climáticos obtidos. **Pré-condições:** consumo informado; medição concluída; HSP disponível.

***Fluxo Principal***

1. Sistema calcula as perdas totais.
2. Sistema calcula a potência necessária: kWp = Consumo / (HSP × 30 × (1 − Perdas)) (RN01).
3. Sistema estima a geração mensal e anual.
4. Sistema verifica se a área medida comporta o sistema e se a geração excede o consumo além do limite configurado.
5. Sistema exibe o resumo técnico, com os alertas cabíveis.
6. Sistema avança para a seleção de equipamentos (RF09).

***Subfluxos***

- 2.1. O cálculo é executado no dispositivo, sem chamada de rede; arredondamento e parâmetros vêm do pacote de domínio compartilhado com a web (DAS, Seção 6).

***Fluxos Alternativos e Exceções***

- 1a. Serviço de clima indisponível: uso da base de contingência (RN02).
- 4a. Espaço insuficiente no telhado: alerta visual antes de avançar.
- 4b. Superdimensionamento (Lei 14.300): alerta de risco de recusa na homologação.

**Dependências:** RF03, RF04/RF05, RF08; RN01. Origem: UC04.

### RF08 — Obter Dados Climáticos com Fallback para Contingência

**Objetivo e Descrição:** obter HSP e irradiação por API externa quando houver conexão, com fallback automático para a base local.

**Ator:** Sistema. **Prioridade:** Obrigatório — MVP.

**Gatilho:** necessidade de HSP para RF06 ou RF07. **Pré-condições:** cidade e estado informados.

***Fluxo Principal***

1. Sistema verifica a conectividade.
2. Sistema consulta a API externa (HTTPS/REST/JSON).
3. Sistema armazena o resultado em cache local.
4. Sistema disponibiliza os dados para os cálculos.

***Subfluxos***

- 3.1. O sistema atualiza a base de contingência com os dados obtidos.

***Fluxos Alternativos e Exceções***

- 1a. Sem conexão: uso direto da base de contingência (RN02).
- 2a. Erro ou timeout da API: fallback automático, registro em log e continuidade do fluxo (RNF12).
- 2b. Cidade fora da base: uso da referência regional mais próxima, sinalizada como aproximada.

**Dependências:** RF03. Origem: UC04; RN02; RNF12.

### RF09 — Selecionar Equipamentos Compatíveis

**Objetivo e Descrição:** permitir que o técnico escolha, no catálogo local, os equipamentos da proposta. O sistema **não sugere kit**; ele apenas valida a compatibilidade com a potência dimensionada e entre os equipamentos.

**Ator:** Técnico. **Prioridade:** Obrigatório — MVP.

**Gatilho:** conclusão do RF07. **Pré-condições:** kWp calculado; catálogo local disponível (pull do RF15).

***Fluxo Principal***

1. Sistema exibe a potência dimensionada e o catálogo ativo da empresa, com busca e filtros (categoria, fabricante, potência, preço).
2. Técnico adiciona módulos, inversor, estrutura e demais itens (string box, cabos, conectores) e informa as quantidades.
3. Técnico consulta os detalhes técnicos de cada item (potência, especificações elétricas, garantia, preço).
4. Sistema calcula a potência total selecionada e valida a compatibilidade elétrica (tensão/corrente, faixa MPPT e fases × tipo de ligação).
5. Técnico confirma a seleção.
6. Sistema avança para a precificação (RF10).

***Subfluxos***

- 2.1. O técnico pode ajustar o preço unitário de um item dentro da proposta (RF18).

***Fluxos Alternativos e Exceções***

- 4a. Combinação eletricamente incompatível: alerta e bloqueio da confirmação até a correção.
- 4b. Potência selecionada muito abaixo ou acima da dimensionada: alerta, com confirmação explícita do técnico.
- 1a. Catálogo sem itens adequados: o sistema orienta atualizar o catálogo (RF17) ou contatar o gestor.

**Dependências:** RF07. Origem: UC05; NOVO-75.

### RF10 — Calcular Precificação da Proposta

**Objetivo e Descrição:** calcular o valor total da proposta conforme a RN03.

**Ator:** Sistema. **Prioridade:** Obrigatório — MVP.

**Gatilho:** confirmação do RF09. **Pré-condições:** itens selecionados; parâmetros comerciais da empresa disponíveis.

***Fluxo Principal***

1. Sistema soma os itens (preço unitário na proposta × quantidade).
2. Sistema adiciona materiais elétricos complementares, mão de obra, ART/homologação e logística/frete, sugeridos pelos padrões da empresa e editáveis pelo técnico.
3. Sistema aplica a margem de lucro da empresa sobre serviços e materiais (RN03).
4. Técnico informa a validade da proposta e a condição de pagamento.
5. Sistema exibe o detalhamento da precificação.
6. Sistema avança para a viabilidade (RF11).

***Subfluxos***

- 1.1. Preços ajustados pelo técnico (RF18) são exibidos com indicação do ajuste aplicado.

***Fluxos Alternativos e Exceções***

- 1a. Preço de item possivelmente desatualizado (catálogo antigo): alerta com a data do último pull.
- 2a. Parâmetros comerciais ausentes: alerta para configuração pelo gestor.

**Dependências:** RF09, RF18; RN03. Origem: UC06.

### RF11 — Calcular Payback, ROI e Impacto Ambiental

**Objetivo e Descrição:** calcular economia mensal, payback, ROI, economia acumulada em 25 anos e CO₂ evitado.

**Ator:** Sistema. **Prioridade:** Obrigatório — MVP.

**Gatilho:** conclusão do RF10. **Pré-condições:** valor total, tarifa e geração estimada disponíveis.

***Fluxo Principal***

1. Sistema calcula a economia mensal (tarifa × geração).
2. Sistema calcula o payback (RN04).
3. Sistema calcula o ROI e a economia acumulada em 25 anos.
4. Sistema calcula o CO₂ evitado (RN10).
5. Sistema exibe o resumo de viabilidade.
6. Sistema avança para a geração do PDF (RF12).

***Subfluxos***

- 1.1. O técnico pode ajustar a tarifa ou o reajuste anual estimado.

***Fluxos Alternativos e Exceções***

- 1a. Tarifa inválida: o sistema solicita a correção na instalação (RF03).
- 2a. Economia nula ou negativa: alerta de inviabilidade aparente.

**Dependências:** RF10; RN04, RN10. Origem: UC06.

### RF12 — Gerar Proposta Comercial em PDF

**Objetivo e Descrição:** gerar a proposta em PDF (3 páginas) com identidade visual padronizada.

**Ator:** Técnico. **Prioridade:** Obrigatório — MVP.

**Gatilho:** solicitação do técnico após o RF11. **Pré-condições:** RF07, RF09, RF10 e RF11 concluídos.

***Fluxo Principal***

1. Técnico solicita a geração.
2. Sistema valida que todas as etapas foram concluídas.
3. Sistema verifica o limite do plano da empresa (RN05).
4. Sistema monta o PDF com resumo técnico, equipamentos, precificação, validade, condição de pagamento, payback, ROI e impacto ambiental (RNF13).
5. Sistema muda o status para "Gerada", registra a data de geração e incrementa o contador local do plano.
6. Sistema coloca a proposta na fila de sincronização (RN07) e oferece visualização e compartilhamento (WhatsApp/e-mail).

***Subfluxos***

- 6.1. O técnico pode reabrir o PDF pelo histórico (RF13).
- 5.1. Proposta "Reaberta" gerada novamente: incrementa a versão e não consome novo item do limite.

***Fluxos Alternativos e Exceções***

- 2a. Etapa pendente: o sistema indica a etapa que falta.
- 3a. Limite de 25 propostas/mês da empresa atingido: o sistema bloqueia a geração e oferece a solicitação de upgrade ao gestor (RF28).
- 4a. Falha na composição do PDF: mensagem de erro; a proposta permanece "Em elaboração".

**Dependências:** RF07, RF09, RF10, RF11; RN05, RN07. Origem: UC07.

### RF13 — Manter Histórico de Propostas (Consulta Offline)

**Objetivo e Descrição:** manter o histórico de propostas do técnico, consultável offline.

**Ator:** Técnico. **Prioridade:** Obrigatório — MVP.

**Gatilho:** técnico acessa "Histórico". **Pré-condições:** ao menos uma proposta.

***Fluxo Principal***

1. Técnico abre o "Histórico".
2. Sistema lista as propostas locais com cliente, data, valor, kWp, status da proposta e status de sincronização.
3. Técnico filtra por cliente, data ou status.
4. Técnico abre uma proposta para ver o detalhe, reenviar o PDF ou, se estiver "Reaberta", editá-la.

***Subfluxos***

- 2.1. Ordenação padrão: mais recente primeiro.
- 4.1. O técnico pode forçar a sincronização de uma proposta com erro.

***Fluxos Alternativos e Exceções***

- 2a. Nenhuma proposta: orientação para iniciar uma nova instalação.
- 4a. PDF ausente no dispositivo: opção de regenerá-lo a partir dos dados salvos, sem consumir o limite.

**Dependências:** RF12, RF15, RF16. Origem: UC08.

### RF14 — Visualizar e Editar Perfil do Técnico

**Objetivo e Descrição:** permitir que o técnico veja e edite seus dados básicos.

**Ator:** Técnico. **Prioridade:** Desejável — MVP.

**Gatilho:** técnico acessa "Perfil". **Pré-condições:** RF01.

***Fluxo Principal***

1. Sistema exibe os dados do técnico.
2. Técnico edita telefone e foto.
3. Técnico salva.
4. Sistema valida, salva localmente e marca para sincronização.

***Subfluxos***

- 1.1. E-mail, papel e empresa são exibidos sem edição (alterados apenas pelo gestor).

***Fluxos Alternativos e Exceções***

- 4a. Dados inválidos: validação.
- 4b. Sem conexão: sincronização posterior.

**Dependências:** RF01, RF15. Origem: UC01.

### RF15 — Operar em Modo Offline-First com Sincronização

**Objetivo e Descrição:** operar com o banco local como fonte primária e sincronizar com a nuvem por pull e push.

**Ator:** Sistema. **Prioridade:** Obrigatório — MVP.

**Gatilho:** login/refresh (pull), operação de escrita ou detecção de conectividade (push). **Pré-condições:** banco local SQLite inicializado.

***Fluxo Principal***

1. Sistema executa leituras e escritas no SQLite criptografado.
2. No login/refresh, o sistema baixa catálogo, preços, parâmetros, concessionárias, base de HSP, contador do plano e propostas reabertas (pull).
3. Cada registro criado ou alterado recebe `sync_status = Pendente`, `updated_at` e `updated_by`.
4. Ao detectar conexão, o sistema envia a fila em ordem de dependência (push), respeitando a RN07.
5. Sistema marca os registros enviados como "Sincronizado" e registra a tentativa no log (RNF11).

***Subfluxos***

- 4.1. Retentativa automática com backoff exponencial.

***Fluxos Alternativos e Exceções***

- 4a. Falha de comunicação: registro marcado como "Erro" e nova tentativa na próxima janela, sem bloquear o app.
- 4b. Conflito residual (DAS 4.3): last-write-wins por `updated_at`, registro no log de auditoria e aviso ao técnico quando sua alteração for sobrescrita.
- 4c. Propostas geradas offline acima do limite do plano: a API aceita e sinaliza ao gestor (DAS 4.4).

**Dependências:** base para RF13, RF16 e RF17. Origem: DAS, Seção 4; RNF02, RNF11, RNF14.

### RF16 — Exibir Status de Sincronização

**Objetivo e Descrição:** exibir o status de sincronização de cada proposta e o estado global de conexão.

**Ator:** Sistema / Técnico. **Prioridade:** Obrigatório — MVP.

**Gatilho:** mudança no `sync_status`. **Pré-condições:** ao menos uma proposta local.

***Fluxo Principal***

1. Sistema atualiza o `sync_status` (Pendente, Sincronizado ou Erro).
2. Sistema exibe o indicador no histórico, no resumo da proposta e o indicador global online/offline na Home.
3. Técnico toca no indicador para ver a data da última tentativa e a mensagem de erro.

***Subfluxos***

- 3.1. O técnico pode forçar nova tentativa.

***Fluxos Alternativos e Exceções***

- 1a. Falha persistente: alerta destacado com orientação.

**Dependências:** RF15. Origem: UC09; RNF11.

### RF17 — Baixar Catálogo/Tabela de Preços Atualizada (Manual)

**Objetivo e Descrição:** permitir que o técnico force a atualização do catálogo sem esperar o próximo login. O download automático no login faz parte do RF15.

**Ator:** Técnico / Sistema. **Prioridade:** Desejável — MVP.

**Gatilho:** técnico seleciona "Atualizar catálogo". **Pré-condições:** conexão; técnico autenticado.

***Fluxo Principal***

1. Técnico solicita a atualização.
2. API retorna o catálogo ativo e os preços da empresa.
3. Sistema substitui o catálogo local, mantendo as propostas já criadas com os preços copiados nos itens.
4. Sistema informa a data e hora da atualização.

***Subfluxos***

- 3.1. O sistema compara a versão local com a remota antes de substituir.

***Fluxos Alternativos e Exceções***

- 1a. Sem conexão: o catálogo local é mantido.
- 2a. Falha da API: catálogo anterior mantido e nova tentativa permitida.

**Dependências:** RF15. Origem: UC05; DAS 4.1.

### RF18 — Ajustar o Preço de um Equipamento na Proposta

**Objetivo e Descrição:** permitir que o técnico ajuste o preço unitário de um equipamento **somente na proposta em elaboração** (por exemplo, quando o preço do fornecedor mudou), sem alterar o catálogo.

**Ator:** Técnico. **Prioridade:** Obrigatório — MVP.

**Gatilho:** técnico identifica divergência de preço no RF09 ou no RF10. **Pré-condições:** proposta "Em elaboração" ou "Reaberta"; item incluído na proposta.

***Fluxo Principal***

1. Técnico seleciona "Ajustar preço" no item.
2. Sistema exibe o preço do catálogo e o limite de ajuste da empresa.
3. Técnico informa o novo preço (ou o percentual).
4. Sistema valida se o ajuste está dentro do limite.
5. Sistema grava o ajuste no item da proposta e o registro no log de auditoria (valor anterior, novo, usuário, data).
6. Sistema recalcula a precificação (RF10).

***Subfluxos***

- 5.1. O gestor vê os ajustes no detalhe da proposta (RF23).

***Fluxos Alternativos e Exceções***

- 4a. Valor ≤ 0 ou fora do limite: validação e campo mantido aberto.
- 1a. Proposta em status não editável pelo técnico (RN11): opção indisponível.

**Dependências:** RF09. Origem: RN06; DAS 3.1.

### RF19 — Oferecer "Modo Leve"

**Objetivo e Descrição:** oferecer o Modo Leve, desabilitando a RA em dispositivos incompatíveis ou pouco potentes.

**Ator:** Técnico / Sistema. **Prioridade:** Obrigatório — MVP.

**Gatilho:** detecção automática ou ativação manual. **Pré-condições:** aplicativo instalado.

***Fluxo Principal***

1. Sistema verifica, na inicialização, a compatibilidade e a capacidade do dispositivo para RA.
2. Se incompatível, ativa o Modo Leve e avisa o técnico.
3. Alternativamente, o técnico ativa o Modo Leve nas configurações.
4. Com o Modo Leve ativo, a medição usa o formulário manual (RF05), mantendo a coleta obrigatória (RN09).

***Subfluxos***

- 3.1. Em dispositivo compatível, o técnico pode desativar o Modo Leve e voltar à RA.

***Fluxos Alternativos e Exceções***

- 1a. Verificação inconclusiva: Modo Leve por padrão.

**Dependências:** RF04, RF05; RN09; RNF09. Origem: UC03.

### RF20 — Efetuar Login do Gestor Comercial (Web)

**Objetivo e Descrição:** permitir o login na interface web.

**Ator:** Gestor Comercial. **Prioridade:** Obrigatório — MVP.

**Gatilho:** acesso à URL do painel. **Pré-condições:** usuário com papel Gestor Comercial.

***Fluxo Principal***

1. Sistema exibe o login web.
2. Usuário informa e-mail e senha e confirma.
3. Sistema valida pela API (JWT/RBAC).
4. Sistema abre o painel com as funções do papel.

***Subfluxos***

- 4.1. O menu inclui "Usuários" e "Parâmetros" (RF29).

***Fluxos Alternativos e Exceções***

- 3a. Credenciais inválidas: mensagem de erro.
- 3b. Papel Técnico: acesso bloqueado com orientação para usar o aplicativo.

**Dependências:** nenhuma. Origem: UC10; RNF06, RNF07.

### RF21 — Exibir Dashboard com Funil de Vendas e Indicadores

**Objetivo e Descrição:** exibir o funil de vendas e os indicadores agregados das propostas da empresa.

**Ator:** Gestor Comercial. **Prioridade:** Desejável — MVP.

**Gatilho:** acesso à tela inicial do painel. **Pré-condições:** usuário autenticado; propostas sincronizadas.

***Fluxo Principal***

1. Sistema consulta as propostas da empresa (RN08).
2. Sistema calcula propostas por status (Gerada, Em negociação, Aprovada, Recusada), valor em negociação e taxa de conversão.
3. Sistema exibe gráficos e indicadores.
4. Usuário filtra por período.

***Subfluxos***

- 4.1. Filtro por técnico para comparar desempenho.

***Fluxos Alternativos e Exceções***

- 1a. Sem propostas no período: estado vazio com orientação.

**Dependências:** RF22, RF27. Origem: UC11.

### RF22 — Listar e Filtrar Propostas

**Objetivo e Descrição:** listar e filtrar as propostas dos técnicos da empresa.

**Ator:** Gestor Comercial. **Prioridade:** Obrigatório — MVP.

**Gatilho:** acesso a "Propostas". **Pré-condições:** RF20.

***Fluxo Principal***

1. Sistema lista as propostas sincronizadas com cliente, técnico, status, valor, data e versão.
2. Usuário filtra por técnico, status, período e cliente.
3. Sistema atualiza a lista.
4. Usuário abre uma proposta (RF23).

***Subfluxos***

- 1.1. Propostas marcadas como acima do limite do plano recebem destaque.
- 2.1. Ordenação por qualquer coluna.

***Fluxos Alternativos e Exceções***

- 3a. Nenhum resultado: mensagem e sugestão de ajuste dos filtros.

**Dependências:** RF15, RF20. Origem: UC11.

### RF23 — Visualizar Detalhamento Técnico e Comercial da Proposta

**Objetivo e Descrição:** exibir o detalhamento técnico e comercial de uma proposta, incluindo o sombreamento obtido em campo.

**Ator:** Gestor Comercial. **Prioridade:** Obrigatório — MVP.

**Gatilho:** seleção na listagem (RF22). **Pré-condições:** proposta da mesma empresa (RN08).

***Fluxo Principal***

1. Sistema recupera a proposta, a instalação, a medição e os itens.
2. Sistema exibe o resumo técnico, a simulação de sombreamento (quando houver), a precificação e a viabilidade.
3. Usuário visualiza ou baixa o PDF da versão atual.
4. Usuário pode abrir o editor (RF27).

***Subfluxos***

- 2.1. Histórico de ajustes de preço, descontos e mudanças de status (log de auditoria).

***Fluxos Alternativos e Exceções***

- 1a. Proposta de outra empresa: acesso bloqueado (RNF07).

**Dependências:** RF22. Origem: UC11.

### RF24 — Acompanhar Plano de Assinatura e Limite Mensal

**Objetivo e Descrição:** exibir o plano da empresa (Freemium, Mensal ou Anual), o consumo do limite mensal e as solicitações de upgrade, e permitir que o gestor realize o upgrade.

**Ator:** Gestor Comercial. **Prioridade:** Obrigatório — MVP para acompanhamento do plano e do limite; **Desejável** para o fluxo de upgrade.

**Gatilho:** acesso a "Plano e Assinatura". **Pré-condições:** RF20.

***Fluxo Principal***

1. Sistema exibe o plano vigente.
2. Sistema exibe o limite de 25 propostas por mês (Freemium) e o consumo atual da empresa.
3. Sistema lista as solicitações de upgrade pendentes enviadas pelos técnicos (RF28).
4. Gestor escolhe o novo plano (Mensal ou Anual) e confirma o upgrade.
5. Sistema atualiza a assinatura, remove o limite mensal e marca as solicitações pendentes como "Atendida".

***Subfluxos***

- 2.1. Alerta preventivo a partir de 80% do limite (20 propostas).
- 3.1. O gestor pode recusar uma solicitação, com justificativa.

***Fluxos Alternativos e Exceções***

- 2a. Limite atingido: o sistema informa que novas propostas estão bloqueadas no app (RF12, RN05).
- 4a. No MVP, a cobrança é simulada: não há processamento de pagamento real.
- 5a. Falha ao atualizar a assinatura: mensagem de erro e nova tentativa.

**Dependências:** RF20; RN05. Origem: UC13.

### RF25 — Gerenciar Catálogo de Equipamentos

**Objetivo e Descrição:** cadastrar, editar e inativar os equipamentos do catálogo da empresa. Somente o gestor altera o catálogo.

**Ator:** Gestor Comercial. **Prioridade:** Obrigatório — MVP.

**Gatilho:** acesso a "Catálogo". **Pré-condições:** RF20.

***Fluxo Principal***

1. Sistema lista os equipamentos com categoria, fabricante, modelo, preço de venda, status e última atualização.
2. Usuário seleciona "Adicionar equipamento", edição inline de preço ou "Inativar".
3. Usuário preenche categoria, fabricante, modelo, fornecedor, especificações elétricas, garantia, preço de custo e margem; o preço de venda é calculado automaticamente.
4. Usuário confirma.
5. Sistema persiste a alteração, registra o log de auditoria e disponibiliza o item aos técnicos no próximo pull.

***Subfluxos***

- 2.1. A inativação preserva o histórico de propostas que usaram o item.

***Fluxos Alternativos e Exceções***

- 4a. Dados obrigatórios ausentes ou preço ≤ 0: validação.
- 5a. Item presente em propostas em andamento: as propostas mantêm o preço copiado no item.

**Dependências:** RF20. Origem: UC12; NOVO-82, NOVO-83.

### RF26 — Gerar Relatórios e Indicadores Analíticos

**Objetivo e Descrição:** gerar relatórios de taxa de fechamento, tempo médio de elaboração e propostas por técnico.

**Ator:** Gestor Comercial. **Prioridade:** Desejável — MVP.

**Gatilho:** acesso a "Relatórios". **Pré-condições:** propostas sincronizadas no período.

***Fluxo Principal***

1. Usuário escolhe o relatório e o período.
2. Sistema consulta as propostas da empresa.
3. Sistema calcula taxa de fechamento (aprovadas/geradas), tempo médio de elaboração e propostas por técnico.
4. Sistema exibe o relatório com opção de exportação (PDF/planilha).

***Subfluxos***

- 4.1. Salvamento de filtros frequentes.

***Fluxos Alternativos e Exceções***

- 2a. Poucos dados: aviso de baixa representatividade.
- 4a. Falha na exportação: mensagem de erro, com visualização mantida.

**Dependências:** RF21, RF22. Origem: UC11.

### RF27 — Editar Proposta e Atualizar Status (Web)

**Objetivo e Descrição:** permitir que o gestor edite uma proposta sincronizada (trocar equipamentos, alterar quantidades e aplicar desconto comercial) com recálculo em tempo real, e movimente seu status no funil.

**Ator:** Gestor Comercial. **Prioridade:** Obrigatório — MVP.

**Gatilho:** "Editar" no detalhe da proposta (RF23). **Pré-condições:** proposta com status "Gerada" ou "Em negociação" (RN11).

***Fluxo Principal***

1. Sistema abre o editor com os itens, serviços e totais.
2. Gestor troca ou inclui equipamentos do catálogo e ajusta quantidades.
3. Gestor aplica desconto comercial.
4. A interface web recalcula precificação e viabilidade no navegador, com o mesmo pacote de domínio do app; a API apenas grava o resultado.
5. Gestor escolhe uma ação: salvar e mover para "Em negociação"; gerar nova versão do PDF; reabrir para o técnico ("Reaberta"); ou marcar como "Aprovada" ou "Recusada".
6. Sistema grava a alteração, incrementa a versão quando houver novo PDF e registra o log de auditoria.

***Subfluxos***

- 5.1. Ao reabrir, a proposta é enviada ao técnico no próximo pull e fica bloqueada para edição na web.

***Fluxos Alternativos e Exceções***

- 2a. Combinação incompatível: alerta e bloqueio (mesma regra do RF09).
- 5a. Proposta "Aprovada" ou "Recusada": somente leitura.
- 6a. Conflito com envio tardio do técnico: last-write-wins e aviso (DAS 4.3).

**Dependências:** RF23; RN03, RN11. Origem: UC14 (Adendo 1 à ERS); NOVO-81; REV-5.

### RF28 — Solicitar Upgrade de Plano ao Gestor

**Objetivo e Descrição:** permitir que o técnico peça ao gestor da empresa um upgrade de plano. O técnico não contrata planos.

**Ator:** Técnico. **Prioridade:** Desejável — MVP.

**Gatilho:** limite atingido (RF12, 3a) ou acesso à tela de plano no app. **Pré-condições:** técnico autenticado.

***Fluxo Principal***

1. Sistema exibe o consumo do limite da empresa.
2. Técnico seleciona "Solicitar upgrade ao gestor" e, opcionalmente, escreve uma mensagem.
3. Sistema registra a solicitação ("Pendente") e a coloca na fila de sincronização.
4. Sistema confirma o envio ao técnico.

***Subfluxos***

- 4.1. O técnico acompanha o status da solicitação (Pendente, Atendida ou Recusada).

***Fluxos Alternativos e Exceções***

- 3a. Sem conexão: a solicitação é enviada na próxima sincronização.
- 2a. Já existe solicitação pendente do técnico: o sistema informa e não duplica.

**Dependências:** RF24. Origem: UC13 (Adendo 1 à ERS); tela "Modal Upgrade Enviado".

### RF29 — Gerenciar Usuários da Empresa

**Objetivo e Descrição:** permitir que o gestor cadastre, edite e inative técnicos e gestores da empresa e configure os parâmetros comerciais.

**Ator:** Gestor Comercial. **Prioridade:** Desejável — MVP (até a tela ficar pronta, os usuários iniciais são criados por script de carga).

**Gatilho:** acesso a "Usuários" ou "Parâmetros". **Pré-condições:** usuário com papel Gestor Comercial.

***Fluxo Principal***

1. Sistema lista os usuários da empresa com papel e situação.
2. Gestor cadastra um usuário (nome, e-mail, papel e senha provisória), edita dados ou inativa a conta.
3. Gestor ajusta os parâmetros comerciais (limite de ajuste de preço, margem padrão e custos padrão).
4. Sistema valida, persiste e registra o log de auditoria.

***Subfluxos***

- 2.1. A inativação revoga as sessões ativas do usuário.

***Fluxos Alternativos e Exceções***

- 4a. E-mail já utilizado: validação.
- 2a. Tentativa de inativar o único gestor ativo da empresa: operação bloqueada.

**Dependências:** RF20. Origem: UC15 (Adendo 1 à ERS); DAS 3.1.

## 2.1 Quadro-Resumo dos Requisitos Funcionais

| ID | Nome | Prioridade |
|---|---|---|
| RF01 | Efetuar Login do Técnico | Obrigatório |
| RF02 | Iniciar Nova Instalação Vinculada a um Cliente | Obrigatório |
| RF03 | Cadastrar Dados do Cliente e da Instalação | Obrigatório |
| RF04 | Medir Telhado via Realidade Aumentada | Obrigatório |
| RF05 | Inserir Medições do Telhado Manualmente (Modo Leve) | Obrigatório |
| RF06 | Simular Sombreamento (Sun Path) | Desejável |
| RF07 | Calcular Dimensionamento Técnico | Obrigatório |
| RF08 | Obter Dados Climáticos com Fallback para Contingência | Obrigatório |
| RF09 | Selecionar Equipamentos Compatíveis | Obrigatório |
| RF10 | Calcular Precificação da Proposta | Obrigatório |
| RF11 | Calcular Payback, ROI e Impacto Ambiental | Obrigatório |
| RF12 | Gerar Proposta Comercial em PDF | Obrigatório |
| RF13 | Manter Histórico de Propostas (Consulta Offline) | Obrigatório |
| RF14 | Visualizar e Editar Perfil do Técnico | Desejável |
| RF15 | Operar em Modo Offline-First com Sincronização | Obrigatório |
| RF16 | Exibir Status de Sincronização | Obrigatório |
| RF17 | Baixar Catálogo/Tabela de Preços Atualizada (Manual) | Desejável |
| RF18 | Ajustar o Preço de um Equipamento na Proposta | Obrigatório |
| RF19 | Oferecer "Modo Leve" | Obrigatório |
| RF20 | Efetuar Login do Gestor Comercial (Web) | Obrigatório |
| RF21 | Exibir Dashboard com Funil de Vendas e Indicadores | Desejável |
| RF22 | Listar e Filtrar Propostas | Obrigatório |
| RF23 | Visualizar Detalhamento Técnico e Comercial da Proposta | Obrigatório |
| RF24 | Acompanhar Plano de Assinatura e Limite Mensal | Obrigatório (upgrade: Desejável) |
| RF25 | Gerenciar Catálogo de Equipamentos | Obrigatório |
| RF26 | Gerar Relatórios e Indicadores Analíticos | Desejável |
| RF27 | Editar Proposta e Atualizar Status (Web) | Obrigatório |
| RF28 | Solicitar Upgrade de Plano ao Gestor | Desejável |
| RF29 | Gerenciar Usuários da Empresa | Desejável |

# 3. Cenários de Verificação dos Requisitos Não Funcionais

### RNF01 — Desempenho

**Descrição:** o cálculo de dimensionamento deve executar em até 3 segundos no dispositivo, sem internet.

**Componente:** pacote de domínio executado no app (RF07).

**Ambiente:** dispositivos de referência Android e iOS; modo avião; dados de cliente e medição preenchidos; base de HSP carregada.

***Procedimento***

1. Ativar o modo avião.
2. Carregar um cenário de teste.
3. Disparar o cálculo (RF07).
4. Medir o tempo entre o disparo e a exibição do resumo (timestamps em log).
5. Repetir 10 vezes em 2 dispositivos (entrada e intermediário).

**Métrica:** ≤ 3 s por execução. **Resultado esperado:** ao menos 95% das execuções dentro do limite. **Evidência:** log com timestamps e planilha de tempos.

### RNF02 — Confiabilidade

**Descrição:** o app deve permanecer 100% funcional offline (exceto clima em tempo real).

**Componente:** fluxo completo do app e base de contingência.

**Ambiente:** modo avião; catálogo, parâmetros e HSP carregados em login anterior.

***Procedimento***

1. Ativar o modo avião.
2. Executar login (sessão em cache), nova instalação, cadastro, medição manual, dimensionamento, seleção de equipamentos, precificação, viabilidade e PDF.
3. Consultar o histórico.
4. Verificar se alguma etapa exige conexão.

**Métrica:** 100% das etapas concluídas sem conexão. **Resultado esperado:** proposta "Gerada" com `sync_status` "Pendente". **Evidência:** vídeo de tela, PDF gerado e captura do histórico.

### RNF03 — Usabilidade

**Descrição:** a interface deve dispensar treinamento formal, com onboarding no primeiro acesso.

**Componente:** onboarding e fluxo de primeiro acesso.

**Ambiente:** conta nova; ao menos 3 usuários sem contato prévio, incluindo 1 técnico de instalação real.

***Procedimento***

1. Pedir que cada usuário faça o fluxo "Nova Instalação" até o PDF, apoiado apenas no onboarding.
2. Cronometrar e registrar dúvidas e erros.
3. Aplicar questionário pós-teste (ex.: SUS simplificado).

**Métrica:** ≥ 80% concluem sem ajuda; nenhuma dúvida bloqueante. **Evidência:** gravações, fichas de observação e questionários.

### RNF04 — Portabilidade

**Descrição:** o app deve ser multiplataforma (Android e iOS), em React Native.

**Componente:** base de código do app.

**Ambiente:** um dispositivo Android e um iOS com o mesmo build.

***Procedimento***

1. Instalar o mesmo build nos dois dispositivos.
2. Executar o fluxo principal em cada um.
3. Comparar telas, comportamento e resultados numéricos.

**Métrica:** 100% das funcionalidades equivalentes e resultados idênticos. **Evidência:** capturas comparativas e registro dos valores.

### RNF05 — Segurança

**Descrição:** os dados sensíveis locais (SQLite) devem ser criptografados em repouso (SQLCipher).

**Componente:** persistência local.

**Ambiente:** dispositivo de teste com cliente cadastrado e acesso ao sistema de arquivos (debug).

***Procedimento***

1. Cadastrar um cliente de teste.
2. Extrair o arquivo do banco local.
3. Tentar abri-lo com uma ferramenta padrão de SQLite, sem a chave.
4. Buscar no conteúdo bruto os dados cadastrados.

**Métrica:** nenhuma ocorrência legível dos dados sensíveis. **Evidência:** arquivo extraído, log da tentativa e relatório.

### RNF06 — Segurança

**Descrição:** comunicação com a API autenticada (JWT) e criptografada (HTTPS/TLS).

**Componente:** API REST e clientes.

**Ambiente:** API em homologação e proxy de análise de tráfego.

***Procedimento***

1. Capturar o tráfego de um login.
2. Verificar HTTPS/TLS e validade do certificado.
3. Verificar o JWT no cabeçalho das requisições seguintes.
4. Acessar um endpoint protegido sem token ou com token expirado.

**Métrica:** 100% das requisições em TLS; 100% dos acessos sem token válido recusados (401/403). **Evidência:** captura do proxy e respostas HTTP.

### RNF07 — Segurança

**Descrição:** o acesso à API e ao banco deve respeitar o perfil do usuário (Técnico ou Gestor Comercial) e sua empresa.

**Componente:** RBAC e filtro por empresa da API.

**Ambiente:** contas de teste de cada papel, em duas empresas diferentes.

***Procedimento***

1. Com a conta Técnico, acessar endpoints exclusivos da web (catálogo em escrita, indicadores, usuários).
2. Com a conta Técnico, acessar a gestão de usuários (exclusiva do gestor).
3. Com Gestor da empresa A, acessar uma proposta da empresa B.
4. Repetir combinações cruzadas.

**Métrica:** 100% das tentativas indevidas recusadas (403). **Evidência:** log das requisições e relatório de combinações.

### RNF08 — Escalabilidade / Custo

**Descrição:** a nuvem deve suportar o crescimento de empresas respeitando o teto do plano Freemium.

**Componente:** API, banco central e controle de limite (RF24, RN05).

**Ambiente:** várias empresas simuladas no plano Freemium (limite de 25 propostas/mês).

***Procedimento***

1. Gerar propostas em várias empresas simultaneamente até uma atingir 25.
2. Verificar que apenas essa empresa é bloqueada.
3. Sincronizar propostas geradas offline acima do limite e verificar a sinalização.
4. Comparar o tempo de resposta sob carga com o de baixa carga.

**Métrica:** bloqueio restrito à empresa que atingiu o limite; degradação ≤ 2× o tempo de baixa carga. **Evidência:** relatório de carga e logs de bloqueio.

### RNF09 — Compatibilidade

**Descrição:** a RA deve usar ARKit (iOS) e ARCore (Android) via ViroReact.

**Componente:** módulo de RA (RF04).

**Ambiente:** um Android com ARCore e um iOS com ARKit.

***Procedimento***

1. Instalar o app nos dois dispositivos.
2. Iniciar a medição por RA.
3. Verificar em log o framework nativo usado.
4. Concluir uma medição completa e compará-la com uma medida conhecida.

**Métrica:** ARCore em 100% dos testes Android e ARKit em 100% dos testes iOS; medição concluída. **Evidência:** logs de inicialização e capturas da cena.

### RNF10 — Manutenibilidade

**Descrição:** o backend deve evoluir de forma independente do app e da web.

**Componente:** contratos e versionamento da API.

**Ambiente:** API, app e web publicados em builds separados.

***Procedimento***

1. Aplicar uma alteração aditiva na API.
2. Verificar que app e web publicados continuam funcionando.
3. Publicar nova versão do app isoladamente.

**Métrica:** nenhuma quebra de contrato; deploys independentes. **Evidência:** changelog/tags e relatório de regressão.

### RNF11 — Auditabilidade

**Descrição:** toda tentativa de sincronização deve ser registrada em log (data/hora, status, quantidade de registros).

**Componente:** sincronização (RF15/RF16) e Log de Sincronização.

**Ambiente:** dispositivo com propostas pendentes.

***Procedimento***

1. Gerar proposta offline e reconectar.
2. Verificar no log a entrada com data/hora, tipo, status e quantidade.
3. Forçar uma falha durante o envio e verificar o registro da falha.

**Métrica:** 100% das tentativas registradas. **Evidência:** extrato do log nos dois cenários.

### RNF12 — Resiliência

**Descrição:** falhas na API de clima não podem travar o app nem impedir a proposta.

**Componente:** RF08 e fluxo RF07–RF12.

**Ambiente:** API de clima simulando indisponibilidade.

***Procedimento***

1. Simular a indisponibilidade.
2. Executar o fluxo completo até o PDF.
3. Verificar travamentos e erros não tratados.
4. Verificar o acionamento do fallback (RN02).

**Métrica:** 0 travamentos; 100% de conclusão do fluxo. **Evidência:** logs da falha e do fallback e PDF gerado.

### RNF13 — Padronização Visual

**Descrição:** o PDF deve manter identidade visual consistente entre plataformas.

**Componente:** template compartilhado do PDF (app e web).

**Ambiente:** a mesma proposta gerada em Android, iOS e na web (nova versão pelo editor).

***Procedimento***

1. Gerar a mesma proposta nas três origens.
2. Comparar logotipo, cores, tipografia e seções.
3. Verificar a aderência ao template oficial.

**Métrica:** 100% de aderência, sem divergências perceptíveis. **Evidência:** os PDFs lado a lado.

### RNF14 — Armazenamento

**Descrição:** o banco local deve suportar propostas offline limitadas apenas pelo armazenamento do dispositivo.

**Componente:** persistência local (SQLite).

**Ambiente:** dispositivo com espaço conhecido e script de geração em lote.

***Procedimento***

1. Registrar o espaço livre.
2. Gerar propostas em lote até um número-alvo (centenas) ou até ocupar espaço significativo.
3. Verificar que não há limite artificial de quantidade.
4. Verificar o comportamento próximo ao limite físico.

**Métrica:** nenhum limite imposto pelo app; tratamento controlado ao esgotar o espaço, sem corromper dados. **Evidência:** registro de quantidade e espaço e captura do comportamento no limite.

## 3.1 Quadro-Resumo dos Requisitos Não Funcionais

| ID | Categoria | Descrição (resumo) |
|---|---|---|
| RNF01 | Desempenho | Cálculo em até 3 s no dispositivo, sem internet. |
| RNF02 | Confiabilidade | App 100% funcional offline (exceto clima em tempo real). |
| RNF03 | Usabilidade | Sem treinamento formal; onboarding no primeiro acesso. |
| RNF04 | Portabilidade | Android e iOS em React Native. |
| RNF05 | Segurança | Dados locais (SQLite) criptografados em repouso. |
| RNF06 | Segurança | JWT e HTTPS/TLS em toda comunicação com a API. |
| RNF07 | Segurança | Acesso conforme papel (Técnico ou Gestor Comercial) e empresa. |
| RNF08 | Escalabilidade / Custo | Crescimento respeitando o teto do Freemium. |
| RNF09 | Compatibilidade | RA com ARKit e ARCore via ViroReact. |
| RNF10 | Manutenibilidade | Backend com evolução independente. |
| RNF11 | Auditabilidade | Toda tentativa de sincronização registrada. |
| RNF12 | Resiliência | Falha da API de clima não trava o app. |
| RNF13 | Padronização Visual | PDF com identidade visual consistente. |
| RNF14 | Armazenamento | Propostas limitadas apenas pelo armazenamento. |

# 4. Considerações Finais

Esta especificação deve permanecer em sincronia com a ERS, o DAS, o Dicionário de Dados, os diagramas e o código ao longo das Sprints oficiais 2 e 3. Alterações de escopo, regras de negócio ou arquitetura que afetem fluxos ou critérios de verificação devem ser refletidas aqui no mesmo ciclo em que forem implementadas. As divergências entre esta versão e a ERS v1.0 estão listadas no *Registro de Decisões de Escopo e Arquitetura*.
