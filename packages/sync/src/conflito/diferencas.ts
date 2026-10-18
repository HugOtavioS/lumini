/**
 * SCRUM-83 — lista o que mudou entre duas versões de um registro, campo a
 * campo, no formato do Log de Auditoria (valor anterior → valor novo).
 *
 * Na Proposta, os itens (Item da Proposta) são comparados um a um pelo
 * `id_item`: campo alterado, item incluído ou item removido.
 */
import type { EntidadeAuditada, EntidadeSincronizavel, VersaoRegistro } from '../contrato';
import { jsonEstavel } from '../util';

/** Campos de controle: mudam a cada gravação e não entram na comparação. */
export const CAMPOS_DE_CONTROLE: readonly string[] = ['created_at', 'updated_at', 'updated_by', 'sync_status'];

export interface Diferenca {
  entidade: EntidadeAuditada;
  idRegistro: string;
  campo: string;
  valorAnterior: string | null;
  valorNovo: string | null;
}

/** Valor como texto para o log: números e booleanos viram texto; listas e objetos, JSON com chaves em ordem. */
export function valorParaAuditoria(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'boolean' || typeof valor === 'bigint') return String(valor);
  return jsonEstavel(valor);
}

function iguais(a: unknown, b: unknown): boolean {
  return jsonEstavel(a ?? null) === jsonEstavel(b ?? null);
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function semCamposDeControle(item: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(item).filter(([campo]) => !CAMPOS_DE_CONTROLE.includes(campo)));
}

function diferencasDosCampos(
  entidade: EntidadeAuditada,
  idRegistro: string,
  anterior: Record<string, unknown>,
  novo: Record<string, unknown>,
  ignorar: ReadonlySet<string>,
): Diferenca[] {
  const campos = [...new Set([...Object.keys(anterior), ...Object.keys(novo)])].filter((c) => !ignorar.has(c)).sort();
  return campos
    .filter((campo) => !iguais(anterior[campo], novo[campo]))
    .map((campo) => ({
      entidade,
      idRegistro,
      campo,
      valorAnterior: valorParaAuditoria(anterior[campo]),
      valorNovo: valorParaAuditoria(novo[campo]),
    }));
}

function itensPorId(lista: unknown): Map<string, Record<string, unknown>> {
  const itens = Array.isArray(lista) ? lista.filter(ehObjeto) : [];
  return new Map(itens.map((item, i) => [typeof item.id_item === 'string' ? item.id_item : `item-sem-id-${i + 1}`, item]));
}

function diferencasDosItens(anteriores: unknown, novos: unknown): Diferenca[] {
  const antes = itensPorId(anteriores);
  const depois = itensPorId(novos);
  const ignorar = new Set([...CAMPOS_DE_CONTROLE, 'id_item', 'id_proposta']);
  const diferencas: Diferenca[] = [];
  for (const id of [...new Set([...antes.keys(), ...depois.keys()])].sort()) {
    const a = antes.get(id);
    const b = depois.get(id);
    if (a && !b) {
      diferencas.push({ entidade: 'ItemProposta', idRegistro: id, campo: '(item removido)', valorAnterior: jsonEstavel(semCamposDeControle(a)), valorNovo: null });
    } else if (!a && b) {
      diferencas.push({ entidade: 'ItemProposta', idRegistro: id, campo: '(item incluído)', valorAnterior: null, valorNovo: jsonEstavel(semCamposDeControle(b)) });
    } else if (a && b) {
      diferencas.push(...diferencasDosCampos('ItemProposta', id, a, b, ignorar));
    }
  }
  return diferencas;
}

/** O que muda quando `nova` toma o lugar de `anterior`. */
export function listarDiferencas(entidade: EntidadeSincronizavel, anterior: VersaoRegistro, nova: VersaoRegistro): Diferenca[] {
  const ignorar = new Set([...CAMPOS_DE_CONTROLE, ...(entidade === 'Proposta' ? ['itens'] : [])]);
  const diferencas = diferencasDosCampos(entidade, nova.id, anterior.dados, nova.dados, ignorar);
  if (entidade === 'Proposta') diferencas.push(...diferencasDosItens(anterior.dados.itens, nova.dados.itens));
  return diferencas;
}
