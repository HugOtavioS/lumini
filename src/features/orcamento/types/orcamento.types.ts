/**
 * orcamento.types.ts
 *
 * Tipos TypeScript LOCAIS da feature de orçamento.
 * Responsabilidades:
 * - Definir interfaces usadas APENAS dentro desta feature
 * - Tipos de formulário, filtros e dados de apresentação
 *
 * ⚠️ Se um tipo precisa ser compartilhado com outras features,
 *    ele deve ser movido para src/domain/entities/ ou src/shared/types/.
 */

import { StatusOrcamento } from '@/domain/enums/StatusOrcamento';

/** Resumo do orçamento para exibição na listagem */
export interface OrcamentoResumo {
  id: string;
  clienteNome: string;
  status: string;
  potenciaKwp: number;
  valorTotal: number;
  criadoEm: string;
}

/** Dados do formulário de criação/edição */
export interface OrcamentoFormData {
  clienteId: string;
  consumoMensalKwh: number;
  tipoTelhado: string;
  areaDisponivelM2: number;
  orientacaoTelhado: string;
  inclinacaoGraus: number;
  modeloPlacaId: string;
  observacoes: string;
}

/** Filtros aplicados na listagem */
export interface FiltroOrcamento {
  busca: string;
  status?: string;
  dataInicio?: string;
  dataFim?: string;
}

/** Item individual dentro de um orçamento */
export interface ItemOrcamentoForm {
  produtoId: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}
