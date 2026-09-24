/**
 * Gera o diagrama de sombreamento de exemplo usado na avaliação do SCRUM-81
 * (docs/avaliacoes). Uso: `npm run exemplo-sombreamento -w @lumini/domain`.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gerarDiagramaSombreamento, obstaculoGeometricoParaAngular } from '../src/index';

const destino = fileURLToPath(
  new URL('../../../docs/avaliacoes/SCRUM-81_exemplo_diagrama_sombreamento.svg', import.meta.url),
);

// Cenário fictício: casa em Taubaté-SP, telhado voltado para o Norte com 20°,
// uma árvore a Nordeste e uma caixa d'água a Oeste-Noroeste.
const arvore = obstaculoGeometricoParaAngular({
  nome: 'Árvore',
  azimuteGraus: 35,
  distanciaM: 8,
  alturaM: 5,
  larguraM: 6,
});
const caixaDagua = { nome: "Caixa d'água", azimuteInicialGraus: 285, azimuteFinalGraus: 310, elevacaoGraus: 18 };

const inicio = performance.now();
const resultado = gerarDiagramaSombreamento({
  latitude: -23.0104,
  longitude: -45.5593,
  ano: 2026,
  titulo: 'Exemplo — Taubaté-SP',
  plano: { inclinacaoGraus: 20, azimuteGraus: 0 },
  obstaculos: [arvore, caixaDagua],
});
const ms = performance.now() - inicio;

// Sem quebra de linha no final: o SVG tem uma linha só e, assim, o arquivo fica
// com os mesmos bytes no Linux e no Windows (onde o git troca LF por CRLF).
// Com a quebra, regerar o diagrama no Windows deixava o arquivo "modificado"
// no git mesmo sem nenhuma diferença no conteúdo.
writeFileSync(destino, resultado.svg, 'utf8');
console.log(`Diagrama salvo em ${destino} (${ms.toFixed(1)} ms)`);
console.log('Sombreamento mensal (%):', resultado.sombreamento.mensal.map((m) => m.sombreamentoPerc).join(' | '));
console.log('Média anual (%):', resultado.sombreamento.mediaAnualPerc);
