/**
 * MigracaoSql.ts
 *
 * SCRUM-17 / SCRUM-18 — Formato das migrações adicionadas nesta entrega.
 *
 * ⚠️ PENDÊNCIA (merge SCRUM-66): a estratégia oficial de versionamento e o runner
 *    de migrações estão no SCRUM-66. Este tipo descreve apenas o mínimo que as
 *    novas migrações precisam (versão, nome, SQL de subida e descida). No merge,
 *    adaptar ao tipo do SCRUM-66 e registrar as migrações na lista dele.
 *
 * Versões usam o formato AAAAMMDDNN para não colidir com a sequência existente
 * e garantir que rodem depois das migrações já publicadas.
 */

export interface MigracaoSql {
  versao: number;
  nome: string;
  up: readonly string[];
  down: readonly string[];
}
