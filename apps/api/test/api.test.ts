import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { INestApplication } from '@nestjs/common';
import { FilaSincronizacao, adaptarSqliteSincrono, criarTransporteHttp, idOperacaoDe, type EntradaFila } from '@lumini/sync';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { lerConfig, type ConfigApi } from '../src/config';
import { criarApp } from '../src/criarApp';
import { EMPRESA_DEMO, SENHA_DEMO } from '../src/db/seed';

let app: INestApplication;
let url: string;
let pasta: string;
let config: ConfigApi;

async function chamar<T = any>(caminho: string, opcoes: { metodo?: string; token?: string; corpo?: unknown } = {}): Promise<{ status: number; corpo: T }> {
  const r = await fetch(`${url}${caminho}`, {
    method: opcoes.metodo ?? (opcoes.corpo === undefined ? 'GET' : 'POST'),
    headers: { 'content-type': 'application/json', ...(opcoes.token ? { authorization: `Bearer ${opcoes.token}` } : {}) },
    ...(opcoes.corpo === undefined ? {} : { body: JSON.stringify(opcoes.corpo) }),
  });
  const texto = await r.text();
  return { status: r.status, corpo: (texto ? JSON.parse(texto) : null) as T };
}

async function entrar(email: string) {
  const r = await chamar('/auth/login', { corpo: { email, senha: SENHA_DEMO } });
  expect(r.status).toBe(200);
  return r.corpo as { tokenAcesso: string; refreshToken: string; usuario: { id: string; papel: string } };
}

async function subir() {
  app = await criarApp(config, false);
  await app.listen(0, '127.0.0.1');
  url = (await app.getUrl()).replace('[::1]', '127.0.0.1');
}

beforeAll(async () => {
  pasta = mkdtempSync(join(tmpdir(), 'lumini-api-'));
  // Com TEST_DATABASE_URL, a mesma bateria roda contra um PostgreSQL (banco vazio).
  const urlPg = process.env.TEST_DATABASE_URL?.trim() || null;
  config = { ...lerConfig({}), caminhoBanco: join(pasta, 'lumini.db'), urlBanco: urlPg, sslBanco: false, segredoJwt: 'segredo-de-teste' };
  await subir();
});

afterAll(async () => {
  await app?.close();
  rmSync(pasta, { recursive: true, force: true });
});

/** Proposta nova do Carlos, no formato que o app envia (registros.ts). */
function propostaDoCarlos(id: string, em: string, status = 'Gerada'): EntradaFila[] {
  const v = (idRegistro: string, dados: Record<string, unknown>) => ({ id: idRegistro, idEmpresa: EMPRESA_DEMO, updatedAt: em, updatedBy: 'tec-001', dados });
  return [
    { entidade: 'Cliente', versao: v(`cli-${id}`, { id_cliente: `cli-${id}`, id_usuario_responsavel: 'tec-001', nome_razao_social: 'Cliente do Teste', contato_whatsapp: '12999990000', contato_email: null }), baseUpdatedAt: null },
    { entidade: 'Instalacao', versao: v(`ins-${id}`, { id_instalacao: `ins-${id}`, id_cliente: `cli-${id}`, cidade: 'Caçapava', estado: 'SP', tarifa_kwh: 0.92, consumo_mensal_kwh: 400 }), baseUpdatedAt: null },
    { entidade: 'Proposta', versao: v(id, { id_proposta: id, id_instalacao: `ins-${id}`, id_usuario_responsavel: 'tec-001', numero_proposta: 'LUM-2026-0999', numero_versao: 1, status_proposta: status, potencia_kwp: 3.3, valor_total: 15900, data_geracao: em, itens: [] }), baseUpdatedAt: null },
  ];
}

describe(`API Lumini (${process.env.TEST_DATABASE_URL ? 'PostgreSQL' : 'SQLite local'})`, () => {
  it('responde a verificação de saúde e publica a base de contingência', async () => {
    expect((await chamar('/saude')).corpo).toMatchObject({ status: 'ok' });
    const versao = await chamar('/contingencia/versao');
    expect(versao.corpo).toMatchObject({ versao: 'embutida-2026.09' });
    const base = await chamar(`/contingencia/${versao.corpo.versao}`);
    expect(Object.keys(base.corpo.hsp)).toHaveLength(27);
  });

  it('RF01: recusa senha errada e devolve token com o papel', async () => {
    expect((await chamar('/auth/login', { corpo: { email: 'carlos@lumini.com', senha: 'errada' } })).status).toBe(401);
    const s = await entrar('carlos@lumini.com');
    expect(s.usuario).toMatchObject({ id: 'tec-001', papel: 'Tecnico' });
    expect((await chamar('/auth/me', { token: s.tokenAcesso })).corpo).toMatchObject({ nomeEmpresa: 'Solar Vale Energia' });
  });

  it('refresh troca o par de tokens e invalida o antigo', async () => {
    const s = await entrar('carlos@lumini.com');
    const novo = await chamar('/auth/refresh', { corpo: { refreshToken: s.refreshToken } });
    expect(novo.status).toBe(200);
    expect((await chamar('/auth/refresh', { corpo: { refreshToken: s.refreshToken } })).status).toBe(401);
  });

  it('RNF06: painel sem token = 401, técnico = 403, gestor = 200', async () => {
    expect((await chamar('/admin/resumo')).status).toBe(401);
    expect((await chamar('/admin/resumo', { token: 'token.falso.x' })).status).toBe(401);
    const tecnico = await entrar('carlos@lumini.com');
    expect((await chamar('/admin/resumo', { token: tecnico.tokenAcesso })).status).toBe(403);
    const gestora = await entrar('gestora@solarvale.com.br');
    const resumo = await chamar('/admin/resumo', { token: gestora.tokenAcesso });
    expect(resumo.status).toBe(200);
    expect(resumo.corpo.propostas.total).toBe(8);
    expect(resumo.corpo.plano).toMatchObject({ tipo: 'Freemium', limiteMes: 25 });
  });

  it('ponta a ponta: a fila do app envia por HTTP e a proposta aparece no painel', async () => {
    const tecnico = await entrar('carlos@lumini.com');
    const banco = adaptarSqliteSincrono(new DatabaseSync(':memory:'));
    const eventos: string[] = [];
    const fila = await FilaSincronizacao.abrir({
      banco,
      transporte: criarTransporteHttp({ urlBase: url, obterToken: () => tecnico.tokenAcesso }),
      idDispositivo: 'celular-carlos',
      idUsuario: 'tec-001',
      conectividade: { estaOnline: () => true },
      esperaAposEnfileirarMs: null,
      aoResultado: (e) => {
        eventos.push(`${e.tipo}:${e.entidade}`);
      },
    });
    for (const entrada of propostaDoCarlos('pro-e2e', '2026-10-29T10:00:00.000Z')) await fila.enfileirar(entrada);
    const rodada = await fila.retentarAgora();
    fila.parar();
    expect(rodada.rejeitadas).toBe(0);
    expect(eventos).toEqual(['sincronizado:Cliente', 'sincronizado:Instalacao', 'sincronizado:Proposta']);

    const gestora = await entrar('gestora@solarvale.com.br');
    const lista = await chamar('/admin/propostas?busca=0999', { token: gestora.tokenAcesso });
    expect(lista.corpo).toEqual([expect.objectContaining({ id: 'pro-e2e', status: 'Gerada', tecnico: 'Carlos Campos', cidade: 'Caçapava/SP' })]);
  });

  it('RF27 + RN11: a gestora move o status pelo painel e o técnico não consegue mais sobrescrever', async () => {
    const gestora = await entrar('gestora@solarvale.com.br');
    const detalhe = await chamar('/admin/propostas/pro-e2e', { token: gestora.tokenAcesso });
    expect(detalhe.corpo.acoesPermitidas).toContain('mover_negociacao');
    const movida = await chamar('/admin/propostas/pro-e2e/status', { token: gestora.tokenAcesso, corpo: { status: 'Em negociação' } });
    expect(movida.status).toBe(201);
    expect(movida.corpo.proposta.status_proposta).toBe('Em negociação');
    expect(movida.corpo.historico[0]).toMatchObject({ campo: 'status_proposta', valorAnterior: 'Gerada', valorNovo: 'Em negociação', usuario: 'Juliana Prado', origem: 'Web' });
    expect(movida.corpo.linhaDoTempo.map((l: { status: string }) => l.status)).toEqual(['Gerada', 'Em negociação']);

    const tecnico = await entrar('carlos@lumini.com');
    const [, , proposta] = propostaDoCarlos('pro-e2e', '2026-10-29T12:00:00.000Z');
    const push = await chamar('/sync/push', {
      token: tecnico.tokenAcesso,
      corpo: { idDispositivo: 'celular-carlos', operacoes: [{ idOperacao: idOperacaoDe('Proposta', 'pro-e2e'), entidade: 'Proposta', baseUpdatedAt: '2026-10-29T10:00:00.000Z', versao: proposta!.versao }] },
    });
    expect(push.corpo.resultados[0]).toMatchObject({ situacao: 'rejeitada', codigo: 'RN11' });

    // Status final é somente leitura até para a gestora.
    const aprovada = await chamar('/admin/propostas/pro-e2e/status', { token: gestora.tokenAcesso, corpo: { status: 'Aprovada' } });
    expect(aprovada.corpo).toMatchObject({ proposta: { status_proposta: 'Aprovada' } });
    const depois = await chamar('/admin/propostas/pro-e2e/status', { token: gestora.tokenAcesso, corpo: { status: 'Em negociação' } });
    expect(depois.status).toBe(409);
  });

  it('pull: o técnico recebe só a carteira dele; a gestora recebe a empresa toda', async () => {
    const carlos = await entrar('carlos@lumini.com');
    const pullCarlos = await chamar('/sync/pull', { token: carlos.tokenAcesso, corpo: { cursor: null } });
    const propostasCarlos = pullCarlos.corpo.registros.filter((r: any) => r.entidade === 'Proposta');
    expect(propostasCarlos.every((r: any) => r.versao.dados.id_usuario_responsavel === 'tec-001')).toBe(true);
    expect(propostasCarlos.length).toBe(6); // 5 do seed + a do teste
    const gestora = await entrar('gestora@solarvale.com.br');
    const pullGestora = await chamar('/sync/pull', { token: gestora.tokenAcesso, corpo: { cursor: null } });
    expect(pullGestora.corpo.registros.filter((r: any) => r.entidade === 'Proposta')).toHaveLength(9);
    const seguinte = await chamar('/sync/pull', { token: gestora.tokenAcesso, corpo: { cursor: pullGestora.corpo.cursor } });
    expect(seguinte.corpo.registros).toEqual([]);
  });

  it('multi-tenant: registro de outra empresa é recusado', async () => {
    const carlos = await entrar('carlos@lumini.com');
    const [cliente] = propostaDoCarlos('pro-x', '2026-10-29T10:00:00.000Z');
    const push = await chamar('/sync/push', {
      token: carlos.tokenAcesso,
      corpo: { idDispositivo: 'celular-carlos', operacoes: [{ idOperacao: 'Cliente:cli-pro-x', entidade: 'Cliente', baseUpdatedAt: null, versao: { ...cliente!.versao, idEmpresa: 'outra-empresa' } }] },
    });
    expect(push.corpo.resultados[0]).toMatchObject({ situacao: 'rejeitada', codigo: 'OUTRA_EMPRESA' });
  });

  it('catálogo: valida pelas regras do @lumini/domain e calcula o preço de venda', async () => {
    const gestora = await entrar('gestora@solarvale.com.br');
    const antes = (await chamar('/admin/equipamentos', { token: gestora.tokenAcesso })).corpo.length;
    expect(antes).toBeGreaterThan(5);
    const invalido = await chamar('/admin/equipamentos', { token: gestora.tokenAcesso, corpo: { categoria: 'Cabos', fabricante: '', modelo: 'X', fornecedor: 'Y', precoCusto: -1 } });
    expect(invalido.status).toBe(400);
    const novo = await chamar('/admin/equipamentos', {
      token: gestora.tokenAcesso,
      corpo: { categoria: 'Cabos', fabricante: 'Prysmian', modelo: 'Afumex Solar 6 mm²', fornecedor: 'Aldo Solar', unidadeVenda: 'm', precoCusto: 8, margemPercentual: 25, especificacoes: { secaoMm2: 6 } },
    });
    expect(novo.status).toBe(201);
    expect(novo.corpo.precoVenda).toBeCloseTo(10, 2);
    expect((await chamar('/admin/equipamentos', { token: gestora.tokenAcesso })).corpo.length).toBe(antes + 1);
  });

  it('usuários: a gestora cadastra um técnico, que já consegue entrar', async () => {
    const gestora = await entrar('gestora@solarvale.com.br');
    const r = await chamar('/admin/usuarios', { token: gestora.tokenAcesso, corpo: { nome: 'Pedro Henrique', email: 'pedro@solarvale.com.br', papel: 'Tecnico', senha: 'senha-forte-1' } });
    expect(r.status).toBe(201);
    const login = await chamar('/auth/login', { corpo: { email: 'pedro@solarvale.com.br', senha: 'senha-forte-1' } });
    expect(login.status).toBe(200);
    await chamar(`/admin/usuarios/${r.corpo.id}`, { metodo: 'PATCH', token: gestora.tokenAcesso, corpo: { ativo: false } });
    expect((await chamar('/auth/login', { corpo: { email: 'pedro@solarvale.com.br', senha: 'senha-forte-1' } })).status).toBe(401);
  });

  it('os dados continuam no arquivo SQLite depois de reiniciar a API', async () => {
    await app.close();
    await subir();
    const gestora = await entrar('gestora@solarvale.com.br');
    const r = await chamar('/admin/propostas/pro-e2e', { token: gestora.tokenAcesso });
    expect(r.corpo.proposta.status_proposta).toBe('Aprovada');
    expect((await chamar('/admin/resumo', { token: gestora.tokenAcesso })).corpo.propostas.total).toBe(9);
  });

  it('GET /sync/catalogo devolve o catálogo ativo ao técnico, sem login dá 401', async () => {
    const semLogin = await chamar('/sync/catalogo');
    expect(semLogin.status).toBe(401);
    const { tokenAcesso } = await entrar('carlos@lumini.com');
    const r = await chamar<{ equipamentos: { idEquipamento: string; categoria: string; precoVenda: number }[] }>('/sync/catalogo', { token: tokenAcesso });
    expect(r.status).toBe(200);
    expect(r.corpo.equipamentos.length).toBeGreaterThan(0);
    expect(r.corpo.equipamentos.some((e) => e.categoria === 'Módulo')).toBe(true);
  });
});
