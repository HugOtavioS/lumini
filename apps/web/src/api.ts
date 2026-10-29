// Cliente da API do Lumini (apps/api). Guarda a sessão no navegador e renova
// o token de acesso com o refresh token quando ele expira (401).

export const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000').replace(/\/+$/, '');

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: 'Tecnico' | 'Gestor';
  telefone: string | null;
  idEmpresa: string;
  nomeEmpresa: string;
}

interface Sessao {
  tokenAcesso: string;
  refreshToken: string;
  usuario: Usuario;
}

const CHAVE = 'lumini.sessao';

function lerSessao(): Sessao | null {
  try {
    const texto = localStorage.getItem(CHAVE);
    return texto ? (JSON.parse(texto) as Sessao) : null;
  } catch {
    return null;
  }
}

function gravarSessao(sessao: Sessao | null): void {
  try {
    if (sessao) localStorage.setItem(CHAVE, JSON.stringify(sessao));
    else localStorage.removeItem(CHAVE);
  } catch {
    /* navegador sem armazenamento: a sessão vale só nesta aba */
  }
}

let sessao: Sessao | null = lerSessao();
let aoExpirar: (() => void) | null = null;

export class ErroApi extends Error {
  constructor(readonly status: number, mensagem: string) {
    super(mensagem);
  }
}

export const sessaoAtual = () => sessao;
export const definirAoExpirar = (fn: () => void) => {
  aoExpirar = fn;
};

async function requisitar<T>(caminho: string, opcoes: { metodo?: string; corpo?: unknown; autenticado?: boolean } = {}, tentouRenovar = false): Promise<T> {
  const autenticado = opcoes.autenticado ?? true;
  let resposta: Response;
  try {
    resposta = await fetch(`${API_URL}${caminho}`, {
      method: opcoes.metodo ?? (opcoes.corpo === undefined ? 'GET' : 'POST'),
      headers: {
        'Content-Type': 'application/json',
        ...(autenticado && sessao ? { Authorization: `Bearer ${sessao.tokenAcesso}` } : {}),
      },
      ...(opcoes.corpo === undefined ? {} : { body: JSON.stringify(opcoes.corpo) }),
    });
  } catch {
    throw new ErroApi(0, `Não foi possível falar com a API em ${API_URL}. Ela está rodando?`);
  }
  if (resposta.status === 401 && autenticado && sessao && !tentouRenovar) {
    if (await renovar()) return requisitar<T>(caminho, opcoes, true);
    sair();
    aoExpirar?.();
  }
  const texto = await resposta.text();
  const corpo = texto ? (JSON.parse(texto) as unknown) : null;
  if (!resposta.ok) {
    const msg = (corpo as { message?: string | string[] } | null)?.message;
    throw new ErroApi(resposta.status, Array.isArray(msg) ? msg.join(' ') : msg ?? `Erro ${resposta.status}.`);
  }
  return corpo as T;
}

async function renovar(): Promise<boolean> {
  if (!sessao) return false;
  try {
    const nova = await requisitar<Sessao>('/auth/refresh', { corpo: { refreshToken: sessao.refreshToken }, autenticado: false }, true);
    sessao = nova;
    gravarSessao(nova);
    return true;
  } catch {
    return false;
  }
}

export async function entrar(email: string, senha: string): Promise<Usuario> {
  const nova = await requisitar<Sessao>('/auth/login', { corpo: { email, senha }, autenticado: false });
  if (nova.usuario.papel !== 'Gestor') {
    throw new ErroApi(403, 'O painel web é para o Gestor Comercial. Técnicos usam o app no celular.');
  }
  sessao = nova;
  gravarSessao(nova);
  return nova.usuario;
}

export function sair(): void {
  if (sessao) void fetch(`${API_URL}/auth/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: sessao.refreshToken }) }).catch(() => undefined);
  sessao = null;
  gravarSessao(null);
}

export const api = {
  get: <T>(caminho: string) => requisitar<T>(caminho),
  post: <T>(caminho: string, corpo: unknown) => requisitar<T>(caminho, { corpo }),
  put: <T>(caminho: string, corpo: unknown) => requisitar<T>(caminho, { metodo: 'PUT', corpo }),
  patch: <T>(caminho: string, corpo: unknown) => requisitar<T>(caminho, { metodo: 'PATCH', corpo }),
};
