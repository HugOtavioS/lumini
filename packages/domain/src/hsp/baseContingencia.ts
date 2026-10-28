/**
 * SCRUM-8 — consulta à base de contingência (tabela Localidade Climática),
 * usada quando não há internet ou a API de clima falha (RN02).
 */
import { normalizarTexto } from '../util/texto';
import { radianos } from '../util/numeros';
import type { LocalidadeClimatica } from './tipos';

/** Raio médio da Terra (km). */
const RAIO_TERRA_KM = 6371.0088;

/** Distância em km entre dois pontos (fórmula de haversine). */
export function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = radianos(lat2 - lat1);
  const dLon = radianos(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(radianos(lat1)) * Math.cos(radianos(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface LocalidadeProxima {
  localidade: LocalidadeClimatica;
  distanciaKm: number;
}

/** Localidade da base mais próxima das coordenadas; `null` se a base estiver vazia. */
export function localidadeMaisProxima(
  latitude: number,
  longitude: number,
  localidades: readonly LocalidadeClimatica[],
): LocalidadeProxima | null {
  let melhor: LocalidadeProxima | null = null;
  for (const localidade of localidades) {
    const d = distanciaKm(latitude, longitude, localidade.latitude, localidade.longitude);
    if (!melhor || d < melhor.distanciaKm) melhor = { localidade, distanciaKm: d };
  }
  return melhor;
}

/** Procura a cidade na base (sem diferenciar acentos/maiúsculas). */
export function buscarLocalidadePorCidade(
  cidade: string,
  estado: string,
  localidades: readonly LocalidadeClimatica[],
): LocalidadeClimatica | null {
  const nome = normalizarTexto(cidade);
  const uf = normalizarTexto(estado);
  return localidades.find((l) => normalizarTexto(l.cidade) === nome && normalizarTexto(l.estado) === uf) ?? null;
}

/** Média de HSP das localidades do estado — referência regional (RF08 2b). */
export function referenciaEstadual(
  estado: string,
  localidades: readonly LocalidadeClimatica[],
): { hspMedio: number; hspMensal: number[] | null; quantidade: number } | null {
  const uf = normalizarTexto(estado);
  const doEstado = localidades.filter((l) => normalizarTexto(l.estado) === uf);
  if (doEstado.length === 0) return null;
  const hspMedio = doEstado.reduce((s, l) => s + l.hspMedio, 0) / doEstado.length;
  const comMensal = doEstado.filter((l) => l.hspMensal && l.hspMensal.length === 12);
  const hspMensal =
    comMensal.length === doEstado.length
      ? Array.from({ length: 12 }, (_, i) => comMensal.reduce((s, l) => s + l.hspMensal![i]!, 0) / comMensal.length)
      : null;
  return { hspMedio, hspMensal, quantidade: doEstado.length };
}
