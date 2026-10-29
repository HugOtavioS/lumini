/**
 * useOrcamentoList.ts
 *
 * Hook customizado para gerenciar a listagem de orçamentos.
 * Responsabilidades:
 * - Carregar orçamentos do repositório local (SQLite)
 * - Paginação com infinite scroll
 * - Filtros por status e busca textual
 * - Pull-to-refresh
 *
 * ⚠️ Este hook abstrai toda a complexidade de dados.
 *    A tela OrcamentoListScreen apenas consome o que este hook expõe.
 */

import { useState, useEffect, useCallback } from 'react';
import { OrcamentoResumo, FiltroOrcamento } from '../types/orcamento.types';
// import { orcamentoRepository } from '@/data/repositories/orcamentoRepository';

const PAGE_SIZE = 20;

interface UseOrcamentoListReturn {
  orcamentos: OrcamentoResumo[];
  isLoading: boolean;
  hasMore: boolean;
  filtros: FiltroOrcamento;
  setFiltros: (filtros: FiltroOrcamento) => void;
  loadMore: () => void;
  refresh: () => void;
}

export function useOrcamentoList(): UseOrcamentoListReturn {
  const [orcamentos, setOrcamentos] = useState<OrcamentoResumo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [filtros, setFiltros] = useState<FiltroOrcamento>({
    busca: '',
    status: undefined,
  });

  const fetchOrcamentos = useCallback(
    async (pageNumber: number, reset = false) => {
      setIsLoading(true);
      try {
        // TODO: Substituir por chamada real ao repositório
        // const result = await orcamentoRepository.listar({
        //   ...filtros,
        //   offset: pageNumber * PAGE_SIZE,
        //   limit: PAGE_SIZE,
        // });

        const result: OrcamentoResumo[] = []; // placeholder

        if (reset) {
          setOrcamentos(result);
        } else {
          setOrcamentos((prev) => [...prev, ...result]);
        }

        setHasMore(result.length === PAGE_SIZE);
        setPage(pageNumber);
      } catch (error) {
        console.error('[useOrcamentoList] Erro ao carregar orçamentos:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [filtros],
  );

  // Recarregar quando filtros mudam
  useEffect(() => {
    fetchOrcamentos(0, true);
  }, [fetchOrcamentos]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchOrcamentos(page + 1);
    }
  }, [isLoading, hasMore, page, fetchOrcamentos]);

  const refresh = useCallback(() => {
    fetchOrcamentos(0, true);
  }, [fetchOrcamentos]);

  return {
    orcamentos,
    isLoading,
    hasMore,
    filtros,
    setFiltros,
    loadMore,
    refresh,
  };
}
