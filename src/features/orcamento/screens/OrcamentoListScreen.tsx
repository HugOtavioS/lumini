/**
 * OrcamentoListScreen.tsx
 *
 * Tela principal de listagem de orçamentos.
 * Responsabilidades:
 * - Exibir lista paginada de orçamentos
 * - Filtros por status e período
 * - Busca por nome do cliente
 * - Navegação para criação e detalhes
 *
 * ⚠️ A tela é "fina": apenas orquestra hooks e componentes.
 *    Toda lógica de negócio fica em hooks/ e services/.
 */

import React, { useCallback } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useOrcamentoList } from '../hooks/useOrcamentoList';
import { OrcamentoCard } from '../components/OrcamentoCard';
// import { SearchInput } from '@/components/forms/SearchInput';
// import { FloatingButton } from '@/components/ui/FloatingButton';
// import { EmptyState } from '@/components/feedback/EmptyState';

export const OrcamentoListScreen: React.FC = () => {
  const navigation = useNavigation();
  const {
    orcamentos,
    isLoading,
    hasMore,
    filtros,
    setFiltros,
    loadMore,
    refresh,
  } = useOrcamentoList();

  const handleNovoOrcamento = useCallback(() => {
    // navigation.navigate('OrcamentoForm');
  }, [navigation]);

  const handleSelectOrcamento = useCallback(
    (id: string) => {
      // navigation.navigate('OrcamentoDetail', { orcamentoId: id });
    },
    [navigation],
  );

  return (
    <View style={styles.container}>
      {/* <SearchInput
        value={filtros.busca}
        onChangeText={(text) => setFiltros({ ...filtros, busca: text })}
        placeholder="Buscar por cliente..."
      /> */}

      <FlatList
        data={orcamentos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <OrcamentoCard
            orcamento={item}
            onPress={() => handleSelectOrcamento(item.id)}
          />
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        onRefresh={refresh}
        refreshing={isLoading}
        // ListEmptyComponent={<EmptyState message="Nenhum orçamento encontrado" />}
      />

      {/* <FloatingButton onPress={handleNovoOrcamento} icon="plus" /> */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
});
