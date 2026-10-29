# features/orcamento — Sprint 3

| Caminho | Task | Conteúdo |
|---|---|---|
| `hooks/useAnaliseFinanceira.ts` | SCRUM-24 | Memoiza `calcularAnaliseFinanceira` e retorna `{ analise, erro }`. Recebe `null` enquanto não houver preço (REV-1) ou geração. |
| `hooks/useImpactoAmbiental.ts` | SCRUM-88 | Memoiza `calcularSerieCO2Evitado` e retorna `fatorPendente: true` enquanto o fator do SIN não estiver configurado. |
| `components/CardFinanceiro.tsx` | SCRUM-24 | Payback, ROI, economia acumulada e investimento, com gráfico do acumulado e a linha do investimento. As premissas aparecem no rodapé. |
| `components/CardImpactoAmbiental.tsx` | SCRUM-88 | CO₂ evitado no 1º ano e no total, com gráfico do acumulado. Mostra um aviso quando o fator está pendente. |

Exemplo:

```tsx
const { analise } = useAnaliseFinanceira({ precoTotal, geracaoAnualKwh, tarifaKwh });
const ambiental = useImpactoAmbiental({ geracaoAnualKwh });

{analise && <CardFinanceiro analise={analise} />}
<CardImpactoAmbiental {...ambiental} />
```

O `useCalculoSolar` existente continua com o próprio payback simplificado. Ver a pendência sobre unificar os dois.
