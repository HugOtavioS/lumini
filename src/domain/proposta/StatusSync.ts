/**
 * StatusSync.ts
 *
 * SCRUM-18 — Estado de sincronização de uma proposta na fila de sync.
 *
 * ⚠️ É independente do StatusProposta (SCRUM-405): uma proposta "Gerada"
 *    pode estar pendente, sincronizando, sincronizada ou com erro.
 */

export const StatusSync = {
  Pendente: 'pendente',
  Sincronizando: 'sincronizando',
  Sincronizada: 'sincronizada',
  Erro: 'erro',
} as const;

export type StatusSync = (typeof StatusSync)[keyof typeof StatusSync];
