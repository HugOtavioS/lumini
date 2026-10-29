/**
 * syncQueue.ts
 *
 * SCRUM-18 — Fila persistente de propostas a sincronizar (tabela fila_sync_propostas).
 *
 * ⚠️ Só o SyncService deve enfileirar, e sempre depois de podeSincronizar (SCRUM-405).
 *    Um item com status 'erro' e proximoEnvioEm = null não é reenviado
 *    automaticamente (erro definitivo ou limite de tentativas atingido).
 */

import { StatusSync } from '@/domain/proposta/StatusSync';
import type { SqlExecutor } from '../database/SqlExecutor';

export interface ItemFilaSync {
  propostaId: string;
  statusSync: StatusSync;
  tentativas: number;
  /** Epoch em ms. null = sem reenvio automático. */
  proximoEnvioEm: number | null;
  ultimoErro: string | null;
  enfileiradaEm: number;
  atualizadaEm: number;
}

export type SituacaoEnfileiramento = 'enfileirada' | 'reenfileirada' | 'ja-na-fila';

export interface FalhaRegistrada {
  tentativas: number;
  proximoEnvioEm: number | null;
  mensagem: string;
}

export interface FilaSync {
  enfileirar(propostaId: string, agora: number): Promise<SituacaoEnfileiramento>;
  obter(propostaId: string): Promise<ItemFilaSync | undefined>;
  /** Itens pendentes ou com erro cujo reenvio já venceu, em ordem de chegada. */
  listarElegiveis(agora: number, limite: number): Promise<ItemFilaSync[]>;
  /** Devolve para 'pendente' itens presos em 'sincronizando' (app encerrado no meio do envio). */
  recuperarTravadas(agora: number): Promise<number>;
  marcarSincronizando(propostaId: string, agora: number): Promise<void>;
  marcarSincronizada(propostaId: string, agora: number): Promise<void>;
  marcarErro(propostaId: string, falha: FalhaRegistrada, agora: number): Promise<void>;
  /** Volta para 'pendente' sem contar tentativa (ex.: rede caiu durante o envio). */
  devolverParaPendente(propostaId: string, agora: number): Promise<void>;
}

interface LinhaFilaSync {
  proposta_id: string;
  status_sync: StatusSync;
  tentativas: number;
  proximo_envio_em: number | null;
  ultimo_erro: string | null;
  enfileirada_em: number;
  atualizada_em: number;
}

function paraItem(l: LinhaFilaSync): ItemFilaSync {
  return {
    propostaId: l.proposta_id,
    statusSync: l.status_sync,
    tentativas: l.tentativas,
    proximoEnvioEm: l.proximo_envio_em,
    ultimoErro: l.ultimo_erro,
    enfileiradaEm: l.enfileirada_em,
    atualizadaEm: l.atualizada_em,
  };
}

export class FilaSyncSqlite implements FilaSync {
  constructor(private readonly db: SqlExecutor) {}

  async enfileirar(propostaId: string, agora: number): Promise<SituacaoEnfileiramento> {
    return this.db.transacao(async (tx) => {
      const [existente] = await tx.consultar<Pick<LinhaFilaSync, 'status_sync'>>(
        'SELECT status_sync FROM fila_sync_propostas WHERE proposta_id = ?',
        [propostaId],
      );

      if (!existente) {
        await tx.executar(
          `INSERT INTO fila_sync_propostas
            (proposta_id, status_sync, tentativas, proximo_envio_em, ultimo_erro, enfileirada_em, atualizada_em)
           VALUES (?, ?, 0, ?, NULL, ?, ?)`,
          [propostaId, StatusSync.Pendente, agora, agora, agora],
        );
        return 'enfileirada';
      }

      if (existente.status_sync === StatusSync.Erro) {
        await tx.executar(
          `UPDATE fila_sync_propostas
           SET status_sync = ?, tentativas = 0, proximo_envio_em = ?, ultimo_erro = NULL, atualizada_em = ?
           WHERE proposta_id = ?`,
          [StatusSync.Pendente, agora, agora, propostaId],
        );
        return 'reenfileirada';
      }

      return 'ja-na-fila';
    });
  }

  async obter(propostaId: string): Promise<ItemFilaSync | undefined> {
    const [linha] = await this.db.consultar<LinhaFilaSync>(
      'SELECT * FROM fila_sync_propostas WHERE proposta_id = ?',
      [propostaId],
    );
    return linha ? paraItem(linha) : undefined;
  }

  async listarElegiveis(agora: number, limite: number): Promise<ItemFilaSync[]> {
    const linhas = await this.db.consultar<LinhaFilaSync>(
      `SELECT * FROM fila_sync_propostas
       WHERE status_sync IN (?, ?)
         AND proximo_envio_em IS NOT NULL
         AND proximo_envio_em <= ?
       ORDER BY enfileirada_em, proposta_id
       LIMIT ?`,
      [StatusSync.Pendente, StatusSync.Erro, agora, limite],
    );
    return linhas.map(paraItem);
  }

  async recuperarTravadas(agora: number): Promise<number> {
    const travadas = await this.db.consultar<{ total: number }>(
      'SELECT COUNT(*) AS total FROM fila_sync_propostas WHERE status_sync = ?',
      [StatusSync.Sincronizando],
    );
    await this.db.executar(
      `UPDATE fila_sync_propostas
       SET status_sync = ?, proximo_envio_em = ?, atualizada_em = ?
       WHERE status_sync = ?`,
      [StatusSync.Pendente, agora, agora, StatusSync.Sincronizando],
    );
    return travadas[0]?.total ?? 0;
  }

  async marcarSincronizando(propostaId: string, agora: number): Promise<void> {
    await this.atualizarStatus(propostaId, StatusSync.Sincronizando, agora);
  }

  async marcarSincronizada(propostaId: string, agora: number): Promise<void> {
    await this.db.executar(
      `UPDATE fila_sync_propostas
       SET status_sync = ?, proximo_envio_em = NULL, ultimo_erro = NULL, atualizada_em = ?
       WHERE proposta_id = ?`,
      [StatusSync.Sincronizada, agora, propostaId],
    );
  }

  async marcarErro(propostaId: string, falha: FalhaRegistrada, agora: number): Promise<void> {
    await this.db.executar(
      `UPDATE fila_sync_propostas
       SET status_sync = ?, tentativas = ?, proximo_envio_em = ?, ultimo_erro = ?, atualizada_em = ?
       WHERE proposta_id = ?`,
      [StatusSync.Erro, falha.tentativas, falha.proximoEnvioEm, falha.mensagem, agora, propostaId],
    );
  }

  async devolverParaPendente(propostaId: string, agora: number): Promise<void> {
    await this.db.executar(
      `UPDATE fila_sync_propostas
       SET status_sync = ?, proximo_envio_em = ?, atualizada_em = ?
       WHERE proposta_id = ?`,
      [StatusSync.Pendente, agora, agora, propostaId],
    );
  }

  private async atualizarStatus(propostaId: string, status: StatusSync, agora: number) {
    await this.db.executar(
      'UPDATE fila_sync_propostas SET status_sync = ?, atualizada_em = ? WHERE proposta_id = ?',
      [status, agora, propostaId],
    );
  }
}
