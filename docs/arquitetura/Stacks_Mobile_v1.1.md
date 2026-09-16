**LUMINI** — **DOCUMENTAÇÃO DAS STACKS DO APLICATIVO MOBILE**

Versão 1.1 — Setembro de 2026

# 1. Introdução

## 1.1 Objetivo do Documento

Este documento descreve a escolha e o uso de React Native e ViroReact como stacks do aplicativo mobile Lumini. Ele registra a função de cada tecnologia, a relação delas com os requisitos do produto e as decisões necessárias para que o aplicativo funcione em Android e iOS, inclusive com conectividade limitada.

## 1.2 Escopo da Documentação

A documentação contempla a camada mobile do Lumini: cadastro de clientes e instalações, medição do telhado, simulação de sombreamento, dimensionamento fotovoltaico, seleção de equipamentos, ajuste de preço na proposta, precificação, viabilidade, geração de propostas em PDF, armazenamento local e sincronização. O backend (Node.js/NestJS), o banco central (PostgreSQL no Amazon RDS) e a interface web são tratados como integrações e estão detalhados no Documento de Arquitetura de Software (DAS) v1.2.

## 1.3 Definições, Acrônimos e Abreviações

| Termo | Definição |
|---|---|
| React Native | Framework baseado em React para aplicações móveis com componentes e recursos nativos. |
| ViroReact | Plataforma de renderização 3D e realidade aumentada integrada ao React Native. |
| RA / AR | Realidade Aumentada (Augmented Reality). |
| ARKit / ARCore | Frameworks de RA da Apple (iOS) e do Google (Android). |
| SQLite / SQLCipher | Banco de dados embarcado e sua extensão de criptografia em repouso. |
| Offline-first | Estratégia em que o app prioriza dados locais e opera sem conexão constante. |
| MVP | Minimum Viable Product — Produto Mínimo Viável. |
| HSP | Horas de Sol Pleno, usadas na estimativa de geração fotovoltaica. |
| kWp | Quilowatt-pico, potência nominal de sistemas fotovoltaicos. |

## 1.4 Visão Geral do Documento

A Seção 2 apresenta a finalidade de cada stack. A Seção 3 descreve a arquitetura do app e a estratégia offline-first. A Seção 4 registra a organização do código, a integração com Expo e o Modo Leve. A Seção 5 reúne riscos e testes. A Seção 6 encerra com a decisão tecnológica consolidada.

## 1.5 Alterações desta Versão (v1.1)

- Banco local definido como **SQLite com SQLCipher**. O Realm foi descartado porque seu SDK e o serviço de sincronização foram descontinuados pelo fornecedor.
- A Realidade Aumentada passa a ser **obrigatória** no MVP.
- O técnico ajusta preços **somente na proposta**; o catálogo local é somente leitura.
- O cálculo é executado somente no dispositivo; o código fica em um pacote de domínio compartilhado com a web (TypeScript). A API é apenas de sincronização.

# 2. Descrição Geral da Stack

## 2.1 Perspectiva Tecnológica

O aplicativo será construído com React Native como framework principal, concentrando telas, navegação, formulários, estados da interface, acesso aos repositórios locais e comunicação com a API. O ViroReact será o módulo especializado de Realidade Aumentada, sem substituir o framework principal. Todo o código será escrito em TypeScript, a mesma linguagem do backend NestJS e da interface web.

A documentação oficial do React Native apresenta o framework como uma forma de desenvolver interfaces nativas com os conceitos do React [1]. A documentação do ViroReact descreve a plataforma como solução de renderização para AR e VR em React Native, com suporte a ARKit no iOS e ARCore no Android [3].

## 2.2 Responsabilidades do React Native

| Módulo do aplicativo | Responsabilidades |
|---|---|
| Autenticação e sessão | Login, logout, sessão do técnico em cache criptografado. |
| Clientes e instalações | Cadastro do cliente e da instalação (endereço, UC/NIS, concessionária, tarifa, tipo de ligação, disjuntor, consumo, telhado). |
| Fluxo técnico | Navegação entre medição, sombreamento, dimensionamento, equipamentos, preço e viabilidade. |
| Equipamentos | Busca e seleção pelo técnico no catálogo local (somente leitura), validação de compatibilidade e ajuste de preço na proposta. |
| Persistência local | SQLite criptografado: clientes, instalações, medições, catálogo, parâmetros, propostas, itens, logs e fila de sincronização. |
| Proposta comercial | Resumo, geração, visualização, compartilhamento e histórico do PDF. |
| Plano | Exibição do uso do limite da empresa e solicitação de upgrade ao gestor. |
| Sincronização | Pull no login, push na reconexão, retentativas e status de envio. |

## 2.3 Responsabilidades do ViroReact

O ViroReact cria a cena de realidade aumentada, apresenta a câmera na medição, permite marcar os vértices do telhado e identificar obstáculos usados na simulação de sombreamento. O resultado da cena não fica restrito ao formato 3D: ao concluir a medição, o módulo produz uma estrutura de dados comum, com área, inclinação, orientação, origem da medição e data da coleta. O cálculo da trajetória solar é feito no pacote de domínio, e a visualização do sombreamento no MVP é 2D.

| Dado | Medição com RA | Medição no Modo Leve |
|---|---|---|
| Área do telhado | Pontos marcados na cena e superfície calculada | Valor informado em m² |
| Inclinação | Sensores e plano identificado | Valor informado em graus |
| Orientação | Bússola e orientação do dispositivo | Seleção manual (N, NE, L, SE, S, SO, O, NO) |
| Sombreamento | Sun path com obstáculos da cena | Sun path sem obstáculos, valor informado ou padrão |
| Origem | "RA" | "Manual" |

## 2.4 Restrições e Dependências

- O ViroReact não funciona no Expo Go; é necessário development build ou prebuild [4].
- A RA depende de câmera, sensores, capacidade de processamento e compatibilidade com ARKit/ARCore.
- O Modo Leve permanece obrigatório para dispositivos incompatíveis ou medições não confiáveis.
- As versões de React Native, Expo, ViroReact, SQLite/SQLCipher e módulos nativos devem ser fixadas e testadas em conjunto.

# 3. Arquitetura do Aplicativo Mobile

## 3.1 Camadas da Aplicação

A arquitetura separa apresentação, domínio, persistência e integração. Assim, as telas não conhecem o banco central, e a origem da medição pode mudar sem alterar os cálculos e a geração da proposta.

| Camada | Componentes principais | Responsabilidade |
|---|---|---|
| Apresentação | React Native, navegação e design system | Interação com o técnico e exibição dos resultados. |
| Domínio | Pacote `packages/domain` compartilhado | Cálculo, RN03, viabilidade, sombreamento e validações. |
| Persistência | SQLite + SQLCipher e repositórios | Operação offline e histórico. |
| RA e nativo | ViroReact e módulos nativos | Câmera, sensores, cena 3D e medição. |
| Integração | API REST e sincronizador | Autenticação, pull e push. |

## 3.2 Fluxo Principal

1. O técnico inicia uma nova instalação.
2. Os dados do cliente e da instalação são registrados e validados.
3. A medição é feita por RA ou pelo Modo Leve, com simulação de sombreamento opcional.
4. O app calcula HSP, perdas, geração estimada e potência necessária.
5. O técnico escolhe os equipamentos, ajusta preços na proposta se necessário e revisa custos, margem e total.
6. O app calcula payback, ROI, economia acumulada e impacto ambiental.
7. A proposta é gerada em PDF, salva localmente e compartilhada.
8. A fila de sincronização envia os dados à API quando a conexão retorna.

## 3.3 Estratégia Offline-First

O offline-first é uma propriedade arquitetural do Lumini. No login, o app carrega catálogo, preços, parâmetros técnicos e comerciais, concessionárias, base de HSP e contador do plano. O que for produzido sem conexão é gravado localmente com status de sincronização "Pendente".

| Dados locais | Finalidade |
|---|---|
| Clientes e instalações | Continuar o atendimento sem rede. |
| Catálogo e parâmetros (somente leitura) | Selecionar equipamentos e montar o orçamento offline. |
| Base climática | Calcular HSP com a API externa indisponível. |
| Propostas e itens | Preservar histórico, PDF e dados para reenvio. |
| Log de auditoria | Registrar ajustes de preço feitos na proposta. |
| Fila de sincronização | Controlar operações pendentes, tentativas e erros. |

Cada registro sincronizável possui UUID gerado no dispositivo, `updated_at`, `updated_by` e `sync_status`. Conflitos são evitados pela regra de edição por status da proposta (DAS 4.3) e, nos casos residuais, resolvidos por last-write-wins com registro em log.

# 4. Implementação e Integração

## 4.1 Organização do Código

```
apps/mobile/src/
  app/          navegação e providers
  features/     auth, clients, measurement, shading, equipment, pricing, proposal, plan
  data/         local (SQLite), remote (API) e repositories
  viro/         cenas de RA, medição e obstáculos
  components/   componentes visuais reutilizáveis
  assets/       ícones, imagens e recursos
packages/domain/  regras de cálculo compartilhadas com a web
```

A pasta `features` concentra os fluxos do usuário, e a pasta `data` implementa o acesso local e remoto. A pasta `viro` isola as cenas de RA e converte seus resultados para o modelo de medição. As regras de cálculo ficam no pacote `packages/domain`, compartilhado com a web. A API não executa cálculos.

## 4.2 Integração com Expo

O plugin do ViroReact deve ser incluído na configuração do app. A execução exige development client ou prebuild, pois o Expo Go não fornece o código nativo necessário [4].

```
{
  "expo": {
    "plugins": ["@reactvision/react-viro"]
  }
}
```

As permissões de câmera e localização devem ser explicadas ao usuário e solicitadas apenas quando necessárias. A validação final ocorre em dispositivos físicos Android e iOS, pois simuladores não representam câmera, sensores e rastreamento espacial.

## 4.3 Modo Leve e Compatibilidade

O Modo Leve é parte funcional do produto. Quando o dispositivo não oferecer suporte adequado à RA, o técnico informa manualmente área, inclinação, orientação e, opcionalmente, sombreamento. O modelo de dados e o motor de cálculo são os mesmos nos dois caminhos; muda apenas a origem dos valores.

# 5. Qualidade, Riscos e Testes

A combinação de React Native e ViroReact exige controle de compatibilidade entre versões, sistemas e dispositivos. A Nova Arquitetura do React Native (Fabric, TurboModules e JSI) deve ser considerada na escolha das versões [2], validando a compatibilidade das bibliotecas antes de cada entrega.

| Risco | Impacto | Mitigação |
|---|---|---|
| RA obrigatória e de maior esforço | Atraso na Sprint Interna 5 | Prova de conceito com cena vazia já na Sprint Interna 1; Modo Leve pronto desde o início. |
| Dispositivo incompatível com RA | Medição automática indisponível | Detecção de capacidade e Modo Leve. |
| Incompatibilidade de versões | Falhas de compilação ou execução | Versões fixadas e matriz Android/iOS. |
| Uso do Expo Go | Cena de RA não inicia | Development build ou prebuild [4]. |
| Falha de sincronização | Dados não chegam ao painel | Fila persistente, retentativas e status visível. |
| Preços desatualizados | Margem incorreta | Pull no login, data da última atualização exibida e ajuste de preço na proposta. |
| Divergência de cálculo | Resultados inconsistentes | Pacote de domínio único e casos de referência. |
| Perda do aparelho | Exposição de dados do cliente | SQLite criptografado com chave no Keychain/Keystore. |

## 5.1 Testes Mínimos

- Login, navegação e validação dos formulários.
- Criar uma instalação e gerar proposta sem conexão.
- Validar o Modo Leve em aparelho sem suporte à RA.
- Inicializar a cena de RA e registrar uma medição calibrada em dispositivo compatível.
- Interromper a rede após gerar uma proposta e sincronizar depois.
- Ajustar o preço de um item na proposta e verificar o limite, o recálculo e o log de auditoria, sem alteração do catálogo.
- Atingir o limite do plano e enviar uma solicitação de upgrade ao gestor.
- Comparar os cálculos com cenários de referência.
- Gerar, abrir e compartilhar o PDF em dispositivo físico.
- Verificar que o arquivo do banco local não é legível sem a chave.

# 6. Conclusão

React Native será a base do aplicativo mobile Lumini, concentrando interface, navegação, formulários, persistência em SQLite criptografado, fluxos de negócio e integração com a API. A escolha reduz a duplicação entre Android e iOS e, por usar TypeScript, permite compartilhar as regras de cálculo com a web e o backend.

ViroReact será a camada especializada de Realidade Aumentada, obrigatória no MVP, integrando ARKit e ARCore à medição do telhado e à identificação de obstáculos para o sombreamento. Seu uso fica isolado, com saída em um modelo de dados comum e com o Modo Leve preservado como contingência.

# Referências

[1] REACT NATIVE. Introduction. Documentação oficial. Disponível em: https://reactnative.dev/docs/getting-started. Acesso em: 1 set. 2026.

[2] REACT NATIVE. About the New Architecture. Documentação oficial. Disponível em: https://reactnative.dev/architecture/landing-page. Acesso em: 1 set. 2026.

[3] REACTVISION. ViroReact — Overview. Documentação oficial. Disponível em: https://viro-community.readme.io/docs/overview. Acesso em: 1 set. 2026.

[4] REACTVISION. Integrating ViroReact with Expo. Documentação oficial. Disponível em: https://viro-community.readme.io/docs/integrating-with-expo. Acesso em: 1 set. 2026.

[5] MONGODB. Atlas Device Sync: End-of-Life and Deprecation. MongoDB Community Forums, 2024. Disponível em: https://www.mongodb.com/community/forums/t/atlas-device-sync-end-of-life-and-deprecation/296687. Acesso em: 15 set. 2026.

[6] ZETETIC. SQLCipher. Disponível em: https://www.zetetic.net/sqlcipher/. Acesso em: 15 set. 2026.
