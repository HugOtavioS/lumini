/**
 * Sombreamento por obstáculos (RF06) — base da visualização do SCRUM-81.
 *
 * Modelo simplificado e documentado, adequado ao MVP:
 *
 * 1. Obstáculos são descritos pelo "perfil de horizonte" visto do centro do
 *    telhado: uma faixa de azimutes e a altura angular do topo. Obstáculos
 *    medidos em metros (distância, altura, largura) são convertidos para esse
 *    formato por {@link obstaculoGeometricoParaAngular}.
 * 2. Para cada mês usa-se o dia médio de Klein e passos de 10 min. Em cada
 *    passo calcula-se a irradiância direta de céu claro (Meinel, com massa de
 *    ar de Kasten & Young) projetada no plano do telhado (cos do ângulo de
 *    incidência). Instantes com o sol atrás do plano não entram na conta (isso
 *    é efeito de orientação, não de sombra).
 * 3. Sombreamento direto do mês = energia direta bloqueada ÷ energia direta.
 * 4. A parte difusa bloqueada é estimada pela fração do céu isotrópico
 *    coberta pelos obstáculos: Σ (Δazimute/360) × sen²(elevação).
 * 5. Sombreamento do mês = f × direto + (1 − f) × difuso, com f = fração
 *    direta da irradiância (padrão 0,6, típica do Brasil).
 * 6. Média anual ponderada pela energia direta de cada mês.
 *
 * O resultado alimenta `sombreamento_perc`, `sombreamento_mensal` e
 * `obstaculos` da tabela Simulação de Sombreamento (Dicionário, 5.2) e entra
 * no dimensionamento como a perda por sombreamento (RF06, passo 5).
 */
import { ehNumeroFinito, garantirSemErros, type ErroCampo } from '../erros';
import { arredondar, CASAS_DECIMAIS, normalizar360, radianos, graus } from '../util/numeros';
import { calcularEventosSolares, calcularPosicaoSolar, validarCoordenadas } from '../solar/posicaoSolar';
import { DIA_MEDIO_KLEIN, FUSO_BRASILIA_HORAS } from '../solar/trajetoria';

/** Obstáculo como é visto do centro do telhado. */
export interface ObstaculoAngular {
  /** Nome livre exibido no diagrama (ex.: "Árvore", "Caixa d'água"). */
  nome?: string;
  /** Azimute da borda esquerda (quem olha para o obstáculo), em graus a partir do Norte. */
  azimuteInicialGraus: number;
  /** Azimute da borda direita. Pode "dar a volta" (ex.: 350° → 10°). */
  azimuteFinalGraus: number;
  /** Altura angular do topo do obstáculo acima do horizonte (°). */
  elevacaoGraus: number;
}

/** Obstáculo medido em metros a partir do centro do telhado. */
export interface ObstaculoGeometrico {
  nome?: string;
  /** Direção do centro do obstáculo (°, a partir do Norte). */
  azimuteGraus: number;
  /** Distância horizontal até o obstáculo (m). */
  distanciaM: number;
  /** Altura do topo do obstáculo acima do telhado (m). */
  alturaM: number;
  /** Largura do obstáculo, perpendicular à linha de visada (m). */
  larguraM: number;
}

/** Plano dos módulos: inclinação e para onde a face está voltada. */
export interface PlanoTelhado {
  /** Inclinação em relação à horizontal (0° a 90°). */
  inclinacaoGraus: number;
  /** Azimute para onde a face está voltada (°, 0 = Norte). */
  azimuteGraus: number;
}

/** Fração direta padrão da irradiância global (≈ 60 % em boa parte do Brasil). */
export const FRACAO_DIRETA_PADRAO = 0.6;

/** Azimute (°) de cada orientação da medição manual (RF05). */
export const AZIMUTE_POR_ORIENTACAO = {
  N: 0,
  NE: 45,
  L: 90,
  SE: 135,
  S: 180,
  SO: 225,
  O: 270,
  NO: 315,
} as const;

export type Orientacao = keyof typeof AZIMUTE_POR_ORIENTACAO;

/** Converte a orientação cardinal da medição (N, NE, …) em azimute. */
export function azimuteDaOrientacao(orientacao: Orientacao): number {
  return AZIMUTE_POR_ORIENTACAO[orientacao];
}

/** Converte um obstáculo em metros para o formato angular. */
export function obstaculoGeometricoParaAngular(o: ObstaculoGeometrico): ObstaculoAngular {
  const erros: ErroCampo[] = [];
  if (!ehNumeroFinito(o.azimuteGraus)) erros.push({ campo: 'azimuteGraus', mensagem: 'Informe a direção do obstáculo.' });
  if (!ehNumeroFinito(o.distanciaM) || o.distanciaM <= 0) {
    erros.push({ campo: 'distanciaM', mensagem: 'A distância até o obstáculo deve ser maior que zero.' });
  }
  if (!ehNumeroFinito(o.alturaM) || o.alturaM <= 0) {
    erros.push({ campo: 'alturaM', mensagem: 'A altura do obstáculo acima do telhado deve ser maior que zero.' });
  }
  if (!ehNumeroFinito(o.larguraM) || o.larguraM <= 0) {
    erros.push({ campo: 'larguraM', mensagem: 'A largura do obstáculo deve ser maior que zero.' });
  }
  garantirSemErros(erros);

  const meiaAbertura = graus(Math.atan(o.larguraM / 2 / o.distanciaM));
  return {
    ...(o.nome !== undefined && { nome: o.nome }),
    azimuteInicialGraus: normalizar360(o.azimuteGraus - meiaAbertura),
    azimuteFinalGraus: normalizar360(o.azimuteGraus + meiaAbertura),
    elevacaoGraus: graus(Math.atan(o.alturaM / o.distanciaM)),
  };
}

/** Largura da faixa de azimute do obstáculo (°), considerando a volta de 360°. */
export function aberturaObstaculo(o: ObstaculoAngular): number {
  return normalizar360(o.azimuteFinalGraus - o.azimuteInicialGraus);
}

/** `true` se o azimute está dentro da faixa do obstáculo. */
export function azimuteDentroDoObstaculo(azimute: number, o: ObstaculoAngular): boolean {
  return normalizar360(azimute - o.azimuteInicialGraus) <= aberturaObstaculo(o);
}

/** `true` se o sol, nessa posição, está escondido atrás de algum obstáculo. */
export function solBloqueado(
  elevacaoGraus: number,
  azimuteGraus: number,
  obstaculos: readonly ObstaculoAngular[],
): boolean {
  return obstaculos.some((o) => elevacaoGraus < o.elevacaoGraus && azimuteDentroDoObstaculo(azimuteGraus, o));
}

export function validarObstaculos(obstaculos: readonly ObstaculoAngular[]): ErroCampo[] {
  const erros: ErroCampo[] = [];
  obstaculos.forEach((o, i) => {
    if (!ehNumeroFinito(o.azimuteInicialGraus) || !ehNumeroFinito(o.azimuteFinalGraus)) {
      erros.push({ campo: `obstaculos[${i}]`, mensagem: 'Informe os azimutes do obstáculo.' });
    } else if (aberturaObstaculo(o) === 0) {
      erros.push({ campo: `obstaculos[${i}]`, mensagem: 'O obstáculo precisa ter largura (azimutes diferentes).' });
    }
    if (!ehNumeroFinito(o.elevacaoGraus) || o.elevacaoGraus <= 0 || o.elevacaoGraus >= 90) {
      erros.push({ campo: `obstaculos[${i}]`, mensagem: 'A altura angular do obstáculo deve estar entre 0° e 90°.' });
    }
  });
  return erros;
}

export function validarPlano(plano: PlanoTelhado): ErroCampo[] {
  const erros: ErroCampo[] = [];
  if (!ehNumeroFinito(plano.inclinacaoGraus) || plano.inclinacaoGraus < 0 || plano.inclinacaoGraus > 90) {
    erros.push({ campo: 'inclinacaoGraus', mensagem: 'A inclinação deve estar entre 0° e 90°.' });
  }
  if (!ehNumeroFinito(plano.azimuteGraus)) {
    erros.push({ campo: 'azimuteGraus', mensagem: 'Informe a orientação do telhado.' });
  }
  return erros;
}

/** Massa de ar relativa (Kasten & Young, 1989) para um ângulo zenital em graus. */
export function massaDeAr(zenitalGraus: number): number {
  if (zenitalGraus >= 90) return Number.POSITIVE_INFINITY;
  return 1 / (Math.cos(radianos(zenitalGraus)) + 0.50572 * (96.07995 - zenitalGraus) ** -1.6364);
}

/** Irradiância direta normal de céu claro (W/m²), modelo de Meinel & Meinel (1976). */
export function irradianciaDiretaCeuClaro(elevacaoGraus: number): number {
  if (elevacaoGraus <= 0) return 0;
  return 1353 * 0.7 ** (massaDeAr(90 - elevacaoGraus) ** 0.678);
}

/** Cosseno do ângulo de incidência do sol no plano (negativo = sol atrás do plano). */
export function cossenoIncidencia(elevacaoGraus: number, azimuteSolGraus: number, plano: PlanoTelhado): number {
  const z = radianos(90 - elevacaoGraus);
  const beta = radianos(plano.inclinacaoGraus);
  return (
    Math.cos(z) * Math.cos(beta) +
    Math.sin(z) * Math.sin(beta) * Math.cos(radianos(azimuteSolGraus - plano.azimuteGraus))
  );
}

/**
 * Fração da irradiância difusa (céu isotrópico) bloqueada pelos obstáculos,
 * pelo perfil de horizonte em faixas de 1° (obstáculos sobrepostos não contam
 * em dobro).
 */
export function fracaoDifusaBloqueada(obstaculos: readonly ObstaculoAngular[]): number {
  if (obstaculos.length === 0) return 0;
  let soma = 0;
  for (let az = 0.5; az < 360; az += 1) {
    let horizonte = 0;
    for (const o of obstaculos) {
      if (azimuteDentroDoObstaculo(az, o)) horizonte = Math.max(horizonte, o.elevacaoGraus);
    }
    soma += Math.sin(radianos(horizonte)) ** 2;
  }
  return soma / 360;
}

export interface EntradaSombreamento {
  latitude: number;
  longitude: number;
  plano: PlanoTelhado;
  obstaculos: readonly ObstaculoAngular[];
  /** Ano de referência (a trajetória muda muito pouco de um ano para outro). */
  ano: number;
  fusoHorarioHoras?: number;
  passoMinutos?: number;
  /** Fração direta da irradiância (0 a 1). Padrão 0,6. */
  fracaoDireta?: number;
}

export interface SombreamentoMensal {
  /** Mês (1 a 12). */
  mes: number;
  /** Perda estimada por sombreamento no mês (%), direta + difusa. */
  sombreamentoPerc: number;
  /** Parcela da irradiância direta bloqueada (%). */
  sombreamentoDiretoPerc: number;
  /** Horas com sol no plano do telhado (dia representativo). */
  horasDeSolNoPlano: number;
  /** Dessas horas, quantas ficam atrás de obstáculos. */
  horasComSombra: number;
}

export interface ResultadoSombreamento {
  mensal: SombreamentoMensal[];
  /** Média anual ponderada pela energia (%) — vai para `sombreamento_perc`. */
  mediaAnualPerc: number;
  /** Parcela da irradiância difusa bloqueada (%), igual em todos os meses. */
  sombreamentoDifusoPerc: number;
  premissas: {
    fracaoDireta: number;
    passoMinutos: number;
    diasRepresentativos: readonly number[];
    modelo: string;
  };
}

/**
 * Calcula o sombreamento mensal e anual de um plano de telhado com
 * obstáculos (RF06, passos 1 a 3).
 *
 * @throws {ErroValidacao} se coordenadas, plano, obstáculos ou parâmetros forem inválidos.
 */
export function calcularSombreamento(entrada: EntradaSombreamento): ResultadoSombreamento {
  const fuso = entrada.fusoHorarioHoras ?? FUSO_BRASILIA_HORAS;
  const passo = entrada.passoMinutos ?? 10;
  const fracaoDireta = entrada.fracaoDireta ?? FRACAO_DIRETA_PADRAO;

  const erros = [
    ...validarCoordenadas(entrada.latitude, entrada.longitude),
    ...validarPlano(entrada.plano),
    ...validarObstaculos(entrada.obstaculos),
  ];
  if (!Number.isInteger(entrada.ano) || entrada.ano < 1900 || entrada.ano > 2100) {
    erros.push({ campo: 'ano', mensagem: 'O ano deve estar entre 1900 e 2100.' });
  }
  if (!ehNumeroFinito(passo) || passo < 1 || passo > 60) {
    erros.push({ campo: 'passoMinutos', mensagem: 'O passo deve estar entre 1 e 60 minutos.' });
  }
  if (!ehNumeroFinito(fracaoDireta) || fracaoDireta < 0 || fracaoDireta > 1) {
    erros.push({ campo: 'fracaoDireta', mensagem: 'A fração direta deve estar entre 0 e 1.' });
  }
  if (!ehNumeroFinito(fuso) || fuso < -12 || fuso > 14) {
    erros.push({ campo: 'fusoHorarioHoras', mensagem: 'O fuso horário deve estar entre -12 e +14 horas.' });
  }
  garantirSemErros(erros);

  const difusa = fracaoDifusaBloqueada(entrada.obstaculos);
  const mensal: SombreamentoMensal[] = [];
  const perdasMensais: number[] = [];
  const pesos: number[] = [];

  for (let mes = 1; mes <= 12; mes += 1) {
    const dia = DIA_MEDIO_KLEIN[mes - 1]!;
    const eventos = calcularEventosSolares(entrada.ano, mes, dia, entrada.latitude, entrada.longitude, fuso);
    const inicio = eventos.nascer ? eventos.nascer.getTime() : eventos.meioDiaSolar.getTime() - 12 * 3_600_000;
    const fim = eventos.por ? eventos.por.getTime() : eventos.meioDiaSolar.getTime() + 12 * 3_600_000;

    let energiaTotal = 0;
    let energiaBloqueada = 0;
    let passosNoPlano = 0;
    let passosSombra = 0;
    // Amostragem pelo ponto médio de cada intervalo.
    for (let t = inicio + (passo * 60_000) / 2; t < fim; t += passo * 60_000) {
      const sol = calcularPosicaoSolar(new Date(t), entrada.latitude, entrada.longitude);
      if (sol.elevacaoGraus <= 0) continue;
      const cosTheta = cossenoIncidencia(sol.elevacaoGraus, sol.azimuteGraus, entrada.plano);
      if (cosTheta <= 0) continue; // sol atrás do plano: não é sombra
      const energia = irradianciaDiretaCeuClaro(sol.elevacaoGraus) * cosTheta;
      energiaTotal += energia;
      passosNoPlano += 1;
      if (solBloqueado(sol.elevacaoGraus, sol.azimuteGraus, entrada.obstaculos)) {
        energiaBloqueada += energia;
        passosSombra += 1;
      }
    }

    const direta = energiaTotal > 0 ? energiaBloqueada / energiaTotal : 0;
    const perda = fracaoDireta * direta + (1 - fracaoDireta) * difusa;
    const diasNoMes = new Date(Date.UTC(entrada.ano, mes, 0)).getUTCDate();
    perdasMensais.push(perda);
    pesos.push(energiaTotal * diasNoMes);
    mensal.push({
      mes,
      sombreamentoPerc: arredondar(perda * 100, CASAS_DECIMAIS.percentual),
      sombreamentoDiretoPerc: arredondar(direta * 100, CASAS_DECIMAIS.percentual),
      horasDeSolNoPlano: arredondar((passosNoPlano * passo) / 60, 2),
      horasComSombra: arredondar((passosSombra * passo) / 60, 2),
    });
  }

  // Média ponderada pela energia direta de cada mês (meses com mais sol pesam mais).
  const somaPesos = pesos.reduce((a, b) => a + b, 0);
  const media =
    somaPesos > 0
      ? perdasMensais.reduce((acc, perda, i) => acc + perda * pesos[i]!, 0) / somaPesos
      : (1 - fracaoDireta) * difusa;

  return {
    mensal,
    mediaAnualPerc: arredondar(media * 100, CASAS_DECIMAIS.percentual),
    sombreamentoDifusoPerc: arredondar(difusa * 100, CASAS_DECIMAIS.percentual),
    premissas: {
      fracaoDireta,
      passoMinutos: passo,
      diasRepresentativos: DIA_MEDIO_KLEIN,
      modelo:
        'Céu claro (Meinel; massa de ar de Kasten & Young), perfil de horizonte por obstáculo e difusa isotrópica',
    },
  };
}
