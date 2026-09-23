/**
 * Ponte para o SCRUM-17 (base de contingência): converte os arquivos do
 * **Atlas Brasileiro de Energia Solar, 2ª ed. (INPE/LABREN, 2017)** — grade de
 * 0,1° com a irradiação global horizontal média anual e mensal — em registros
 * de Localidade Climática, um por município do IBGE (célula mais próxima).
 *
 * Os arquivos do Atlas são públicos, mas não ficam neste repositório: baixe
 * `global_horizontal_means.csv` no site do LABREN e rode
 * `npm run importar-atlas -w @lumini/domain` (veja `scripts/`).
 *
 * As funções aqui são puras (texto → dados) para poderem ser testadas.
 */
import { arredondar } from '../util/numeros';
import { normalizarTexto } from '../util/texto';
import { distanciaKm } from './baseContingencia';
import type { LocalidadeClimatica } from './tipos';

export interface CelulaAtlas {
  latitude: number;
  longitude: number;
  /** Irradiação global horizontal média anual (kWh/m²/dia). */
  anual: number;
  /** Média de cada mês (kWh/m²/dia), jan→dez. */
  mensal: number[];
}

export interface MunicipioIbge {
  codigoIbge: string;
  nome: string;
  uf: string;
  latitude: number;
  longitude: number;
}

const MESES_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MESES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Lê um CSV simples (separador `;` ou `,`, detectado pelo cabeçalho; aspas opcionais). */
export function lerCsv(texto: string): { cabecalho: string[]; linhas: string[][]; separador: ';' | ',' } {
  const linhasBrutas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  const primeira = linhasBrutas[0] ?? '';
  const separador: ';' | ',' = (primeira.match(/;/g) ?? []).length >= (primeira.match(/,/g) ?? []).length ? ';' : ',';
  const dividir = (linha: string): string[] => linha.split(separador).map((c) => c.trim().replace(/^"(.*)"$/, '$1'));
  return {
    cabecalho: dividir(primeira).map((c) => normalizarTexto(c)),
    linhas: linhasBrutas.slice(1).map(dividir),
    separador,
  };
}

function numero(valor: string | undefined, separador: ';' | ','): number {
  if (valor === undefined) return Number.NaN;
  // Com separador ";", a vírgula pode ser o separador decimal.
  return Number(separador === ';' ? valor.replace(',', '.') : valor);
}

function indice(cabecalho: string[], ...nomes: string[]): number {
  return cabecalho.findIndex((c) => nomes.includes(c));
}

/**
 * Lê o CSV do Atlas (colunas `LON`, `LAT`, `ANNUAL` e `JAN`…`DEC`, em
 * Wh/m²/dia). Aceita cabeçalhos em português e valores já em kWh/m²/dia.
 */
export function lerAtlasLabren(texto: string): CelulaAtlas[] {
  const { cabecalho, linhas, separador } = lerCsv(texto);
  const iLon = indice(cabecalho, 'lon', 'longitude');
  const iLat = indice(cabecalho, 'lat', 'latitude');
  const iAnual = indice(cabecalho, 'annual', 'anual', 'ann', 'media');
  const iMeses = MESES_EN.map((m, i) => indice(cabecalho, m, MESES_PT[i]!));
  if (iLon < 0 || iLat < 0 || iAnual < 0 || iMeses.some((i) => i < 0)) {
    throw new Error('CSV do Atlas sem as colunas esperadas (LON, LAT, ANNUAL, JAN…DEC).');
  }
  const celulas: CelulaAtlas[] = [];
  for (const linha of linhas) {
    const lat = numero(linha[iLat], separador);
    const lon = numero(linha[iLon], separador);
    let anual = numero(linha[iAnual], separador);
    let mensal = iMeses.map((i) => numero(linha[i], separador));
    if (![lat, lon, anual, ...mensal].every(Number.isFinite)) continue;
    if (anual > 100) {
      // Wh/m²/dia → kWh/m²/dia
      anual /= 1000;
      mensal = mensal.map((v) => v / 1000);
    }
    celulas.push({ latitude: lat, longitude: lon, anual, mensal });
  }
  return celulas;
}

/**
 * Lê a lista de municípios do IBGE (formato do projeto `kelvins/municipios-brasileiros`:
 * `codigo_ibge,nome,latitude,longitude,capital,codigo_uf,…`) e a de estados
 * (`codigo_uf,uf,nome,…`).
 */
export function lerMunicipiosIbge(textoMunicipios: string, textoEstados: string): MunicipioIbge[] {
  const estados = lerCsv(textoEstados);
  const iCodUf = indice(estados.cabecalho, 'codigo_uf');
  const iUf = indice(estados.cabecalho, 'uf');
  const ufPorCodigo = new Map(estados.linhas.map((l) => [l[iCodUf]!, l[iUf]!]));

  const municipios = lerCsv(textoMunicipios);
  const c = municipios.cabecalho;
  const iCodigo = indice(c, 'codigo_ibge');
  const iNome = indice(c, 'nome');
  const iLat = indice(c, 'latitude');
  const iLon = indice(c, 'longitude');
  const iCodUfMun = indice(c, 'codigo_uf');
  if ([iCodigo, iNome, iLat, iLon, iCodUfMun].some((i) => i < 0)) {
    throw new Error('CSV de municípios sem as colunas esperadas.');
  }
  return municipios.linhas
    .map((l) => ({
      codigoIbge: l[iCodigo]!,
      nome: l[iNome]!,
      uf: ufPorCodigo.get(l[iCodUfMun]!) ?? '',
      latitude: numero(l[iLat], municipios.separador),
      longitude: numero(l[iLon], municipios.separador),
    }))
    .filter((m) => m.uf !== '' && Number.isFinite(m.latitude) && Number.isFinite(m.longitude));
}

/** Célula do Atlas mais próxima, usando um índice de grade de 0,1° com busca nos vizinhos. */
export function criarBuscaCelula(celulas: readonly CelulaAtlas[]): (lat: number, lon: number) => CelulaAtlas | null {
  const grade = new Map<string, CelulaAtlas[]>();
  const chave = (lat: number, lon: number): string => `${Math.round(lat * 10)}:${Math.round(lon * 10)}`;
  for (const c of celulas) {
    const k = chave(c.latitude, c.longitude);
    const lista = grade.get(k) ?? [];
    lista.push(c);
    grade.set(k, lista);
  }
  return (lat, lon) => {
    const iLat = Math.round(lat * 10);
    const iLon = Math.round(lon * 10);
    for (let raio = 0; raio <= 5; raio += 1) {
      let melhor: CelulaAtlas | null = null;
      let melhorD = Number.POSITIVE_INFINITY;
      for (let dy = -raio; dy <= raio; dy += 1) {
        for (let dx = -raio; dx <= raio; dx += 1) {
          for (const c of grade.get(`${iLat + dy}:${iLon + dx}`) ?? []) {
            const d = distanciaKm(lat, lon, c.latitude, c.longitude);
            if (d < melhorD) {
              melhor = c;
              melhorD = d;
            }
          }
        }
      }
      if (melhor) return melhor;
    }
    return null;
  };
}

export interface OpcoesGerarBase {
  /** Data/hora ISO registrada em `data_atualizacao`. */
  dataAtualizacao: string;
  /** Gera o `id_localidade` a partir do código IBGE (ex.: UUID determinístico). */
  gerarId: (codigoIbge: string) => string;
}

/** Monta a base de contingência: um registro por município, com o HSP da célula mais próxima. */
export function gerarBaseContingencia(
  municipios: readonly MunicipioIbge[],
  celulas: readonly CelulaAtlas[],
  opcoes: OpcoesGerarBase,
): LocalidadeClimatica[] {
  const buscar = criarBuscaCelula(celulas);
  const base: LocalidadeClimatica[] = [];
  for (const m of municipios) {
    const celula = buscar(m.latitude, m.longitude);
    if (!celula) continue;
    base.push({
      idLocalidade: opcoes.gerarId(m.codigoIbge),
      cidade: m.nome,
      estado: m.uf,
      latitude: m.latitude,
      longitude: m.longitude,
      hspMedio: arredondar(celula.anual, 2),
      irradiacaoKwhM2Dia: arredondar(celula.anual, 2),
      hspMensal: celula.mensal.map((v) => arredondar(v, 2)),
      fonte: 'Contingência',
      dataAtualizacao: opcoes.dataAtualizacao,
    });
  }
  return base;
}
