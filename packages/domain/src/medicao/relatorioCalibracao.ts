/**
 * SCRUM-79 — leitura do registro do teste de calibração (CSV preenchido
 * durante o teste) e geração do relatório em Markdown, usado como evidência.
 *
 * Formato do CSV (modelo em `docs/testes/SCRUM-79_modelo_registro_calibracao.csv`):
 *
 *     data;dispositivo;sistema;grandeza;referencia;medido;observacoes
 *
 * `grandeza` ∈ comprimento | area | inclinacao | azimute; números com vírgula
 * ou ponto decimal.
 */
import { lerCsv } from '../util/csv';
import { normalizarTexto } from '../util/texto';
import { comUnidade, consolidarCalibracao, ROTULOS_GRANDEZA, type EntradaCalibracao, type GrandezaCalibracao } from './calibracao';

export interface RegistroCalibracao {
  data: string;
  dispositivo: string;
  sistema: string;
  grandeza: GrandezaCalibracao;
  referencia: number;
  medido: number;
  observacoes: string;
}

const GRANDEZAS: readonly GrandezaCalibracao[] = ['comprimento', 'area', 'inclinacao', 'azimute'];

/** Lê o CSV do teste. Linhas com grandeza desconhecida ou números inválidos são ignoradas e listadas em `ignoradas`. */
export function lerRegistroCalibracao(texto: string): { registros: RegistroCalibracao[]; ignoradas: number[] } {
  const { cabecalho, linhas } = lerCsv(texto);
  const col = (nome: string): number => cabecalho.indexOf(nome);
  const [iData, iDisp, iSis, iGr, iRef, iMed, iObs] = ['data', 'dispositivo', 'sistema', 'grandeza', 'referencia', 'medido', 'observacoes'].map(col);
  if ([iDisp, iGr, iRef, iMed].some((i) => i === undefined || i < 0)) {
    throw new Error('CSV de calibração sem as colunas dispositivo, grandeza, referencia e medido.');
  }
  const num = (v: string | undefined): number => Number((v ?? '').replace(',', '.'));
  const registros: RegistroCalibracao[] = [];
  const ignoradas: number[] = [];
  linhas.forEach((l, i) => {
    const grandeza = normalizarTexto(l[iGr!] ?? '') as GrandezaCalibracao;
    const referencia = num(l[iRef!]);
    const medido = num(l[iMed!]);
    if (!GRANDEZAS.includes(grandeza) || !Number.isFinite(referencia) || !Number.isFinite(medido)) {
      ignoradas.push(i + 2); // número da linha no arquivo (cabeçalho = 1)
      return;
    }
    registros.push({
      data: iData !== undefined && iData >= 0 ? (l[iData] ?? '') : '',
      dispositivo: l[iDisp!] ?? '',
      sistema: iSis !== undefined && iSis >= 0 ? (l[iSis] ?? '') : '',
      grandeza,
      referencia,
      medido,
      observacoes: iObs !== undefined && iObs >= 0 ? (l[iObs] ?? '') : '',
    });
  });
  return { registros, ignoradas };
}

export interface CalibracaoPorDispositivo {
  dispositivo: string;
  sistema: string;
  calibrada: boolean;
  resumo: string;
  resultados: ReturnType<typeof consolidarCalibracao>['resultados'];
}

/** Agrupa por aparelho e por (grandeza, referência) e avalia cada grupo. */
export function avaliarRegistros(registros: readonly RegistroCalibracao[]): CalibracaoPorDispositivo[] {
  const porDispositivo = new Map<string, RegistroCalibracao[]>();
  for (const r of registros) {
    const lista = porDispositivo.get(r.dispositivo) ?? [];
    lista.push(r);
    porDispositivo.set(r.dispositivo, lista);
  }
  return [...porDispositivo.entries()].map(([dispositivo, lista]) => {
    const grupos = new Map<string, EntradaCalibracao>();
    for (const r of lista) {
      const chave = `${r.grandeza}|${r.referencia}`;
      const grupo = grupos.get(chave) ?? { grandeza: r.grandeza, valorReferencia: r.referencia, medicoes: [] };
      (grupo.medicoes as number[]).push(r.medido);
      grupos.set(chave, grupo);
    }
    const consolidado = consolidarCalibracao([...grupos.values()]);
    return {
      dispositivo,
      sistema: lista[0]?.sistema ?? '',
      calibrada: consolidado.calibrada,
      resumo: consolidado.resumo,
      resultados: consolidado.resultados,
    };
  });
}

function fmt(valor: number | null, casas = 3): string {
  if (valor === null) return '—';
  return (Math.round(valor * 10 ** casas) / 10 ** casas).toString().replace('.', ',');
}

/** Relatório em Markdown, pronto para anexar como evidência do SCRUM-79. */
export function gerarRelatorioCalibracao(avaliacoes: readonly CalibracaoPorDispositivo[], titulo = 'Relatório de calibração da RA (SCRUM-79)'): string {
  const linhas: string[] = [`# ${titulo}`, ''];
  for (const a of avaliacoes) {
    linhas.push(`## ${a.dispositivo}${a.sistema ? ` (${a.sistema})` : ''} — ${a.calibrada ? '✅ calibrado' : '❌ não calibrado'}`, '');
    linhas.push('| Grandeza | Referência | Nº | Média | Desvio padrão | Viés | Erro máx. | Dentro da tol. | Resultado |');
    linhas.push('|---|---|---|---|---|---|---|---|---|');
    for (const r of a.resultados) {
      const g = r.grandeza;
      const vies = r.viesPerc !== null ? `${comUnidade(r.vies, g)} (${fmt(r.viesPerc, 2)} %)` : comUnidade(r.vies, g);
      const erro = r.erroMaximoPerc !== null ? `${comUnidade(r.erroMaximo, g)} (${fmt(r.erroMaximoPerc, 2)} %)` : comUnidade(r.erroMaximo, g);
      linhas.push(
        `| ${ROTULOS_GRANDEZA[g]} | ${comUnidade(r.valorReferencia, g)} | ${r.quantidade} | ${comUnidade(r.media, g)} | ${comUnidade(r.desvioPadrao, g)} | ${vies} | ${erro} | ${fmt(r.dentroDaToleranciaPerc, 1)} % | ${r.aprovado ? 'aprovado' : 'reprovado'} |`,
      );
    }
    linhas.push('', ...a.resultados.map((r) => `- ${r.resumo}`), '', `**${a.resumo}**`, '');
  }
  return linhas.join('\n');
}
