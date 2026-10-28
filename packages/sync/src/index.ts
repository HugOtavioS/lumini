/**
 * @lumini/sync — sincronização offline do Lumini (Épico 4).
 *
 * Código TypeScript puro, sem APIs do Node nem do React Native: roda no app
 * (Hermes), na web e na API. O acesso ao SQLite e à rede vem de fora
 * (`BancoSql` e `TransporteSync`).
 */
export * from './erros';
export * from './contrato';
export * from './sql';
export * from './transporte';

// SCRUM-82 — fila persistente com retentativa e backoff exponencial
export * from './fila/backoff';
export * from './fila/migracoes';
export * from './fila/fila';

// SCRUM-83 — resolução de conflito (last-write-wins) com log de auditoria
export * from './conflito/diferencas';
export * from './conflito/resolverConflito';

// SCRUM-406 — RN11: quem pode editar a proposta em cada status (app, web e API)
export * from './regras/rn11';

// SCRUM-87 — limite de armazenamento local e limpeza manual
export * from './armazenamento/politica';

// SCRUM-86 — servidor de referência (regras da API) e aplicação do pull no aparelho
export * from './servidor/servidorReferencia';
export * from './recebimento';
