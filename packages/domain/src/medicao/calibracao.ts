/**
 * SCRUM-79 — calibração/validação da medição por RA contra uma medida manual
 * conhecida (teste de precisão), antes de confiar na RA em campo real.
 *
 * O técnico (ou a equipe, no teste) mede várias vezes, com a RA, algo cujo
 * valor verdadeiro já é conhecido pela trena/medidor a laser — por exemplo,
 * um cômodo de 4,00 × 3,00 m. Esta função compara as medições com a
 * referência e diz se a precisão atende à tolerância. O resultado alimenta o
 * campo `calibrada` da Medição do Telhado (Dicionário de Dados, 5.1).
 *
 * Tolerâncias padrão (propostas pela equipe, ajustáveis):
 * - comprimento: ±3 %;
 * - área: ±5 % (o erro da área é aproximadamente a soma dos erros dos lados);
 * - inclinação: ±2°;
 * - azimute (bússola): ±10°.
 */
import { ehNumeroFinito, garantirSemErros, type ErroCampo } from '../erros';
import { arredondar, normalizar180, normalizar360, radianos, graus } from '../util/numeros';

export type GrandezaCalibracao = 'comprimento' | 'area' | 'inclinacao' | 'azimute';

export interface Tolerancia {
  /** Erro relativo máximo (%), para comprimento e área. */
  relativaPerc?: number;
  /** Erro absoluto máximo (na unidade da grandeza: m, m² ou graus). */
  absoluta?: number;
}

export const TOLERANCIAS_PADRAO: Readonly<Record<GrandezaCalibracao, Tolerancia>> = Object.freeze({
  comprimento: { relativaPerc: 3 },
  area: { relativaPerc: 5 },
  inclinacao: { absoluta: 2 },
  azimute: { absoluta: 10 },
});

export const UNIDADES: Readonly<Record<GrandezaCalibracao, string>> = Object.freeze({
  comprimento: 'm',
  area: 'm²',
  inclinacao: '°',
  azimute: '°',
});

/** Nome da grandeza para textos e relatórios. */
export const ROTULOS_GRANDEZA: Readonly<Record<GrandezaCalibracao, string>> = Object.freeze({
  comprimento: 'comprimento',
  area: 'área',
  inclinacao: 'inclinação',
  azimute: 'orientação (azimute)',
});

/** Valor com unidade no padrão brasileiro ("4,02 m", "20,3°"). */
export function comUnidade(valor: number, grandeza: GrandezaCalibracao, casas = 3): string {
  const numero = arredondar(valor, casas).toString().replace('.', ',');
  const unidade = UNIDADES[grandeza];
  return unidade === '°' ? `${numero}°` : `${numero} ${unidade}`;
}

export interface EntradaCalibracao {
  grandeza: GrandezaCalibracao;
  /** Valor verdadeiro, medido com trena/laser/inclinômetro/bússola de referência. */
  valorReferencia: number;
  /** Valores medidos com a RA (uma entrada por repetição). */
  medicoes: readonly number[];
  tolerancia?: Tolerancia;
}

export interface ResultadoCalibracao {
  grandeza: GrandezaCalibracao;
  unidade: string;
  valorReferencia: number;
  quantidade: number;
  media: number;
  /** Desvio padrão amostral (repetibilidade). */
  desvioPadrao: number;
  /** Erro sistemático: média − referência. */
  vies: number;
  /** Viés relativo (%), para comprimento e área. */
  viesPerc: number | null;
  /** Maior erro absoluto entre as medições. */
  erroMaximo: number;
  /** Maior erro relativo (%), para comprimento e área. */
  erroMaximoPerc: number | null;
  /** Raiz do erro quadrático médio. */
  rmse: number;
  /** Percentual das medições dentro da tolerância. */
  dentroDaToleranciaPerc: number;
  /** Aprovado quando **todas** as medições estão dentro da tolerância. */
  aprovado: boolean;
  /**
   * Fator multiplicativo sugerido quando há viés sistemático significativo
   * (comprimento e área): referência ÷ média. `null` se não há viés relevante.
   */
  fatorCorrecaoSugerido: number | null;
  /** Se, aplicando o fator sugerido, todas as medições passariam. */
  aprovadoComCorrecao: boolean | null;
  tolerancia: Tolerancia;
  resumo: string;
}

function erroDe(grandeza: GrandezaCalibracao, medido: number, referencia: number): number {
  return grandeza === 'azimute' ? normalizar180(medido - referencia) : medido - referencia;
}

function limiteAbsoluto(grandeza: GrandezaCalibracao, referencia: number, tol: Tolerancia): number {
  const limites: number[] = [];
  if (tol.absoluta !== undefined) limites.push(tol.absoluta);
  if (tol.relativaPerc !== undefined && grandeza !== 'azimute') limites.push((Math.abs(referencia) * tol.relativaPerc) / 100);
  return limites.length > 0 ? Math.max(...limites) : 0;
}

function validar(entrada: EntradaCalibracao): ErroCampo[] {
  const erros: ErroCampo[] = [];
  if (!['comprimento', 'area', 'inclinacao', 'azimute'].includes(entrada.grandeza)) {
    erros.push({ campo: 'grandeza', mensagem: 'Grandeza inválida.' });
  }
  if (!ehNumeroFinito(entrada.valorReferencia)) {
    erros.push({ campo: 'valorReferencia', mensagem: 'Informe o valor de referência (medida manual).' });
  } else if ((entrada.grandeza === 'comprimento' || entrada.grandeza === 'area') && entrada.valorReferencia <= 0) {
    erros.push({ campo: 'valorReferencia', mensagem: 'A referência deve ser maior que zero.' });
  }
  if (!Array.isArray(entrada.medicoes) || entrada.medicoes.length < 2) {
    erros.push({ campo: 'medicoes', mensagem: 'Registre pelo menos 2 medições com a RA (o protocolo pede 5).' });
  } else if (!entrada.medicoes.every(ehNumeroFinito)) {
    erros.push({ campo: 'medicoes', mensagem: 'Há medições inválidas.' });
  }
  const tol = entrada.tolerancia;
  if (tol && ((tol.absoluta !== undefined && !(tol.absoluta >= 0)) || (tol.relativaPerc !== undefined && !(tol.relativaPerc >= 0)))) {
    erros.push({ campo: 'tolerancia', mensagem: 'A tolerância não pode ser negativa.' });
  }
  return erros;
}

function mediaCircular(angulos: readonly number[]): number {
  const s = angulos.reduce((acc, a) => acc + Math.sin(radianos(a)), 0);
  const c = angulos.reduce((acc, a) => acc + Math.cos(radianos(a)), 0);
  return normalizar360(graus(Math.atan2(s, c)));
}

/**
 * Compara as medições da RA com a medida manual conhecida.
 *
 * @throws {ErroValidacao} com referência inválida ou menos de 2 medições.
 */
export function avaliarCalibracao(entrada: EntradaCalibracao): ResultadoCalibracao {
  garantirSemErros(validar(entrada));
  const { grandeza, valorReferencia: ref, medicoes } = entrada;
  const tol = entrada.tolerancia ?? TOLERANCIAS_PADRAO[grandeza];
  const n = medicoes.length;
  const escala = grandeza === 'comprimento' || grandeza === 'area';

  const erros = medicoes.map((m) => erroDe(grandeza, m, ref));
  const media = grandeza === 'azimute' ? mediaCircular(medicoes) : medicoes.reduce((s, v) => s + v, 0) / n;
  const vies = grandeza === 'azimute' ? normalizar180(media - ref) : media - ref;
  const erroMedio = erros.reduce((a, b) => a + b, 0) / n;
  const desvio = Math.sqrt(erros.reduce((s, e) => s + (e - erroMedio) ** 2, 0) / (n - 1));
  const erroMaximo = Math.max(...erros.map(Math.abs));
  const rmse = Math.sqrt(erros.reduce((s, e) => s + e * e, 0) / n);
  const limite = limiteAbsoluto(grandeza, ref, tol);
  const dentro = erros.filter((e) => Math.abs(e) <= limite + 1e-12).length;
  const aprovado = dentro === n;

  // Viés sistemático significativo: maior que 2 erros-padrão da média.
  let fator: number | null = null;
  let aprovadoComCorrecao: boolean | null = null;
  if (escala && Math.abs(vies) > (2 * desvio) / Math.sqrt(n) && Math.abs(vies) > 1e-12) {
    fator = ref / media;
    aprovadoComCorrecao = medicoes.every((m) => Math.abs(m * fator! - ref) <= limite + 1e-12);
  }

  const u = UNIDADES[grandeza];
  const fmt = (v: number, casas = 3): string => arredondar(v, casas).toString().replace('.', ',');
  const toleranciaTexto =
    tol.relativaPerc !== undefined && grandeza !== 'azimute'
      ? `±${fmt(tol.relativaPerc, 2)} %`
      : `±${comUnidade(tol.absoluta ?? 0, grandeza, 2)}`;
  const nome = ROTULOS_GRANDEZA[grandeza];
  let resumo = aprovado
    ? `Aprovado: ${n} de ${n} medições de ${nome} dentro de ${toleranciaTexto} (erro máximo ${comUnidade(erroMaximo, grandeza)}).`
    : `Reprovado: ${dentro} de ${n} medições de ${nome} dentro de ${toleranciaTexto} (erro máximo ${comUnidade(erroMaximo, grandeza)}).`;
  if (fator !== null) {
    resumo += ` Há viés sistemático de ${fmt((vies / ref) * 100, 2)} %; fator de correção sugerido: ${fmt(fator, 4)}${aprovadoComCorrecao ? ' (com ele, todas as medições passariam)' : ''}.`;
  }

  return {
    grandeza,
    unidade: u,
    valorReferencia: ref,
    quantidade: n,
    media: arredondar(media, 4),
    desvioPadrao: arredondar(desvio, 4),
    vies: arredondar(vies, 4),
    viesPerc: escala ? arredondar((vies / ref) * 100, 2) : null,
    erroMaximo: arredondar(erroMaximo, 4),
    erroMaximoPerc: escala ? arredondar((erroMaximo / ref) * 100, 2) : null,
    rmse: arredondar(rmse, 4),
    dentroDaToleranciaPerc: arredondar((dentro / n) * 100, 1),
    aprovado,
    fatorCorrecaoSugerido: fator === null ? null : arredondar(fator, 4),
    aprovadoComCorrecao,
    tolerancia: tol,
    resumo,
  };
}

export interface ResultadoCalibracaoDispositivo {
  resultados: ResultadoCalibracao[];
  /** Valor para o campo `calibrada` das medições feitas neste aparelho. */
  calibrada: boolean;
  resumo: string;
}

/**
 * Consolida a calibração de um aparelho em várias grandezas. O aparelho só é
 * considerado calibrado se **todas** as grandezas testadas forem aprovadas.
 */
export function consolidarCalibracao(entradas: readonly EntradaCalibracao[]): ResultadoCalibracaoDispositivo {
  if (entradas.length === 0) {
    garantirSemErros([{ campo: 'entradas', mensagem: 'Informe ao menos uma grandeza para calibrar.' }]);
  }
  const resultados = entradas.map(avaliarCalibracao);
  const calibrada = resultados.every((r) => r.aprovado);
  const reprovadas = resultados.filter((r) => !r.aprovado).map((r) => r.grandeza);
  return {
    resultados,
    calibrada,
    resumo: calibrada
      ? `Aparelho calibrado: ${[...new Set(resultados.map((r) => ROTULOS_GRANDEZA[r.grandeza]))].join(', ')} dentro da tolerância.`
      : `Aparelho NÃO calibrado: reprovado em ${[...new Set(reprovadas.map((g) => ROTULOS_GRANDEZA[g]))].join(', ')}. Use o Modo Leve ou repita a calibração.`,
  };
}
