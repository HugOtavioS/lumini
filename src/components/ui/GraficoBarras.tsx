/**
 * GraficoBarras.tsx
 *
 * SCRUM-24 / SCRUM-88 — Gráfico de barras simples (uma série, valores ≥ 0),
 * feito só com View, sem biblioteca de gráficos.
 *
 * - Toque em uma barra para ver o valor (área de toque = coluna inteira).
 * - Linha de referência opcional (ex.: valor do investimento).
 * - Barras finas (máx. 24 px), topo arredondado, 2 px de espaço entre elas.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface PontoGrafico {
  rotulo: string;
  valor: number;
}

interface GraficoBarrasProps {
  /** Descreve o gráfico para leitores de tela. */
  titulo: string;
  dados: PontoGrafico[];
  formatarValor: (valor: number) => string;
  linhaReferencia?: { valor: number; rotulo: string };
  altura?: number;
  cor?: string;
  /** Exibe o rótulo do eixo X a cada N barras (o último sempre aparece). */
  intervaloRotulosX?: number;
}

const COR_SERIE_PADRAO = '#2A78D6';

export const GraficoBarras: React.FC<GraficoBarrasProps> = ({
  titulo,
  dados,
  formatarValor,
  linhaReferencia,
  altura = 140,
  cor = COR_SERIE_PADRAO,
  intervaloRotulosX = 5,
}) => {
  const [selecionado, setSelecionado] = useState(dados.length - 1);

  if (dados.length === 0) return null;

  const maximo = Math.max(0, linhaReferencia?.valor ?? 0, ...dados.map((d) => d.valor));
  const alturaDe = (valor: number) => (maximo > 0 ? (Math.max(0, valor) / maximo) * altura : 0);
  const ponto = dados[Math.min(selecionado, dados.length - 1)];

  return (
    <View accessible={false}>
      <Text style={styles.leitura} accessibilityLiveRegion="polite">
        <Text style={styles.leituraRotulo}>{ponto.rotulo} · </Text>
        {formatarValor(ponto.valor)}
      </Text>

      <View style={[styles.area, { height: altura }]} accessibilityLabel={titulo}>
        {linhaReferencia ? (
          <View
            pointerEvents="none"
            style={[styles.referencia, { bottom: alturaDe(linhaReferencia.valor) }]}
          >
            <Text style={styles.referenciaRotulo}>{linhaReferencia.rotulo}</Text>
          </View>
        ) : null}

        {dados.map((d, i) => (
          <Pressable
            key={d.rotulo}
            style={styles.coluna}
            onPress={() => setSelecionado(i)}
            accessibilityRole="button"
            accessibilityLabel={`${d.rotulo}: ${formatarValor(d.valor)}`}
            accessibilityState={{ selected: i === selecionado }}
          >
            <View
              style={[
                styles.barra,
                {
                  height: alturaDe(d.valor),
                  backgroundColor: cor,
                  opacity: i === selecionado ? 1 : 0.55,
                },
              ]}
            />
          </Pressable>
        ))}
      </View>

      <View style={styles.eixoX}>
        {dados.map((d, i) => {
          const visivel = i % intervaloRotulosX === 0 || i === dados.length - 1;
          return (
            <Text key={d.rotulo} style={styles.rotuloX} numberOfLines={1}>
              {visivel ? d.rotulo : ''}
            </Text>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  leitura: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  leituraRotulo: {
    fontWeight: '400',
    color: '#64748B',
  },
  area: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  coluna: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginHorizontal: 1,
  },
  barra: {
    width: '100%',
    maxWidth: 24,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  referencia: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#334155',
    zIndex: 1,
  },
  referenciaRotulo: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    fontSize: 10,
    color: '#334155',
  },
  eixoX: {
    flexDirection: 'row',
    marginTop: 4,
  },
  rotuloX: {
    flex: 1,
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    marginHorizontal: 1,
  },
});
