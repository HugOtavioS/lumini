/**
 * SCRUM-79 — analisa o registro do teste de calibração da RA e gera o relatório.
 *
 * Uso:
 *   npm run calibracao -w @lumini/domain -- --arquivo registro.csv [--saida relatorio.md]
 *
 * O CSV segue o modelo `docs/testes/SCRUM-79_modelo_registro_calibracao.csv`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { avaliarRegistros, gerarRelatorioCalibracao, lerRegistroCalibracao } from '../src/medicao/relatorioCalibracao';

function argumento(nome: string, obrigatorio = true): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  const valor = i >= 0 ? process.argv[i + 1] : undefined;
  if (!valor && obrigatorio) {
    console.error(`Faltou o argumento --${nome}. Uso: npm run calibracao -w @lumini/domain -- --arquivo registro.csv`);
    process.exit(1);
  }
  return valor;
}

const { registros, ignoradas } = lerRegistroCalibracao(readFileSync(argumento('arquivo')!, 'utf8'));
if (ignoradas.length > 0) console.warn(`Linhas ignoradas (grandeza ou número inválido): ${ignoradas.join(', ')}`);

const avaliacoes = avaliarRegistros(registros);
const relatorio = gerarRelatorioCalibracao(avaliacoes);
const saida = argumento('saida', false);
if (saida) {
  writeFileSync(saida, `${relatorio}\n`, 'utf8');
  console.log(`Relatório salvo em ${saida}`);
} else {
  console.log(relatorio);
}
process.exitCode = avaliacoes.every((a) => a.calibrada) ? 0 : 2;
