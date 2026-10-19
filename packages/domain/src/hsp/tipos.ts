/**
 * SCRUM-8 — tipos da busca de HSP (Horas de Sol Pleno).
 */

/**
 * Registro da tabela Localidade Climática (Dicionário de Dados, 4.1) — a base
 * de contingência usada sem internet (SCRUM-17 / RN02).
 */
export interface LocalidadeClimatica {
  idLocalidade: string;
  cidade: string;
  /** UF (2 letras). */
  estado: string;
  latitude: number;
  longitude: number;
  /** HSP médio anual (kWh/m²/dia). */
  hspMedio: number;
  /** Irradiação global horizontal média (kWh/m²/dia); numericamente igual ao HSP. */
  irradiacaoKwhM2Dia: number;
  /** HSP de cada mês (jan→dez), quando a fonte fornece. Coluna `hsp_mensal` (v1.3). */
  hspMensal?: number[] | null;
  fonte: 'API' | 'Contingência';
  /** Data/hora ISO da última atualização. */
  dataAtualizacao: string;
}

/** De onde veio o HSP devolvido. */
export type FonteHsp = 'API' | 'Cache' | 'Contingência';

export interface DadosHsp {
  /** HSP médio anual (kWh/m²/dia), com 2 casas. */
  hspMedio: number;
  /** HSP mensal (jan→dez) ou `null` se a fonte não tiver. */
  hspMensal: number[] | null;
  fonte: FonteHsp;
  /** Texto para exibir ao técnico (ex.: "NASA POWER — climatologia 2001–2020"). */
  descricaoFonte: string;
  /** `true` quando o valor é uma referência regional (localidade longe ou média do estado — RF08 2b). */
  aproximado: boolean;
  /** Localidade da base usada, quando a fonte é a contingência. */
  localidade?: { cidade: string; estado: string; distanciaKm: number | null };
  /** Coordenadas consultadas (arredondadas), quando houver GPS. */
  coordenadas?: { latitude: number; longitude: number };
  /** Data/hora ISO em que o valor foi obtido. */
  obtidoEm: string;
}

export type ResultadoHsp =
  | { status: 'ok'; dados: DadosHsp; avisos: string[] }
  | { status: 'indisponivel'; motivo: string; avisos: string[] };

/** Resposta de um provedor online de HSP. */
export interface RespostaProvedorHsp {
  hspMedio: number;
  hspMensal: number[] | null;
  descricao: string;
}

/** Serviço externo de clima/irradiação (ator "Serviço de Clima" da ERS). */
export interface ProvedorHspOnline {
  nome: string;
  buscar(latitude: number, longitude: number, sinal: AbortSignal): Promise<RespostaProvedorHsp>;
}

/** Cache local de resultados (no app: uma tabela SQLite). */
export interface CacheHsp {
  obter(chave: string): Promise<DadosHsp | null> | DadosHsp | null;
  salvar(chave: string, dados: DadosHsp): Promise<void> | void;
}

/** Evento de log da busca de HSP (RNF12: registrar falhas e o uso do fallback). */
export interface EventoHsp {
  tipo: 'api_ok' | 'api_falhou' | 'api_timeout' | 'offline' | 'cache' | 'contingencia' | 'indisponivel';
  mensagem: string;
  duracaoMs?: number;
}

/** Assinatura mínima de `fetch` (injetada, para testes e para não depender do ambiente). */
export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
