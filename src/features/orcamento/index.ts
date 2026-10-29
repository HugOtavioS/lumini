/**
 * Feature: Orçamento
 *
 * Barrel export — expõe apenas o que outras partes da aplicação
 * podem consumir desta feature (ex: navegação, provedores).
 *
 * ⚠️ Componentes internos e hooks NÃO devem ser exportados aqui
 *    a menos que sejam consumidos fora da feature.
 */

// Telas (usadas pelo React Navigation para registro de rotas)
export { OrcamentoListScreen } from './screens/OrcamentoListScreen';
// export { OrcamentoFormScreen } from './screens/OrcamentoFormScreen';
// export { OrcamentoDetailScreen } from './screens/OrcamentoDetailScreen';

// Tipos públicos (se necessário para navegação tipada)
export type {
  OrcamentoResumo,
  OrcamentoFormData,
} from './types/orcamento.types';
