**LUMINI** — **DICIONÁRIO DE DADOS**

Versão 1.2 — Setembro de 2026

# 1. Introdução e Convenções

Este dicionário descreve, campo a campo, os dados persistidos pelo Lumini no banco local do aplicativo (SQLite com SQLCipher) e no banco central (PostgreSQL no Amazon RDS). Ele segue o Documento de Arquitetura de Software (DAS) v1.2 e o Documento de Escopo do MVP v1.4.

## 1.1 Alterações desta Versão (v1.2)

- Novas tabelas: Empresa, Usuário, Assinatura, Solicitação de Upgrade, Instalação, Concessionária, Parâmetros Técnicos, Simulação de Sombreamento, Item da Proposta, Log de Auditoria e Log de Sincronização.
- Dados de endereço e dados elétricos saíram de Cliente e foram para Instalação; `tipo_telhado` foi para Instalação; `tarifa_kwh` passou a ser Decimal.
- Campos duplicados removidos: `tipo_conexao` (mantido `tipo_ligacao`) e `tipo_equipamento` (mantido `categoria`).
- Equipamento ganhou `modelo` e especificações elétricas; `margem_percentual` passou a aceitar zero.
- Proposta ganhou técnico responsável, empresa, geração estimada, economia em 25 anos, materiais elétricos, margem e versão; `impacto_ambiental` virou `co2_evitado_kg_ano` (numérico).
- `status_proposta` e `sync_status` foram separados.

## 1.2 Convenções

| Convenção | Regra |
|---|---|
| Identificadores | UUID. Registros criados no mobile recebem o UUID no próprio dispositivo (idempotência na sincronização). |
| Multi-tenant | Toda tabela de negócio possui `id_empresa` (FK Empresa), e a API sempre filtra por ela. |
| Campos de controle | Toda entidade sincronizável possui `created_at`, `updated_at` (Timestamp) e `updated_by` (UUID FK Usuário). |
| `sync_status` | Enum (Pendente, Sincronizado, Erro), default Pendente. **Existe somente no banco local.** |
| Local × Nuvem | Coluna "Onde": L = banco local, N = banco central, L/N = ambos. |
| Valores monetários | Decimal(12,2), em reais (R$). |
| Percentuais | Float de 0 a 100. |

# 2. Empresa, Usuários e Plano

## 2.1 Empresa

| Campo | Tipo | Restrições | Origem / Observação |
|---|---|---|---|
| id_empresa | UUID | PK | Gerado pelo sistema |
| razao_social | String(150) | Not Null | Cadastro da empresa |
| cnpj | String(14) | Not Null, Unique | Cadastro da empresa |
| limite_ajuste_preco_perc | Float | Not Null, 0 a 100, default 10 | Definido pelo Gestor; limite do ajuste de preço do técnico (RF18) |
| margem_padrao_perc | Float | Not Null, ≥ 0 | Margem de lucro aplicada aos serviços (RN03) |
| mao_de_obra_padrao | Decimal | Not Null, ≥ 0 | Valor padrão sugerido na proposta |
| art_homologacao_padrao | Decimal | Not Null, ≥ 0 | Valor padrão sugerido na proposta |
| frete_padrao | Decimal | Not Null, ≥ 0 | Valor padrão sugerido na proposta |
| ativo | Boolean | Not Null, default true | Administração da plataforma |
| created_at / updated_at | Timestamp | Not Null | Sistema |

Onde: N (os parâmetros comerciais são enviados ao mobile no pull).

## 2.2 Usuário

| Campo | Tipo | Restrições | Origem / Observação |
|---|---|---|---|
| id_usuario | UUID | PK | Gerado pelo sistema |
| id_empresa | UUID | FK Empresa, Not Null | — |
| nome | String(120) | Not Null | Cadastro pelo Gestor (RF29) ou script de carga |
| email | String(150) | Not Null, Unique | Login |
| senha_hash | String | Not Null | Hash bcrypt; nunca enviado ao mobile |
| papel | Enum (Técnico, Gestor Comercial) | Not Null | RBAC |
| telefone | String(20) | Nullable | Editável no perfil (RF14) |
| foto_url | String | Nullable | Editável no perfil (RF14) |
| ativo | Boolean | Not Null, default true | Inativação pelo Gestor (RF29) |
| created_at / updated_at | Timestamp | Not Null | Sistema |

Onde: N (o mobile guarda apenas os dados do próprio usuário e a sessão criptografada).

## 2.3 Assinatura

| Campo | Tipo | Restrições | Origem / Observação |
|---|---|---|---|
| id_assinatura | UUID | PK | Gerado pelo sistema |
| id_empresa | UUID | FK Empresa, Not Null | Uma assinatura ativa por empresa |
| plano | Enum (Freemium, Mensal, Anual) | Not Null, default Freemium | Alterado pelo Gestor no upgrade |
| limite_propostas_mes | Integer | Nullable, > 0 | 25 no Freemium; nulo nos planos pagos (RN05) |
| propostas_geradas_mes | Integer | Not Null, ≥ 0 | Contador do mês corrente; zerado no início de cada mês |
| data_inicio | Date | Not Null | Sistema |
| data_fim | Date | Nullable | Planos pagos |
| status | Enum (Ativa, Cancelada) | Not Null | Sistema |
| updated_at / updated_by | Timestamp / UUID | Not Null | Sistema |

Onde: N (o contador é enviado ao mobile no pull).

## 2.4 Solicitação de Upgrade

| Campo | Tipo | Restrições | Origem / Observação |
|---|---|---|---|
| id_solicitacao | UUID | PK | Gerado no dispositivo |
| id_empresa | UUID | FK Empresa, Not Null | — |
| id_usuario_solicitante | UUID | FK Usuário, Not Null | Técnico (RF28) |
| plano_desejado | Enum (Mensal, Anual) | Nullable | Sugestão do técnico |
| mensagem | String(500) | Nullable | Texto livre |
| status | Enum (Pendente, Atendida, Recusada) | Not Null, default Pendente | Atualizado pelo Gestor |
| resolvido_por | UUID | FK Usuário, Nullable | Gestor |
| resolvido_em | Timestamp | Nullable | Sistema |
| created_at / updated_at / updated_by | Timestamp / UUID | Not Null | Sistema |
| sync_status | Enum | Not Null, default Pendente | Somente local |

Onde: L/N.

# 3. Cliente e Instalação

## 3.1 Cliente

| Campo | Tipo | Restrições | Origem / Observação |
|---|---|---|---|
| id_cliente | UUID | PK | Gerado no dispositivo |
| id_empresa | UUID | FK Empresa, Not Null | — |
| id_usuario_responsavel | UUID | FK Usuário, Not Null | Técnico que cadastrou |
| tipo_pessoa | Enum (Física, Jurídica) | Not Null | Inserção do usuário |
| nome_razao_social | String(150) | Not Null | Inserção do usuário |
| cpf_cnpj | String(14) | Not Null | Inserção do usuário; dado pessoal (LGPD) |
| contato_whatsapp | String(20) | Not Null | Inserção do usuário (compartilhamento do PDF) |
| contato_email | String(150) | Nullable | Inserção do usuário |
| created_at / updated_at / updated_by | Timestamp / UUID | Not Null | Sistema |
| sync_status | Enum | Not Null, default Pendente | Somente local |

Onde: L/N. Campos pessoais ficam criptografados em repouso no dispositivo (RNF05).

## 3.2 Instalação

| Campo | Tipo | Restrições | Origem / Observação |
|---|---|---|---|
| id_instalacao | UUID | PK | Gerado no dispositivo (RF02) |
| id_empresa | UUID | FK Empresa, Not Null | — |
| id_cliente | UUID | FK Cliente, Not Null | Um cliente pode ter várias instalações |
| cep | String(8) | Not Null | Inserção do usuário; preenchimento automático quando possível |
| logradouro | String(150) | Not Null | Inserção do usuário |
| numero | String(10) | Not Null | Inserção do usuário |
| bairro | String(80) | Not Null | Inserção do usuário |
| cidade | String(80) | Not Null | Inserção do usuário; usada na busca de HSP |
| estado | String(2) | Not Null | Inserção do usuário |
| latitude / longitude | Decimal(9,6) | Nullable | GPS do dispositivo; usadas no sun path |
| uc_nis | String(20) | Not Null | Número da instalação na concessionária (Épico 11) |
| id_concessionaria | UUID | FK Concessionária, Not Null | Seleção do usuário |
| tarifa_kwh | Decimal(8,4) | Not Null, > 0 | Sugerida pela concessionária, editável (RF03) |
| modalidade_tarifaria | Enum (Convencional, Branca) | Not Null | Épico 11 |
| tipo_ligacao | Enum (Monofásica, Bifásica, Trifásica) | Not Null | RF03; alimenta a validação elétrica (NOVO-75) |
| disjuntor_amperagem | Integer | Not Null, > 0 | Épico 11 |
| consumo_mensal_kwh | Float | Not Null, > 0 | Inserção do usuário (RN01) |
| tipo_telhado | Enum (Cerâmico, Fibrocimento, Laje, Metálico) | Not Null | Épico 11 |
| distancia_quadro_m | Float | Nullable, ≥ 0 | Épico 11 |
| necessidade_adequacao_quadro | Boolean | Not Null, default false | Épico 11 |
| created_at / updated_at / updated_by | Timestamp / UUID | Not Null | Sistema |
| sync_status | Enum | Not Null, default Pendente | Somente local |

Onde: L/N.

## 3.3 Concessionária

| Campo | Tipo | Restrições | Origem / Observação |
|---|---|---|---|
| id_concessionaria | UUID | PK | Carga inicial |
| nome | String(100) | Not Null | Carga inicial |
| estado | String(2) | Not Null | Carga inicial |
| tarifa_referencia_kwh | Decimal(8,4) | Not Null, > 0 | Tabela mantida no servidor |
| updated_at | Timestamp | Not Null | Sistema |

Onde: N, com cópia em L (pull).

# 4. Dados Climáticos e Parâmetros Técnicos

## 4.1 Localidade Climática (base de contingência)

| Campo | Tipo | Restrições | Origem / Observação |
|---|---|---|---|
| id_localidade | UUID | PK | Carga inicial |
| cidade | String(80) | Not Null | Carga inicial |
| estado | String(2) | Not Null | Carga inicial |
| latitude / longitude | Decimal(9,6) | Not Null | Referência regional (RF08, alternativa 2b) |
| hsp_medio | Float | Not Null, > 0 | API de clima ou base pré-carregada |
| irradiacao_kwh_m2_dia | Float | Not Null, > 0 | API de clima ou base pré-carregada |
| fonte | Enum (API, Contingência) | Not Null | Sistema |
| data_atualizacao | Timestamp | Not Null | Sistema (RF08, subfluxo 3.1) |

Onde: L/N.

## 4.2 Parâmetros Técnicos

| Campo | Tipo | Restrições | Origem / Observação |
|---|---|---|---|
| id_parametro | UUID | PK | Sistema |
| id_empresa | UUID | FK Empresa, Not Null | Parâmetros por empresa |
| perda_temperatura_perc | Float | Not Null, 0 a 100 | Padrão configurável |
| perda_sujeira_perc | Float | Not Null, 0 a 100 | Padrão configurável |
| perda_cabeamento_perc | Float | Not Null, 0 a 100 | Padrão configurável |
| sombreamento_padrao_perc | Float | Not Null, 0 a 100 | Usado quando não há simulação (RF05, subfluxo 3.1) |
| fator_emissao_kgco2_kwh | Float | Not Null, > 0 | Fator de referência (RN10) |
| limite_superdimensionamento_perc | Float | Not Null, default 20 | Alerta da Lei 14.300 |
| updated_at / updated_by | Timestamp / UUID | Not Null | Sistema |

Onde: N, com cópia em L (pull).

# 5. Medição do Telhado e Sombreamento

## 5.1 Medição do Telhado

| Campo | Tipo | Restrições | Origem / Observação |
|---|---|---|---|
| id_medicao | UUID | PK | Gerado no dispositivo |
| id_instalacao | UUID | FK Instalação, Not Null | — |
| secao | Integer | Not Null, default 1 | Número da água do telhado (múltiplas seções — NOVO-72) |
| metodo_medicao | Enum (RA, Manual) | Not Null | Origem da medição (RF04/RF05) |
| area_m2 | Float | Not Null, > 0 | Medição RA ou manual |
| inclinacao_graus | Float | Not Null, 0 a 90 | Medição RA ou manual |
| orientacao | Enum (N, NE, L, SE, S, SO, O, NO) | Not Null | Bússola (RA) ou seleção manual |
| azimute_graus | Float | Nullable, 0 a 360 | Precisão adicional para o sun path |
| calibrada | Boolean | Not Null, default false | Calibração contra medida conhecida (SCRUM-79) |
| data_coleta | Timestamp | Not Null | Sistema |
| created_at / updated_at / updated_by | Timestamp / UUID | Not Null | Sistema |
| sync_status | Enum | Not Null, default Pendente | Somente local |

Onde: L/N.

## 5.2 Simulação de Sombreamento

| Campo | Tipo | Restrições | Origem / Observação |
|---|---|---|---|
| id_simulacao | UUID | PK | Gerado no dispositivo |
| id_medicao | UUID | FK Medição, Not Null | — |
| origem | Enum (Sun path + RA, Sun path manual, Estimativa manual) | Not Null | RF06 |
| data_referencia | Date | Not Null | Data usada no cálculo da trajetória solar |
| sombreamento_perc | Float | Not Null, 0 a 100 | Resultado usado como perda (RF07) |
| sombreamento_mensal | JSON | Nullable | Percentual por mês, exibido no app e na web |
| obstaculos | JSON | Nullable | Obstáculos identificados na cena de RA |
| created_at / updated_at / updated_by | Timestamp / UUID | Not Null | Sistema |
| sync_status | Enum | Not Null, default Pendente | Somente local |

Onde: L/N. O gestor consulta este resultado no detalhe da proposta na web.

# 6. Catálogo de Equipamentos

| Campo | Tipo | Restrições | Origem / Observação |
|---|---|---|---|
| id_equipamento | UUID | PK | Gerado pela API |
| id_empresa | UUID | FK Empresa, Not Null | Catálogo por empresa |
| categoria | Enum (Módulo, Inversor, Estrutura, String Box, Cabos, Conectores) | Not Null | Formulário web (RF25) |
| fabricante | String(80) | Not Null | Formulário web |
| modelo | String(80) | Not Null | Formulário web |
| fornecedor | String(80) | Not Null | Formulário web; separado do fabricante |
| potencia_w | Float | Nullable, > 0 | Obrigatório para módulos e inversores |
| voc_v | Float | Nullable, > 0 | Tensão de circuito aberto (módulos) — NOVO-75 |
| isc_a | Float | Nullable, > 0 | Corrente de curto-circuito (módulos) — NOVO-75 |
| tensao_max_entrada_v | Float | Nullable, > 0 | Inversores — NOVO-75 |
| corrente_max_entrada_a | Float | Nullable, > 0 | Inversores — NOVO-75 |
| faixa_mppt_min_v / faixa_mppt_max_v | Float | Nullable, > 0 | Inversores — NOVO-75 |
| fases | Enum (Monofásico, Bifásico, Trifásico) | Nullable | Inversores; comparado com `tipo_ligacao` |
| garantia_anos | Integer | Nullable, ≥ 0 | Exibido no modal de detalhes |
| preco_custo | Decimal | Not Null, > 0 | Formulário web |
| margem_percentual | Float | Not Null, ≥ 0 | Formulário web |
| preco_venda | Decimal | Not Null, > 0 | Calculado: `preco_custo × (1 + margem_percentual/100)` |
| status | Enum (Ativo, Oculto) | Not Null, default Ativo | Inativação preserva o histórico |
| created_at / updated_at / updated_by | Timestamp / UUID | Not Null | Alterações de preço também vão ao Log de Auditoria |

Onde: N, com cópia somente leitura em L (pull). O técnico **não** altera registros do catálogo.

# 7. Proposta Comercial

## 7.1 Proposta

| Campo | Tipo | Restrições | Origem / Observação |
|---|---|---|---|
| id_proposta | UUID | PK | Gerado no dispositivo |
| id_empresa | UUID | FK Empresa, Not Null | — |
| id_instalacao | UUID | FK Instalação, Not Null | — |
| id_usuario_responsavel | UUID | FK Usuário, Not Null | Técnico autor (RN08) |
| numero_versao | Integer | Not Null, default 1 | Incrementado a cada novo PDF (reabertura ou editor web) |
| status_proposta | Enum (Em elaboração, Gerada, Em negociação, Reaberta, Aprovada, Recusada) | Not Null, default Em elaboração | Máquina de estados (RN07; DAS 4.3) |
| potencia_kwp | Float | Nullable, > 0 | RN01; obrigatório a partir de "Gerada" |
| geracao_estimada_kwh_mes | Float | Nullable, > 0 | RF07 |
| perdas_totais_perc | Float | Nullable, 0 a 100 | Temperatura + sujeira + cabeamento + sombreamento |
| valor_equipamentos | Decimal | Not Null, ≥ 0 | Soma dos itens (RN03) |
| valor_materiais_eletricos | Decimal | Not Null, ≥ 0 | RN03 |
| valor_mao_de_obra | Decimal | Not Null, ≥ 0 | RN03; sugerido pela empresa |
| valor_art_homologacao | Decimal | Not Null, ≥ 0 | RN03 |
| valor_logistica_frete | Decimal | Not Null, ≥ 0 | RN03 |
| margem_percentual | Float | Not Null, ≥ 0 | Copiada da empresa no momento da proposta |
| valor_margem | Decimal | Not Null, ≥ 0 | Calculado: serviços × margem |
| desconto_comercial_perc | Float | Nullable, 0 a 100 | Somente o gestor, no editor web (RF27) |
| valor_total | Decimal | Not Null, ≥ 0 | Calculado (RN03) |
| economia_mensal_estimada | Decimal | Nullable, ≥ 0 | RN04 |
| economia_25_anos | Decimal | Nullable, ≥ 0 | RF11 |
| payback_meses | Integer | Nullable, > 0 | RN04 |
| roi_percentual | Float | Nullable | RF11 |
| co2_evitado_kg_ano | Float | Nullable, ≥ 0 | RN10; formatado apenas na exibição |
| validade_dias | Integer | Not Null, > 0, default 15 | NOVO-78; estampado no PDF |
| condicao_pagamento | Enum (À vista, Parcelado, Entrada + parcelas) | Not Null | NOVO-87 |
| caminho_pdf | String | Nullable | Local no dispositivo / armazenamento na nuvem |
| data_geracao | Timestamp | Nullable | Primeira passagem para "Gerada" (conta no limite do plano) |
| excedeu_limite_plano | Boolean | Not Null, default false | Marcado pela API quando gerada offline acima do limite |
| created_at / updated_at / updated_by | Timestamp / UUID | Not Null | Sistema |
| sync_status | Enum | Not Null, default Pendente | Somente local (RF16) |

Onde: L/N. Campos calculados podem ser nulos enquanto a proposta está "Em elaboração".

## 7.2 Item da Proposta

| Campo | Tipo | Restrições | Origem / Observação |
|---|---|---|---|
| id_item | UUID | PK | Gerado no dispositivo ou na web |
| id_proposta | UUID | FK Proposta, Not Null | — |
| id_equipamento | UUID | FK Equipamento, Not Null | Escolhido pelo técnico (RF09) ou trocado pelo gestor (RF27) |
| quantidade | Integer | Not Null, > 0 | Inserção do usuário |
| preco_catalogo | Decimal | Not Null, > 0 | Cópia do `preco_venda` no momento da inclusão |
| ajuste_percentual | Float | Not Null, default 0 | Entre −limite e +limite da empresa (RF18) |
| preco_unitario | Decimal | Not Null, > 0 | Calculado: preco_catalogo × (1 + ajuste/100) |
| subtotal | Decimal | Not Null, > 0 | Calculado: preco_unitario × quantidade |
| created_at / updated_at / updated_by | Timestamp / UUID | Not Null | Ajustes também vão ao Log de Auditoria |
| sync_status | Enum | Not Null, default Pendente | Somente local |

Onde: L/N.

# 8. Logs

## 8.1 Log de Auditoria

| Campo | Tipo | Restrições | Origem / Observação |
|---|---|---|---|
| id_log | UUID | PK | Sistema |
| id_empresa | UUID | FK Empresa, Not Null | — |
| entidade | Enum (Equipamento, ItemProposta, Proposta, Assinatura, Usuário) | Not Null | Registro alterado |
| id_registro | UUID | Not Null | Registro alterado |
| campo | String(60) | Not Null | Ex.: preco_custo, ajuste_percentual, status_proposta |
| valor_anterior | String | Nullable | Valor antes da alteração |
| valor_novo | String | Nullable | Valor depois da alteração |
| id_usuario | UUID | FK Usuário, Not Null | Quem alterou |
| origem | Enum (Mobile, Web, API) | Not Null | De onde veio a alteração |
| data_hora | Timestamp | Not Null | Sistema |

Onde: L/N (gerado no dispositivo para ajustes de preço e enviado na sincronização). Substitui a entidade de preço versionado das versões anteriores.

## 8.2 Log de Sincronização

| Campo | Tipo | Restrições | Origem / Observação |
|---|---|---|---|
| id_log_sync | UUID | PK | Sistema |
| id_usuario | UUID | FK Usuário, Not Null | — |
| id_dispositivo | String(64) | Not Null | Identificador da instalação do app |
| data_hora | Timestamp | Not Null | Sistema |
| tipo | Enum (Pull, Push) | Not Null | DAS 4.1 |
| status | Enum (Sucesso, Falha) | Not Null | RNF11 |
| qtd_registros | Integer | Not Null, ≥ 0 | RNF11 |
| mensagem_erro | String | Nullable | Preenchido em falhas |

Onde: L/N.
