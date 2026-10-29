import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// JWT HS256 (RFC 7519) com node:crypto, sem dependência externa.
// O token de acesso carrega o papel (D23 / SCRUM-397) e a empresa (RNF06).

export type Papel = 'Tecnico' | 'Gestor';

export interface ConteudoToken {
  /** id_usuario */
  sub: string;
  emp: string;
  papel: Papel;
  nome: string;
  iat: number;
  exp: number;
}

const b64 = (dado: Buffer | string) => Buffer.from(dado).toString('base64url');

export function assinarToken(conteudo: Omit<ConteudoToken, 'iat' | 'exp'>, segredo: string, validadeS: number, agoraS = Math.floor(Date.now() / 1000)): string {
  const cabecalho = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const corpo = b64(JSON.stringify({ ...conteudo, iat: agoraS, exp: agoraS + validadeS }));
  const assinatura = createHmac('sha256', segredo).update(`${cabecalho}.${corpo}`).digest('base64url');
  return `${cabecalho}.${corpo}.${assinatura}`;
}

/** Conteúdo do token, ou `null` se a assinatura não confere ou se expirou. */
export function verificarToken(token: string, segredo: string, agoraS = Math.floor(Date.now() / 1000)): ConteudoToken | null {
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  const [cabecalho, corpo, assinatura] = partes as [string, string, string];
  const esperada = createHmac('sha256', segredo).update(`${cabecalho}.${corpo}`).digest();
  const recebida = Buffer.from(assinatura, 'base64url');
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return null;
  try {
    const dados = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8')) as ConteudoToken;
    if (typeof dados.exp !== 'number' || dados.exp <= agoraS) return null;
    if (dados.papel !== 'Tecnico' && dados.papel !== 'Gestor') return null;
    return dados;
  } catch {
    return null;
  }
}

/** Refresh token opaco; no banco fica só o hash. */
export function novoRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashRefresh(token) };
}

export function hashRefresh(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}
