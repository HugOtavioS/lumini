/**
 * SCRUM-80 — trajetória solar ao longo do dia e do ano.
 *
 * Usa {@link calcularPosicaoSolar} para amostrar o caminho do sol em passos
 * fixos (padrão 10 min) entre o nascer e o pôr do sol. A trajetória anual é
 * formada por um dia representativo de cada mês — o dia 21, como nos
 * diagramas solares clássicos (21/03, 21/06, 21/09 e 21/12 ficam próximos dos
 * equinócios e solstícios), ou o "dia médio" de Klein (1977), usado em
 * cálculos mensais de energia.
 */
import { ehNumeroFinito, garantirSemErros, type ErroCampo } from '../erros';
import { arredondar, CASAS_DECIMAIS } from '../util/numeros';
import { calcularEventosSolares, calcularPosicaoSolar, validarCoordenadas } from './posicaoSolar';

/** Data do calendário local (sem hora). `mes` vai de 1 a 12. */
export interface DataLocal {
  ano: number;
  mes: number;
  dia: number;
}

/** Fuso horário de Brasília (sem horário de verão desde 2019). */
export const FUSO_BRASILIA_HORAS = -3;

/** Passo padrão de amostragem da trajetória (minutos). */
export const PASSO_PADRAO_MINUTOS = 10;

/**
 * Dia médio de cada mês segundo Klein (1977), reproduzido em Duffie & Beckman,
 * *Solar Engineering of Thermal Processes*, Tabela 1.6.1. É o dia cuja
 * radiação extraterrestre mais se aproxima da média do mês.
 */
export const DIA_MEDIO_KLEIN: readonly number[] = [17, 16, 16, 15, 15, 11, 17, 16, 15, 15, 14, 10];

export const NOMES_MESES: readonly string[] = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

export interface PontoTrajetoria {
  /** Minutos desde a meia-noite local. */
  minutosLocal: number;
  /** Hora local no formato HH:MM. */
  horaLocal: string;
  instante: Date;
  /** Elevação aparente (°). */
  elevacaoGraus: number;
  /** Azimute a partir do Norte, sentido horário (°). */
  azimuteGraus: number;
}

export interface TrajetoriaDiaria {
  data: DataLocal;
  fusoHorarioHoras: number;
  /** Hora local do nascer do sol (HH:MM) ou `null` em dia/noite polar. */
  nascerDoSol: string | null;
  porDoSol: string | null;
  meioDiaSolar: string;
  duracaoDiaHoras: number;
  /** Maior elevação do dia (°), atingida no meio-dia solar. */
  elevacaoMaximaGraus: number;
  /** Azimute do sol no meio-dia solar: ~0° (Norte) ou ~180° (Sul). */
  azimuteMeioDiaGraus: number;
  /** Pontos com o sol acima do horizonte, do nascer ao pôr. */
  pontos: PontoTrajetoria[];
}

export interface EntradaTrajetoriaDiaria {
  latitude: number;
  longitude: number;
  data: DataLocal;
  /** Deslocamento do fuso em horas (ex.: -3 para Brasília). Padrão: -3. */
  fusoHorarioHoras?: number;
  /** Passo entre pontos (minutos). Padrão: 10. */
  passoMinutos?: number;
}

/** `true` quando a data existe no calendário (considera anos bissextos). */
export function ehDataValida(data: DataLocal): boolean {
  const { ano, mes, dia } = data;
  if (![ano, mes, dia].every(Number.isInteger)) return false;
  if (mes < 1 || mes > 12 || dia < 1) return false;
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return dia <= ultimoDia;
}

function validarTrajetoria(entrada: EntradaTrajetoriaDiaria): ErroCampo[] {
  const erros = validarCoordenadas(entrada.latitude, entrada.longitude);
  if (!ehDataValida(entrada.data)) {
    erros.push({ campo: 'data', mensagem: 'Data inválida.' });
  }
  const fuso = entrada.fusoHorarioHoras ?? FUSO_BRASILIA_HORAS;
  if (!ehNumeroFinito(fuso) || fuso < -12 || fuso > 14) {
    erros.push({ campo: 'fusoHorarioHoras', mensagem: 'O fuso horário deve estar entre -12 e +14 horas.' });
  }
  const passo = entrada.passoMinutos ?? PASSO_PADRAO_MINUTOS;
  if (!ehNumeroFinito(passo) || passo < 1 || passo > 120) {
    erros.push({ campo: 'passoMinutos', mensagem: 'O passo deve estar entre 1 e 120 minutos.' });
  }
  return erros;
}

/** Converte minutos desde a meia-noite em HH:MM. */
export function formatarHora(minutos: number): string {
  const total = ((Math.round(minutos) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function minutosLocais(instante: Date, meiaNoiteLocalUtcMs: number): number {
  return (instante.getTime() - meiaNoiteLocalUtcMs) / 60_000;
}

/**
 * Trajetória do sol em um dia: nascer, pôr, meio-dia solar, elevação máxima e
 * os pontos (elevação/azimute) a cada `passoMinutos`.
 *
 * @throws {ErroValidacao} se coordenadas, data, fuso ou passo forem inválidos.
 */
export function calcularTrajetoriaDiaria(entrada: EntradaTrajetoriaDiaria): TrajetoriaDiaria {
  garantirSemErros(validarTrajetoria(entrada));
  const { latitude, longitude, data } = entrada;
  const fuso = entrada.fusoHorarioHoras ?? FUSO_BRASILIA_HORAS;
  const passo = entrada.passoMinutos ?? PASSO_PADRAO_MINUTOS;

  const meiaNoiteLocalUtcMs = Date.UTC(data.ano, data.mes - 1, data.dia) - fuso * 3_600_000;
  const eventos = calcularEventosSolares(data.ano, data.mes, data.dia, latitude, longitude, fuso);
  const noMeioDia = calcularPosicaoSolar(eventos.meioDiaSolar, latitude, longitude);

  const inicio = eventos.nascer ? minutosLocais(eventos.nascer, meiaNoiteLocalUtcMs) : 0;
  const fim = eventos.por ? minutosLocais(eventos.por, meiaNoiteLocalUtcMs) : 1440;

  const pontos: PontoTrajetoria[] = [];
  const adicionar = (minutos: number, forcarHorizonte: boolean): void => {
    const instante = new Date(meiaNoiteLocalUtcMs + minutos * 60_000);
    const posicao = calcularPosicaoSolar(instante, latitude, longitude);
    if (!forcarHorizonte && posicao.elevacaoGraus <= 0) return;
    pontos.push({
      minutosLocal: minutos,
      horaLocal: formatarHora(minutos),
      instante,
      // No nascer/pôr, o centro do disco está a ~0,3° abaixo do horizonte; para o
      // gráfico, a curva começa e termina exatamente na linha do horizonte.
      elevacaoGraus: forcarHorizonte ? Math.max(0, posicao.elevacaoGraus) : posicao.elevacaoGraus,
      azimuteGraus: posicao.azimuteGraus,
    });
  };

  const noiteInteira = eventos.nascer === null && eventos.duracaoDiaHoras === 0;
  if (!noiteInteira) {
    if (eventos.nascer) adicionar(inicio, true);
    // Começa no primeiro múltiplo do passo depois do nascer (grade regular: 06:10, 06:20...).
    for (let min = Math.floor(inicio / passo) * passo + passo; min < fim; min += passo) {
      if (min > inicio) adicionar(min, false);
    }
    if (eventos.por) adicionar(fim, true);
  }

  return {
    data: { ...data },
    fusoHorarioHoras: fuso,
    nascerDoSol: eventos.nascer ? formatarHora(inicio) : null,
    porDoSol: eventos.por ? formatarHora(fim) : null,
    meioDiaSolar: formatarHora(minutosLocais(eventos.meioDiaSolar, meiaNoiteLocalUtcMs)),
    duracaoDiaHoras: arredondar(eventos.duracaoDiaHoras, 2),
    elevacaoMaximaGraus: arredondar(noMeioDia.elevacaoGraus, CASAS_DECIMAIS.graus),
    azimuteMeioDiaGraus: arredondar(noMeioDia.azimuteGraus, CASAS_DECIMAIS.graus),
    pontos,
  };
}

export interface EntradaTrajetoriaAnual {
  latitude: number;
  longitude: number;
  ano: number;
  fusoHorarioHoras?: number;
  passoMinutos?: number;
  /**
   * Dia de cada mês usado como representativo: um número fixo (padrão 21) ou
   * `'medio'` para o dia médio de Klein.
   */
  diaDoMes?: number | 'medio';
}

/**
 * Trajetória do sol ao longo do ano: uma {@link TrajetoriaDiaria} por mês
 * (janeiro a dezembro), no dia representativo escolhido.
 */
export function calcularTrajetoriaAnual(entrada: EntradaTrajetoriaAnual): TrajetoriaDiaria[] {
  const diaDoMes = entrada.diaDoMes ?? 21;
  const erros: ErroCampo[] = [];
  if (diaDoMes !== 'medio' && (!Number.isInteger(diaDoMes) || diaDoMes < 1 || diaDoMes > 28)) {
    erros.push({ campo: 'diaDoMes', mensagem: "O dia do mês deve estar entre 1 e 28 (ou 'medio')." });
  }
  if (!Number.isInteger(entrada.ano) || entrada.ano < 1900 || entrada.ano > 2100) {
    erros.push({ campo: 'ano', mensagem: 'O ano deve estar entre 1900 e 2100.' });
  }
  garantirSemErros(erros);

  return Array.from({ length: 12 }, (_, i) =>
    calcularTrajetoriaDiaria({
      latitude: entrada.latitude,
      longitude: entrada.longitude,
      data: { ano: entrada.ano, mes: i + 1, dia: diaDoMes === 'medio' ? DIA_MEDIO_KLEIN[i]! : diaDoMes },
      ...(entrada.fusoHorarioHoras !== undefined && { fusoHorarioHoras: entrada.fusoHorarioHoras }),
      ...(entrada.passoMinutos !== undefined && { passoMinutos: entrada.passoMinutos }),
    }),
  );
}
