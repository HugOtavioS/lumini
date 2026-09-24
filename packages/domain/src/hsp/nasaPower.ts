/**
 * SCRUM-8 — provedor online de HSP: NASA POWER (Prediction Of Worldwide
 * Energy Resources), endpoint de climatologia por ponto.
 *
 * Por que a NASA POWER: é gratuita, não exige chave de API, cobre todo o
 * Brasil e devolve JSON. O parâmetro `ALLSKY_SFC_SW_DWN` é a irradiação
 * global horizontal média em kWh/m²/dia — numericamente igual ao HSP — para
 * cada mês e para o ano (climatologia de 20 anos, 2001–2020).
 * A escolha definitiva do serviço é do NOVO-103; outro provedor pode ser
 * plugado implementando {@link ProvedorHspOnline}.
 *
 * Privacidade (LGPD, SCRUM-102): as coordenadas enviadas são arredondadas a
 * 2 casas (~1 km). A climatologia tem resolução de ~50 km, então isso não
 * altera o resultado e evita enviar a localização exata da casa do cliente.
 */
import { ehNumeroFinito } from '../erros';
import { arredondar } from '../util/numeros';
import type { FetchLike, ProvedorHspOnline, RespostaProvedorHsp } from './tipos';

export const URL_NASA_POWER_CLIMATOLOGIA = 'https://power.larc.nasa.gov/api/temporal/climatology/point';

const MESES_NASA = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;

/** Falha ao consultar ou interpretar a resposta do provedor. */
export class ErroProvedorHsp extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroProvedorHsp';
  }
}

/** Coordenada arredondada a 2 casas (≈ 1 km), para cache e privacidade. */
export function arredondarCoordenada(valor: number): number {
  return arredondar(valor, 2);
}

/** URL da consulta de climatologia de irradiação para um ponto. */
export function montarUrlNasaPower(latitude: number, longitude: number, base = URL_NASA_POWER_CLIMATOLOGIA): string {
  const parametros = [
    ['parameters', 'ALLSKY_SFC_SW_DWN'],
    ['community', 'RE'],
    ['longitude', String(arredondarCoordenada(longitude))],
    ['latitude', String(arredondarCoordenada(latitude))],
    ['format', 'JSON'],
  ];
  return `${base}?${parametros.map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&')}`;
}

type Objeto = Record<string, unknown>;

function ehObjeto(valor: unknown): valor is Objeto {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * Interpreta o JSON da NASA POWER. Meses com valor de preenchimento
 * (`fill_value`, normalmente -999) são descartados; se faltar algum mês, o
 * HSP mensal volta `null` e o anual é usado.
 *
 * @throws {ErroProvedorHsp} se a resposta não tiver dados utilizáveis.
 */
export function interpretarRespostaNasaPower(json: unknown): RespostaProvedorHsp {
  if (!ehObjeto(json)) throw new ErroProvedorHsp('Resposta da NASA POWER em formato inesperado.');
  const header = ehObjeto(json.header) ? json.header : {};
  const fill = ehNumeroFinito(header.fill_value) ? header.fill_value : -999;

  const unidades = ehObjeto(json.parameters) && ehObjeto(json.parameters.ALLSKY_SFC_SW_DWN)
    ? json.parameters.ALLSKY_SFC_SW_DWN.units
    : undefined;
  if (typeof unidades === 'string' && !/kw-?hr\/m\^?2\/day/i.test(unidades)) {
    throw new ErroProvedorHsp(`Unidade inesperada na NASA POWER: ${unidades}.`);
  }

  const propriedades = ehObjeto(json.properties) ? json.properties : {};
  const parametro = ehObjeto(propriedades.parameter) ? propriedades.parameter : {};
  const serie = ehObjeto(parametro.ALLSKY_SFC_SW_DWN) ? parametro.ALLSKY_SFC_SW_DWN : null;
  if (!serie) {
    const mensagens = Array.isArray(json.messages) ? json.messages.join(' ') : '';
    throw new ErroProvedorHsp(`A NASA POWER não retornou irradiação para o ponto. ${mensagens}`.trim());
  }

  const valido = (v: unknown): v is number => ehNumeroFinito(v) && v !== fill && v > 0 && v < 15;
  const mensais = MESES_NASA.map((m) => serie[m]);
  const hspMensal = mensais.every(valido) ? mensais.map((v) => arredondar(v, 2)) : null;
  const validos = mensais.filter(valido);

  let anual: number;
  if (valido(serie.ANN)) {
    anual = serie.ANN;
  } else if (validos.length > 0) {
    anual = validos.reduce((s, v) => s + v, 0) / validos.length;
  } else {
    throw new ErroProvedorHsp('A NASA POWER não tem dados de irradiação para este ponto.');
  }

  const periodo = typeof header.range === 'string' ? header.range : 'climatologia';
  return {
    hspMedio: arredondar(anual, 2),
    hspMensal,
    descricao: `NASA POWER — ${periodo}`,
  };
}

export interface OpcoesNasaPower {
  /** `fetch` a usar; padrão: o global. */
  fetch?: FetchLike;
  /** URL base (para testes ou proxy). */
  urlBase?: string;
}

/** Cria o provedor NASA POWER para usar em {@link obterHsp}. */
export function criarProvedorNasaPower(opcoes: OpcoesNasaPower = {}): ProvedorHspOnline {
  return {
    nome: 'NASA POWER',
    async buscar(latitude, longitude, sinal) {
      const fetchFn: FetchLike | undefined = opcoes.fetch ?? (globalThis.fetch as unknown as FetchLike | undefined);
      if (!fetchFn) throw new ErroProvedorHsp('fetch não disponível neste ambiente.');
      const url = montarUrlNasaPower(latitude, longitude, opcoes.urlBase);
      const resposta = await fetchFn(url, { signal: sinal, headers: { Accept: 'application/json' } });
      let corpo: unknown = null;
      try {
        corpo = await resposta.json();
      } catch {
        corpo = null;
      }
      if (!resposta.ok) {
        const mensagens = ehObjeto(corpo) && Array.isArray(corpo.messages) ? ` ${corpo.messages.join(' ')}` : '';
        throw new ErroProvedorHsp(`NASA POWER respondeu HTTP ${resposta.status}.${mensagens}`);
      }
      return interpretarRespostaNasaPower(corpo);
    },
  };
}
