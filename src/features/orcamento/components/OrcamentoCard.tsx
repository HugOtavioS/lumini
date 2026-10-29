/**
 * OrcamentoCard.tsx
 *
 * Componente de card exibido na listagem de orçamentos.
 * Responsabilidades:
 * - Exibir resumo visual do orçamento (cliente, valor, status)
 * - Indicação visual de status com cores
 * - Ação de toque para navegar ao detalhe
 *
 * ⚠️ Este componente é EXCLUSIVO da feature orcamento.
 *    Componentes reutilizáveis em todo o app ficam em src/components/.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { OrcamentoResumo } from '../types/orcamento.types';

interface OrcamentoCardProps {
  orcamento: OrcamentoResumo;
  onPress: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  rascunho: '#94A3B8',
  enviado: '#3B82F6',
  aprovado: '#10B981',
  recusado: '#EF4444',
};

export const OrcamentoCard: React.FC<OrcamentoCardProps> = ({
  orcamento,
  onPress,
}) => {
  const statusColor = STATUS_COLORS[orcamento.status] ?? '#94A3B8';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={styles.clienteNome}>{orcamento.clienteNome}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{orcamento.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.detalhes}>
        <View style={styles.detalheItem}>
          <Text style={styles.detalheLabel}>Potência</Text>
          <Text style={styles.detalheValor}>{orcamento.potenciaKwp} kWp</Text>
        </View>
        <View style={styles.detalheItem}>
          <Text style={styles.detalheLabel}>Valor Total</Text>
          <Text style={styles.detalheValor}>
            R$ {orcamento.valorTotal.toLocaleString('pt-BR')}
          </Text>
        </View>
      </View>

      <Text style={styles.data}>
        Criado em {new Date(orcamento.criadoEm).toLocaleDateString('pt-BR')}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clienteNome: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  detalhes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detalheItem: {
    flex: 1,
  },
  detalheLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 2,
  },
  detalheValor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  data: {
    fontSize: 11,
    color: '#CBD5E1',
  },
});
