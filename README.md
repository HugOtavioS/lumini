# ☀️ Lumini - UNISA TECNOLOGIA Order System

**Demanda:** Otimização no Processo de Instalação de Placas Solares.
**Empresa / Área:** UNISA TECNOLOGIA / Faculdade SENAI Fatesg / Goiânia.
**Equipe:** Hugo Otávio dos Santos de Paula, Misael Bonifácio Morgado, Pedro Gabriel Moreira dos Santos.

---

## 📖 O Problema

Atualmente, instaladoras e integradoras de energia solar realizam o planejamento e a precificação de seus projetos de forma manual, utilizando planilhas próprias sem uma metodologia padronizada. Isso resulta em:

* Até 3 horas de trabalho manual para gerar uma única proposta comercial.


* Cálculos técnicos inconsistentes entre técnicos da mesma empresa, o que gera desconfiança no cliente.


* Erros nas fórmulas de irradiação solar, nas perdas do sistema e no dimensionamento dos equipamentos.


* Desconexão entre os dados técnicos e comerciais, prejudicando a gestão e o histórico de vendas.


* Propostas com preços desatualizados por falta de integração com os fornecedores.


* Perda de competitividade em licitações que exigem indicadores financeiros e ambientais claros.



## 🎯 Objetivo da Solução (MVP)

Desenvolver um aplicativo mobile com arquitetura *offline-first* para automatizar o dimensionamento técnico, a precificação e a geração de propostas comerciais de sistemas fotovoltaicos. O sistema visa eliminar os cálculos em planilhas e padronizar os resultados entre todos os técnicos.

**Metas Mensuráveis:**

* Reduzir o tempo de elaboração de propostas de até 3 horas para menos de 10 minutos.


* Eliminar erros técnicos através de fórmulas automatizadas.


* Aumentar a taxa de fechamento de contratos com simulações precisas.


* Manter funcionamento confiável mesmo sem conexão constante à internet.



## 🔄 Fluxo Principal de Uso

1. **Entrada de Dados:** Inserção do consumo do cliente (kWh), tarifa, tipo de ligação e dados do telhado (área, inclinação, orientação) de forma guiada.


2. **Processamento Automático:** Cálculo do HSP (Horas de Sol Pico), perdas do sistema, dimensionamento da potência (kWp) e seleção do kit (módulos, inversor, estrutura) via banco de preços local.


3. **Viabilidade Financeira:** Cálculo do custo total, payback, ROI, economia acumulada e impacto ambiental.


4. **Entrega:** Geração de proposta em PDF com identidade visual profissional, pronta para envio via WhatsApp ou e-mail, com salvamento no histórico local.



## ⚙️ Tecnologias e Arquitetura

O projeto foi estruturado para garantir acesso rápido e resiliência offline:

* **Frontend Mobile:** Flutter ou React Native (multiplataforma com suporte a armazenamento offline).


* **Banco de Dados Local:** SQLite ou Realm (permite uso sem internet e sincronização posterior).


* **Backend / Sincronização:** API própria desenvolvida em Node.js ou Python/FastAPI, com banco de dados em nuvem PostgreSQL.


* **Geração de Documentos:** Bibliotecas como pdf-lib ou iText para a criação dos PDFs de proposta.



## 🚧 Escopo e Limitações

**Obrigatório para o MVP:**

* Cálculo automatizado de dimensionamento e HSP, com banco de dados de contingência local.


* Geração de proposta em PDF (payback, ROI e impacto ambiental).


* Funcionamento *offline* com interface simples (sem necessidade de treinamento).



**Fora do Escopo (Não incluído no MVP):**

* **Recursos de Realidade Aumentada:** A funcionalidade de medição/visualização 3D do telhado foi avaliada e descartada para manter o MVP 100% alinhado ao edital, sem depender de hardware mais recente.


* Integração automática com sistemas de homologação (ART).


* Módulo completo de gestão financeira ou marketplace de fornecedores no app.


* Suporte a outras fontes de energia renovável.



---
