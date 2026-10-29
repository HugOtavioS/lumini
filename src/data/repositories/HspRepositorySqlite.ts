/**
 * HspRepositorySqlite.ts
 *
 * SCRUM-17 — Implementação do HspRepository com fallback para a contingência local.
 *
 * Ordem de resolução:
 * 1. Fonte em tempo real (SCRUM-8), se houver rede, com timeout.
 * 2. Contingência local (SQLite): cidade por código IBGE → cidade por nome/UF → média da UF.
 * 3. Sem nenhum dado: lança HspIndisponivelError.
 */

import {
  FonteHspTempoReal,
  HspIndisponivelError,
  HspRepository,
  HspTempoReal,
  LocalizacaoHsp,
  MotivoFallbackHsp,
  ResultadoHsp,
} from '@/domain/repositories/HspRepository';
import type { SqlExecutor } from '../database/SqlExecutor';
import { chaveCidade } from './chaveCidade';

/**
 * Tempo máximo de espera pela fonte em tempo real antes de cair na contingência.
 * Decisão de UX (não é dado técnico externo): o técnico em campo não deve
 * esperar mais que alguns segundos. Ajustável por injeção.
 */
export const TIMEOUT_HSP_TEMPO_REAL_PADRAO_MS = 8000;

export interface DependenciasHspRepository {
  db: SqlExecutor;
  fonteTempoReal: FonteHspTempoReal;
  /** Evita tentar a rede quando já se sabe que está offline. */
  estaOnline?: () => Promise<boolean>;
  timeoutMs?: number;
}

interface LinhaHspContingencia {
  abrangencia: 'cidade' | 'uf';
  hsp_medio_anual: number;
  hsp_mensal: string | null;
  fonte: string;
  dado_de_exemplo: number;
}

class TimeoutHspError extends Error {
  constructor(ms: number) {
    super(`Fonte de HSP em tempo real excedeu ${ms} ms.`);
    this.name = 'TimeoutHspError';
  }
}

function hspValido(dado: HspTempoReal | null | undefined): dado is HspTempoReal {
  return (
    dado != null &&
    Number.isFinite(dado.hspMedioAnual) &&
    dado.hspMedioAnual > 0
  );
}

export class HspRepositorySqlite implements HspRepository {
  private readonly timeoutMs: number;

  constructor(private readonly deps: DependenciasHspRepository) {
    this.timeoutMs = deps.timeoutMs ?? TIMEOUT_HSP_TEMPO_REAL_PADRAO_MS;
  }

  async resolverHsp(local: LocalizacaoHsp): Promise<ResultadoHsp> {
    const tempoReal = await this.tentarTempoReal(local);
    if (typeof tempoReal !== 'string') {
      return { ...tempoReal, origem: 'tempo-real', dadoDeExemplo: false };
    }
    const motivo = tempoReal;

    const contingencia = await this.buscarContingencia(local);
    if (!contingencia) {
      throw new HspIndisponivelError(local, motivo);
    }

    return {
      hspMedioAnual: contingencia.hsp_medio_anual,
      hspMensal: contingencia.hsp_mensal
        ? (JSON.parse(contingencia.hsp_mensal) as number[])
        : undefined,
      fonte: contingencia.fonte,
      origem: 'contingencia',
      motivoFallback: motivo,
      abrangencia: contingencia.abrangencia,
      dadoDeExemplo: contingencia.dado_de_exemplo === 1,
    };
  }

  /** Retorna o dado em tempo real ou o motivo pelo qual não foi possível obtê-lo. */
  private async tentarTempoReal(
    local: LocalizacaoHsp,
  ): Promise<HspTempoReal | MotivoFallbackHsp> {
    if (this.deps.estaOnline) {
      const online = await this.deps.estaOnline().catch(() => false);
      if (!online) return 'sem-rede';
    }

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new TimeoutHspError(this.timeoutMs));
      }, this.timeoutMs);
    });

    try {
      const dado = await Promise.race([
        this.deps.fonteTempoReal.buscarHsp(local, controller.signal),
        timeout,
      ]);
      return hspValido(dado) ? dado : 'sem-dado';
    } catch (erro) {
      return erro instanceof TimeoutHspError ? 'timeout' : 'erro';
    } finally {
      clearTimeout(timer);
    }
  }

  private async buscarContingencia(
    local: LocalizacaoHsp,
  ): Promise<LinhaHspContingencia | undefined> {
    const colunas =
      'abrangencia, hsp_medio_anual, hsp_mensal, fonte, dado_de_exemplo';
    const uf = local.uf.toUpperCase();

    if (local.codigoIbge) {
      const [porIbge] = await this.deps.db.consultar<LinhaHspContingencia>(
        `SELECT ${colunas} FROM hsp_contingencia
         WHERE abrangencia = 'cidade' AND codigo_ibge = ? LIMIT 1`,
        [local.codigoIbge],
      );
      if (porIbge) return porIbge;
    }

    const [porNome] = await this.deps.db.consultar<LinhaHspContingencia>(
      `SELECT ${colunas} FROM hsp_contingencia
       WHERE abrangencia = 'cidade' AND uf = ? AND cidade_chave = ? LIMIT 1`,
      [uf, chaveCidade(local.cidade)],
    );
    if (porNome) return porNome;

    const [porUf] = await this.deps.db.consultar<LinhaHspContingencia>(
      `SELECT ${colunas} FROM hsp_contingencia
       WHERE abrangencia = 'uf' AND uf = ? LIMIT 1`,
      [uf],
    );
    return porUf;
  }
}
