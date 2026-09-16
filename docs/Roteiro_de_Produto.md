**LUMINI** — **ROTEIRO DE PRODUTO**



# Sobre o Projeto (Produto)

O Lumini é uma solução mobile e web para empresas de energia solar que automatiza o processo de planejamento e orçamento da instalação de placas solares. A solução nasceu de uma demanda real da UNISA TECNOLOGIA, cadastrada na Plataforma SAGA SENAI de Inovação, em que empresas publicam necessidades para serem resolvidas por projetos acadêmicos.

## O Problema

Muitas empresas de energia solar ainda sofrem com processos manuais e com a falta de metodologias padronizadas, o que gera:

- cálculos técnicos inconsistentes entre técnicos da mesma empresa;
- de 1 a 3 horas de trabalho manual para gerar uma única proposta;
- erros em fórmulas de irradiação, perdas e tarifas;
- desconexão entre dados técnicos e comerciais, sem visão do funil de vendas;
- propostas com preços desatualizados, por falta de integração com os fornecedores.

Tudo isso resulta em retrabalho, perda de vendas em períodos de alta demanda, baixa credibilidade comercial e menor competitividade, inclusive em licitações que exigem indicadores de payback, ROI e impacto ambiental.

## A Solução

O produto automatiza, em um aplicativo mobile offline-first, o dimensionamento técnico, a precificação e a geração de propostas comerciais, padronizando todo o processo com uma metodologia única. Uma interface web conecta esses dados à gestão comercial.

Os resultados esperados são a redução do tempo de elaboração de propostas (de até 3 horas para menos de 10 minutos), a eliminação de erros técnicos e o aumento da taxa de fechamento de contratos.

# Escopo

Está dentro do escopo do projeto uma solução de software para otimizar o processo de instalação de placas solares, dividida em duas partes: um aplicativo mobile, usado pelos técnicos de instalação, e uma interface web, usada pelo gestor comercial da empresa.

O modelo de rentabilidade é **freemium**: empresas no plano gratuito podem gerar até **25 propostas por mês**, com planos de assinatura mensal e anual a preços acessíveis para pequenas e médias empresas. O upgrade de plano é feito pelo gestor na interface web; no aplicativo, o técnico apenas solicita o upgrade ao gestor.

## Aplicativo Profissional

Aplicação mobile usada pelos técnicos para otimizar o processo de orçamento da instalação. Inclui:

- calculadora das fórmulas de dimensionamento, precificação e viabilidade;
- funcionamento offline, com sincronização posterior;
- medição do telhado ponto a ponto com realidade aumentada;
- "modo leve", sem realidade aumentada, para celulares mais simples;
- simulação de sombreamento por trajetória solar (sun path);
- seleção de equipamentos feita pelo técnico, com validação de compatibilidade;
- geração automática de propostas comerciais em PDF;
- interface simples, com um pequeno guia no primeiro uso, dispensando treinamento.

## Interface Web

A interface web é a ponte entre o processo técnico e o comercial: os dados coletados em campo são tratados e transformados em informação útil. Ela contém:

- histórico de propostas, com detalhes técnicos (inclusive o sombreamento) e editor de propostas;
- dashboard com funil de vendas;
- gestão do catálogo de equipamentos e preços;
- plano e assinatura;
- especificação dos pontos de integração futura com sistemas ERP e/ou CRM.

## Riscos, Impactos e Mitigações

**API de clima fora do ar:** o impacto seria cálculo inconsistente, frustração do usuário ou travamento do app. A mitigação é uma base de dados de contingência pré-carregada e atualizada, que elimina a dependência direta do serviço.

**Desatualização dos preços dos fornecedores:** o impacto é uma proposta com margens incorretas. A mitigação é dupla: o gestor mantém o catálogo atualizado na web, e o técnico pode ajustar, de forma simples, o preço de um equipamento **dentro da proposta**, até um limite definido pela empresa, com registro de quem alterou.

**Custo de infraestrutura de nuvem:** o impacto é pressionar um modelo de cobrança acessível. A mitigação é o modelo freemium, com teto rígido de 25 propostas por mês por empresa nas contas que não geram receita.

**Complexidade da realidade aumentada:** a RA é obrigatória e é o item de maior esforço. A mitigação é uma prova de conceito antecipada e o modo leve sempre disponível como alternativa.

## Mínimo Produto Viável (MVP)

Todas as funcionalidades da demanda original fazem parte do MVP. Elas estão classificadas como **Obrigatórias** (precisam estar funcionando na entrega) ou **Desejáveis** (com implementação prevista, mas que cedem prioridade em caso de atraso).

- **Obrigatórias:** cálculo automatizado de dimensionamento (kWp, HSP e perdas); proposta em PDF com payback, ROI e impacto ambiental; funcionamento offline com sincronização; interface sem necessidade de treinamento; base de contingência local; e **medição por realidade aumentada**, obrigatória por exigência da unidade curricular de RA.
- **Desejáveis:** simulação de sombreamento, dashboard de funil de vendas, fluxo de upgrade de plano e especificação da integração com ERP/CRM.

O detalhamento completo está no Documento de Escopo do MVP v1.4.

# Visão, Metas e Objetivos do Produto

## Visão

Ser a principal ferramenta de bolso para instaladores solares, integrando engenharia e vendas em uma experiência fluida e sem erros.

## Missão

Capacitar instaladores solares com tecnologia acessível e offline para gerar orçamentos precisos em qualquer lugar, democratizando a energia solar.

## Metas

- Eliminar os erros de cálculo hoje feitos manualmente nas empresas que usarem a aplicação.
- Reduzir o tempo de elaboração de propostas comerciais em até 18 vezes (de até 3 horas para menos de 10 minutos).
- Aumentar a taxa de fechamento de contratos.

## Objetivos

- Padronizar o processo das empresas de energia solar.
- Manter a solução confiável mesmo sem conexão constante com a internet.
- Dar ao gestor comercial visibilidade sobre as propostas e o funil de vendas.
