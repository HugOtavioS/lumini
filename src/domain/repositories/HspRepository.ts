/**
 * HspRepository.ts
 *
 * SCRUM-17 — Contrato de resolução do HSP (Horas de Sol Pleno).
 * Responsabilidades:
 * - Declarar a interface que a camada data implementa
 * - Declarar a fonte de HSP em tempo real (SCRUM-8) como porta injetável
 *
 * Regra: tenta o HSP em tempo real; se falhar (timeout, erro, sem rede),
 * cai automaticamente na base de contingência local. O retorno indica a origem.
 */

export type OrigemHsp = 'tempo-real' | 'contingencia';

export type MotivoFallbackHsp = 'sem-rede' | 'timeout' | 'erro' | 'sem-dado';

export interface LocalizacaoHsp {
  /** Código IBGE do município (7 dígitos). Chave preferencial de busca. */
  codigoIbge?: string;
  cidade: string;
  /** Sigla da UF (ex.: 'SP'). Usada no fallback regional. */
  uf: string;
  latitude?: number;
  longitude?: number;
}

/** Dado retornado pela fonte em tempo real (SCRUM-8). */
export interface HspTempoReal {
  /** HSP médio anual em kWh/m²·dia. */
  hspMedioAnual: number;
  /** HSP médio de cada mês (jan..dez), quando disponível. */
  hspMensal?: readonly number[];
  fonte: string;
}

export interface ResultadoHsp extends HspTempoReal {
  origem: OrigemHsp;
  /** Presente quando origem = 'contingencia'. */
  motivoFallback?: MotivoFallbackHsp;
  /** Abrangência do dado de contingência usado (cidade ou média da UF). */
  abrangencia?: 'cidade' | 'uf';
  /**
   * true quando o dado de contingência ainda é de EXEMPLO (seed não oficial).
   * A UI deve sinalizar isso na proposta.
   */
  dadoDeExemplo: boolean;
}

/** Porta para a busca de HSP em tempo real (implementada pelo SCRUM-8). */
export interface FonteHspTempoReal {
  buscarHsp(local: LocalizacaoHsp, signal: AbortSignal): Promise<HspTempoReal>;
}

export interface HspRepository {
  resolverHsp(local: LocalizacaoHsp): Promise<ResultadoHsp>;
}

/** Lançado quando nem a fonte em tempo real nem a contingência têm dado. */
export class HspIndisponivelError extends Error {
  constructor(
    readonly local: LocalizacaoHsp,
    readonly motivoFallback: MotivoFallbackHsp,
  ) {
    super(
      `HSP indisponível para ${local.cidade}/${local.uf}: tempo real falhou (${motivoFallback}) e não há contingência.`,
    );
    this.name = 'HspIndisponivelError';
  }
}
