import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// Hash de senha com scrypt (node:crypto), no formato `scrypt$<sal>$<hash>`.

const TAMANHO = 64;

export function gerarHashSenha(senha: string): string {
  const sal = randomBytes(16).toString('base64url');
  return `scrypt$${sal}$${scryptSync(senha, sal, TAMANHO).toString('base64url')}`;
}

export function conferirSenha(senha: string, hash: string): boolean {
  const [algoritmo, sal, esperado] = hash.split('$');
  if (algoritmo !== 'scrypt' || !sal || !esperado) return false;
  const calculado = scryptSync(senha, sal, TAMANHO);
  const guardado = Buffer.from(esperado, 'base64url');
  return guardado.length === calculado.length && timingSafeEqual(guardado, calculado);
}
