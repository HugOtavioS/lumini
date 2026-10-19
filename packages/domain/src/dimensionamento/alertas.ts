/**
 * Alertas do resumo técnico (RF07, passo 4, e exceções 4a/4b).
 *
 * - SCRUM-392: espaço insuficiente no telhado.
 * - SCRUM-394: superdimensionamento em relação ao consumo (Lei 14.300).
 *
 * Os dois alertas não bloqueiam o fluxo: eles devolvem um `nivel` e uma
 * mensagem pronta para a tela. Quem decide se o técnico pode avançar é a
 * interface (o protótipo `Resumo_Técnico` mostra os dois avisos).
 */
import { garantirSemErros, ehNumeroFinito, type ErroCampo } from '../erros';
import { arredondar, CASAS_DECIMAIS, formatarNumeroBr } from '../util/numeros';

// ---------------------------------------------------------------------------
// SCRUM-392 — espaço insuficiente
// ---------------------------------------------------------------------------

/** Folga padrão sobre a área dos módulos: grampos, espaçamento e circulação. */
export const FOLGA_INSTALACAO_PADRAO_PERC = 10;

/** A partir desta ocupação (% da área medida) o técnico recebe um aviso de atenção. */
export const LIMIAR_ATENCAO_OCUPACAO_PADRAO_PERC = 90;

export type NivelEspaco = 'ok' | 'atencao' | 'insuficiente';

export interface EntradaEspacoTelhado {
  /** Área útil medida do telhado (m²) — soma das seções (RF04/RF05). */
  areaMedidaM2: number;
  /** Quantidade de módulos do kit dimensionado/selecionado. */
  quantidadeModulos: number;
  /** Área de um módulo (m²). Use {@link areaDoModuloM2} a partir das dimensões do datasheet. */
  areaModuloM2: number;
  /** Folga sobre a área dos módulos (%). Padrão 10 %. */
  folgaInstalacaoPerc?: number;
  /** Ocupação a partir da qual o nível vira `atencao`. Padrão 90 %. */
  limiarAtencaoPerc?: number;
}

export interface ResultadoEspacoTelhado {
  nivel: NivelEspaco;
  /** `true` quando a área necessária cabe na área medida. */
  cabe: boolean;
  /** Área exigida pelo kit, já com a folga (m²). */
  areaNecessariaM2: number;
  areaMedidaM2: number;
  /** Área exigida ÷ área medida × 100. */
  ocupacaoPerc: number;
  /** Quanto falta (m²); zero quando cabe. */
  faltaM2: number;
  /** Quantos módulos cabem na área medida, com a mesma folga. */
  maximoModulos: number;
  mensagem: string;
}

/** Área de um módulo a partir das dimensões do datasheet (mm → m²). */
export function areaDoModuloM2(comprimentoMm: number, larguraMm: number): number {
  garantirSemErros(
    [
      !ehNumeroFinito(comprimentoMm) || comprimentoMm <= 0
        ? { campo: 'comprimentoMm', mensagem: 'O comprimento do módulo deve ser maior que zero.' }
        : null,
      !ehNumeroFinito(larguraMm) || larguraMm <= 0
        ? { campo: 'larguraMm', mensagem: 'A largura do módulo deve ser maior que zero.' }
        : null,
    ].filter((e): e is ErroCampo => e !== null),
  );
  return (comprimentoMm * larguraMm) / 1_000_000;
}

function validarEspaco(entrada: EntradaEspacoTelhado): ErroCampo[] {
  const erros: ErroCampo[] = [];
  const { areaMedidaM2, quantidadeModulos, areaModuloM2 } = entrada;
  const folga = entrada.folgaInstalacaoPerc ?? FOLGA_INSTALACAO_PADRAO_PERC;
  const limiar = entrada.limiarAtencaoPerc ?? LIMIAR_ATENCAO_OCUPACAO_PADRAO_PERC;
  if (!ehNumeroFinito(areaMedidaM2) || areaMedidaM2 <= 0) {
    erros.push({ campo: 'areaMedidaM2', mensagem: 'A área medida do telhado deve ser maior que zero.' });
  }
  if (!Number.isInteger(quantidadeModulos) || quantidadeModulos <= 0) {
    erros.push({ campo: 'quantidadeModulos', mensagem: 'A quantidade de módulos deve ser um inteiro maior que zero.' });
  }
  if (!ehNumeroFinito(areaModuloM2) || areaModuloM2 <= 0) {
    erros.push({ campo: 'areaModuloM2', mensagem: 'A área do módulo deve ser maior que zero.' });
  }
  if (!ehNumeroFinito(folga) || folga < 0 || folga > 100) {
    erros.push({ campo: 'folgaInstalacaoPerc', mensagem: 'A folga de instalação deve estar entre 0 % e 100 %.' });
  }
  if (!ehNumeroFinito(limiar) || limiar <= 0 || limiar > 100) {
    erros.push({ campo: 'limiarAtencaoPerc', mensagem: 'O limiar de atenção deve estar entre 0 % e 100 %.' });
  }
  return erros;
}

/**
 * SCRUM-392 — compara a área exigida pelo kit com a área medida do telhado.
 *
 *     área necessária = qtd. de módulos × área do módulo × (1 + folga)
 *
 * @throws {ErroValidacao} se alguma entrada for inválida.
 */
export function verificarEspacoTelhado(entrada: EntradaEspacoTelhado): ResultadoEspacoTelhado {
  garantirSemErros(validarEspaco(entrada));

  const folga = (entrada.folgaInstalacaoPerc ?? FOLGA_INSTALACAO_PADRAO_PERC) / 100;
  const limiar = entrada.limiarAtencaoPerc ?? LIMIAR_ATENCAO_OCUPACAO_PADRAO_PERC;
  const areaPorModulo = entrada.areaModuloM2 * (1 + folga);
  const areaNecessaria = entrada.quantidadeModulos * areaPorModulo;
  const ocupacao = (areaNecessaria / entrada.areaMedidaM2) * 100;
  // Arredonda antes do floor para não perder um módulo por erro de ponto flutuante.
  const maximoModulos = Math.floor(arredondar(entrada.areaMedidaM2 / areaPorModulo, 6));
  const cabe = areaNecessaria <= entrada.areaMedidaM2 + 1e-9;

  const nivel: NivelEspaco = !cabe ? 'insuficiente' : ocupacao >= limiar ? 'atencao' : 'ok';
  const necessaria = formatarNumeroBr(areaNecessaria, 1);
  const medida = formatarNumeroBr(entrada.areaMedidaM2, 1);

  let mensagem: string;
  if (nivel === 'insuficiente') {
    mensagem =
      `Espaço insuficiente: o kit precisa de ${necessaria} m² e o telhado medido tem ${medida} m². ` +
      `Cabem no máximo ${maximoModulos} módulo(s) desse modelo. Reveja a seleção ou meça outra seção do telhado.`;
  } else if (nivel === 'atencao') {
    mensagem =
      `Atenção: o kit ocupa ${formatarNumeroBr(ocupacao, 0)} % da área medida (${necessaria} de ${medida} m²). ` +
      'Confirme no local se há espaço para os afastamentos e a circulação.';
  } else {
    mensagem = `O kit cabe no telhado: ${necessaria} m² de ${medida} m² medidos.`;
  }

  return {
    nivel,
    cabe,
    areaNecessariaM2: arredondar(areaNecessaria, CASAS_DECIMAIS.area),
    areaMedidaM2: entrada.areaMedidaM2,
    ocupacaoPerc: arredondar(ocupacao, CASAS_DECIMAIS.percentual),
    faltaM2: cabe ? 0 : arredondar(areaNecessaria - entrada.areaMedidaM2, CASAS_DECIMAIS.area),
    maximoModulos,
    mensagem,
  };
}

export interface EntradaEspacoPorPotencia {
  areaMedidaM2: number;
  /** Potência a instalar (kWp), ex.: a potência necessária do RF07. */
  potenciaKwp: number;
  /** Potência do módulo de referência (W). */
  potenciaModuloW: number;
  /** Área do módulo de referência (m²). */
  areaModuloM2: number;
  folgaInstalacaoPerc?: number;
  limiarAtencaoPerc?: number;
}

/**
 * Variante para o resumo técnico (RF07), antes de o técnico escolher o
 * equipamento: calcula quantos módulos de referência a potência exige e então
 * verifica o espaço.
 */
export function verificarEspacoPorPotencia(entrada: EntradaEspacoPorPotencia): ResultadoEspacoTelhado {
  const erros: ErroCampo[] = [];
  if (!ehNumeroFinito(entrada.potenciaKwp) || entrada.potenciaKwp <= 0) {
    erros.push({ campo: 'potenciaKwp', mensagem: 'A potência deve ser maior que zero.' });
  }
  if (!ehNumeroFinito(entrada.potenciaModuloW) || entrada.potenciaModuloW <= 0) {
    erros.push({ campo: 'potenciaModuloW', mensagem: 'A potência do módulo deve ser maior que zero.' });
  }
  garantirSemErros(erros);
  const quantidadeModulos = Math.ceil(arredondar((entrada.potenciaKwp * 1000) / entrada.potenciaModuloW, 6));
  return verificarEspacoTelhado({
    areaMedidaM2: entrada.areaMedidaM2,
    quantidadeModulos,
    areaModuloM2: entrada.areaModuloM2,
    ...(entrada.folgaInstalacaoPerc !== undefined && { folgaInstalacaoPerc: entrada.folgaInstalacaoPerc }),
    ...(entrada.limiarAtencaoPerc !== undefined && { limiarAtencaoPerc: entrada.limiarAtencaoPerc }),
  });
}

// ---------------------------------------------------------------------------
// SCRUM-394 — superdimensionamento (Lei 14.300)
// ---------------------------------------------------------------------------

/** Limite padrão do alerta (%), igual ao `default` de `limite_superdimensionamento_perc`. */
export const LIMITE_SUPERDIMENSIONAMENTO_PADRAO_PERC = 20;

/** Início da faixa de atenção (%). Com o limite padrão, a faixa é 15–20 %. */
export const LIMITE_ATENCAO_SUPERDIMENSIONAMENTO_PADRAO_PERC = 15;

/**
 * Texto de base legal exibido junto do alerta. A Lei 14.300/2022 não fixa um
 * percentual máximo: o limite é um parâmetro da empresa. O que a lei define é
 * que o excedente vira crédito (art. 1º, IX) e que o crédito expira em 60 meses
 * (art. 13) — por isso gerar muito acima do consumo não traz retorno ao cliente
 * e costuma ser questionado pela distribuidora na análise do pedido de conexão.
 */
export const BASE_LEGAL_SUPERDIMENSIONAMENTO =
  'Lei 14.300/2022: o excedente de energia vira crédito (art. 1º, IX), que expira em 60 meses (art. 13). ' +
  'O percentual-limite é definido pela empresa nos parâmetros técnicos.';

export type NivelSuperdimensionamento = 'ok' | 'atencao' | 'alerta';

export interface EntradaSuperdimensionamento {
  /** Consumo médio mensal da instalação (kWh/mês). */
  consumoMensalKwh: number;
  /** Geração estimada média mensal do sistema selecionado (kWh/mês). */
  geracaoEstimadaKwhMes: number;
  /** Excedente acima do qual o alerta dispara (%). Padrão 20 %. */
  limiteAlertaPerc?: number;
  /** Excedente a partir do qual o nível vira `atencao` (%). Padrão 15 % (ou 75 % do limite, se menor). */
  limiteAtencaoPerc?: number;
}

export interface ResultadoSuperdimensionamento {
  nivel: NivelSuperdimensionamento;
  /** (geração − consumo) ÷ consumo × 100. Negativo quando a geração não cobre o consumo. */
  excedentePerc: number;
  /** Energia gerada acima do consumo (kWh/mês); zero quando não há excedente. */
  excedenteKwhMes: number;
  limiteAlertaPerc: number;
  mensagem: string;
  baseLegal: string;
}

/**
 * SCRUM-394 — alerta quando a geração estimada passa do consumo além do
 * limite configurado. Use com a geração do sistema **selecionado** (depois do
 * RF09); com a potência necessária do RF07 a geração é igual ao consumo.
 *
 * @throws {ErroValidacao} se consumo, geração ou limites forem inválidos.
 */
export function verificarSuperdimensionamento(entrada: EntradaSuperdimensionamento): ResultadoSuperdimensionamento {
  const limiteAlerta = entrada.limiteAlertaPerc ?? LIMITE_SUPERDIMENSIONAMENTO_PADRAO_PERC;
  const limiteAtencao =
    entrada.limiteAtencaoPerc ?? Math.min(LIMITE_ATENCAO_SUPERDIMENSIONAMENTO_PADRAO_PERC, limiteAlerta * 0.75);

  const erros: ErroCampo[] = [];
  if (!ehNumeroFinito(entrada.consumoMensalKwh) || entrada.consumoMensalKwh <= 0) {
    erros.push({ campo: 'consumoMensalKwh', mensagem: 'O consumo médio mensal deve ser maior que zero.' });
  }
  if (!ehNumeroFinito(entrada.geracaoEstimadaKwhMes) || entrada.geracaoEstimadaKwhMes < 0) {
    erros.push({ campo: 'geracaoEstimadaKwhMes', mensagem: 'A geração estimada não pode ser negativa.' });
  }
  if (!ehNumeroFinito(limiteAlerta) || limiteAlerta <= 0) {
    erros.push({ campo: 'limiteAlertaPerc', mensagem: 'O limite de superdimensionamento deve ser maior que zero.' });
  }
  if (!ehNumeroFinito(limiteAtencao) || limiteAtencao < 0 || limiteAtencao > limiteAlerta) {
    erros.push({ campo: 'limiteAtencaoPerc', mensagem: 'O limite de atenção deve estar entre 0 e o limite de alerta.' });
  }
  garantirSemErros(erros);

  const excedente = entrada.geracaoEstimadaKwhMes - entrada.consumoMensalKwh;
  const excedentePerc = (excedente / entrada.consumoMensalKwh) * 100;
  const excedenteArred = arredondar(excedentePerc, CASAS_DECIMAIS.percentual);
  // A comparação usa o valor arredondado, para a tela nunca mostrar "20,0 %"
  // com um nível diferente do que o número sugere.
  const nivel: NivelSuperdimensionamento =
    excedenteArred > limiteAlerta ? 'alerta' : excedenteArred >= limiteAtencao && excedenteArred > 0 ? 'atencao' : 'ok';

  const pct = formatarNumeroBr(excedentePerc, 1);
  const lim = formatarNumeroBr(limiteAlerta, 0);
  let mensagem: string;
  if (nivel === 'alerta') {
    mensagem =
      `Superdimensionamento: a geração estimada fica ${pct} % acima do consumo (limite da empresa: ${lim} %). ` +
      'A distribuidora pode questionar ou recusar a homologação, e o excedente vira créditos que expiram em 60 meses. ' +
      'Reduza a quantidade de módulos ou registre a justificativa (ex.: aumento de carga previsto).';
  } else if (nivel === 'atencao') {
    mensagem = `Atenção: a geração estimada fica ${pct} % acima do consumo, perto do limite de ${lim} %.`;
  } else if (excedentePerc < 0) {
    mensagem = `A geração estimada cobre ${formatarNumeroBr(100 + excedentePerc, 1)} % do consumo.`;
  } else {
    mensagem = 'A geração estimada está compatível com o consumo.';
  }

  return {
    nivel,
    excedentePerc: excedenteArred,
    excedenteKwhMes: excedente > 0 ? arredondar(excedente, CASAS_DECIMAIS.kwh) : 0,
    limiteAlertaPerc: limiteAlerta,
    mensagem,
    baseLegal: BASE_LEGAL_SUPERDIMENSIONAMENTO,
  };
}
