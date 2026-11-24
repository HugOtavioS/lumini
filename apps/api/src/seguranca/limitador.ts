/**
 * limitador.ts — SCRUM-32: controle de requisições e limitação de uso.
 *
 * A API fica numa EC2 sem API Gateway na frente, então a limitação é feita
 * aqui mesmo, em memória (uma instância só — suficiente para o MVP):
 *
 *   1. Limite geral por cliente (IP ou usuário do token): N requisições por minuto.
 *   2. Login: depois de X senhas erradas para o mesmo e-mail + IP, bloqueia por
 *      uma janela (contra força bruta). Login certo zera a contagem.
 *   3. Corpo da requisição limitado (o push do app não passa disso).
 *
 * Passou do limite → HTTP 429 com Retry-After e os cabeçalhos RateLimit-*.
 */
import type { NextFunction, Request, Response } from 'express';

export interface ConfigLimites {
  /** Requisições por minuto por cliente (0 desliga). */
  requisicoesPorMinuto: number;
  /** Senhas erradas permitidas por e-mail + IP dentro da janela. */
  tentativasLogin: number;
  janelaLoginS: number;
}

interface Janela { inicio: number; contagem: number }

export class Limitador {
  private readonly geral = new Map<string, Janela>();
  private readonly login = new Map<string, Janela>();

  constructor(private readonly cfg: ConfigLimites, private readonly agora: () => number = Date.now) {}

  /** Conta uma requisição; devolve quantos segundos esperar se estourou. */
  contarGeral(chave: string): { restante: number; esperarS: number | null } {
    const limite = this.cfg.requisicoesPorMinuto;
    if (limite <= 0) return { restante: Infinity, esperarS: null };
    const j = this.janela(this.geral, chave, 60);
    j.contagem += 1;
    const esperarS = j.contagem > limite ? this.falta(j, 60) : null;
    return { restante: Math.max(0, limite - j.contagem), esperarS };
  }

  loginBloqueado(chave: string): number | null {
    const j = this.login.get(chave);
    if (!j || this.agora() - j.inicio >= this.cfg.janelaLoginS * 1000) return null;
    return j.contagem >= this.cfg.tentativasLogin ? this.falta(j, this.cfg.janelaLoginS) : null;
  }

  registrarLogin(chave: string, deuCerto: boolean): void {
    if (deuCerto) { this.login.delete(chave); return; }
    this.janela(this.login, chave, this.cfg.janelaLoginS).contagem += 1;
  }

  /** Limpa janelas vencidas (chamado de tempos em tempos). */
  limpar(): void {
    const t = this.agora();
    for (const [k, j] of this.geral) if (t - j.inicio >= 60_000) this.geral.delete(k);
    for (const [k, j] of this.login) if (t - j.inicio >= this.cfg.janelaLoginS * 1000) this.login.delete(k);
  }

  private janela(mapa: Map<string, Janela>, chave: string, duracaoS: number): Janela {
    const t = this.agora();
    let j = mapa.get(chave);
    if (!j || t - j.inicio >= duracaoS * 1000) { j = { inicio: t, contagem: 0 }; mapa.set(chave, j); }
    return j;
  }

  private falta(j: Janela, duracaoS: number): number {
    return Math.max(1, Math.ceil((j.inicio + duracaoS * 1000 - this.agora()) / 1000));
  }
}

/** Quem é o cliente: o usuário do token (sub), senão o IP. Só para contar — quem valida o token é o AuthGuard. */
function chaveCliente(req: Request): string {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const partes = auth.slice(7).split('.');
    try {
      const sub = JSON.parse(Buffer.from(partes[1] ?? '', 'base64url').toString('utf8')).sub;
      if (typeof sub === 'string' && sub) return `u:${sub}|${req.ip}`;
    } catch { /* token malformado: conta pelo IP */ }
  }
  return `ip:${req.ip}`;
}

function recusar(res: Response, esperarS: number, mensagem: string) {
  res.setHeader('Retry-After', String(esperarS));
  res.status(429).json({ statusCode: 429, error: 'Too Many Requests', message: mensagem });
}

export function middlewareLimitador(limitador: Limitador, cfg: ConfigLimites) {
  const timer = setInterval(() => limitador.limpar(), 60_000);
  timer.unref();
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS' || req.path === '/saude') return next();

    const g = limitador.contarGeral(chaveCliente(req));
    if (cfg.requisicoesPorMinuto > 0) {
      res.setHeader('RateLimit-Limit', String(cfg.requisicoesPorMinuto));
      res.setHeader('RateLimit-Remaining', String(g.restante));
    }
    if (g.esperarS !== null) return recusar(res, g.esperarS, `Muitas requisições. Tente de novo em ${g.esperarS} s.`);

    if (req.method === 'POST' && req.path === '/auth/login') {
      const email = String((req.body as { email?: unknown } | undefined)?.email ?? '').trim().toLowerCase();
      const chave = `${email}|${req.ip}`;
      const bloqueio = limitador.loginBloqueado(chave);
      if (bloqueio !== null) {
        const min = Math.ceil(bloqueio / 60);
        return recusar(res, bloqueio, `Muitas tentativas de login com senha errada. Tente de novo em ${min} min.`);
      }
      res.on('finish', () => {
        if (res.statusCode === 401) limitador.registrarLogin(chave, false);
        else if (res.statusCode < 300) limitador.registrarLogin(chave, true);
      });
    }
    next();
  };
}
