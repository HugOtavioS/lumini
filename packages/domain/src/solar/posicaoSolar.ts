/**
 * SCRUM-80 — posição do sol por coordenadas geográficas e data.
 *
 * Algoritmo: equações do NOAA Solar Calculator (National Oceanic and
 * Atmospheric Administration), baseadas em Jean Meeus, *Astronomical
 * Algorithms* (2ª ed., 1998). É o algoritmo "padrão" mais usado em
 * ferramentas de energia solar quando não se precisa da precisão extrema do
 * SPA do NREL: o erro é da ordem de 0,01° entre os anos 1800 e 2100.
 * Os testes comparam o resultado com o SPA do NREL (via pvlib).
 *
 * Convenções:
 * - latitude positiva no hemisfério Norte (o Brasil é quase todo negativo);
 * - longitude positiva a Leste de Greenwich (o Brasil é todo negativo);
 * - azimute em graus a partir do Norte, no sentido horário
 *   (0° = N, 90° = L, 180° = S, 270° = O), igual a `azimute_graus` da medição;
 * - o instante é sempre um `Date` (UTC internamente), sem depender do fuso
 *   do aparelho.
 */
import { ehNumeroFinito, garantirSemErros, type ErroCampo } from '../erros';
import { graus, limitar, normalizar360, radianos } from '../util/numeros';

export interface PosicaoSolar {
  /** Elevação aparente, corrigida pela refração atmosférica (°). Negativa quando o sol está abaixo do horizonte. */
  elevacaoGraus: number;
  /** Elevação geométrica, sem refração (°). */
  elevacaoGeometricaGraus: number;
  /** Ângulo zenital aparente = 90° − elevação aparente. */
  zenitalGraus: number;
  /** Azimute do sol a partir do Norte, sentido horário (°). */
  azimuteGraus: number;
  /** Declinação solar (°). */
  declinacaoGraus: number;
  /** Equação do tempo (minutos). */
  equacaoTempoMin: number;
  /** Ângulo horário (°): negativo de manhã, zero no meio-dia solar, positivo à tarde. */
  anguloHorarioGraus: number;
}

/** Grandezas que dependem só do instante (não do local). */
interface EfemerideSolar {
  declinacaoRad: number;
  equacaoTempoMin: number;
}

const MS_POR_DIA = 86_400_000;
/** Dia juliano de 1970-01-01T00:00Z. */
const DIA_JULIANO_EPOCA_UNIX = 2_440_587.5;
/** Dia juliano de J2000.0 (2000-01-01T12:00Z). */
const DIA_JULIANO_J2000 = 2_451_545;

/** Dia juliano de um instante. */
export function diaJuliano(instante: Date): number {
  return instante.getTime() / MS_POR_DIA + DIA_JULIANO_EPOCA_UNIX;
}

/** Declinação e equação do tempo no instante (NOAA, colunas G–V da planilha). */
function efemeride(instante: Date): EfemerideSolar {
  const seculoJuliano = (diaJuliano(instante) - DIA_JULIANO_J2000) / 36_525;
  const t = seculoJuliano;

  const longitudeMedia = normalizar360(280.46646 + t * (36000.76983 + t * 0.0003032));
  const anomaliaMedia = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const excentricidade = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);

  const m = radianos(anomaliaMedia);
  const equacaoCentro =
    Math.sin(m) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * m) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * m) * 0.000289;

  const longitudeVerdadeira = longitudeMedia + equacaoCentro;
  const omega = radianos(125.04 - 1934.136 * t);
  const longitudeAparente = longitudeVerdadeira - 0.00569 - 0.00478 * Math.sin(omega);

  const obliquidadeMedia = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliquidade = radianos(obliquidadeMedia + 0.00256 * Math.cos(omega));

  const declinacaoRad = Math.asin(Math.sin(obliquidade) * Math.sin(radianos(longitudeAparente)));

  const y = Math.tan(obliquidade / 2) ** 2;
  const l0 = radianos(longitudeMedia);
  const e = excentricidade;
  const equacaoTempoRad =
    y * Math.sin(2 * l0) -
    2 * e * Math.sin(m) +
    4 * e * y * Math.sin(m) * Math.cos(2 * l0) -
    0.5 * y * y * Math.sin(4 * l0) -
    1.25 * e * e * Math.sin(2 * m);

  return { declinacaoRad, equacaoTempoMin: 4 * graus(equacaoTempoRad) };
}

/**
 * Refração atmosférica aproximada (°) em função da elevação geométrica,
 * pela mesma aproximação por faixas usada no NOAA Solar Calculator.
 */
export function refracaoAtmosfericaGraus(elevacaoGeometrica: number): number {
  const e = elevacaoGeometrica;
  if (e > 85) return 0;
  const tanE = Math.tan(radianos(e));
  let segundosDeArco: number;
  if (e > 5) {
    segundosDeArco = 58.1 / tanE - 0.07 / tanE ** 3 + 0.000086 / tanE ** 5;
  } else if (e > -0.575) {
    segundosDeArco = 1735 + e * (-518.2 + e * (103.4 + e * (-12.79 + e * 0.711)));
  } else {
    segundosDeArco = -20.772 / tanE;
  }
  return segundosDeArco / 3600;
}

export function validarCoordenadas(latitude: number, longitude: number): ErroCampo[] {
  const erros: ErroCampo[] = [];
  if (!ehNumeroFinito(latitude) || latitude < -90 || latitude > 90) {
    erros.push({ campo: 'latitude', mensagem: 'A latitude deve estar entre -90° e 90°.' });
  }
  if (!ehNumeroFinito(longitude) || longitude < -180 || longitude > 180) {
    erros.push({ campo: 'longitude', mensagem: 'A longitude deve estar entre -180° e 180°.' });
  }
  return erros;
}

export interface OpcoesPosicaoSolar {
  /** Aplica a correção de refração na elevação (padrão `true`). */
  refracao?: boolean;
}

/**
 * Posição do sol em um instante, para um ponto (latitude/longitude em graus).
 *
 * @example
 * // Taubaté-SP, 21/12/2026 às 12:00 (UTC−3)
 * calcularPosicaoSolar(new Date('2026-12-21T15:00:00Z'), -23.0265, -45.5559);
 *
 * @throws {ErroValidacao} se as coordenadas ou o instante forem inválidos.
 */
export function calcularPosicaoSolar(
  instante: Date,
  latitude: number,
  longitude: number,
  opcoes: OpcoesPosicaoSolar = {},
): PosicaoSolar {
  const erros = validarCoordenadas(latitude, longitude);
  if (!(instante instanceof Date) || Number.isNaN(instante.getTime())) {
    erros.push({ campo: 'instante', mensagem: 'Data/hora inválida.' });
  }
  garantirSemErros(erros);

  const { declinacaoRad, equacaoTempoMin } = efemeride(instante);

  // Tempo solar verdadeiro (minutos) a partir do horário UTC.
  const msNoDiaUtc = ((instante.getTime() % MS_POR_DIA) + MS_POR_DIA) % MS_POR_DIA;
  const minutosUtc = msNoDiaUtc / 60_000;
  const tempoSolarVerdadeiro = (((minutosUtc + equacaoTempoMin + 4 * longitude) % 1440) + 1440) % 1440;
  // Tempo solar em [0, 1440) min → ângulo horário em [-180°, 180°).
  const anguloHorario = tempoSolarVerdadeiro / 4 - 180;

  const phi = radianos(latitude);
  const h = radianos(anguloHorario);
  const cosZenite = limitar(
    Math.sin(phi) * Math.sin(declinacaoRad) + Math.cos(phi) * Math.cos(declinacaoRad) * Math.cos(h),
    -1,
    1,
  );
  const zenitalGeometrico = graus(Math.acos(cosZenite));
  const elevacaoGeometrica = 90 - zenitalGeometrico;

  // Azimute pela forma com atan2 (Meeus), estável mesmo com o sol perto do zênite.
  const azimuteDoSul = Math.atan2(
    Math.sin(h),
    Math.cos(h) * Math.sin(phi) - Math.tan(declinacaoRad) * Math.cos(phi),
  );
  const azimute = normalizar360(graus(azimuteDoSul) + 180);

  const elevacao =
    opcoes.refracao === false ? elevacaoGeometrica : elevacaoGeometrica + refracaoAtmosfericaGraus(elevacaoGeometrica);

  return {
    elevacaoGraus: elevacao,
    elevacaoGeometricaGraus: elevacaoGeometrica,
    zenitalGraus: 90 - elevacao,
    azimuteGraus: azimute,
    declinacaoGraus: graus(declinacaoRad),
    equacaoTempoMin,
    anguloHorarioGraus: anguloHorario,
  };
}

/** Ângulo de depressão usado para nascer/pôr do sol: raio do disco solar + refração média (0,833°). */
export const DEPRESSAO_NASCER_POR_GRAUS = 0.833;

export interface EventosSolaresUtc {
  /** Meio-dia solar (instante UTC). */
  meioDiaSolar: Date;
  /** Nascer do sol; `null` em dia polar ou noite polar. */
  nascer: Date | null;
  /** Pôr do sol; `null` em dia polar ou noite polar. */
  por: Date | null;
  /** Duração do dia claro (horas). */
  duracaoDiaHoras: number;
}

/**
 * Nascer, pôr e meio-dia solar do dia civil informado (NOAA). O dia é
 * definido pela data local (`ano`, `mes`, `dia`) no fuso `fusoHorarioHoras`.
 */
export function calcularEventosSolares(
  ano: number,
  mes: number,
  dia: number,
  latitude: number,
  longitude: number,
  fusoHorarioHoras: number,
): EventosSolaresUtc {
  garantirSemErros(validarCoordenadas(latitude, longitude));
  const meiaNoiteLocalUtcMs = Date.UTC(ano, mes - 1, dia) - fusoHorarioHoras * 3_600_000;

  // 1ª aproximação: efemérides ao meio-dia local; 2ª: no meio-dia solar encontrado.
  let meioDiaMinutos = 720;
  for (let i = 0; i < 2; i += 1) {
    const { equacaoTempoMin } = efemeride(new Date(meiaNoiteLocalUtcMs + meioDiaMinutos * 60_000));
    meioDiaMinutos = 720 - 4 * longitude - equacaoTempoMin + fusoHorarioHoras * 60;
  }
  const meioDiaSolar = new Date(meiaNoiteLocalUtcMs + meioDiaMinutos * 60_000);
  const { declinacaoRad } = efemeride(meioDiaSolar);

  const phi = radianos(latitude);
  const cosH =
    Math.cos(radianos(90 + DEPRESSAO_NASCER_POR_GRAUS)) / (Math.cos(phi) * Math.cos(declinacaoRad)) -
    Math.tan(phi) * Math.tan(declinacaoRad);

  if (cosH > 1) {
    return { meioDiaSolar, nascer: null, por: null, duracaoDiaHoras: 0 };
  }
  if (cosH < -1) {
    return { meioDiaSolar, nascer: null, por: null, duracaoDiaHoras: 24 };
  }
  const anguloHorarioNascer = graus(Math.acos(cosH));
  const meiaDuracaoMs = anguloHorarioNascer * 4 * 60_000;
  return {
    meioDiaSolar,
    nascer: new Date(meioDiaSolar.getTime() - meiaDuracaoMs),
    por: new Date(meioDiaSolar.getTime() + meiaDuracaoMs),
    duracaoDiaHoras: (anguloHorarioNascer * 8) / 60,
  };
}
