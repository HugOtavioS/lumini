/**
 * SCRUM-76 — modelo de dados do catálogo de equipamentos.
 *
 * Espelha a tabela **Equipamento** do Dicionário de Dados (seção 6, v1.3):
 * cada coluna `snake_case` vira uma propriedade `camelCase` com o mesmo nome.
 * O catálogo é mantido pelo gestor na web (RF25) e chega ao app por pull
 * (RF15), onde é somente leitura.
 *
 * Campos elétricos são opcionais no tipo porque dependem da categoria:
 * `validarEquipamento` exige os que cada categoria precisa.
 */

/** As 6 categorias confirmadas no protótipo. */
export const CATEGORIAS_EQUIPAMENTO = ['Módulo', 'Inversor', 'Estrutura', 'String Box', 'Cabos', 'Conectores'] as const;
export type CategoriaEquipamento = (typeof CATEGORIAS_EQUIPAMENTO)[number];

export const FASES = ['Monofásico', 'Bifásico', 'Trifásico'] as const;
export type Fases = (typeof FASES)[number];

export const STATUS_EQUIPAMENTO = ['Ativo', 'Oculto'] as const;
export type StatusEquipamento = (typeof STATUS_EQUIPAMENTO)[number];

/** Unidade em que o item é vendido e contado na proposta (cabo por metro, conector por par…). */
export const UNIDADES_VENDA = ['un', 'm', 'par', 'kit'] as const;
export type UnidadeVenda = (typeof UNIDADES_VENDA)[number];

/**
 * Configuração de um MPPT do inversor. Usada quando os MPPTs não são iguais
 * (ex.: Growatt MIN 10000TL-X: 13,5 A / 13,5 A / 27 A).
 */
export interface ConfiguracaoMppt {
  /** Quantidade de strings (entradas) em paralelo neste MPPT. */
  strings: number;
  /** Corrente máxima de entrada do MPPT (A). */
  correnteMaxA: number;
  /** Corrente máxima de curto-circuito do MPPT (A). */
  correnteCurtoMaxA?: number;
}

export interface Equipamento {
  /** UUID, gerado pela API. */
  idEquipamento: string;
  /** Catálogo por empresa (multi-tenant). */
  idEmpresa: string;
  categoria: CategoriaEquipamento;
  fabricante: string;
  modelo: string;
  /** Fornecedor (distribuidor), separado do fabricante. */
  fornecedor: string;
  unidadeVenda: UnidadeVenda;

  /** Potência nominal (W): Pmax do módulo em STC ou potência CA do inversor. Nula nas demais categorias. */
  potenciaW: number | null;

  // --- Módulo (NOVO-75 / SCRUM-395 / SCRUM-392) ---
  /** Tensão de circuito aberto em STC (V). */
  vocV?: number | null;
  /** Corrente de curto-circuito em STC (A). */
  iscA?: number | null;
  /** Tensão de máxima potência em STC (V). */
  vmpV?: number | null;
  /** Corrente de máxima potência em STC (A). */
  impA?: number | null;
  /** Coeficiente de temperatura da Voc (%/°C, negativo). */
  coefTempVocPercC?: number | null;
  /** Coeficiente de temperatura da Pmax (%/°C, negativo). */
  coefTempPmaxPercC?: number | null;
  /** Coeficiente de temperatura da Isc (%/°C, positivo). */
  coefTempIscPercC?: number | null;
  /** Comprimento do módulo (mm). */
  comprimentoMm?: number | null;
  /** Largura do módulo (mm). */
  larguraMm?: number | null;
  /** Eficiência do módulo (%). */
  eficienciaPerc?: number | null;

  // --- Inversor (NOVO-75 / SCRUM-395) ---
  /** Tensão máxima de entrada CC (V). */
  tensaoMaxEntradaV?: number | null;
  /** Corrente máxima de entrada **por MPPT** (A). */
  correnteMaxEntradaA?: number | null;
  /** Corrente máxima de curto-circuito **por MPPT** (A). */
  correnteCurtoMaxMpptA?: number | null;
  faixaMpptMinV?: number | null;
  faixaMpptMaxV?: number | null;
  /** Tensão de partida (V). */
  tensaoPartidaV?: number | null;
  /** Quantidade de MPPTs (quando todos são iguais). */
  qtdMppt?: number | null;
  /** Strings por MPPT (quando todos são iguais). */
  stringsPorMppt?: number | null;
  /** MPPTs diferentes entre si; quando preenchido, substitui qtdMppt/stringsPorMppt/correntes por MPPT. */
  configuracaoMppt?: ConfiguracaoMppt[] | null;
  /** Limite de corrente por entrada/string (A) — microinversores. */
  correnteMaxPorStringA?: number | null;
  /** Limite de curto-circuito por entrada/string (A) — microinversores. */
  correnteCurtoMaxPorStringA?: number | null;
  /** Potência CC máxima recomendada pelo fabricante (W). */
  potenciaMaxCcW?: number | null;
  /** Fases do inversor, comparadas com o `tipo_ligacao` da instalação. */
  fases?: Fases | null;
  /** Tensão nominal CA (V), ex.: 220 ou 380. */
  tensaoCaV?: number | null;

  // --- Comum ---
  garantiaAnos: number | null;
  /** Atributos que só fazem sentido em uma categoria (ex.: seção do cabo, entradas da string box). */
  especificacoes?: Record<string, string | number> | null;
  precoCusto: number;
  margemPercentual: number;
  /** Calculado: precoCusto × (1 + margemPercentual/100). */
  precoVenda: number;
  status: StatusEquipamento;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}
