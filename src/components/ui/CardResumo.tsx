/**
 * CardResumo.tsx
 *
 * SCRUM-24 / SCRUM-88 — Card genérico de resumo: título, métricas em grade,
 * aviso opcional e conteúdo extra (ex.: gráfico).
 *
 * Reutilizável em qualquer feature; não conhece regras de negócio.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface MetricaResumo {
  rotulo: string;
  valor: string;
  /** Texto de apoio abaixo do valor (ex.: "em 25 anos"). */
  detalhe?: string;
}

interface CardResumoProps {
  titulo: string;
  metricas: MetricaResumo[];
  aviso?: string;
  /** Nota de rodapé (ex.: premissas e fonte dos dados). */
  rodape?: string;
  children?: React.ReactNode;
}

export const CardResumo: React.FC<CardResumoProps> = ({
  titulo,
  metricas,
  aviso,
  rodape,
  children,
}) => (
  <View style={styles.card}>
    <Text style={styles.titulo} accessibilityRole="header">
      {titulo}
    </Text>

    {aviso ? (
      <View style={styles.aviso} accessibilityRole="alert">
        <Text style={styles.avisoTexto}>⚠ {aviso}</Text>
      </View>
    ) : null}

    {metricas.length > 0 ? (
      <View style={styles.metricas}>
        {metricas.map((m) => (
          <View key={m.rotulo} style={styles.metrica}>
            <Text style={styles.rotulo}>{m.rotulo}</Text>
            <Text style={styles.valor}>{m.valor}</Text>
            {m.detalhe ? <Text style={styles.detalhe}>{m.detalhe}</Text> : null}
          </View>
        ))}
      </View>
    ) : null}

    {children}

    {rodape ? <Text style={styles.rodape}>{rodape}</Text> : null}
  </View>
);

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
  titulo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  aviso: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  avisoTexto: {
    fontSize: 12,
    color: '#92400E',
  },
  metricas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  metrica: {
    width: '50%',
    marginBottom: 12,
    paddingRight: 8,
  },
  rotulo: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  valor: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  detalhe: {
    fontSize: 11,
    color: '#64748B',
  },
  rodape: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 12,
  },
});
