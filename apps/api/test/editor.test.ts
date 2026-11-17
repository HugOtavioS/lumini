import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { precificarProposta } from '@lumini/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BancoService } from '../src/banco.service';
import { lerConfig } from '../src/config';
import { criarApp } from '../src/criarApp';
import { SENHA_DEMO } from '../src/db/seed';

// SCRUM-419 (Editor de Proposta), SCRUM-433 (parâmetros) e SCRUM-435/436 (limite do plano).

let app: INestApplication;
let url: string;
let pasta: string;

async function chamar<T = any>(caminho: string, opcoes: { metodo?: string; token?: string; corpo?: unknown } = {}): Promise<{ status: number; corpo: T }> {
  const r = await fetch(`${url}${caminho}`, {
    method: opcoes.metodo ?? (opcoes.corpo === undefined ? 'GET' : 'POST'),
    headers: { 'content-type': 'application/json', ...(opcoes.token ? { authorization: `Bearer ${opcoes.token}` } : {}) },
    ...(opcoes.corpo === undefined ? {} : { body: JSON.stringify(opcoes.corpo) }),
  });
  const texto = await r.text();
  return { status: r.status, corpo: (texto ? JSON.parse(texto) : null) as T };
}
const entrar = async (email: string) => (await chamar('/auth/login', { corpo: { email, senha: SENHA_DEMO } })).corpo.tokenAcesso as string;

beforeAll(async () => {
  pasta = mkdtempSync(join(tmpdir(), 'lumini-editor-'));
  const urlPg = process.env.TEST_DATABASE_URL?.trim() || null;
  app = await criarApp({ ...lerConfig({}), caminhoBanco: join(pasta, 'lumini.db'), segredoJwt: 'teste', ...(urlPg ? { urlBanco: urlPg, sslBanco: false } : {}) } as never, false);
  await app.listen(0, '127.0.0.1');
  url = (await app.getUrl()).replace('[::1]', '127.0.0.1');
});
afterAll(async () => {
  await app?.close();
  rmSync(pasta, { recursive: true, force: true });
});

describe('SCRUM-433 — parâmetros comerciais', () => {
  it('a gestora lê e altera; valores fora da faixa são recusados; o técnico recebe pelo /sync', async () => {
    const g = await entrar('gestora@solarvale.com.br');
    const lidos = await chamar('/admin/parametros', { token: g });
    expect(lidos.corpo).toMatchObject({ limiteAjustePrecoPerc: 15, margemPadraoPerc: 25, validadePadraoDias: 15 });
    expect((await chamar('/admin/parametros', { metodo: 'PUT', token: g, corpo: { margemPadraoPerc: -5 } })).status).toBe(400);
    const salvos = await chamar('/admin/parametros', { metodo: 'PUT', token: g, corpo: { limiteAjustePrecoPerc: 10, fretePadrao: 950 } });
    expect(salvos.corpo).toMatchObject({ limiteAjustePrecoPerc: 10, fretePadrao: 950, atualizadoPor: 'ges-001' });
    const t = await entrar('carlos@lumini.com');
    expect((await chamar('/admin/parametros', { token: t })).status).toBe(403);
    expect((await chamar('/sync/parametros', { token: t })).corpo).toMatchObject({ limiteAjustePrecoPerc: 10, fretePadrao: 950 });
  });
});

describe('SCRUM-419 — Editor de Proposta', () => {
  it('troca quantidade e aplica desconto: nova versão, totais recalculados e auditoria', async () => {
    const g = await entrar('gestora@solarvale.com.br');
    const lista = (await chamar('/admin/propostas?status=Gerada', { token: g })).corpo as { id: string }[];
    const id = lista[0]!.id;
    const antes = (await chamar(`/admin/propostas/${id}`, { token: g })).corpo;
    expect(antes.podeEditar).toBe(true);
    const p = antes.proposta;
    const itens = p.itens.map((i: any, n: number) => ({ id_equipamento: i.id_equipamento, quantidade: n === 0 ? i.quantidade + 2 : i.quantidade, ajuste_percentual: 0 }));
    // O navegador calcula com @lumini/domain; a API confere.
    const esperado = precificarProposta({
      itens: itens.map((i: any, n: number) => ({ ...i, precoCatalogo: Number(p.itens[n].preco_catalogo), ajustePercentual: 0 })),
      servicos: { materiaisEletricos: p.valor_materiais_eletricos, maoDeObra: p.valor_mao_de_obra, artHomologacao: p.valor_art_homologacao, logisticaFrete: p.valor_logistica_frete },
      margemPercentual: p.margem_percentual,
      descontoComercialPerc: 5,
    });
    const errado = await chamar(`/admin/propostas/${id}`, { metodo: 'PUT', token: g, corpo: { itens, desconto_comercial_perc: 5, valor_total: esperado.valorTotal + 100 } });
    expect(errado.status).toBe(400);
    const r = await chamar(`/admin/propostas/${id}`, { metodo: 'PUT', token: g, corpo: { itens, desconto_comercial_perc: 5, valor_total: esperado.valorTotal } });
    expect(r.status).toBe(200);
    expect(r.corpo.proposta).toMatchObject({ valor_total: esperado.valorTotal, desconto_comercial_perc: 5, numero_versao: Number(p.numero_versao) + 1 });
    expect(r.corpo.proposta.potencia_kwp).toBeGreaterThan(p.potencia_kwp);
    expect(r.corpo.proposta.payback_meses).toBeGreaterThan(0);
    expect(r.corpo.historico.map((h: any) => h.campo)).toEqual(expect.arrayContaining(['desconto_comercial_perc', 'valor_total', 'numero_versao']));
  });

  it('recusa ajuste acima do limite da empresa, técnico e proposta encerrada', async () => {
    const g = await entrar('gestora@solarvale.com.br');
    const lista = (await chamar('/admin/propostas', { token: g })).corpo as { id: string; status: string }[];
    const gerada = lista.find((x) => x.status === 'Gerada')!;
    const det = (await chamar(`/admin/propostas/${gerada.id}`, { token: g })).corpo;
    const itens = det.proposta.itens.map((i: any) => ({ id_equipamento: i.id_equipamento, quantidade: i.quantidade, ajuste_percentual: 30 }));
    const r = await chamar(`/admin/propostas/${gerada.id}`, { metodo: 'PUT', token: g, corpo: { itens } });
    expect(r.status).toBe(400);
    expect(String(r.corpo.message)).toContain('ajuste');
    const t = await entrar('carlos@lumini.com');
    expect((await chamar(`/admin/propostas/${gerada.id}`, { metodo: 'PUT', token: t, corpo: { itens } })).status).toBe(403);
    const aprovada = lista.find((x) => x.status === 'Aprovada')!;
    const ap = (await chamar(`/admin/propostas/${aprovada.id}`, { token: g })).corpo;
    expect(ap.podeEditar).toBe(false);
    const r2 = await chamar(`/admin/propostas/${aprovada.id}`, { metodo: 'PUT', token: g, corpo: { itens: ap.proposta.itens.map((i: any) => ({ id_equipamento: i.id_equipamento, quantidade: i.quantidade })) } });
    expect(r2.status).toBe(409);
  });
});

describe('SCRUM-435/436 — limite do plano revalidado na sincronização', () => {
  it('proposta gerada offline além do limite é aceita, volta com aviso e fica sinalizada', async () => {
    const bd = app.get(BancoService);
    const g = await entrar('gestora@solarvale.com.br');
    const usadas = (await chamar('/admin/plano', { token: g })).corpo.usadasMes as number;
    bd.banco.executar('UPDATE assinatura SET limite_propostas_mes = ? WHERE id_empresa = ?', usadas, 'emp-001');

    const t = await entrar('carlos@lumini.com');
    const agora = new Date().toISOString();
    const v = (id: string, dados: Record<string, unknown>) => ({ id, idEmpresa: 'emp-001', updatedAt: agora, updatedBy: 'tec-001', dados });
    const ops = [
      { idOperacao: 'Cliente:cli-lim', entidade: 'Cliente', baseUpdatedAt: null, versao: v('cli-lim', { id_cliente: 'cli-lim', id_usuario_responsavel: 'tec-001', nome_razao_social: 'Cliente Limite' }) },
      { idOperacao: 'Instalacao:ins-lim', entidade: 'Instalacao', baseUpdatedAt: null, versao: v('ins-lim', { id_instalacao: 'ins-lim', id_cliente: 'cli-lim', cidade: 'Taubaté', estado: 'SP', tarifa_kwh: 0.9, consumo_mensal_kwh: 300 }) },
      { idOperacao: 'Proposta:pro-lim', entidade: 'Proposta', baseUpdatedAt: null, versao: v('pro-lim', { id_proposta: 'pro-lim', id_instalacao: 'ins-lim', id_usuario_responsavel: 'tec-001', numero_proposta: 'LUM-2026-0777', numero_versao: 1, status_proposta: 'Gerada', potencia_kwp: 3, valor_total: 14000, data_geracao: agora, itens: [] }) },
    ];
    const push = await chamar('/sync/push', { token: t, corpo: { idDispositivo: 'cel', operacoes: ops } });
    const res = push.corpo.resultados.find((r: any) => r.idOperacao === 'Proposta:pro-lim');
    expect(res.situacao).toBe('aplicada');
    expect(res.avisos.join(' ')).toContain('Limite do plano');

    const lista = (await chamar('/admin/propostas?busca=0777', { token: g })).corpo;
    expect(lista[0]).toMatchObject({ id: 'pro-lim', excedeuLimite: true });
    const plano = (await chamar('/admin/plano', { token: g })).corpo;
    expect(plano.acimaDoLimiteMes).toBe(1);
    const det = (await chamar('/admin/propostas/pro-lim', { token: g })).corpo;
    expect(det.historico.some((h: any) => h.campo === 'excedeu_limite_plano')).toBe(true);
  });
});
