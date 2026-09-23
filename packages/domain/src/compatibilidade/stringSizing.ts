/**
 * SCRUM-395 — compatibilidade elétrica inversor × módulos (string sizing).
 *
 * O técnico escolhe o módulo, o inversor e as quantidades (RF09); o app não
 * sugere kit (D09). Esta função verifica se a combinação funciona e, quando
 * funciona, mostra um arranjo de strings possível. Cada problema vem com um
 * nível:
 *
 * - `erro`   → bloqueia a confirmação (RF09 4a): risco ao equipamento ou
 *              sistema que não opera (tensão acima do máximo no frio, curto-
 *              circuito acima do limite, fases incompatíveis, módulos demais…);
 * - `alerta` → exige confirmação do técnico: o sistema opera, mas perde
 *              geração (corrente acima do MPPT, tensão fora da faixa do MPPT
 *              em dias muito quentes ou frios, relação CC/CA alta);
 * - `info`   → só informativo.
 *
 * Valores de projeto (padrões dos Parâmetros Técnicos):
 * - Voc máxima: Voc × [1 + βVoc × (Tmín − 25)], com Tmín = 0 °C;
 * - Vmp mínima: Vmp × [1 + βVmp × (Tcél,máx − 25)], com Tcél,máx = 70 °C;
 * - Vmp máxima: Vmp × [1 + βVmp × (Tmín − 25)];
 * - Isc máxima: Isc × [1 + αIsc × (Tcél,máx − 25)].
 * Para βVmp usa-se o coeficiente da Pmax (aproximação usual: a Imp quase não
 * varia com a temperatura); na falta dele, o da Voc.
 */
import { ehNumeroFinito, garantirSemErros, type ErroCampo } from '../erros';
import { arredondar, CASAS_DECIMAIS, formatarNumeroBr } from '../util/numeros';
import { PARAMETROS_TECNICOS_PADRAO } from '../parametros';
import type { Equipamento, Fases } from '../catalogo/tipos';

export interface EspecModulo {
  modelo?: string;
  potenciaW: number;
  vocV: number;
  iscA: number;
  vmpV: number;
  impA: number;
  /** %/°C, negativo (ex.: -0,26). */
  coefTempVocPercC: number;
  /** %/°C, negativo. Usado para a variação da Vmp. */
  coefTempPmaxPercC?: number;
  /** %/°C, positivo. Padrão 0,05. */
  coefTempIscPercC?: number;
}

export interface EspecMppt {
  /** Strings em paralelo que o MPPT aceita. */
  strings: number;
  /** Corrente máxima de entrada do MPPT (A). */
  correnteMaxA: number;
  /** Corrente máxima de curto-circuito do MPPT (A). */
  correnteCurtoMaxA?: number;
}

export interface EspecInversor {
  modelo?: string;
  /** Potência CA nominal (W). */
  potenciaCaW: number;
  tensaoMaxEntradaV: number;
  faixaMpptMinV: number;
  faixaMpptMaxV: number;
  tensaoPartidaV?: number;
  mppts: readonly EspecMppt[];
  /** Limite por entrada/string (microinversores). */
  correnteMaxPorStringA?: number;
  correnteCurtoMaxPorStringA?: number;
  /** Potência CC máxima recomendada pelo fabricante (W). */
  potenciaMaxCcW?: number;
  /** 1 = monofásico, 2 = bifásico, 3 = trifásico. */
  fases: 1 | 2 | 3;
  tensaoCaV?: number;
}

export type TipoLigacao = 'Monofásica' | 'Bifásica' | 'Trifásica';

/** Strings ligadas em um MPPT: `strings` em paralelo, cada uma com `modulosPorString` em série. */
export interface StringsNoMppt {
  strings: number;
  modulosPorString: number;
}

/** Arranjo informado pelo técnico: `[inversor][mppt]` → strings (ou `null` se o MPPT ficar vazio). */
export type ArranjoInformado = readonly (readonly (StringsNoMppt | null)[])[];

export interface EntradaCompatibilidade {
  modulo: EspecModulo;
  quantidadeModulos: number;
  inversor: EspecInversor;
  /** Padrão 1. */
  quantidadeInversores?: number;
  /** `tipo_ligacao` da instalação (RF03). */
  tipoLigacao?: TipoLigacao;
  /** Tensão da rede no local (V), quando conhecida. */
  tensaoRedeV?: number;
  /** Menor temperatura ambiente (°C). Padrão: Parâmetros Técnicos (0 °C). */
  temperaturaMinimaC?: number;
  /** Maior temperatura de célula (°C). Padrão: Parâmetros Técnicos (70 °C). */
  temperaturaMaximaCelulaC?: number;
  /** Relação CC/CA máxima quando o fabricante não informa a potência CC máxima. Padrão 1,3. */
  relacaoCcCaMaxima?: number;
  /** Abaixo desta relação CC/CA o inversor está folgado demais. Padrão 0,75. */
  relacaoCcCaMinima?: number;
  /** Arranjo definido pelo técnico. Sem ele, a função procura um arranjo válido. */
  arranjo?: ArranjoInformado;
}

export type NivelProblema = 'erro' | 'alerta' | 'info';

export type CodigoProblema =
  | 'TENSAO_MODULO_ACIMA_MAXIMO'
  | 'TENSAO_STRING_ACIMA_MAXIMO'
  | 'TENSAO_INSUFICIENTE_PARTIDA'
  | 'TENSAO_ABAIXO_MPPT'
  | 'CORRENTE_CURTO_ACIMA'
  | 'MODULOS_DEMAIS'
  | 'MODULOS_DE_MENOS'
  | 'SEM_ARRANJO_VALIDO'
  | 'ARRANJO_INVALIDO'
  | 'FASES_INCOMPATIVEIS'
  | 'TENSAO_CA_INCOMPATIVEL'
  | 'CORRENTE_ACIMA_MPPT'
  | 'VMP_ABAIXO_MPPT_CALOR'
  | 'VMP_ACIMA_MPPT_FRIO'
  | 'PARTIDA_LENTA_CALOR'
  | 'POTENCIA_CC_ACIMA_FABRICANTE'
  | 'RELACAO_CC_CA_ALTA'
  | 'INVERSOR_FOLGADO'
  | 'INVERSOR_SEM_MODULOS'
  | 'MONOFASICO_EM_TRIFASICA';

export interface ProblemaCompatibilidade {
  nivel: NivelProblema;
  codigo: CodigoProblema;
  mensagem: string;
}

export interface MpptCalculado {
  /** Número do inversor (a partir de 1). */
  inversor: number;
  /** Número do MPPT no inversor (a partir de 1). */
  mppt: number;
  strings: number;
  modulosPorString: number;
  /** Voc da string no frio (V). */
  vocMaxV: number;
  /** Vmp da string no calor (V). */
  vmpMinV: number;
  /** Vmp da string no frio (V). */
  vmpMaxV: number;
  /** Corrente de operação do MPPT = strings × Imp (A). */
  correnteOperacaoA: number;
  /** Corrente de curto do MPPT no calor = strings × Isc máx (A). */
  correnteCurtoMaxA: number;
}

export interface ResultadoCompatibilidade {
  /** `true` quando não há nenhum problema de nível `erro`. */
  compativel: boolean;
  /** RF09 4a: combinação incompatível bloqueia a confirmação. */
  bloqueia: boolean;
  /** Há alertas que o técnico precisa confirmar explicitamente. */
  exigeConfirmacao: boolean;
  problemas: ProblemaCompatibilidade[];
  /** Limites de módulos em série por string para este par módulo × inversor. */
  limitesString: {
    /** Menor quantidade para o inversor partir e operar no MPPT (erro abaixo disso). */
    minimo: number;
    /** Maior quantidade antes de passar da tensão máxima no frio (erro acima disso). */
    maximo: number;
    /** Faixa recomendada, sem sair do MPPT no calor nem no frio. */
    recomendadoMin: number;
    recomendadoMax: number;
  };
  /** Valores de um módulo nas temperaturas de projeto. */
  valoresPorModulo: { vocMaxV: number; vocMinV: number; vmpMinV: number; vmpMaxV: number; iscMaxA: number };
  /** Arranjo analisado (o informado ou o encontrado); `null` se não houver arranjo possível. */
  arranjo: MpptCalculado[] | null;
  /** Descrição curta do arranjo, para a tela. */
  descricaoArranjo: string | null;
  potenciaCcKwp: number;
  potenciaCaKw: number;
  relacaoCcCa: number;
  premissas: { temperaturaMinimaC: number; temperaturaMaximaCelulaC: number };
}

const NUMERO_FASES: Record<TipoLigacao, 1 | 2 | 3> = { Monofásica: 1, Bifásica: 2, Trifásica: 3 };
const NUMERO_FASES_INVERSOR: Record<Fases, 1 | 2 | 3> = { Monofásico: 1, Bifásico: 2, Trifásico: 3 };
const PENALIDADE = 10;

// ---------------------------------------------------------------------------
// Conversão a partir do catálogo
// ---------------------------------------------------------------------------

function exigir(eq: Equipamento, campos: (keyof Equipamento)[], erros: ErroCampo[]): void {
  for (const campo of campos) {
    const v = eq[campo];
    if (!ehNumeroFinito(v)) {
      erros.push({ campo, mensagem: `${eq.modelo}: complete "${String(campo)}" no catálogo para validar a compatibilidade.` });
    }
  }
}

/** Especificação elétrica de um módulo do catálogo. @throws {ErroValidacao} se faltar dado. */
export function especModuloDoEquipamento(eq: Equipamento): EspecModulo {
  const erros: ErroCampo[] = [];
  if (eq.categoria !== 'Módulo') erros.push({ campo: 'categoria', mensagem: `${eq.modelo} não é um módulo.` });
  exigir(eq, ['potenciaW', 'vocV', 'iscA', 'vmpV', 'impA', 'coefTempVocPercC'], erros);
  garantirSemErros(erros);
  return {
    modelo: `${eq.fabricante} ${eq.modelo}`,
    potenciaW: eq.potenciaW!,
    vocV: eq.vocV!,
    iscA: eq.iscA!,
    vmpV: eq.vmpV!,
    impA: eq.impA!,
    coefTempVocPercC: eq.coefTempVocPercC!,
    ...(ehNumeroFinito(eq.coefTempPmaxPercC) && { coefTempPmaxPercC: eq.coefTempPmaxPercC }),
    ...(ehNumeroFinito(eq.coefTempIscPercC) && { coefTempIscPercC: eq.coefTempIscPercC }),
  };
}

/** Especificação elétrica de um inversor do catálogo. @throws {ErroValidacao} se faltar dado. */
export function especInversorDoEquipamento(eq: Equipamento): EspecInversor {
  const erros: ErroCampo[] = [];
  if (eq.categoria !== 'Inversor') erros.push({ campo: 'categoria', mensagem: `${eq.modelo} não é um inversor.` });
  exigir(eq, ['potenciaW', 'tensaoMaxEntradaV', 'faixaMpptMinV', 'faixaMpptMaxV'], erros);
  if (!eq.fases) erros.push({ campo: 'fases', mensagem: `${eq.modelo}: complete as fases do inversor no catálogo.` });

  let mppts: EspecMppt[] = [];
  if (eq.configuracaoMppt && eq.configuracaoMppt.length > 0) {
    mppts = eq.configuracaoMppt.map((m) => ({
      strings: m.strings,
      correnteMaxA: m.correnteMaxA,
      ...(ehNumeroFinito(m.correnteCurtoMaxA) && { correnteCurtoMaxA: m.correnteCurtoMaxA }),
    }));
  } else {
    exigir(eq, ['qtdMppt', 'stringsPorMppt', 'correnteMaxEntradaA'], erros);
    if (erros.length === 0) {
      mppts = Array.from({ length: eq.qtdMppt! }, () => ({
        strings: eq.stringsPorMppt!,
        correnteMaxA: eq.correnteMaxEntradaA!,
        ...(ehNumeroFinito(eq.correnteCurtoMaxMpptA) && { correnteCurtoMaxA: eq.correnteCurtoMaxMpptA }),
      }));
    }
  }
  garantirSemErros(erros);

  const opcional = <K extends keyof Equipamento>(campo: K, destino: keyof EspecInversor): Partial<EspecInversor> =>
    ehNumeroFinito(eq[campo]) ? { [destino]: eq[campo] } : {};

  return {
    modelo: `${eq.fabricante} ${eq.modelo}`,
    potenciaCaW: eq.potenciaW!,
    tensaoMaxEntradaV: eq.tensaoMaxEntradaV!,
    faixaMpptMinV: eq.faixaMpptMinV!,
    faixaMpptMaxV: eq.faixaMpptMaxV!,
    mppts,
    fases: NUMERO_FASES_INVERSOR[eq.fases!],
    ...opcional('tensaoPartidaV', 'tensaoPartidaV'),
    ...opcional('correnteMaxPorStringA', 'correnteMaxPorStringA'),
    ...opcional('correnteCurtoMaxPorStringA', 'correnteCurtoMaxPorStringA'),
    ...opcional('potenciaMaxCcW', 'potenciaMaxCcW'),
    ...opcional('tensaoCaV', 'tensaoCaV'),
  };
}

// ---------------------------------------------------------------------------
// Validação da entrada
// ---------------------------------------------------------------------------

function validarEntrada(e: EntradaCompatibilidade): ErroCampo[] {
  const erros: ErroCampo[] = [];
  const m = e.modulo;
  for (const [campo, valor] of Object.entries({
    potenciaW: m.potenciaW,
    vocV: m.vocV,
    iscA: m.iscA,
    vmpV: m.vmpV,
    impA: m.impA,
  })) {
    if (!ehNumeroFinito(valor) || valor <= 0) erros.push({ campo: `modulo.${campo}`, mensagem: `Módulo: ${campo} deve ser maior que zero.` });
  }
  if (ehNumeroFinito(m.vmpV) && ehNumeroFinito(m.vocV) && m.vmpV >= m.vocV) {
    erros.push({ campo: 'modulo.vmpV', mensagem: 'Módulo: a Vmp deve ser menor que a Voc.' });
  }
  if (!ehNumeroFinito(m.coefTempVocPercC) || m.coefTempVocPercC >= 0) {
    erros.push({ campo: 'modulo.coefTempVocPercC', mensagem: 'Módulo: o coeficiente de temperatura da Voc deve ser negativo.' });
  }
  const inv = e.inversor;
  for (const [campo, valor] of Object.entries({
    potenciaCaW: inv.potenciaCaW,
    tensaoMaxEntradaV: inv.tensaoMaxEntradaV,
    faixaMpptMinV: inv.faixaMpptMinV,
    faixaMpptMaxV: inv.faixaMpptMaxV,
  })) {
    if (!ehNumeroFinito(valor) || valor <= 0) erros.push({ campo: `inversor.${campo}`, mensagem: `Inversor: ${campo} deve ser maior que zero.` });
  }
  if (inv.mppts.length === 0 || inv.mppts.some((x) => !Number.isInteger(x.strings) || x.strings < 1 || !(x.correnteMaxA > 0))) {
    erros.push({ campo: 'inversor.mppts', mensagem: 'Inversor: informe os MPPTs (strings e corrente máxima de cada um).' });
  }
  if (!Number.isInteger(e.quantidadeModulos) || e.quantidadeModulos < 1) {
    erros.push({ campo: 'quantidadeModulos', mensagem: 'A quantidade de módulos deve ser um inteiro maior que zero.' });
  }
  const qInv = e.quantidadeInversores ?? 1;
  if (!Number.isInteger(qInv) || qInv < 1) {
    erros.push({ campo: 'quantidadeInversores', mensagem: 'A quantidade de inversores deve ser um inteiro maior que zero.' });
  }
  const tMin = e.temperaturaMinimaC ?? PARAMETROS_TECNICOS_PADRAO.temperaturaMinimaAmbienteC;
  const tMax = e.temperaturaMaximaCelulaC ?? PARAMETROS_TECNICOS_PADRAO.temperaturaMaximaCelulaC;
  if (!ehNumeroFinito(tMin) || !ehNumeroFinito(tMax) || tMin >= tMax || tMin < -50 || tMax > 100) {
    erros.push({ campo: 'temperaturas', mensagem: 'Temperaturas de projeto inválidas (mínima deve ser menor que a máxima).' });
  }
  return erros;
}

// ---------------------------------------------------------------------------
// Cálculo
// ---------------------------------------------------------------------------

interface Slot {
  inversor: number;
  mppt: number;
  espec: EspecMppt;
}

interface Contexto {
  modulo: EspecModulo;
  inversor: EspecInversor;
  vocMax: number;
  vocMin: number;
  vmpMin: number;
  vmpMax: number;
  iscMax: number;
  /** Menor comprimento de string que parte e opera no MPPT (em STC). */
  minimoHard: number;
  maximoHard: number;
}

/** Penalidade "suave" (alertas) de colocar `strings` × `n` módulos em um MPPT; `null` se violar limite rígido. */
function avaliarSlot(ctx: Contexto, espec: EspecMppt, strings: number, n: number): number | null {
  const { inversor: inv, modulo: m } = ctx;
  if (n > ctx.maximoHard || n < ctx.minimoHard) return null;
  if (espec.correnteCurtoMaxA !== undefined && strings * ctx.iscMax > espec.correnteCurtoMaxA + 1e-9) return null;
  if (inv.correnteCurtoMaxPorStringA !== undefined && ctx.iscMax > inv.correnteCurtoMaxPorStringA + 1e-9) return null;
  let penalidade = 0;
  if (strings * m.impA > espec.correnteMaxA + 1e-9) penalidade += PENALIDADE;
  if (inv.correnteMaxPorStringA !== undefined && m.impA > inv.correnteMaxPorStringA + 1e-9) penalidade += PENALIDADE;
  if (n * ctx.vmpMin < inv.faixaMpptMinV) penalidade += PENALIDADE;
  if (n * ctx.vmpMax > inv.faixaMpptMaxV) penalidade += PENALIDADE;
  if (inv.tensaoPartidaV !== undefined && n * ctx.vocMin < inv.tensaoPartidaV) penalidade += PENALIDADE;
  return penalidade;
}

interface Escolha {
  strings: number;
  n: number;
}

interface MelhorAtribuicao {
  penalidade: number;
  escolhas: (Escolha | null)[];
}

/**
 * Distribui `qtdA` strings de `nA` módulos e `qtdB` strings de `nB` módulos
 * pelos MPPTs (strings do mesmo MPPT têm o mesmo comprimento), minimizando a
 * penalidade. Programação dinâmica com memória por (MPPT, restantes A, restantes B, inversor atual usado).
 */
function atribuir(ctx: Contexto, slots: readonly Slot[], nA: number, qtdA: number, nB: number, qtdB: number): MelhorAtribuicao | null {
  const memo = new Map<string, MelhorAtribuicao | null>();
  const PENALIDADE_INVERSOR_VAZIO = PENALIDADE * 5;

  const resolver = (k: number, a: number, b: number, usado: boolean): MelhorAtribuicao | null => {
    if (k === slots.length) {
      if (a !== 0 || b !== 0) return null;
      return { penalidade: usado ? 0 : PENALIDADE_INVERSOR_VAZIO, escolhas: [] };
    }
    const chave = `${k}|${a}|${b}|${usado ? 1 : 0}`;
    if (memo.has(chave)) return memo.get(chave)!;

    const slot = slots[k]!;
    const proximoInversorNovo = k + 1 < slots.length && slots[k + 1]!.inversor !== slot.inversor;
    let melhor: MelhorAtribuicao | null = null;

    const considerar = (escolha: Escolha | null, custo: number, na: number, nb: number): void => {
      const usadoAgora = usado || escolha !== null;
      let resto: MelhorAtribuicao | null;
      let extra = 0;
      if (proximoInversorNovo) {
        extra = usadoAgora ? 0 : PENALIDADE_INVERSOR_VAZIO;
        resto = resolver(k + 1, na, nb, false);
      } else {
        resto = resolver(k + 1, na, nb, usadoAgora);
      }
      if (!resto) return;
      const total = custo + extra + resto.penalidade;
      if (!melhor || total < melhor.penalidade) {
        melhor = { penalidade: total, escolhas: [escolha, ...resto.escolhas] };
      }
    };

    // Preferência de desempate: preencher o MPPT antes de deixá-lo vazio.
    for (let t = Math.min(slot.espec.strings, a); t >= 1; t -= 1) {
      const custo = avaliarSlot(ctx, slot.espec, t, nA);
      if (custo !== null) considerar({ strings: t, n: nA }, custo, a - t, b);
    }
    if (nB !== nA) {
      for (let t = Math.min(slot.espec.strings, b); t >= 1; t -= 1) {
        const custo = avaliarSlot(ctx, slot.espec, t, nB);
        if (custo !== null) considerar({ strings: t, n: nB }, custo, a, b - t);
      }
    }
    considerar(null, 0, a, b);

    memo.set(chave, melhor);
    return melhor;
  };

  return resolver(0, qtdA, qtdB, false);
}

function mpptsCalculados(ctx: Contexto, slots: readonly Slot[], escolhas: readonly (Escolha | null)[]): MpptCalculado[] {
  const resultado: MpptCalculado[] = [];
  escolhas.forEach((e, i) => {
    if (!e) return;
    const slot = slots[i]!;
    resultado.push({
      inversor: slot.inversor,
      mppt: slot.mppt,
      strings: e.strings,
      modulosPorString: e.n,
      vocMaxV: arredondar(e.n * ctx.vocMax, CASAS_DECIMAIS.eletrica),
      vmpMinV: arredondar(e.n * ctx.vmpMin, CASAS_DECIMAIS.eletrica),
      vmpMaxV: arredondar(e.n * ctx.vmpMax, CASAS_DECIMAIS.eletrica),
      correnteOperacaoA: arredondar(e.strings * ctx.modulo.impA, CASAS_DECIMAIS.eletrica),
      correnteCurtoMaxA: arredondar(e.strings * ctx.iscMax, CASAS_DECIMAIS.eletrica),
    });
  });
  return resultado;
}

/** Texto do arranjo, ex.: "MPPT 1: 1 × 5 módulos · MPPT 2: 1 × 5 módulos". */
export function descreverArranjo(arranjo: readonly MpptCalculado[]): string {
  const variosInversores = arranjo.some((m) => m.inversor > 1);
  return arranjo
    .map((m) => {
      const prefixo = variosInversores ? `Inversor ${m.inversor} · ` : '';
      const strings = m.strings === 1 ? '1 string' : `${m.strings} strings`;
      return `${prefixo}MPPT ${m.mppt}: ${strings} de ${m.modulosPorString} módulo${m.modulosPorString > 1 ? 's' : ''}`;
    })
    .join(' | ');
}

function plural(qtd: number, singular: string, pluralTexto: string): string {
  return `${qtd} ${qtd === 1 ? singular : pluralTexto}`;
}

function fmtV(valor: number): string {
  return `${formatarNumeroBr(valor, 1)} V`;
}

function fmtA(valor: number): string {
  return `${formatarNumeroBr(valor, 1)} A`;
}

/** Procura o melhor arranjo com strings de comprimentos iguais (ou diferindo em 1). */
function procurarArranjo(ctx: Contexto, slots: readonly Slot[], total: number): { escolhas: (Escolha | null)[]; penalidade: number } | null {
  const capacidade = slots.reduce((s, x) => s + x.espec.strings, 0);
  let melhor: { escolhas: (Escolha | null)[]; penalidade: number; s: number } | null = null;
  const qtdMppts = slots.length;
  for (let s = 1; s <= Math.min(total, capacidade); s += 1) {
    const q = Math.floor(total / s);
    const r = total % s;
    // Poda: todas as strings precisam caber entre o mínimo e o máximo de módulos.
    if (q < ctx.minimoHard || q > ctx.maximoHard || (r > 0 && q + 1 > ctx.maximoHard)) continue;
    const tentativa = atribuir(ctx, slots, q + 1, r, q, s - r);
    if (!tentativa) continue;
    const melhorQue = (): boolean => {
      if (!melhor) return true;
      if (tentativa.penalidade !== melhor.penalidade) return tentativa.penalidade < melhor.penalidade;
      // Desempate: uma string por MPPT; depois menos strings (strings mais longas).
      const d1 = Math.abs(s - qtdMppts);
      const d2 = Math.abs(melhor.s - qtdMppts);
      if (d1 !== d2) return d1 < d2;
      return s < melhor.s;
    };
    if (melhorQue()) melhor = { escolhas: tentativa.escolhas, penalidade: tentativa.penalidade, s };
  }
  return melhor ? { escolhas: melhor.escolhas, penalidade: melhor.penalidade } : null;
}

/**
 * SCRUM-395 — valida a combinação inversor × módulos e mostra um arranjo.
 *
 * @throws {ErroValidacao} se os dados de entrada estiverem incompletos.
 */
export function verificarCompatibilidade(entrada: EntradaCompatibilidade): ResultadoCompatibilidade {
  garantirSemErros(validarEntrada(entrada));

  const m = entrada.modulo;
  const inv = entrada.inversor;
  const qtdInversores = entrada.quantidadeInversores ?? 1;
  const n = entrada.quantidadeModulos;
  const tMin = entrada.temperaturaMinimaC ?? PARAMETROS_TECNICOS_PADRAO.temperaturaMinimaAmbienteC;
  const tMax = entrada.temperaturaMaximaCelulaC ?? PARAMETROS_TECNICOS_PADRAO.temperaturaMaximaCelulaC;

  const betaVoc = m.coefTempVocPercC / 100;
  const betaVmp = (m.coefTempPmaxPercC ?? m.coefTempVocPercC) / 100;
  const alfaIsc = (m.coefTempIscPercC ?? 0.05) / 100;
  const vocMax = m.vocV * (1 + betaVoc * (tMin - 25));
  const vocMin = m.vocV * (1 + betaVoc * (tMax - 25));
  const vmpMin = m.vmpV * (1 + betaVmp * (tMax - 25));
  const vmpMax = m.vmpV * (1 + betaVmp * (tMin - 25));
  const iscMax = m.iscA * (1 + alfaIsc * (tMax - 25));

  const maximoHard = Math.floor(arredondar(inv.tensaoMaxEntradaV / vocMax, 6));
  const minimoHard = Math.max(
    1,
    Math.ceil(arredondar(inv.faixaMpptMinV / m.vmpV, 6)),
    inv.tensaoPartidaV !== undefined ? Math.ceil(arredondar(inv.tensaoPartidaV / m.vocV, 6)) : 1,
  );
  const recomendadoMin = Math.max(
    minimoHard,
    Math.ceil(arredondar(inv.faixaMpptMinV / vmpMin, 6)),
    inv.tensaoPartidaV !== undefined ? Math.ceil(arredondar(inv.tensaoPartidaV / vocMin, 6)) : 1,
  );
  const recomendadoMax = Math.min(maximoHard, Math.floor(arredondar(inv.faixaMpptMaxV / vmpMax, 6)));

  const ctx: Contexto = { modulo: m, inversor: inv, vocMax, vocMin, vmpMin, vmpMax, iscMax, minimoHard, maximoHard };
  const slots: Slot[] = [];
  for (let i = 1; i <= qtdInversores; i += 1) {
    inv.mppts.forEach((espec, j) => slots.push({ inversor: i, mppt: j + 1, espec }));
  }
  const capacidadeStrings = slots.reduce((s, x) => s + x.espec.strings, 0);

  const problemas: ProblemaCompatibilidade[] = [];
  const add = (nivel: NivelProblema, codigo: CodigoProblema, mensagem: string): void => {
    if (!problemas.some((p) => p.codigo === codigo && p.mensagem === mensagem)) problemas.push({ nivel, codigo, mensagem });
  };

  // --- Fases e tensão CA ---
  if (entrada.tipoLigacao) {
    const fasesLigacao = NUMERO_FASES[entrada.tipoLigacao];
    if (inv.fases > fasesLigacao) {
      add('erro', 'FASES_INCOMPATIVEIS', `Inversor ${['', 'monofásico', 'bifásico', 'trifásico'][inv.fases]} não pode ser ligado em uma instalação ${entrada.tipoLigacao.toLowerCase()}.`);
    } else if (inv.fases === 1 && fasesLigacao === 3) {
      add('info', 'MONOFASICO_EM_TRIFASICA', 'Inversor monofásico em ligação trifásica: confira o limite de desequilíbrio entre fases da distribuidora.');
    }
  }
  if (entrada.tensaoRedeV !== undefined && inv.tensaoCaV !== undefined) {
    if (Math.abs(inv.tensaoCaV - entrada.tensaoRedeV) / entrada.tensaoRedeV > 0.1) {
      add('erro', 'TENSAO_CA_INCOMPATIVEL', `O inversor é de ${inv.tensaoCaV} V e a rede do local é de ${entrada.tensaoRedeV} V.`);
    }
  }

  // --- Limites que impedem qualquer arranjo ---
  if (maximoHard < 1) {
    add('erro', 'TENSAO_MODULO_ACIMA_MAXIMO', `A Voc de um único módulo no frio (${fmtV(vocMax)}) já passa da tensão máxima do inversor (${fmtV(inv.tensaoMaxEntradaV)}).`);
  }
  const curtoPorString = inv.correnteCurtoMaxPorStringA;
  const msgCurtoPorString = (limite: number): string =>
    `A corrente de curto-circuito do módulo no calor (${fmtA(iscMax)}) passa do limite de ${fmtA(limite)} por entrada do inversor.`;
  const maiorCurtoMppt = Math.max(...inv.mppts.map((x) => x.correnteCurtoMaxA ?? Number.POSITIVE_INFINITY));
  if (iscMax > maiorCurtoMppt + 1e-9) {
    add('erro', 'CORRENTE_CURTO_ACIMA', `A corrente de curto-circuito do módulo no calor (${fmtA(iscMax)}) passa do limite de ${fmtA(maiorCurtoMppt)} por MPPT do inversor. Escolha um inversor com entrada de corrente maior.`);
  }
  if (curtoPorString !== undefined && iscMax > curtoPorString + 1e-9) {
    add('erro', 'CORRENTE_CURTO_ACIMA', msgCurtoPorString(curtoPorString));
  }
  if (maximoHard >= 1 && n > capacidadeStrings * maximoHard) {
    const inversores = qtdInversores > 1 ? `${qtdInversores} inversores deste modelo aceitam` : '1 inversor deste modelo aceita';
    add(
      'erro',
      'MODULOS_DEMAIS',
      `São ${n} módulos, mas ${inversores} no máximo ${capacidadeStrings * maximoHard} ` +
        `(${plural(capacidadeStrings, 'string', 'strings')} de até ${plural(maximoHard, 'módulo', 'módulos')}). ` +
        'Aumente a quantidade de inversores ou escolha um inversor maior.',
    );
  }
  if (n < minimoHard) {
    add('erro', 'MODULOS_DE_MENOS', `São necessários pelo menos ${minimoHard} módulos em série para o inversor partir e operar (faixa do MPPT a partir de ${fmtV(inv.faixaMpptMinV)}).`);
  }

  // --- Arranjo ---
  let arranjo: MpptCalculado[] | null = null;
  if (entrada.arranjo) {
    const escolhas: (Escolha | null)[] = [];
    const informadas = entrada.arranjo;
    let totalInformado = 0;
    let formatoValido = informadas.length === qtdInversores;
    slots.forEach((slot) => {
      const e = informadas[slot.inversor - 1]?.[slot.mppt - 1] ?? null;
      if (e) {
        totalInformado += e.strings * e.modulosPorString;
        if (!Number.isInteger(e.strings) || e.strings < 1 || e.strings > slot.espec.strings || !Number.isInteger(e.modulosPorString) || e.modulosPorString < 1) {
          formatoValido = false;
        }
      }
      escolhas.push(e ? { strings: e.strings, n: e.modulosPorString } : null);
    });
    if (!formatoValido || informadas.some((x, i) => x.length > inv.mppts.length || i >= qtdInversores)) {
      add('erro', 'ARRANJO_INVALIDO', 'O arranjo informado não corresponde aos MPPTs/strings do inversor.');
    } else if (totalInformado !== n) {
      add('erro', 'ARRANJO_INVALIDO', `O arranjo informado soma ${totalInformado} módulos, mas a proposta tem ${n}.`);
    } else {
      arranjo = mpptsCalculados(ctx, slots, escolhas);
    }
  } else if (!problemas.some((p) => p.nivel === 'erro' && p.codigo !== 'FASES_INCOMPATIVEIS' && p.codigo !== 'TENSAO_CA_INCOMPATIVEL')) {
    const encontrado = procurarArranjo(ctx, slots, n);
    if (encontrado) {
      arranjo = mpptsCalculados(ctx, slots, encontrado.escolhas);
    } else {
      const aceitam = slots.filter((slot) => avaliarSlot(ctx, slot.espec, 1, Math.max(minimoHard, 1)) !== null);
      const motivo =
        aceitam.length < slots.length
          ? ` Só ${plural(aceitam.length, 'MPPT aceita', 'MPPTs aceitam')} a corrente de curto deste módulo (${fmtA(iscMax)}).`
          : '';
      add(
        'erro',
        'SEM_ARRANJO_VALIDO',
        `Não há como ligar ${n} módulos neste inversor respeitando tensão e corrente (strings de ${minimoHard} a ${maximoHard} módulos).${motivo}`,
      );
    }
  }

  // --- Verificações do arranjo (informado ou encontrado) ---
  if (arranjo) {
    // Problemas iguais em vários MPPTs viram uma mensagem só ("MPPT 1, MPPT 2: …").
    const porMppt = new Map<string, { nivel: NivelProblema; codigo: CodigoProblema; texto: string; rotulos: string[] }>();
    const addMppt = (nivel: NivelProblema, codigo: CodigoProblema, rotulo: string, texto: string): void => {
      const chave = `${codigo}|${texto}`;
      const existente = porMppt.get(chave);
      if (existente) existente.rotulos.push(rotulo);
      else porMppt.set(chave, { nivel, codigo, texto, rotulos: [rotulo] });
    };
    for (const mp of arranjo) {
      const espec = inv.mppts[mp.mppt - 1]!;
      const rotulo = `${qtdInversores > 1 ? `Inversor ${mp.inversor}, ` : ''}MPPT ${mp.mppt}`;
      if (mp.modulosPorString > maximoHard) {
        addMppt('erro', 'TENSAO_STRING_ACIMA_MAXIMO', rotulo, `a Voc da string no frio (${fmtV(mp.vocMaxV)}) passa da tensão máxima do inversor (${fmtV(inv.tensaoMaxEntradaV)}). Use no máximo ${plural(maximoHard, 'módulo', 'módulos')} por string.`);
      }
      if (inv.tensaoPartidaV !== undefined && mp.modulosPorString * m.vocV < inv.tensaoPartidaV) {
        addMppt('erro', 'TENSAO_INSUFICIENTE_PARTIDA', rotulo, `a string não atinge a tensão de partida do inversor (${fmtV(inv.tensaoPartidaV)}).`);
      }
      if (mp.modulosPorString * m.vmpV < inv.faixaMpptMinV) {
        addMppt('erro', 'TENSAO_ABAIXO_MPPT', rotulo, `a Vmp da string (${fmtV(mp.modulosPorString * m.vmpV)}) fica abaixo da faixa do MPPT (${fmtV(inv.faixaMpptMinV)}).`);
      }
      if (espec.correnteCurtoMaxA !== undefined && mp.correnteCurtoMaxA > espec.correnteCurtoMaxA + 1e-9) {
        addMppt('erro', 'CORRENTE_CURTO_ACIMA', rotulo, `corrente de curto no calor de ${fmtA(mp.correnteCurtoMaxA)}, acima do limite de ${fmtA(espec.correnteCurtoMaxA)} do MPPT.`);
      }
      if (mp.correnteOperacaoA > espec.correnteMaxA + 1e-9) {
        addMppt('alerta', 'CORRENTE_ACIMA_MPPT', rotulo, `corrente de operação de ${fmtA(mp.correnteOperacaoA)}, acima do máximo de ${fmtA(espec.correnteMaxA)} do MPPT. O inversor limita a corrente e parte da geração é perdida (clipping).`);
      }
      if (mp.vmpMinV < inv.faixaMpptMinV && mp.modulosPorString * m.vmpV >= inv.faixaMpptMinV) {
        addMppt('alerta', 'VMP_ABAIXO_MPPT_CALOR', rotulo, `em dias muito quentes a Vmp da string cai para ${fmtV(mp.vmpMinV)}, abaixo do MPPT (${fmtV(inv.faixaMpptMinV)}). Considere mais módulos por string.`);
      }
      if (mp.vmpMaxV > inv.faixaMpptMaxV && mp.modulosPorString <= maximoHard) {
        addMppt('alerta', 'VMP_ACIMA_MPPT_FRIO', rotulo, `em dias frios a Vmp da string sobe para ${fmtV(mp.vmpMaxV)}, acima do MPPT (${fmtV(inv.faixaMpptMaxV)}).`);
      }
      if (inv.tensaoPartidaV !== undefined && mp.modulosPorString * vocMin < inv.tensaoPartidaV && mp.modulosPorString * m.vocV >= inv.tensaoPartidaV) {
        addMppt('alerta', 'PARTIDA_LENTA_CALOR', rotulo, `em dias quentes a string pode demorar a atingir a tensão de partida (${fmtV(inv.tensaoPartidaV)}).`);
      }
    }
    for (const p of porMppt.values()) add(p.nivel, p.codigo, `${p.rotulos.join(', ')}: ${p.texto}`);
    if (curtoPorString !== undefined && iscMax > curtoPorString + 1e-9) {
      add('erro', 'CORRENTE_CURTO_ACIMA', msgCurtoPorString(curtoPorString));
    }
    if (inv.correnteMaxPorStringA !== undefined && m.impA > inv.correnteMaxPorStringA + 1e-9) {
      add('alerta', 'CORRENTE_ACIMA_MPPT', `A corrente do módulo (${fmtA(m.impA)}) passa do máximo de ${fmtA(inv.correnteMaxPorStringA)} por entrada. O inversor limita a corrente e parte da geração é perdida (clipping).`);
    }
    for (let i = 1; i <= qtdInversores; i += 1) {
      if (!arranjo.some((mp) => mp.inversor === i)) {
        add('alerta', 'INVERSOR_SEM_MODULOS', `O inversor ${i} ficou sem módulos: reduza a quantidade de inversores.`);
      }
    }
  }

  // --- Relação CC/CA ---
  const potenciaCcW = n * m.potenciaW;
  const potenciaCaW = qtdInversores * inv.potenciaCaW;
  const relacao = potenciaCcW / potenciaCaW;
  const relacaoMax = entrada.relacaoCcCaMaxima ?? 1.3;
  const relacaoMin = entrada.relacaoCcCaMinima ?? 0.75;
  if (inv.potenciaMaxCcW !== undefined && potenciaCcW > qtdInversores * inv.potenciaMaxCcW + 1e-9) {
    add('alerta', 'POTENCIA_CC_ACIMA_FABRICANTE', `Potência dos módulos (${formatarNumeroBr(potenciaCcW / 1000, 2)} kWp) acima do máximo recomendado pelo fabricante (${formatarNumeroBr((qtdInversores * inv.potenciaMaxCcW) / 1000, 2)} kWp).`);
  } else if (inv.potenciaMaxCcW === undefined && relacao > relacaoMax) {
    add('alerta', 'RELACAO_CC_CA_ALTA', `Relação CC/CA de ${formatarNumeroBr(relacao, 2)}, acima de ${formatarNumeroBr(relacaoMax, 2)}: o inversor vai cortar parte da geração nos horários de pico.`);
  }
  if (relacao < relacaoMin) {
    add('info', 'INVERSOR_FOLGADO', `Relação CC/CA de ${formatarNumeroBr(relacao, 2)}: o inversor está bem acima da potência dos módulos.`);
  }

  const compativel = !problemas.some((p) => p.nivel === 'erro');
  const ordem: Record<NivelProblema, number> = { erro: 0, alerta: 1, info: 2 };
  problemas.sort((x, y) => ordem[x.nivel] - ordem[y.nivel]);

  return {
    compativel,
    bloqueia: !compativel,
    exigeConfirmacao: problemas.some((p) => p.nivel === 'alerta'),
    problemas,
    limitesString: {
      minimo: minimoHard,
      maximo: Math.max(0, maximoHard),
      recomendadoMin,
      recomendadoMax: Math.max(0, recomendadoMax),
    },
    valoresPorModulo: {
      vocMaxV: arredondar(vocMax, CASAS_DECIMAIS.eletrica),
      vocMinV: arredondar(vocMin, CASAS_DECIMAIS.eletrica),
      vmpMinV: arredondar(vmpMin, CASAS_DECIMAIS.eletrica),
      vmpMaxV: arredondar(vmpMax, CASAS_DECIMAIS.eletrica),
      iscMaxA: arredondar(iscMax, CASAS_DECIMAIS.eletrica),
    },
    arranjo,
    descricaoArranjo: arranjo ? descreverArranjo(arranjo) : null,
    potenciaCcKwp: arredondar(potenciaCcW / 1000, CASAS_DECIMAIS.kwp),
    potenciaCaKw: arredondar(potenciaCaW / 1000, CASAS_DECIMAIS.kwp),
    relacaoCcCa: arredondar(relacao, 2),
    premissas: { temperaturaMinimaC: tMin, temperaturaMaximaCelulaC: tMax },
  };
}

export interface EntradaCompatibilidadeCatalogo {
  modulo: Equipamento;
  quantidadeModulos: number;
  inversor: Equipamento;
  quantidadeInversores?: number;
  tipoLigacao?: TipoLigacao;
  tensaoRedeV?: number;
  temperaturaMinimaC?: number;
  temperaturaMaximaCelulaC?: number;
  arranjo?: ArranjoInformado;
}

/** Atalho para a tela de seleção (RF09): recebe os itens do catálogo diretamente. */
export function verificarCompatibilidadeCatalogo(entrada: EntradaCompatibilidadeCatalogo): ResultadoCompatibilidade {
  const { modulo, inversor, ...resto } = entrada;
  return verificarCompatibilidade({
    ...resto,
    modulo: especModuloDoEquipamento(modulo),
    inversor: especInversorDoEquipamento(inversor),
  });
}
