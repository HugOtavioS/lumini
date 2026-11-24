import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { lerConfig } from '../src/config';
import { criarApp } from '../src/criarApp';
import { SENHA_DEMO } from '../src/db/seed';
import { Limitador } from '../src/seguranca/limitador';

// SCRUM-32 — controle de requisições e limitação de uso.

describe('Limitador (regras)', () => {
  it('limite geral por minuto e liberação na janela seguinte', () => {
    let t = 0;
    const l = new Limitador({ requisicoesPorMinuto: 3, tentativasLogin: 2, janelaLoginS: 900 }, () => t);
    expect([1, 2, 3].map(() => l.contarGeral('a').esperarS)).toEqual([null, null, null]);
    expect(l.contarGeral('a').esperarS).toBe(60);
    expect(l.contarGeral('b').esperarS).toBeNull(); // outro cliente não é afetado
    t = 60_000;
    expect(l.contarGeral('a').esperarS).toBeNull();
  });

  it('login: bloqueia depois das senhas erradas e zera quando acerta', () => {
    let t = 0;
    const l = new Limitador({ requisicoesPorMinuto: 0, tentativasLogin: 2, janelaLoginS: 900 }, () => t);
    l.registrarLogin('x', false);
    expect(l.loginBloqueado('x')).toBeNull();
    l.registrarLogin('x', false);
    expect(l.loginBloqueado('x')).toBe(900);
    t = 900_000;
    expect(l.loginBloqueado('x')).toBeNull();
    l.registrarLogin('x', false);
    l.registrarLogin('x', true);
    expect(l.loginBloqueado('x')).toBeNull();
  });
});

describe('API com limitação ligada', () => {
  let app: INestApplication;
  let url: string;
  let pasta: string;
  beforeAll(async () => {
    pasta = mkdtempSync(join(tmpdir(), 'lumini-limite-'));
    const cfg = lerConfig({ LIMITE_REQ_MINUTO: '20', LIMITE_TENTATIVAS_LOGIN: '3' });
    app = await criarApp({ ...cfg, caminhoBanco: join(pasta, 'lumini.db'), segredoJwt: 'teste' }, false);
    await app.listen(0, '127.0.0.1');
    url = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });
  afterAll(async () => {
    await app?.close();
    rmSync(pasta, { recursive: true, force: true });
  });
  const login = (email: string, senha: string) =>
    fetch(`${url}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) });

  it('3 senhas erradas bloqueiam o login daquele e-mail com 429 (até a senha certa)', async () => {
    for (let i = 0; i < 3; i++) expect((await login('carlos@lumini.com', 'errada')).status).toBe(401);
    const r = await login('carlos@lumini.com', SENHA_DEMO);
    expect(r.status).toBe(429);
    expect(Number(r.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await r.json()).message).toContain('Muitas tentativas');
    expect((await login('gestora@solarvale.com.br', SENHA_DEMO)).status).toBe(200); // outro e-mail segue normal
  });

  it('corpo acima do limite é recusado com 413', async () => {
    const r = await fetch(`${url}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'a', senha: 'x'.repeat(3 * 1024 * 1024) }) });
    expect(r.status).toBe(413);
  });

  it('passa do limite por minuto → 429 com cabeçalhos RateLimit', async () => {
    let ultima: Response | undefined;
    for (let i = 0; i < 25; i++) {
      ultima = await fetch(`${url}/contingencia/versao`);
      if (ultima.status === 429) break;
    }
    expect(ultima!.status).toBe(429);
    expect(ultima!.headers.get('ratelimit-limit')).toBe('20');
    expect((await fetch(`${url}/saude`)).status).toBe(200); // saúde nunca é limitada (health check da EC2)
  });
});
