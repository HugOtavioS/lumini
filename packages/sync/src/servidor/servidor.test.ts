import { describe, expect, it } from 'vitest';
import type { RequisicaoPush } from '../contrato';
import { EMPRESA, GESTORA_CARLA, TECNICO_ANA, TECNICO_BRUNO, cliente, instalacao, operacao, proposta } from '../testes/registros';
import { ServidorSincronizacaoMemoria, type SessaoServidor } from './servidorReferencia';

const ANA: SessaoServidor = { idUsuario: TECNICO_ANA, idEmpresa: EMPRESA, papel: 'Tecnico' };
const BRUNO: SessaoServidor = { idUsuario: TECNICO_BRUNO, idEmpresa: EMPRESA, papel: 'Tecnico' };
const CARLA: SessaoServidor = { idUsuario: GESTORA_CARLA, idEmpresa: EMPRESA, papel: 'Gestor' };

const T0 = '2026-10-18T12:00:00.000Z';
const T1 = '2026-10-18T12:05:00.000Z';
const T2 = '2026-10-18T12:10:00.000Z';

/** Cada pessoa usa o próprio aparelho (o servidor guarda qual aparelho gravou cada versão). */
const APARELHO: Readonly<Record<string, string>> = {
  [TECNICO_ANA]: 'celular-ana',
  [TECNICO_BRUNO]: 'celular-bruno',
  [GESTORA_CARLA]: 'navegador-carla',
};

function servidor() {
  let n = 0;
  return new ServidorSincronizacaoMemoria({ relogio: () => Date.parse('2026-10-18T12:30:00.000Z'), gerarId: () => `id-${(n += 1)}` });
}

function push(s: ServidorSincronizacaoMemoria, sessao: SessaoServidor, ...operacoes: RequisicaoPush['operacoes']) {
  return s.push(sessao, { idDispositivo: APARELHO[sessao.idUsuario] ?? 'aparelho-desconhecido', operacoes });
}

/** Servidor com cliente c1, instalação i1 e proposta p1 (versão T0). */
function comProposta() {
  const s = servidor();
  push(s, ANA, operacao('Cliente', cliente('c1', T0)), operacao('Instalacao', instalacao('i1', 'c1', T0)), operacao('Proposta', proposta('p1', 'i1', T0)));
  return s;
}

describe('servidor de referência — push', () => {
  it('grava em ordem de dependência, mesmo que o lote venha fora de ordem', () => {
    const s = servidor();
    const r = push(s, ANA, operacao('Proposta', proposta('p1', 'i1', T0)), operacao('Instalacao', instalacao('i1', 'c1', T0)), operacao('Cliente', cliente('c1', T0)));
    expect(r.resultados.map((x) => [x.idOperacao, x.situacao])).toEqual([
      ['Cliente:c1', 'aplicada'],
      ['Instalacao:i1', 'aplicada'],
      ['Proposta:p1', 'aplicada'],
    ]);
    expect(s.obter('Proposta', 'p1')?.dados.valor_total).toBe(21500);
  });

  it('registro pai ausente: recusa retentável', () => {
    const r = push(servidor(), ANA, operacao('Instalacao', instalacao('i1', 'c-inexistente', T0)));
    expect(r.resultados[0]).toMatchObject({ situacao: 'rejeitada', codigo: 'DEPENDENCIA_AUSENTE', retentavel: true });
  });

  it('registro de outra empresa: recusa definitiva', () => {
    const r = push(servidor(), ANA, operacao('Cliente', { ...cliente('c1', T0), idEmpresa: 'outra-empresa' }));
    expect(r.resultados[0]).toMatchObject({ situacao: 'rejeitada', codigo: 'OUTRA_EMPRESA', retentavel: false });
  });

  it('RN07: o técnico não envia proposta em elaboração; o gestor pode reabrir pela web', () => {
    const s = comProposta();
    const tecnico = push(s, ANA, operacao('Proposta', proposta('p2', 'i1', T1, { status_proposta: 'Em elaboração' })));
    expect(tecnico.resultados[0]).toMatchObject({ situacao: 'rejeitada', codigo: 'RN07' });
    const gestora = push(s, CARLA, operacao('Proposta', proposta('p1', 'i1', T1, { status_proposta: 'Reaberta' }, GESTORA_CARLA), T0));
    expect(gestora.resultados[0]).toMatchObject({ situacao: 'aplicada', conflito: false });
  });

  it('dados quebrados: recusa definitiva, sem derrubar o resto do lote', () => {
    const r = push(servidor(), ANA, operacao('Cliente', { ...cliente('c1', 'quando?') }), operacao('Cliente', cliente('c2', T0)));
    expect(r.resultados.map((x) => x.situacao)).toEqual(['rejeitada', 'aplicada']);
    expect(r.resultados[0]).toMatchObject({ codigo: 'DADOS_INVALIDOS', retentavel: false });
  });

  it('reenvio do mesmo registro não duplica nem gera auditoria (idempotência pelo UUID)', () => {
    const s = comProposta();
    const r = push(s, ANA, operacao('Proposta', proposta('p1', 'i1', T0)));
    expect(r.resultados[0]).toMatchObject({ situacao: 'aplicada', conflito: false });
    expect(s.listar('Proposta')).toHaveLength(1);
    expect(s.logAuditoria).toEqual([]);
  });
});

describe('servidor de referência — conflito, auditoria e avisos', () => {
  it('versão mais recente sobrescreve: auditoria, e o aviso chega a quem perdeu no próximo pull (uma vez só)', () => {
    const s = comProposta();
    push(s, ANA, operacao('Proposta', proposta('p1', 'i1', T1, { valor_total: 22000 }), T0));
    const r = push(s, BRUNO, operacao('Proposta', proposta('p1', 'i1', T2, { valor_total: 24500 }, TECNICO_BRUNO), T0));
    expect(r.resultados[0]).toMatchObject({ situacao: 'aplicada', conflito: true });
    expect(s.obter('Proposta', 'p1')?.dados.valor_total).toBe(24500);
    expect(s.logAuditoria).toHaveLength(1);
    expect(s.logAuditoria[0]).toMatchObject({ campo: 'valor_total', valorAnterior: '22000', valorNovo: '24500', idUsuario: TECNICO_BRUNO });

    const pullDaAna = s.pull(ANA, { cursor: null });
    expect(pullDaAna.avisos).toHaveLength(1);
    expect(pullDaAna.avisos[0]?.sobrescritoPor).toBe(TECNICO_BRUNO);
    expect(s.pull(ANA, { cursor: pullDaAna.cursor }).avisos).toEqual([]);
    expect(s.pull(BRUNO, { cursor: null }).avisos).toEqual([]);
  });

  it('versão mais antiga é descartada: a resposta traz a versão do servidor e o motivo', () => {
    const s = comProposta();
    push(s, BRUNO, operacao('Proposta', proposta('p1', 'i1', T2, { valor_total: 24500 }, TECNICO_BRUNO), T0));
    const r = push(s, ANA, operacao('Proposta', proposta('p1', 'i1', T1, { valor_total: 22000 }), T0));
    expect(r.resultados[0]).toMatchObject({ situacao: 'descartada' });
    if (r.resultados[0]?.situacao !== 'descartada') throw new Error('esperava descartada');
    expect(r.resultados[0].versaoServidor.dados.valor_total).toBe(24500);
    expect(r.resultados[0].mensagem).toContain('não foi aplicada');
    expect(s.logAuditoria[0]).toMatchObject({ valorAnterior: '22000', valorNovo: '24500', origem: 'API' });
    expect(s.pull(ANA, { cursor: null }).avisos).toEqual([]); // a Ana já soube pela resposta do push
  });
});

describe('servidor de referência — reenvio quando a resposta se perde', () => {
  it('nova edição no mesmo aparelho depois de uma resposta perdida não é conflito; vinda de outro aparelho, é', () => {
    const s = comProposta();
    // A Ana edita e envia; o servidor grava, mas a resposta se perde. Ela edita de novo antes do
    // reenvio, e a fila manda a versão nova com a mesma versão-base de antes (T0).
    push(s, ANA, operacao('Proposta', proposta('p1', 'i1', T1, { valor_total: 22000 }), T0));
    const r = push(s, ANA, operacao('Proposta', proposta('p1', 'i1', T2, { valor_total: 23000 }), T0));
    expect(r.resultados[0]).toMatchObject({ situacao: 'aplicada', conflito: false });
    expect(s.obter('Proposta', 'p1')?.dados.valor_total).toBe(23000);
    expect(s.logAuditoria).toEqual([]);
    expect(s.pull(ANA, { cursor: null }).avisos).toEqual([]);

    // A mesma versão-base, vinda do celular do Bruno, é edição concorrente.
    const doBruno = push(s, BRUNO, operacao('Proposta', proposta('p1', 'i1', '2026-10-18T12:15:00.000Z', { valor_total: 24500 }, TECNICO_BRUNO), T0));
    expect(doBruno.resultados[0]).toMatchObject({ situacao: 'aplicada', conflito: true });
  });

  it('reenvio de uma alteração descartada: mesma resposta, sem repetir o log de auditoria', () => {
    const s = comProposta();
    push(s, BRUNO, operacao('Proposta', proposta('p1', 'i1', T2, { valor_total: 24500 }, TECNICO_BRUNO), T0));
    const daAna = operacao('Proposta', proposta('p1', 'i1', T1, { valor_total: 22000 }), T0);
    const primeira = push(s, ANA, daAna);
    const segunda = push(s, ANA, daAna); // a primeira resposta se perdeu
    expect(primeira.resultados[0]?.situacao).toBe('descartada');
    expect(segunda.resultados).toEqual(primeira.resultados);
    expect(s.logAuditoria).toHaveLength(1);
  });

  it('reenvio de uma versão já gravada e alterada depois em outro aparelho: recebe a versão atual, sem nada novo no log', () => {
    const s = comProposta();
    const daAna = operacao('Proposta', proposta('p1', 'i1', T1, { valor_total: 22000 }), T0);
    push(s, ANA, daAna); // gravada, mas a resposta se perde
    // O Bruno baixa a versão da Ana e edita em cima dela.
    push(s, BRUNO, operacao('Proposta', proposta('p1', 'i1', T2, { valor_total: 24500 }, TECNICO_BRUNO), T1));
    const reenvio = push(s, ANA, daAna);
    expect(reenvio.resultados[0]).toMatchObject({ situacao: 'descartada', versaoServidor: { updatedBy: TECNICO_BRUNO } });
    expect(reenvio.resultados[0]).toMatchObject({ mensagem: expect.stringContaining('já tinha chegado ao servidor') });
    expect(s.obter('Proposta', 'p1')?.dados.valor_total).toBe(24500);
    expect(s.logAuditoria).toEqual([]);
  });
});

describe('servidor de referência — pull e log de sincronização', () => {
  it('o pull devolve só o que mudou desde o último cursor', () => {
    const s = comProposta();
    const primeiro = s.pull(ANA, { cursor: null });
    expect(primeiro.registros.map((r) => r.entidade)).toEqual(['Cliente', 'Instalacao', 'Proposta']);
    expect(s.pull(ANA, { cursor: primeiro.cursor }).registros).toEqual([]);
    push(s, ANA, operacao('Cliente', cliente('c1', T1, 'Maria S. Souza'), T0));
    expect(s.pull(ANA, { cursor: primeiro.cursor }).registros.map((r) => r.versao.dados.nome)).toEqual(['Maria S. Souza']);
  });

  it('não entrega registros de outra empresa', () => {
    const s = comProposta();
    expect(s.pull({ ...ANA, idEmpresa: 'outra-empresa' }, { cursor: null }).registros).toEqual([]);
  });

  it('cada push e cada pull ficam no log de sincronização (RNF11)', () => {
    const s = comProposta();
    s.pull(ANA, { cursor: null, idDispositivo: 'celular-ana' });
    expect(s.logSincronizacao.map((l) => [l.tipo, l.status, l.qtdRegistros, l.idDispositivo])).toEqual([
      ['Push', 'Sucesso', 3, 'celular-ana'],
      ['Pull', 'Sucesso', 3, 'celular-ana'],
    ]);
  });
});
