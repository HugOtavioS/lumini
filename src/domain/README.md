# domain — Sprint 3

Regras puras, sem React, SQLite ou rede.

| Pasta | Task | Conteúdo |
|---|---|---|
| `proposta/` | SCRUM-405 | `StatusProposta` e as transições válidas (`Rascunho → Dimensionada → Precificada → PDF gerado → Gerada`), além de `podeSincronizar` (RN07), que retorna `{ permitido, motivos }`. `StatusSync` (SCRUM-18). |
| `financeiro/` | SCRUM-24 | `calcularAnaliseFinanceira`: payback (anos e meses), ROI, economia acumulada ano a ano. `PrecoTotalProposta` é o contrato da REV-1. |
| `ambiental/` | SCRUM-88 | `calcularCO2Evitado` e `calcularSerieCO2Evitado` (25 anos, com degradação). `FATOR_EMISSAO_SIN` ainda é **placeholder** (`null`). |
| `energia/` | 24 / 88 | `projecaoGeracao`: horizonte padrão (25 anos) e degradação padrão (0,5% a.a., com fonte citada), compartilhados pelos dois cálculos. |
| `repositories/` | SCRUM-17 | Interface `HspRepository` e porta `FonteHspTempoReal` (SCRUM-8). O retorno indica `origem: 'tempo-real' \| 'contingencia'`. |

Os parâmetros econômicos ficam em `PREMISSAS_ECONOMICAS_PADRAO` e podem ser trocados por chamada. O reajuste tarifário padrão é `0` (placeholder conservador, ver o TODO no arquivo).
