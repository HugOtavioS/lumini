/**
 * SCRUM-86 — testes de integração do fluxo completo:
 * propostas offline → reconexão → sincronização automática → dados corretos
 * no backend, incluindo o conflito do SCRUM-83.
 *
 * Cada aparelho tem um SQLite de verdade, em arquivo; a rede cai e volta; o
 * backend é o servidor de referência (as regras que a API NestJS vai seguir).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntidadeSincronizavel } from './contrato';
import { ServidorSincronizacaoMemoria } from './servidor/servidorReferencia';
import { AparelhoSimulado, Rede } from './testes/ambiente';
import { EMPRESA, TECNICO_ANA, TECNICO_BRUNO } from './testes/registros';
import { criarPastaTemporaria, type PastaTemporaria } from './testes/sqlite';

const ITENS = [
  { id_item: 'item-1', id_equipamento: 'modulo-canadian-550', quantidade: 8, preco_unitario: 629.94 },
  { id_item: 'item-2', id_equipamento: 'inversor-growatt-5k', quantidade: 1, preco_unitario: 4513.75 },
];

let pasta: PastaTemporaria;
let rede: Rede;
let servidor: ServidorSincronizacaoMemoria;
let horaServidor: number;
const abertos: AparelhoSimulado[] = [];

beforeEach(() => {
  pasta = criarPastaTemporaria();
  rede = new Rede();
  horaServidor = Date.parse('2026-10-18T15:00:00.000Z');
  let n = 0;
  servidor = new ServidorSincronizacaoMemoria({ relogio: () => horaServidor, gerarId: () => `srv-${(n += 1)}` });
});

afterEach(() => {
  vi.useRealTimers();
  for (const aparelho of abertos.splice(0)) {
    try {
      aparelho.fechar();
    } catch {
      // já fechado no teste
    }
  }
  pasta.apagar();
});

async function aparelho(nome: string, idUsuario: string): Promise<AparelhoSimulado> {
  const a = new AparelhoSimulado(nome, { idUsuario, idEmpresa: EMPRESA, papel: 'Tecnico' }, pasta.arquivo(`${nome}.db`), servidor, rede);
  await a.abrir();
  abertos.push(a);
  return a;
}

/** O orçamento completo feito em campo: cliente, instalação, medição, simulação e proposta gerada. */
async function orcamentoCompleto(a: AparelhoSimulado, em: string): Promise<Record<string, Record<string, unknown>>> {
  const dados: Record<string, Record<string, unknown>> = {
    Cliente: { id_cliente: 'cli-1', nome: 'Maria Souza', telefone: '(12) 99999-0000' },
    Instalacao: { id_instalacao: 'ins-1', id_cliente: 'cli-1', cidade: 'Taubaté', estado: 'SP', consumo_medio_kwh: 500 },
    Medicao: { id_medicao: 'med-1', id_instalacao: 'ins-1', area_m2: 41, inclinacao_graus: 20, orientacao: 'N', calibrada: false },
    SimulacaoSombreamento: { id_simulacao: 'sim-1', id_medicao: 'med-1', media_anual_perc: 3.6 },
    Proposta: { id_proposta: 'pro-1', id_instalacao: 'ins-1', status_proposta: 'Gerada', potencia_kwp: 4.4, valor_total: 21500, itens: ITENS },
  };
  const ids: Record<string, string> = { Cliente: 'cli-1', Instalacao: 'ins-1', Medicao: 'med-1', SimulacaoSombreamento: 'sim-1', Proposta: 'pro-1' };
  for (const entidade of Object.keys(dados) as EntidadeSincronizavel[]) {
    await a.salvar(entidade, ids[entidade]!, dados[entidade]!, em);
  }
  return dados;
}

describe('SCRUM-86 — offline → reconexão → sincronização automática', () => {
  it('orçamento feito sem internet sobe sozinho quando a conexão volta, e o backend fica com os dados certos', async () => {
    const ana = await aparelho('ana', TECNICO_ANA);
    ana.desconectar(); // em campo, sem sinal

    const dados = await orcamentoCompleto(ana, '2026-10-18T14:00:00.000Z');
    expect((await ana.fila.resumo()).pendentes).toBe(5);
    expect((await ana.registro('Proposta', 'pro-1'))?.syncStatus).toBe('Pendente');

    // Sem conexão a fila nem tenta, e o técnico pode fechar o app.
    expect((await ana.fila.processar()).motivo).toBe('offline');
    expect(rede.pushesRecebidos).toBe(0);
    ana.fechar();

    // Mais tarde, o app é aberto de novo, ainda sem sinal: a fila continua lá.
    await ana.abrir();
    ana.desconectar();
    expect((await ana.fila.listar()).map((i) => i.entidade)).toEqual(['Cliente', 'Instalacao', 'Medicao', 'SimulacaoSombreamento', 'Proposta']);

    // A conexão volta: o envio acontece sozinho, sem o técnico fazer nada.
    const rodada = await ana.conectar();
    expect(rodada).toMatchObject({ motivo: 'ok', aplicadas: 5, rejeitadas: 0 });

    // No backend, cada registro chegou com exatamente os dados do aparelho.
    for (const [entidade, esperado] of Object.entries(dados) as [EntidadeSincronizavel, Record<string, unknown>][]) {
      const noServidor = servidor.listar(entidade);
      expect(noServidor).toHaveLength(1);
      expect(noServidor[0]?.dados).toEqual(esperado);
      expect(noServidor[0]).toMatchObject({ idEmpresa: EMPRESA, updatedBy: TECNICO_ANA, updatedAt: '2026-10-18T14:00:00.000Z' });
    }
    // No aparelho, tudo "Sincronizado" e a fila vazia.
    expect(await ana.fila.listar()).toEqual([]);
    for (const [entidade, id] of [['Cliente', 'cli-1'], ['Proposta', 'pro-1']] as const) {
      expect((await ana.registro(entidade, id))?.syncStatus).toBe('Sincronizado');
    }
    // RNF11: a tentativa ficou no log do aparelho e no do servidor.
    const log = await ana.banco.banco.consultar<Record<string, unknown>>('SELECT tipo, status, qtd_registros FROM log_sincronizacao');
    expect(log).toEqual([{ tipo: 'Push', status: 'Sucesso', qtd_registros: 5 }]);
    expect(servidor.logSincronizacao.map((l) => [l.tipo, l.status, l.qtdRegistros])).toEqual([['Push', 'Sucesso', 5]]);
  });

  it('sinal fraco: com a API sem responder, tenta de novo com espera crescente e sobe quando ela volta', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-18T15:00:00.000Z') });
    const ana = await aparelho('ana', TECNICO_ANA);
    rede.apiForaDoAr = true;
    await orcamentoCompleto(ana, '2026-10-18T14:00:00.000Z');
    await ana.fila.processar();
    expect((await ana.registro('Proposta', 'pro-1'))?.syncStatus).toBe('Erro'); // RF15, 4a

    const tentativas: number[] = [];
    const contar = async () => {
      const [linha] = await ana.banco.banco.consultar<{ n: number }>("SELECT COUNT(*) AS n FROM log_sincronizacao WHERE status = 'Falha'");
      tentativas.push(Number(linha?.n));
    };
    for (const espera of [2_000, 4_000, 8_000]) {
      await vi.advanceTimersByTimeAsync(espera);
      await contar();
    }
    expect(tentativas).toEqual([2, 3, 4]); // 1ª na hora; depois 2 s, 4 s e 8 s
    expect(servidor.listar('Proposta')).toEqual([]);

    rede.apiForaDoAr = false; // a API volta
    await vi.advanceTimersByTimeAsync(16_000);
    expect(servidor.listar('Proposta')).toHaveLength(1);
    expect((await ana.registro('Proposta', 'pro-1'))?.syncStatus).toBe('Sincronizado');
    expect(await ana.fila.listar()).toEqual([]);
    ana.fila.parar();
  });

  it('se a conexão cai depois de o servidor gravar, o reenvio não duplica nada', async () => {
    const ana = await aparelho('ana', TECNICO_ANA);
    ana.desconectar();
    await orcamentoCompleto(ana, '2026-10-18T14:00:00.000Z');
    rede.perderProximaResposta = true;
    await ana.conectar(); // o servidor grava, mas a resposta se perde
    expect((await ana.fila.resumo()).comErro).toBe(5);

    await ana.fila.retentarAgora(); // reenvia tudo
    expect(rede.pushesRecebidos).toBe(2);
    for (const entidade of ['Cliente', 'Instalacao', 'Medicao', 'SimulacaoSombreamento', 'Proposta'] as const) {
      expect(servidor.listar(entidade)).toHaveLength(1);
    }
    expect(servidor.logAuditoria).toEqual([]);
    expect(await ana.fila.listar()).toEqual([]);
  });

  it('RN07: a proposta em elaboração fica só no aparelho; ao ser gerada, sobe', async () => {
    const ana = await aparelho('ana', TECNICO_ANA);
    await ana.salvar('Cliente', 'cli-1', { id_cliente: 'cli-1', nome: 'Maria Souza' }, '2026-10-18T14:00:00.000Z');
    await ana.salvar('Instalacao', 'ins-1', { id_instalacao: 'ins-1', id_cliente: 'cli-1' }, '2026-10-18T14:00:00.000Z');
    const rascunho = { id_proposta: 'pro-1', id_instalacao: 'ins-1', status_proposta: 'Em elaboração', itens: ITENS };
    expect(await ana.salvar('Proposta', 'pro-1', rascunho, '2026-10-18T14:01:00.000Z')).toBe(false);
    await ana.fila.processar();
    expect(servidor.listar('Proposta')).toEqual([]);

    expect(await ana.salvar('Proposta', 'pro-1', { ...rascunho, status_proposta: 'Gerada' }, '2026-10-18T14:05:00.000Z')).toBe(true);
    await ana.fila.processar();
    expect(servidor.obter('Proposta', 'pro-1')?.dados.status_proposta).toBe('Gerada');
  });

  it('instalação ligada a um cliente que não existe segura a proposta; corrigida a instalação, as duas sobem', async () => {
    const ana = await aparelho('ana', TECNICO_ANA);
    ana.desconectar();
    await ana.salvar('Cliente', 'cli-1', { id_cliente: 'cli-1', nome: 'Maria Souza' }, '2026-10-18T14:00:00.000Z');
    await ana.salvar('Instalacao', 'ins-1', { id_instalacao: 'ins-1', id_cliente: 'cli-errado' }, '2026-10-18T14:00:00.000Z');
    await ana.salvar('Proposta', 'pro-1', { id_proposta: 'pro-1', id_instalacao: 'ins-1', status_proposta: 'Gerada', itens: ITENS }, '2026-10-18T14:01:00.000Z');
    await ana.conectar();
    // A instalação aponta para um cliente que não existe: fica recusada (retentável), e a proposta espera por ela.
    expect(servidor.listar('Instalacao')).toEqual([]);
    expect(servidor.listar('Proposta')).toEqual([]);
    expect((await ana.registro('Proposta', 'pro-1'))?.syncStatus).toBe('Erro');

    await ana.salvar('Instalacao', 'ins-1', { id_instalacao: 'ins-1', id_cliente: 'cli-1' }, '2026-10-18T14:10:00.000Z');
    await ana.fila.retentarAgora();
    expect(servidor.obter('Instalacao', 'ins-1')?.dados.id_cliente).toBe('cli-1');
    expect(servidor.obter('Proposta', 'pro-1')).toBeDefined();
    expect(await ana.fila.listar()).toEqual([]);
  });
});

describe('SCRUM-86 + SCRUM-83 — o mesmo registro editado offline em dois aparelhos', () => {
  /** A proposta já sincronizada e baixada pelos dois técnicos (versão das 14:00). */
  async function cenario() {
    const ana = await aparelho('ana', TECNICO_ANA);
    await orcamentoCompleto(ana, '2026-10-18T14:00:00.000Z');
    await ana.fila.processar();
    const bruno = await aparelho('bruno', TECNICO_BRUNO);
    await bruno.puxar();
    expect((await bruno.registro('Proposta', 'pro-1'))?.syncStatus).toBe('Sincronizado');
    ana.desconectar();
    bruno.desconectar();
    return { ana, bruno };
  }

  const comValor = (valor: number, itens = ITENS) => ({
    id_proposta: 'pro-1',
    id_instalacao: 'ins-1',
    status_proposta: 'Gerada',
    potencia_kwp: 4.4,
    valor_total: valor,
    itens,
  });

  it('vence a edição mais recente, mesmo chegando por último; a sobrescrita vai para o log e quem perdeu é avisado', async () => {
    const { ana, bruno } = await cenario();
    await ana.salvar('Proposta', 'pro-1', comValor(22000), '2026-10-18T14:05:00.000Z');
    const itensDoBruno = [ITENS[0]!, { id_item: 'item-3', id_equipamento: 'inversor-deye-6k', quantidade: 1, preco_unitario: 2180.71 }];
    await bruno.salvar('Proposta', 'pro-1', comValor(24500, itensDoBruno), '2026-10-18T14:10:00.000Z');

    await ana.conectar(); // a Ana sincroniza primeiro: edição normal, sem conflito
    expect(servidor.obter('Proposta', 'pro-1')?.dados.valor_total).toBe(22000);
    expect(servidor.logAuditoria).toEqual([]);

    await bruno.conectar(); // o Bruno sincroniza depois, com a edição mais recente
    expect(bruno.eventos.at(-1)).toMatchObject({ tipo: 'sincronizado', conflito: true });
    const final = servidor.obter('Proposta', 'pro-1');
    expect(final?.dados).toEqual(comValor(24500, itensDoBruno));
    expect(final?.updatedBy).toBe(TECNICO_BRUNO);

    // Cada campo sobrescrito ficou no log de auditoria, com o motivo.
    expect(servidor.logAuditoria.map((l) => [l.entidade, l.campo, l.valorAnterior, l.valorNovo, l.idUsuario])).toEqual([
      ['Proposta', 'valor_total', '22000', '24500', TECNICO_BRUNO],
      ['ItemProposta', '(item removido)', '{"id_equipamento":"inversor-growatt-5k","id_item":"item-2","preco_unitario":4513.75,"quantidade":1}', null, TECNICO_BRUNO],
      ['ItemProposta', '(item incluído)', null, '{"id_equipamento":"inversor-deye-6k","id_item":"item-3","preco_unitario":2180.71,"quantidade":1}', TECNICO_BRUNO],
    ]);
    expect(servidor.logAuditoria.every((l) => l.motivo?.includes('last-write-wins'))).toBe(true);

    // A Ana recebe a versão do Bruno e o aviso no próximo pull; os dois aparelhos ficam iguais ao servidor.
    await ana.puxar();
    expect((await ana.registro('Proposta', 'pro-1'))?.versao).toEqual(final);
    expect((await bruno.registro('Proposta', 'pro-1'))?.versao).toEqual(final);
    expect(ana.mensagens).toEqual([
      'Sua alteração na proposta, feita em 18/10/2026 às 11:05, foi substituída por uma versão mais recente, de 18/10/2026 às 11:10, ' +
        'feita em outro aparelho. Os valores anteriores ficaram no log de auditoria.',
    ]);
  });

  it('a edição mais antiga, chegando por último, é descartada: o aparelho recebe a versão do servidor e o log guarda o que se perdeu', async () => {
    const { ana, bruno } = await cenario();
    await bruno.salvar('Proposta', 'pro-1', comValor(24500), '2026-10-18T14:10:00.000Z');
    await ana.salvar('Proposta', 'pro-1', comValor(22000), '2026-10-18T14:05:00.000Z');

    await bruno.conectar(); // a edição mais recente chega primeiro
    await ana.conectar(); // a mais antiga chega depois e perde

    const final = servidor.obter('Proposta', 'pro-1');
    expect(final?.dados.valor_total).toBe(24500);
    expect(ana.eventos.at(-1)).toMatchObject({ tipo: 'substituido', aindaPendente: false });
    const local = await ana.registro('Proposta', 'pro-1');
    expect(local).toEqual({ entidade: 'Proposta', versao: final, syncStatus: 'Sincronizado' });
    expect(ana.mensagens[0]).toContain('não foi aplicada porque já havia uma versão mais recente no servidor');
    expect(servidor.logAuditoria).toEqual([
      expect.objectContaining({ entidade: 'Proposta', campo: 'valor_total', valorAnterior: '22000', valorNovo: '24500', origem: 'API' }),
    ]);
    expect(await ana.fila.listar()).toEqual([]);
  });

  it('a regra não depende de quem reconecta primeiro: nos dois casos o servidor fica com a edição mais recente', async () => {
    const resultados: unknown[] = [];
    for (const anaPrimeiro of [true, false]) {
      // recomeça o cenário do zero
      for (const a of abertos.splice(0)) a.fechar();
      pasta.apagar();
      pasta = criarPastaTemporaria();
      servidor = new ServidorSincronizacaoMemoria({ relogio: () => horaServidor });
      const { ana, bruno } = await cenario();
      await ana.salvar('Proposta', 'pro-1', comValor(22000), '2026-10-18T14:05:00.000Z');
      await bruno.salvar('Proposta', 'pro-1', comValor(24500), '2026-10-18T14:10:00.000Z');
      const ordem = anaPrimeiro ? [ana, bruno] : [bruno, ana];
      for (const a of ordem) await a.conectar();
      await ana.puxar();
      await bruno.puxar();
      resultados.push([
        servidor.obter('Proposta', 'pro-1')?.dados.valor_total,
        (await ana.registro('Proposta', 'pro-1'))?.versao.dados.valor_total,
        (await bruno.registro('Proposta', 'pro-1'))?.versao.dados.valor_total,
        servidor.logAuditoria.length,
      ]);
    }
    expect(resultados).toEqual([
      [24500, 24500, 24500, 1],
      [24500, 24500, 24500, 1],
    ]);
  });
});
