/**
 * SCRUM-76 — regras do catálogo de equipamentos: preço de venda, validação
 * por categoria e filtros (subtarefa 3: marca, preço e disponibilidade).
 *
 * As mesmas regras valem no formulário web do gestor (RF25) e na tela de
 * seleção do técnico (RF09).
 */
import { ehNumeroFinito, type ErroCampo } from '../erros';
import { arredondar } from '../util/numeros';
import { normalizarTexto } from '../util/texto';
import {
  CATEGORIAS_EQUIPAMENTO,
  FASES,
  STATUS_EQUIPAMENTO,
  UNIDADES_VENDA,
  type CategoriaEquipamento,
  type Equipamento,
  type StatusEquipamento,
} from './tipos';

/** preço de venda = preço de custo × (1 + margem/100), em R$ com 2 casas (Dicionário, seção 6). */
export function calcularPrecoVenda(precoCusto: number, margemPercentual: number): number {
  return arredondar(precoCusto * (1 + margemPercentual / 100), 2);
}

const ROTULOS_CAMPOS: Partial<Record<keyof Equipamento, string>> = {
  potenciaW: 'potência (W)',
  vocV: 'Voc (V)',
  iscA: 'Isc (A)',
  vmpV: 'Vmp (V)',
  impA: 'Imp (A)',
  coefTempVocPercC: 'coeficiente de temperatura da Voc (%/°C)',
  comprimentoMm: 'comprimento (mm)',
  larguraMm: 'largura (mm)',
  tensaoMaxEntradaV: 'tensão máxima de entrada CC (V)',
  faixaMpptMinV: 'tensão mínima do MPPT (V)',
  faixaMpptMaxV: 'tensão máxima do MPPT (V)',
  qtdMppt: 'quantidade de MPPTs',
  stringsPorMppt: 'strings por MPPT',
  correnteMaxEntradaA: 'corrente máxima por MPPT (A)',
};

/** Campos elétricos obrigatórios para módulos (usados no string sizing e no alerta de espaço). */
export const CAMPOS_OBRIGATORIOS_MODULO = [
  'potenciaW',
  'vocV',
  'iscA',
  'vmpV',
  'impA',
  'coefTempVocPercC',
  'comprimentoMm',
  'larguraMm',
] as const satisfies readonly (keyof Equipamento)[];

/** Campos elétricos obrigatórios para inversores (os de MPPT podem vir de `configuracaoMppt`). */
export const CAMPOS_OBRIGATORIOS_INVERSOR = [
  'potenciaW',
  'tensaoMaxEntradaV',
  'faixaMpptMinV',
  'faixaMpptMaxV',
] as const satisfies readonly (keyof Equipamento)[];

function positivo(eq: Equipamento, campo: keyof Equipamento, erros: ErroCampo[]): void {
  const valor = eq[campo];
  if (!ehNumeroFinito(valor) || valor <= 0) {
    erros.push({ campo, mensagem: `Informe ${ROTULOS_CAMPOS[campo] ?? campo} (maior que zero).` });
  }
}

function textoPreenchido(eq: Equipamento, campo: 'fabricante' | 'modelo' | 'fornecedor', erros: ErroCampo[]): void {
  if (typeof eq[campo] !== 'string' || eq[campo].trim() === '') {
    erros.push({ campo, mensagem: `Informe o ${campo}.` });
  }
}

/**
 * Valida um equipamento do catálogo: campos comuns, preço (RF25 4a) e os
 * dados técnicos que cada categoria precisa. Retorna a lista de erros.
 */
export function validarEquipamento(eq: Equipamento): ErroCampo[] {
  const erros: ErroCampo[] = [];
  if (!(CATEGORIAS_EQUIPAMENTO as readonly string[]).includes(eq.categoria)) {
    erros.push({ campo: 'categoria', mensagem: 'Categoria inválida.' });
  }
  textoPreenchido(eq, 'fabricante', erros);
  textoPreenchido(eq, 'modelo', erros);
  textoPreenchido(eq, 'fornecedor', erros);
  if (!(UNIDADES_VENDA as readonly string[]).includes(eq.unidadeVenda)) {
    erros.push({ campo: 'unidadeVenda', mensagem: 'Unidade de venda inválida.' });
  }
  if (!(STATUS_EQUIPAMENTO as readonly string[]).includes(eq.status)) {
    erros.push({ campo: 'status', mensagem: 'Status inválido.' });
  }
  if (!ehNumeroFinito(eq.precoCusto) || eq.precoCusto <= 0) {
    erros.push({ campo: 'precoCusto', mensagem: 'O preço de custo deve ser maior que zero.' });
  }
  if (!ehNumeroFinito(eq.margemPercentual) || eq.margemPercentual < 0) {
    erros.push({ campo: 'margemPercentual', mensagem: 'A margem não pode ser negativa.' });
  }
  if (
    ehNumeroFinito(eq.precoCusto) &&
    ehNumeroFinito(eq.margemPercentual) &&
    Math.abs(eq.precoVenda - calcularPrecoVenda(eq.precoCusto, eq.margemPercentual)) > 0.005
  ) {
    erros.push({ campo: 'precoVenda', mensagem: 'O preço de venda não bate com custo × (1 + margem).' });
  }
  if (eq.garantiaAnos !== null && (!Number.isInteger(eq.garantiaAnos) || eq.garantiaAnos < 0)) {
    erros.push({ campo: 'garantiaAnos', mensagem: 'A garantia deve ser um número inteiro de anos.' });
  }

  if (eq.categoria === 'Módulo') {
    CAMPOS_OBRIGATORIOS_MODULO.forEach((c) => {
      if (c !== 'coefTempVocPercC') positivo(eq, c, erros);
    });
    if (!ehNumeroFinito(eq.coefTempVocPercC) || eq.coefTempVocPercC >= 0) {
      erros.push({ campo: 'coefTempVocPercC', mensagem: 'O coeficiente de temperatura da Voc deve ser negativo (%/°C).' });
    }
    if (ehNumeroFinito(eq.vmpV) && ehNumeroFinito(eq.vocV) && eq.vmpV >= eq.vocV) {
      erros.push({ campo: 'vmpV', mensagem: 'A Vmp deve ser menor que a Voc.' });
    }
    if (ehNumeroFinito(eq.impA) && ehNumeroFinito(eq.iscA) && eq.impA >= eq.iscA) {
      erros.push({ campo: 'impA', mensagem: 'A Imp deve ser menor que a Isc.' });
    }
  }

  if (eq.categoria === 'Inversor') {
    CAMPOS_OBRIGATORIOS_INVERSOR.forEach((c) => positivo(eq, c, erros));
    if (!eq.fases || !(FASES as readonly string[]).includes(eq.fases)) {
      erros.push({ campo: 'fases', mensagem: 'Informe as fases do inversor.' });
    }
    if (
      ehNumeroFinito(eq.faixaMpptMinV) &&
      ehNumeroFinito(eq.faixaMpptMaxV) &&
      eq.faixaMpptMinV >= eq.faixaMpptMaxV
    ) {
      erros.push({ campo: 'faixaMpptMinV', mensagem: 'A tensão mínima do MPPT deve ser menor que a máxima.' });
    }
    if (
      ehNumeroFinito(eq.faixaMpptMaxV) &&
      ehNumeroFinito(eq.tensaoMaxEntradaV) &&
      eq.faixaMpptMaxV > eq.tensaoMaxEntradaV
    ) {
      erros.push({ campo: 'faixaMpptMaxV', mensagem: 'A faixa do MPPT não pode passar da tensão máxima de entrada.' });
    }
    if (eq.configuracaoMppt && eq.configuracaoMppt.length > 0) {
      eq.configuracaoMppt.forEach((m, i) => {
        if (!Number.isInteger(m.strings) || m.strings <= 0 || !ehNumeroFinito(m.correnteMaxA) || m.correnteMaxA <= 0) {
          erros.push({ campo: `configuracaoMppt[${i}]`, mensagem: `MPPT ${i + 1}: informe strings e corrente máxima.` });
        }
      });
    } else {
      positivo(eq, 'qtdMppt', erros);
      positivo(eq, 'stringsPorMppt', erros);
      positivo(eq, 'correnteMaxEntradaA', erros);
    }
  }
  return erros;
}

export type OrdenacaoCatalogo = 'fabricante' | 'preco' | 'potencia';

export interface FiltroCatalogo {
  categoria?: CategoriaEquipamento;
  /** Um ou mais fabricantes (marca). */
  fabricantes?: readonly string[];
  /** Busca livre em fabricante e modelo, sem diferenciar acentos e maiúsculas. */
  busca?: string;
  potenciaMinW?: number;
  potenciaMaxW?: number;
  /** Faixa de preço de venda (R$). */
  precoMin?: number;
  precoMax?: number;
  /** Disponibilidade: por padrão só itens `Ativo` (o técnico nunca vê itens ocultos). */
  status?: StatusEquipamento | 'Todos';
  ordenarPor?: OrdenacaoCatalogo;
  ordem?: 'asc' | 'desc';
}

/** Reexportado por compatibilidade; a implementação fica em `util/texto`. */
export { normalizarTexto };

/**
 * Filtra e ordena o catálogo (RF09, passo 1; SCRUM-76, subtarefa 3).
 * Não altera a lista recebida.
 */
export function filtrarCatalogo(itens: readonly Equipamento[], filtro: FiltroCatalogo = {}): Equipamento[] {
  const status = filtro.status ?? 'Ativo';
  const termos = filtro.busca ? normalizarTexto(filtro.busca).split(/\s+/).filter(Boolean) : [];
  const fabricantes = filtro.fabricantes?.map(normalizarTexto);

  const resultado = itens.filter((eq) => {
    if (status !== 'Todos' && eq.status !== status) return false;
    if (filtro.categoria && eq.categoria !== filtro.categoria) return false;
    if (fabricantes && fabricantes.length > 0 && !fabricantes.includes(normalizarTexto(eq.fabricante))) return false;
    if (termos.length > 0) {
      const alvo = normalizarTexto(`${eq.fabricante} ${eq.modelo}`);
      if (!termos.every((t) => alvo.includes(t))) return false;
    }
    if (filtro.potenciaMinW !== undefined && (eq.potenciaW ?? -Infinity) < filtro.potenciaMinW) return false;
    if (filtro.potenciaMaxW !== undefined && (eq.potenciaW ?? Infinity) > filtro.potenciaMaxW) return false;
    if (filtro.precoMin !== undefined && eq.precoVenda < filtro.precoMin) return false;
    if (filtro.precoMax !== undefined && eq.precoVenda > filtro.precoMax) return false;
    return true;
  });

  const ordenarPor = filtro.ordenarPor ?? 'fabricante';
  const sinal = filtro.ordem === 'desc' ? -1 : 1;
  const chave = (eq: Equipamento): number | string =>
    ordenarPor === 'preco' ? eq.precoVenda : ordenarPor === 'potencia' ? (eq.potenciaW ?? 0) : normalizarTexto(`${eq.fabricante} ${eq.modelo}`);
  return resultado.sort((a, b) => {
    const ka = chave(a);
    const kb = chave(b);
    if (ka < kb) return -1 * sinal;
    if (ka > kb) return 1 * sinal;
    return 0;
  });
}

/** Fabricantes distintos (ordem alfabética), para o filtro de marca. */
export function listarFabricantes(itens: readonly Equipamento[], categoria?: CategoriaEquipamento): string[] {
  const nomes = new Set(itens.filter((eq) => !categoria || eq.categoria === categoria).map((eq) => eq.fabricante));
  return [...nomes].sort((a, b) => normalizarTexto(a).localeCompare(normalizarTexto(b)));
}

/** Quantidade de itens por categoria (todas as 6 aparecem, mesmo com zero). */
export function contarPorCategoria(itens: readonly Equipamento[]): Record<CategoriaEquipamento, number> {
  const contagem = Object.fromEntries(CATEGORIAS_EQUIPAMENTO.map((c) => [c, 0])) as Record<CategoriaEquipamento, number>;
  for (const eq of itens) contagem[eq.categoria] += 1;
  return contagem;
}
