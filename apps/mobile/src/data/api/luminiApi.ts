import type { RespostaPull } from '@lumini/sync';

import { config } from '@/data/config';
import type { Equipment, EquipmentCategory } from '@/domain/entities';
import type { RegistroServidor } from '@/data/sync/doServidor';

// Cliente HTTP da API do Lumini (apps/api): login (RF01), catálogo (RF17) e
// carga inicial do histórico (pull). A fila de envio usa o transporte do @lumini/sync.

export interface UsuarioApi {
  id: string;
  nome: string;
  email: string;
  papel: 'Tecnico' | 'Gestor';
  telefone: string | null;
  idEmpresa: string;
  nomeEmpresa: string;
}
export interface SessaoApi {
  tokenAcesso: string;
  refreshToken: string;
  expiraEmS: number;
  usuario: UsuarioApi;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function chamar<T>(caminho: string, opcoes: { corpo?: unknown; token?: string; metodo?: string } = {}): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(`${config.apiUrl}${caminho}`, {
      method: opcoes.metodo ?? (opcoes.corpo === undefined ? 'GET' : 'POST'),
      headers: { 'content-type': 'application/json', ...(opcoes.token ? { authorization: `Bearer ${opcoes.token}` } : {}) },
      ...(opcoes.corpo === undefined ? {} : { body: JSON.stringify(opcoes.corpo) }),
    });
  } catch {
    throw new ApiError('Sem conexão com o servidor. Verifique a internet e tente de novo.', 0);
  }
  const texto = await resposta.text();
  const corpo = texto ? (JSON.parse(texto) as unknown) : null;
  if (!resposta.ok) {
    const msg = (corpo as { message?: unknown } | null)?.message;
    throw new ApiError(typeof msg === 'string' ? msg : `Erro ${resposta.status} no servidor.`, resposta.status);
  }
  return corpo as T;
}

export async function entrar(email: string, senha: string): Promise<SessaoApi> {
  try {
    return await chamar<SessaoApi>('/auth/login', { corpo: { email: email.trim().toLowerCase(), senha } });
  } catch (erro) {
    if (erro instanceof ApiError && (erro.status === 401 || erro.status === 400)) throw new ApiError('E-mail ou senha incorretos.', erro.status);
    throw erro;
  }
}

export const renovar = (refreshToken: string) => chamar<SessaoApi>('/auth/refresh', { corpo: { refreshToken } });

export async function sair(refreshToken: string): Promise<void> {
  await chamar('/auth/logout', { corpo: { refreshToken } }).catch(() => {});
}

/** Todos os registros da carteira do técnico (pull paginado pelo cursor). */
export async function baixarRegistros(token: string, idDispositivo: string): Promise<RegistroServidor[]> {
  const todos: RegistroServidor[] = [];
  let cursor: string | null = null;
  for (let pagina = 0; pagina < 50; pagina++) {
    const r: RespostaPull = await chamar<RespostaPull>('/sync/pull', { token, corpo: { cursor, idDispositivo } });
    todos.push(...r.registros);
    if (r.registros.length === 0 || r.cursor === cursor) break;
    cursor = r.cursor;
  }
  return todos;
}

const CATEGORIA: Record<string, EquipmentCategory> = {
  Módulo: 'modulo', Inversor: 'inversor', Estrutura: 'estrutura', 'String Box': 'string_box', Cabos: 'cabos', Conectores: 'conectores',
};

interface EquipamentoApi {
  idEquipamento: string; categoria: string; fabricante: string; modelo: string; fornecedor: string;
  potenciaW?: number | null; fases?: string | null; garantiaAnos?: number | null;
  comprimentoMm?: number | null; larguraMm?: number | null; precoVenda: number;
}

export async function baixarCatalogo(token: string): Promise<Equipment[]> {
  const r = await chamar<{ equipamentos: EquipamentoApi[] }>('/sync/catalogo', { token });
  return r.equipamentos.map((e) => ({
    id: e.idEquipamento,
    category: CATEGORIA[e.categoria] ?? 'estrutura',
    name: `${e.fabricante} ${e.modelo}`,
    manufacturer: e.fabricante,
    price: e.precoVenda,
    warrantyYears: e.garantiaAnos ?? 0,
    available: true,
    suppliers: [e.fornecedor],
    ...(e.potenciaW ? { powerW: e.potenciaW } : {}),
    ...(e.fases ? { phases: e.fases === 'Trifásico' ? (3 as const) : (1 as const) } : {}),
    ...(e.comprimentoMm && e.larguraMm ? { areaM2: Math.round(((e.comprimentoMm * e.larguraMm) / 1e6) * 100) / 100 } : {}),
  }));
}
