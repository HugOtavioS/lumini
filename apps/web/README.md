# Lumini — Painel Web (Gestor Comercial)

Vite + React + TypeScript (decisão NOVO-101), seguindo as telas de `01_Desing/Telas/01_Web`.

```bash
npm run api       # API local (http://localhost:3000)
npm run painel    # http://localhost:5173 — gestora@solarvale.com.br / lumini123
```

Telas: login, dashboard (funil, conversão, limite do plano, atividade recente, desempenho por técnico, valor por mês, origem RA × manual), propostas (filtros, busca, CSV), detalhe da proposta com as ações do gestor (botões de `acoesDoGestor` do `@lumini/sync` — RN11), catálogo (preço editável com duplo clique, ocultar item, cadastro validado pelo `@lumini/domain`), plano, equipe (cadastrar e desativar técnicos) e log de sincronizações.

Outra API: `VITE_API_URL=https://...` em `.env.local`.
