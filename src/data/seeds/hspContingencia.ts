/**
 * hspContingencia.ts
 *
 * SCRUM-17 — Seed de contingência de HSP (Horas de Sol Pleno, kWh/m²·dia).
 * Usado como fallback quando a busca de HSP em tempo real (SCRUM-8) falha.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ TODO: substituir por dados oficiais.                                    │
 * │ Os valores de HSP abaixo são DADOS DE EXEMPLO, sem validação, e servem  │
 * │ só para exercitar a estrutura (migração, carga idempotente, fallback).  │
 * │ Fonte recomendada: Atlas Brasileiro de Energia Solar, 2ª ed.            │
 * │ (INPE/LABREN, 2017) ou CRESESB/SunData, irradiação no plano inclinado.  │
 * │ Ao trocar pelos dados oficiais: preencher `fonte`, marcar               │
 * │ `dadoDeExemplo: false` e incrementar VERSAO_SEED_HSP.                   │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Os códigos IBGE dos municípios são reais (tabela de municípios do IBGE).
 */

export const NOME_SEED_HSP = 'hsp_contingencia';

/**
 * Versão do conteúdo deste seed. Incrementar SEMPRE que os registros mudarem:
 * a carga inicial só reaplica o seed quando esta versão é maior que a gravada.
 */
export const VERSAO_SEED_HSP = 1;

export interface RegistroHspContingencia {
  abrangencia: 'cidade' | 'uf';
  /** Obrigatório quando abrangencia = 'cidade'. */
  codigoIbge?: string;
  cidade?: string;
  uf: string;
  hspMedioAnual: number;
  /** 12 valores (jan..dez), quando a fonte fornecer. */
  hspMensal?: readonly number[];
  fonte: string;
  dadoDeExemplo: boolean;
}

const FONTE_EXEMPLO = 'EXEMPLO — TODO: substituir por dados oficiais (Atlas Brasileiro de Energia Solar / CRESESB)';

export const SEED_HSP_CONTINGENCIA: readonly RegistroHspContingencia[] = [
  // ── Cidades ──
  { abrangencia: 'cidade', codigoIbge: '3550308', cidade: 'São Paulo', uf: 'SP', hspMedioAnual: 4.5, fonte: FONTE_EXEMPLO, dadoDeExemplo: true },
  { abrangencia: 'cidade', codigoIbge: '3304557', cidade: 'Rio de Janeiro', uf: 'RJ', hspMedioAnual: 4.8, fonte: FONTE_EXEMPLO, dadoDeExemplo: true },
  { abrangencia: 'cidade', codigoIbge: '3106200', cidade: 'Belo Horizonte', uf: 'MG', hspMedioAnual: 5.0, fonte: FONTE_EXEMPLO, dadoDeExemplo: true },
  { abrangencia: 'cidade', codigoIbge: '5300108', cidade: 'Brasília', uf: 'DF', hspMedioAnual: 5.2, fonte: FONTE_EXEMPLO, dadoDeExemplo: true },
  { abrangencia: 'cidade', codigoIbge: '2927408', cidade: 'Salvador', uf: 'BA', hspMedioAnual: 5.1, fonte: FONTE_EXEMPLO, dadoDeExemplo: true },
  { abrangencia: 'cidade', codigoIbge: '2304400', cidade: 'Fortaleza', uf: 'CE', hspMedioAnual: 5.5, fonte: FONTE_EXEMPLO, dadoDeExemplo: true },
  { abrangencia: 'cidade', codigoIbge: '4314902', cidade: 'Porto Alegre', uf: 'RS', hspMedioAnual: 4.4, fonte: FONTE_EXEMPLO, dadoDeExemplo: true },
  { abrangencia: 'cidade', codigoIbge: '1302603', cidade: 'Manaus', uf: 'AM', hspMedioAnual: 4.6, fonte: FONTE_EXEMPLO, dadoDeExemplo: true },

  // ── Médias por UF (fallback quando a cidade não está na base) ──
  { abrangencia: 'uf', uf: 'SP', hspMedioAnual: 4.6, fonte: FONTE_EXEMPLO, dadoDeExemplo: true },
  { abrangencia: 'uf', uf: 'RJ', hspMedioAnual: 4.8, fonte: FONTE_EXEMPLO, dadoDeExemplo: true },
  { abrangencia: 'uf', uf: 'MG', hspMedioAnual: 5.1, fonte: FONTE_EXEMPLO, dadoDeExemplo: true },
  { abrangencia: 'uf', uf: 'DF', hspMedioAnual: 5.2, fonte: FONTE_EXEMPLO, dadoDeExemplo: true },
  { abrangencia: 'uf', uf: 'BA', hspMedioAnual: 5.3, fonte: FONTE_EXEMPLO, dadoDeExemplo: true },
  { abrangencia: 'uf', uf: 'CE', hspMedioAnual: 5.5, fonte: FONTE_EXEMPLO, dadoDeExemplo: true },
  { abrangencia: 'uf', uf: 'RS', hspMedioAnual: 4.5, fonte: FONTE_EXEMPLO, dadoDeExemplo: true },
  { abrangencia: 'uf', uf: 'AM', hspMedioAnual: 4.6, fonte: FONTE_EXEMPLO, dadoDeExemplo: true },
];
