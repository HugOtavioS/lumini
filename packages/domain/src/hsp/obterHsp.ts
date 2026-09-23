/**
 * SCRUM-8 — HSP automático pela localização GPS, com fallback (RF08, RN02).
 *
 * Ordem de tentativa, sem procura manual:
 *
 * 1. **Cache** do próprio ponto (resultado de uma consulta anterior à API).
 *    A climatologia não muda, então o cache vale indefinidamente e evita
 *    rede desnecessária.
 * 2. **API de clima** (NASA POWER), se houver internet, com tempo-limite.
 * 3. **Base de contingência** (SCRUM-17): a localidade mais próxima; se ela
 *    estiver longe, o valor é marcado como aproximado (RF08 2b).
 * 4. Sem nada disso: `indisponivel`, para a tela pedir o HSP ao técnico.
 *
 * A função **nunca lança erro e nunca espera mais que o tempo-limite**
 * (RNF12: falha da API de clima não trava o app). Todo fallback é registrado
 * pelo `registrarLog`.
 */
import { ehNumeroFinito } from '../erros';
import { arredondar } from '../util/numeros';
import { buscarLocalidadePorCidade, localidadeMaisProxima, referenciaEstadual } from './baseContingencia';
import { arredondarCoordenada } from './nasaPower';
import type { CacheHsp, DadosHsp, EventoHsp, LocalidadeClimatica, ProvedorHspOnline, ResultadoHsp } from './tipos';

/** Tempo-limite padrão da consulta online (ms). */
export const TIMEOUT_HSP_PADRAO_MS = 8000;

/** Acima desta distância a localidade de contingência é considerada só uma referência aproximada. */
export const LIMIAR_APROXIMADO_PADRAO_KM = 50;

export interface LocalizacaoHsp {
  /** Latitude do GPS do dispositivo (RF03, subfluxo 2.2). */
  latitude?: number | null;
  longitude?: number | null;
  /** Cidade/UF da instalação, usadas quando não há GPS (RF06 1a). */
  cidade?: string | null;
  estado?: string | null;
}

export interface OpcoesObterHsp {
  /** Base de contingência carregada do SQLite (Localidade Climática). */
  baseContingencia: readonly LocalidadeClimatica[];
  /** Provedor online (ex.: {@link criarProvedorNasaPower}). Sem ele, só cache e contingência. */
  provedor?: ProvedorHspOnline;
  /** Informa se há conexão (ex.: NetInfo). Se `false`, a API nem é chamada. */
  estaOnline?: () => boolean | Promise<boolean>;
  cache?: CacheHsp;
  timeoutMs?: number;
  limiarAproximadoKm?: number;
  registrarLog?: (evento: EventoHsp) => void;
  /** Relógio injetável (testes). */
  agora?: () => Date;
}

/** Chave de cache por ponto, com 1 casa decimal (~11 km): o HSP não muda nessa escala. */
export function chaveCacheHsp(latitude: number, longitude: number): string {
  return `hsp:${latitude.toFixed(1)}:${longitude.toFixed(1)}`;
}

/** Cache simples em memória (útil em testes e na web). */
export function criarCacheHspEmMemoria(): CacheHsp & { tamanho(): number } {
  const mapa = new Map<string, DadosHsp>();
  return {
    obter: (chave) => mapa.get(chave) ?? null,
    salvar: (chave, dados) => {
      mapa.set(chave, dados);
    },
    tamanho: () => mapa.size,
  };
}

function coordenadasValidas(lat: unknown, lon: unknown): lat is number {
  return ehNumeroFinito(lat) && ehNumeroFinito(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);
}

class TempoEsgotado extends Error {}

async function comTempoLimite<T>(tarefa: (sinal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controlador = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rejeitar) => {
    temporizador = setTimeout(() => {
      controlador?.abort();
      rejeitar(new TempoEsgotado());
    }, ms);
  });
  try {
    // O Promise.race garante o tempo-limite mesmo se o fetch ignorar o abort.
    return await Promise.race([tarefa(controlador?.signal as AbortSignal), limite]);
  } finally {
    clearTimeout(temporizador);
  }
}

function descreverErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

/**
 * Obtém o HSP da instalação a partir do GPS (ou da cidade), com fallback.
 * Sempre resolve — nunca rejeita.
 *
 * @example
 * const r = await obterHsp(
 *   { latitude: -23.01, longitude: -45.56 },
 *   { baseContingencia, provedor: criarProvedorNasaPower(), estaOnline: () => netInfo.isConnected, cache },
 * );
 * if (r.status === 'ok') dimensionarSistema({ ..., hspMedio: r.dados.hspMedio, hspMensal: r.dados.hspMensal ?? undefined });
 */
export async function obterHsp(local: LocalizacaoHsp, opcoes: OpcoesObterHsp): Promise<ResultadoHsp> {
  const avisos: string[] = [];
  const log = (evento: EventoHsp): void => {
    try {
      opcoes.registrarLog?.(evento);
    } catch {
      // O log nunca pode derrubar o fluxo.
    }
  };
  const agora = (): string => (opcoes.agora ? opcoes.agora() : new Date()).toISOString();
  const limiar = opcoes.limiarAproximadoKm ?? LIMIAR_APROXIMADO_PADRAO_KM;
  const base = Array.isArray(opcoes.baseContingencia) ? opcoes.baseContingencia : [];

  try {
    const temGps = coordenadasValidas(local.latitude, local.longitude);
    if (!temGps && (local.latitude != null || local.longitude != null)) {
      avisos.push('Coordenadas do GPS inválidas; usando a cidade da instalação.');
    }

    if (temGps) {
      const lat = local.latitude as number;
      const lon = local.longitude as number;
      const chave = chaveCacheHsp(lat, lon);
      const coordenadas = { latitude: arredondarCoordenada(lat), longitude: arredondarCoordenada(lon) };

      // 1. Cache do ponto
      if (opcoes.cache) {
        try {
          const emCache = await opcoes.cache.obter(chave);
          if (emCache) {
            log({ tipo: 'cache', mensagem: `HSP do cache (${chave}).` });
            return { status: 'ok', dados: { ...emCache, fonte: 'Cache' }, avisos };
          }
        } catch (erro) {
          log({ tipo: 'api_falhou', mensagem: `Falha ao ler o cache: ${descreverErro(erro)}` });
        }
      }

      // 2. API de clima
      if (opcoes.provedor) {
        let online = true;
        try {
          online = opcoes.estaOnline ? await opcoes.estaOnline() : true;
        } catch {
          online = false;
        }
        if (!online) {
          log({ tipo: 'offline', mensagem: 'Sem conexão: usando a base de contingência.' });
          avisos.push('Sem internet: HSP obtido da base de contingência.');
        } else {
          const inicio = Date.now();
          try {
            const provedor = opcoes.provedor;
            const resposta = await comTempoLimite(
              (sinal) => provedor.buscar(lat, lon, sinal),
              opcoes.timeoutMs ?? TIMEOUT_HSP_PADRAO_MS,
            );
            if (!(ehNumeroFinito(resposta.hspMedio) && resposta.hspMedio > 0)) {
              throw new Error('HSP inválido na resposta.');
            }
            const dados: DadosHsp = {
              hspMedio: arredondar(resposta.hspMedio, 2),
              hspMensal: resposta.hspMensal,
              fonte: 'API',
              descricaoFonte: resposta.descricao,
              aproximado: false,
              coordenadas,
              obtidoEm: agora(),
            };
            log({ tipo: 'api_ok', mensagem: `HSP obtido de ${provedor.nome}.`, duracaoMs: Date.now() - inicio });
            if (opcoes.cache) {
              try {
                await opcoes.cache.salvar(chave, dados);
              } catch (erro) {
                log({ tipo: 'api_falhou', mensagem: `Falha ao gravar o cache: ${descreverErro(erro)}` });
              }
            }
            return { status: 'ok', dados, avisos };
          } catch (erro) {
            const timeout = erro instanceof TempoEsgotado;
            log({
              tipo: timeout ? 'api_timeout' : 'api_falhou',
              mensagem: timeout ? 'A API de clima não respondeu a tempo.' : `Falha na API de clima: ${descreverErro(erro)}`,
              duracaoMs: Date.now() - inicio,
            });
            avisos.push('Serviço de clima indisponível: HSP obtido da base de contingência.');
          }
        }
      }

      // 3. Contingência: localidade mais próxima
      const proxima = localidadeMaisProxima(lat, lon, base);
      if (proxima) {
        const aproximado = proxima.distanciaKm > limiar;
        const { localidade } = proxima;
        const distancia = arredondar(proxima.distanciaKm, 1);
        if (aproximado) {
          avisos.push(`Localidade de referência a ${Math.round(distancia)} km (${localidade.cidade}-${localidade.estado}): valor aproximado.`);
        }
        log({ tipo: 'contingencia', mensagem: `HSP da contingência: ${localidade.cidade}-${localidade.estado} (${distancia} km).` });
        return {
          status: 'ok',
          dados: {
            hspMedio: arredondar(localidade.hspMedio, 2),
            hspMensal: localidade.hspMensal && localidade.hspMensal.length === 12 ? [...localidade.hspMensal] : null,
            fonte: 'Contingência',
            descricaoFonte: `Base de contingência: ${localidade.cidade}-${localidade.estado} (a ${Math.round(distancia)} km)`,
            aproximado,
            localidade: { cidade: localidade.cidade, estado: localidade.estado, distanciaKm: distancia },
            coordenadas,
            obtidoEm: agora(),
          },
          avisos,
        };
      }
    }

    // Sem GPS (ou base vazia com GPS): cidade/UF da instalação
    if (local.cidade && local.estado) {
      const daCidade = buscarLocalidadePorCidade(local.cidade, local.estado, base);
      if (daCidade) {
        log({ tipo: 'contingencia', mensagem: `HSP da contingência pela cidade: ${daCidade.cidade}-${daCidade.estado}.` });
        return {
          status: 'ok',
          dados: {
            hspMedio: arredondar(daCidade.hspMedio, 2),
            hspMensal: daCidade.hspMensal && daCidade.hspMensal.length === 12 ? [...daCidade.hspMensal] : null,
            fonte: 'Contingência',
            descricaoFonte: `Base de contingência: ${daCidade.cidade}-${daCidade.estado}`,
            aproximado: false,
            localidade: { cidade: daCidade.cidade, estado: daCidade.estado, distanciaKm: null },
            obtidoEm: agora(),
          },
          avisos,
        };
      }
      const regional = referenciaEstadual(local.estado, base);
      if (regional) {
        const uf = local.estado.toUpperCase();
        avisos.push(`Cidade fora da base: usando a média do estado (${uf}), valor aproximado.`);
        log({ tipo: 'contingencia', mensagem: `HSP pela média estadual de ${uf}.` });
        return {
          status: 'ok',
          dados: {
            hspMedio: arredondar(regional.hspMedio, 2),
            hspMensal: regional.hspMensal ? regional.hspMensal.map((v) => arredondar(v, 2)) : null,
            fonte: 'Contingência',
            descricaoFonte: `Média estadual (${uf}) da base de contingência`,
            aproximado: true,
            localidade: { cidade: local.cidade, estado: uf, distanciaKm: null },
            obtidoEm: agora(),
          },
          avisos,
        };
      }
    }

    const motivo = 'Não foi possível obter o HSP automaticamente (sem internet e sem dados de contingência para o local). Informe o HSP manualmente.';
    log({ tipo: 'indisponivel', mensagem: motivo });
    return { status: 'indisponivel', motivo, avisos };
  } catch (erro) {
    // Rede de segurança: qualquer erro inesperado vira "indisponível", nunca uma exceção.
    const motivo = `Falha inesperada ao obter o HSP (${descreverErro(erro)}). Informe o HSP manualmente.`;
    log({ tipo: 'indisponivel', mensagem: motivo });
    return { status: 'indisponivel', motivo, avisos };
  }
}
