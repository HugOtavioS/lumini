import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequisicaoPush, RespostaPush } from '../contrato';
import { ErroValidacao } from '../erros';
import type { BancoSql } from '../sql';
import { abrirBanco, criarPastaTemporaria, type BancoDeTeste, type PastaTemporaria } from '../testes/sqlite';
import { TECNICO_ANA, aceitarTudo, capturarErro, clonar, cliente, instalacao, proposta } from '../testes/registros';
import { ErroDeRede, ErroHttp } from '../transporte';
import { FilaSincronizacao, podeEntrarNaFila, type EventoFila, type OpcoesFila, type TentativaSync } from './fila';

const T0 = '2026-10-18T09:00:00.000Z';
const T1 = '2026-10-18T09:05:00.000Z';
const T2 = '2026-10-18T09:10:00.000Z';

type Comportamento = (req: RequisicaoPush) => RespostaPush | Promise<RespostaPush>;

async function montarFila(banco: BancoSql, extra: Partial<OpcoesFila> = {}) {
  const chamadas: RequisicaoPush[] = [];
  const eventos: EventoFila[] = [];
  const tentativas: TentativaSync[] = [];
  let comportamento: Comportamento = (req) => aceitarTudo(req);
  const fila = await FilaSincronizacao.abrir({
    banco,
    idDispositivo: 'aparelho-da-ana',
    idUsuario: TECNICO_ANA,
    transporte: {
      enviar: async (req) => {
        chamadas.push(clonar(req));
        return comportamento(clonar(req));
      },
    },
    esperaAposEnfileirarMs: null,
    aleatorio: () => 1, // sem sorteio: espera cheia, para os testes serem exatos
    aoResultado: (e) => {
      eventos.push(e);
    },
    aoTentar: (t) => {
      tentativas.push(t);
    },
    ...extra,
  });
  return {
    fila,
    chamadas,
    eventos,
    tentativas,
    definir: (c: Comportamento) => {
      comportamento = c;
    },
  };
}

let pasta: PastaTemporaria;
let aberto: BancoDeTeste;

beforeEach(() => {
  pasta = criarPastaTemporaria();
  aberto = abrirBanco(pasta.arquivo('lumini.db'));
});

afterEach(() => {
  vi.useRealTimers();
  try {
    aberto.fechar();
  } catch {
    // já fechado pelo teste
  }
  pasta.apagar();
});

describe('fila persistente — SCRUM-82', () => {
  it('a fila fica no SQLite e continua lá depois de fechar e abrir o app', async () => {
    const { fila } = await montarFila(aberto.banco);
    const c1 = cliente('c1', T0);
    const p1 = proposta('p1', 'i1', T1);
    await fila.enfileirar({ entidade: 'Cliente', versao: c1 });
    await fila.enfileirar({ entidade: 'Proposta', versao: p1 });
    fila.parar();
    aberto.fechar(); // o app foi fechado (ou o sistema matou o processo)

    aberto = abrirBanco(pasta.arquivo('lumini.db'));
    const reaberta = await montarFila(aberto.banco);
    const itens = await reaberta.fila.listar();
    expect(itens.map((i) => i.idOperacao)).toEqual(['Cliente:c1', 'Proposta:p1']);
    expect(itens[1]?.versao).toEqual(p1);
    expect(await reaberta.fila.syncStatusDe('Proposta', 'p1')).toBe('Pendente');

    await reaberta.fila.iniciar();
    expect(reaberta.chamadas).toHaveLength(1);
    expect(await reaberta.fila.listar()).toEqual([]);
  });

  it('as tentativas e a hora da próxima também sobrevivem ao fechamento do app', async () => {
    const { fila, definir } = await montarFila(aberto.banco);
    definir(() => {
      throw new ErroDeRede('sem sinal');
    });
    await fila.enfileirar({ entidade: 'Cliente', versao: cliente('c1', T0) });
    await fila.iniciar();
    fila.parar();
    const antes = await fila.obter('Cliente', 'c1');
    aberto.fechar();

    aberto = abrirBanco(pasta.arquivo('lumini.db'));
    const depois = await (await montarFila(aberto.banco)).fila.obter('Cliente', 'c1');
    expect(depois).toEqual(antes);
    expect(depois?.situacao).toBe('Erro');
    expect(depois?.tentativas).toBe(1);
    expect(depois?.ultimoErro).toBe('sem sinal');
  });

  it('abrir a fila de novo no mesmo banco não duplica nem apaga nada (migração idempotente)', async () => {
    const { fila } = await montarFila(aberto.banco);
    await fila.enfileirar({ entidade: 'Cliente', versao: cliente('c1', T0) });
    const outra = await montarFila(aberto.banco);
    expect(await outra.fila.listar()).toHaveLength(1);
  });

  it('editar de novo um registro pendente troca o conteúdo da mesma linha e mantém a versão-base', async () => {
    const { fila } = await montarFila(aberto.banco);
    await fila.enfileirar({ entidade: 'Proposta', versao: proposta('p1', 'i1', T1), baseUpdatedAt: T0 });
    const editada = proposta('p1', 'i1', T2, { valor_total: 23000 });
    const item = await fila.enfileirar({ entidade: 'Proposta', versao: editada, baseUpdatedAt: T1 });
    expect(await fila.listar()).toHaveLength(1);
    expect(item.versao).toEqual(editada);
    expect(item.revisao).toBe(2);
    expect(item.baseUpdatedAt).toBe(T0); // a base é a de antes da primeira edição offline
  });

  it('RN07: proposta em elaboração ou reaberta não entra na fila; gerada entra', async () => {
    const { fila } = await montarFila(aberto.banco);
    for (const status of ['Em elaboração', 'Reaberta']) {
      const v = proposta('p1', 'i1', T1, { status_proposta: status });
      expect(podeEntrarNaFila({ entidade: 'Proposta', versao: v })).toBe(false);
      await expect(fila.enfileirar({ entidade: 'Proposta', versao: v })).rejects.toThrow(/RN07/);
    }
    expect(await fila.listar()).toEqual([]);
    await fila.enfileirar({ entidade: 'Proposta', versao: proposta('p1', 'i1', T1) });
    expect(await fila.syncStatusDe('Proposta', 'p1')).toBe('Pendente');
  });

  it('recusa registro sem UUID, sem data válida ou com entidade desconhecida', async () => {
    const { fila } = await montarFila(aberto.banco);
    const erro = await capturarErro<ErroValidacao>(
      fila.enfileirar({ entidade: 'Cliente', versao: { ...cliente('', 'ontem'), updatedBy: '' } }),
    );
    expect(erro).toBeInstanceOf(ErroValidacao);
    expect(erro.erros.map((e) => e.campo).sort()).toEqual(['versao.id', 'versao.updatedAt', 'versao.updatedBy']);
    await expect(fila.enfileirar({ entidade: 'Equipamento' as never, versao: cliente('x', T0) })).rejects.toThrow(/Entidade inválida/);
  });

  it('envia em ordem de dependência (cliente → instalação → proposta), mesmo enfileirados fora de ordem', async () => {
    const { fila, chamadas } = await montarFila(aberto.banco);
    await fila.enfileirar({ entidade: 'Proposta', versao: proposta('p1', 'i1', T2) });
    await fila.enfileirar({ entidade: 'Instalacao', versao: instalacao('i1', 'c1', T1) });
    await fila.enfileirar({ entidade: 'Cliente', versao: cliente('c1', T0) });
    await fila.iniciar();
    expect(chamadas[0]?.operacoes.map((o) => o.entidade)).toEqual(['Cliente', 'Instalacao', 'Proposta']);
    expect(chamadas[0]?.idDispositivo).toBe('aparelho-da-ana');
  });

  it('divide a fila em lotes do tamanho configurado', async () => {
    const { fila, chamadas } = await montarFila(aberto.banco, { tamanhoLote: 2 });
    for (let i = 1; i <= 5; i += 1) await fila.enfileirar({ entidade: 'Cliente', versao: cliente(`c${i}`, T0) });
    const r = await fila.iniciar();
    expect(chamadas.map((c) => c.operacoes.length)).toEqual([2, 2, 1]);
    expect(r).toMatchObject({ motivo: 'ok', enviadas: 5, aplicadas: 5 });
  });

  it('sucesso: tira da fila e avisa o app para marcar "Sincronizado"', async () => {
    const { fila, eventos } = await montarFila(aberto.banco);
    const v = cliente('c1', T0);
    await fila.enfileirar({ entidade: 'Cliente', versao: v });
    await fila.iniciar();
    expect(await fila.syncStatusDe('Cliente', 'c1')).toBe('Sincronizado');
    expect(eventos).toEqual([
      { tipo: 'sincronizado', entidade: 'Cliente', idRegistro: 'c1', versaoAceita: v, conflito: false, avisos: [], aindaPendente: false },
    ]);
  });
});

describe('retentativa automática com backoff exponencial — SCRUM-82', () => {
  it('falha de rede: marca "Erro" e tenta de novo sozinha, esperando 2 s, 4 s, 8 s, 16 s', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-18T12:00:00Z') });
    const { fila, definir, eventos } = await montarFila(aberto.banco);
    const horarios: number[] = [];
    let falhas = 0;
    definir((req) => {
      horarios.push(Date.now());
      if (falhas < 4) {
        falhas += 1;
        throw new ErroDeRede('sem sinal');
      }
      return aceitarTudo(req);
    });
    await fila.enfileirar({ entidade: 'Cliente', versao: cliente('c1', T0) });
    await fila.iniciar();
    expect(await fila.syncStatusDe('Cliente', 'c1')).toBe('Erro');
    expect(eventos[0]).toMatchObject({ tipo: 'erro', retentavel: true, tentativas: 1 });

    await vi.advanceTimersByTimeAsync(2_000 + 4_000 + 8_000 + 16_000);
    const intervalos = horarios.slice(1).map((h, i) => h - horarios[i]!);
    expect(intervalos).toEqual([2_000, 4_000, 8_000, 16_000]);
    expect(await fila.syncStatusDe('Cliente', 'c1')).toBe('Sincronizado');
    fila.parar();
  });

  it('não tenta antes da hora: processar() sem forçar respeita a espera', async () => {
    const { fila, chamadas, definir } = await montarFila(aberto.banco);
    definir(() => {
      throw new ErroDeRede('sem sinal');
    });
    await fila.enfileirar({ entidade: 'Cliente', versao: cliente('c1', T0) });
    await fila.iniciar();
    fila.parar();
    const r = await fila.processar();
    expect(r.motivo).toBe('vazia');
    expect(chamadas).toHaveLength(1);
  });

  it('sem conexão não tenta (não gasta tentativa); quando a conexão volta, envia na hora, sem esperar o backoff', async () => {
    let online = false;
    const { fila, chamadas, definir } = await montarFila(aberto.banco, { conectividade: { estaOnline: () => online } });
    await fila.enfileirar({ entidade: 'Cliente', versao: cliente('c1', T0) });
    expect((await fila.iniciar()).motivo).toBe('offline');
    expect(chamadas).toHaveLength(0);
    expect((await fila.obter('Cliente', 'c1'))?.tentativas).toBe(0);

    // Online, mas a API não responde: cinco falhas seguidas → próxima tentativa só daqui a ~32 s.
    online = true;
    definir(() => {
      throw new ErroDeRede('tempo esgotado');
    });
    for (let i = 0; i < 5; i += 1) await fila.processar({ ignorarEspera: true });
    const item = await fila.obter('Cliente', 'c1');
    expect(item?.tentativas).toBe(5);
    expect(item!.proximaTentativaEm - Date.now()).toBeGreaterThan(25_000);

    // A conexão cai e volta: envia na hora.
    definir((req) => aceitarTudo(req));
    expect(await fila.aoMudarConexao(false)).toBeNull();
    const r = await fila.aoMudarConexao(true);
    expect(r?.aplicadas).toBe(1);
    expect(chamadas).toHaveLength(6);
    fila.parar();
  });

  it('uma falha de rede adia o resto da fila junto, em vez de tentar cada item em seguida', async () => {
    const { fila, chamadas, definir } = await montarFila(aberto.banco, { tamanhoLote: 1 });
    definir(() => {
      throw new ErroDeRede('sem sinal');
    });
    await fila.enfileirar({ entidade: 'Cliente', versao: cliente('c1', T0) });
    await fila.enfileirar({ entidade: 'Cliente', versao: cliente('c2', T0) });
    await fila.iniciar();
    fila.parar();
    expect(chamadas).toHaveLength(1); // parou no primeiro lote
    const [c1, c2] = await fila.listar();
    expect(c2?.tentativas).toBe(0); // não foi tentado...
    expect(c2?.proximaTentativaEm).toBe(c1?.proximaTentativaEm); // ...mas espera junto
  });

  it('respeita o Retry-After quando a API pede mais tempo (503)', async () => {
    const { fila, definir } = await montarFila(aberto.banco);
    definir(() => {
      throw new ErroHttp(503, 'Em manutenção', 120_000);
    });
    await fila.enfileirar({ entidade: 'Cliente', versao: cliente('c1', T0) });
    const antes = Date.now();
    await fila.iniciar();
    fila.parar();
    const item = await fila.obter('Cliente', 'c1');
    expect(item!.proximaTentativaEm - antes).toBeGreaterThanOrEqual(120_000);
    expect(item?.retentarAutomaticamente).toBe(true);
  });

  it('API recusa o lote inteiro (HTTP 400): os itens esperam ação do técnico e não são reenviados sozinhos', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-18T12:00:00Z') });
    const { fila, chamadas, definir } = await montarFila(aberto.banco);
    definir(() => {
      throw new ErroHttp(400, 'A API respondeu HTTP 400.');
    });
    await fila.enfileirar({ entidade: 'Cliente', versao: cliente('c1', T0) });
    await fila.iniciar();
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(chamadas).toHaveLength(1);
    const resumo = await fila.resumo();
    expect(resumo).toMatchObject({ total: 1, comErro: 1, aguardandoAcao: 1, falhaPersistente: true, proximaTentativaEm: null });
    fila.parar();
  });

  it('registro recusado (dados inválidos) fica em "Erro"; editar de novo libera o envio', async () => {
    const { fila, chamadas, definir, eventos } = await montarFila(aberto.banco);
    definir((req) => ({
      horaServidor: T2,
      resultados: req.operacoes.map((op) => ({
        idOperacao: op.idOperacao,
        situacao: 'rejeitada' as const,
        codigo: 'DADOS_INVALIDOS' as const,
        mensagem: 'O telefone do cliente é inválido.',
        retentavel: false,
      })),
    }));
    await fila.enfileirar({ entidade: 'Cliente', versao: cliente('c1', T0) });
    await fila.iniciar();
    expect(eventos.at(-1)).toMatchObject({ tipo: 'erro', retentavel: false, mensagem: 'O telefone do cliente é inválido.' });
    expect((await fila.obter('Cliente', 'c1'))?.retentarAutomaticamente).toBe(false);

    definir((req) => aceitarTudo(req));
    const corrigido = await fila.enfileirar({ entidade: 'Cliente', versao: cliente('c1', T1, 'Maria S. Souza') });
    expect(corrigido).toMatchObject({ situacao: 'Pendente', tentativas: 0, retentarAutomaticamente: true });
    await fila.processar();
    expect(chamadas).toHaveLength(2);
    expect(await fila.syncStatusDe('Cliente', 'c1')).toBe('Sincronizado');
    fila.parar();
  });

  it('registro pai ainda não chegou ao servidor: recusa retentável, com backoff', async () => {
    const { fila, definir } = await montarFila(aberto.banco);
    definir((req) => ({
      horaServidor: T2,
      resultados: req.operacoes.map((op) => ({
        idOperacao: op.idOperacao,
        situacao: 'rejeitada' as const,
        codigo: 'DEPENDENCIA_AUSENTE' as const,
        mensagem: 'A instalação i1 ainda não chegou ao servidor.',
        retentavel: true,
      })),
    }));
    await fila.enfileirar({ entidade: 'Proposta', versao: proposta('p1', 'i1', T1) });
    await fila.iniciar();
    fila.parar();
    const item = await fila.obter('Proposta', 'p1');
    expect(item).toMatchObject({ situacao: 'Erro', retentarAutomaticamente: true, tentativas: 1 });
    expect(item!.proximaTentativaEm).toBeGreaterThan(Date.now());
  });

  it('"Forçar sincronização agora" tenta de novo, inclusive o que esperava ação', async () => {
    const { fila, chamadas, definir } = await montarFila(aberto.banco);
    definir(() => {
      throw new ErroHttp(422, 'inválido');
    });
    await fila.enfileirar({ entidade: 'Cliente', versao: cliente('c1', T0) });
    await fila.iniciar();
    definir((req) => aceitarTudo(req));
    const r = await fila.retentarAgora({ entidade: 'Cliente', idRegistro: 'c1' });
    expect(r.aplicadas).toBe(1);
    expect(chamadas).toHaveLength(2);
    fila.parar();
  });
});

describe('situações de borda', () => {
  it('edição feita enquanto o lote estava a caminho não se perde', async () => {
    const { fila, chamadas, definir, eventos } = await montarFila(aberto.banco);
    const enviada = proposta('p1', 'i1', T1);
    const editadaDurante = proposta('p1', 'i1', T2, { valor_total: 22000 });
    definir(async (req) => {
      if (chamadas.length === 1) await fila.enfileirar({ entidade: 'Proposta', versao: editadaDurante });
      return aceitarTudo(req);
    });
    await fila.enfileirar({ entidade: 'Proposta', versao: enviada, baseUpdatedAt: T0 });
    await fila.iniciar();
    expect(eventos[0]).toMatchObject({ tipo: 'sincronizado', aindaPendente: true });
    const item = await fila.obter('Proposta', 'p1');
    expect(item?.versao).toEqual(editadaDurante);
    expect(item?.baseUpdatedAt).toBe(T1); // o servidor agora tem a versão T1, base da edição nova

    await fila.processar();
    expect(chamadas[1]?.operacoes[0]).toMatchObject({ baseUpdatedAt: T1, versao: editadaDurante });
    expect(await fila.syncStatusDe('Proposta', 'p1')).toBe('Sincronizado');
    fila.parar();
  });

  it('conflito perdido: o app recebe a versão do servidor para substituir a local', async () => {
    const { fila, definir, eventos } = await montarFila(aberto.banco);
    const doServidor = proposta('p1', 'i1', T2, { valor_total: 30000 });
    definir((req) => ({
      horaServidor: T2,
      resultados: req.operacoes.map((op) => ({
        idOperacao: op.idOperacao,
        situacao: 'descartada' as const,
        versaoServidor: doServidor,
        mensagem: 'Havia uma versão mais recente no servidor.',
      })),
    }));
    await fila.enfileirar({ entidade: 'Proposta', versao: proposta('p1', 'i1', T1), baseUpdatedAt: T0 });
    await fila.iniciar();
    expect(eventos[0]).toEqual({
      tipo: 'substituido',
      entidade: 'Proposta',
      idRegistro: 'p1',
      versaoServidor: doServidor,
      mensagem: 'Havia uma versão mais recente no servidor.',
      aindaPendente: false,
    });
    expect(await fila.syncStatusDe('Proposta', 'p1')).toBe('Sincronizado');
    fila.parar();
  });

  it('operação sem resposta da API fica para a próxima tentativa', async () => {
    const { fila, definir } = await montarFila(aberto.banco);
    definir(() => ({ horaServidor: T2, resultados: [] }));
    await fila.enfileirar({ entidade: 'Cliente', versao: cliente('c1', T0) });
    const r = await fila.iniciar();
    fila.parar();
    expect(r.rejeitadas).toBe(1);
    expect(await fila.obter('Cliente', 'c1')).toMatchObject({ situacao: 'Erro', retentarAutomaticamente: true });
  });

  it('duas chamadas ao mesmo tempo não mandam o mesmo lote duas vezes', async () => {
    const { fila, chamadas, definir } = await montarFila(aberto.banco);
    let liberar!: () => void;
    definir((req) => new Promise<RespostaPush>((r) => (liberar = () => r(aceitarTudo(req)))));
    await fila.enfileirar({ entidade: 'Cliente', versao: cliente('c1', T0) });
    const primeira = fila.processar();
    const segunda = fila.processar();
    expect(segunda).toBe(primeira); // a segunda pega carona na rodada em andamento
    await new Promise((r) => setTimeout(r, 10));
    liberar();
    await primeira;
    await new Promise((r) => setTimeout(r, 20));
    expect(chamadas).toHaveLength(1);
    fila.parar();
  });

  it('depois de parar() não envia sozinha; iniciar() retoma', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-18T12:00:00Z') });
    const { fila, chamadas } = await montarFila(aberto.banco, { esperaAposEnfileirarMs: 1_500 });
    await fila.iniciar();
    fila.parar();
    await fila.enfileirar({ entidade: 'Cliente', versao: cliente('c1', T0) });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(chamadas).toHaveLength(0);
    await fila.iniciar();
    expect(chamadas).toHaveLength(1);
    fila.parar();
  });

  it('com o envio automático ligado, gravar um registro dispara o push logo depois (RF15)', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-18T12:00:00Z') });
    const { fila, chamadas } = await montarFila(aberto.banco, { esperaAposEnfileirarMs: 1_500 });
    await fila.iniciar();
    await fila.enfileirar({ entidade: 'Cliente', versao: cliente('c1', T0) });
    await fila.enfileirar({ entidade: 'Instalacao', versao: instalacao('i1', 'c1', T0) });
    await vi.advanceTimersByTimeAsync(1_499);
    expect(chamadas).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]?.operacoes).toHaveLength(2); // as duas gravações foram juntas
    fila.parar();
  });

  it('remover() tira da fila um registro que ainda não tinha subido', async () => {
    const { fila } = await montarFila(aberto.banco);
    await fila.enfileirar({ entidade: 'Cliente', versao: cliente('c1', T0) });
    expect(await fila.remover('Cliente', 'c1')).toBe(true);
    expect(await fila.remover('Cliente', 'c1')).toBe(false);
  });

  it('valida as opções da fila', async () => {
    await expect(
      FilaSincronizacao.abrir({ banco: aberto.banco, idDispositivo: '', transporte: { enviar: async (r) => aceitarTudo(r) }, tamanhoLote: 0 }),
    ).rejects.toBeInstanceOf(ErroValidacao);
  });
});

describe('log de sincronização (RNF11)', () => {
  it('cada tentativa grava data/hora, tipo, status e quantidade de registros', async () => {
    const { fila, definir, tentativas } = await montarFila(aberto.banco);
    definir(() => {
      throw new ErroDeRede('sem sinal');
    });
    await fila.enfileirar({ entidade: 'Cliente', versao: cliente('c1', T0) });
    await fila.enfileirar({ entidade: 'Instalacao', versao: instalacao('i1', 'c1', T0) });
    await fila.iniciar();
    definir((req) => aceitarTudo(req));
    await fila.aoMudarConexao(true);
    fila.parar();

    const linhas = await aberto.banco.consultar<Record<string, unknown>>('SELECT * FROM log_sincronizacao ORDER BY data_hora, status');
    expect(linhas).toHaveLength(2);
    expect(linhas.map((l) => [l.tipo, l.status, l.qtd_registros, l.id_usuario, l.id_dispositivo])).toEqual([
      ['Push', 'Falha', 2, TECNICO_ANA, 'aparelho-da-ana'],
      ['Push', 'Sucesso', 2, TECNICO_ANA, 'aparelho-da-ana'],
    ]);
    expect(linhas[0]?.mensagem_erro).toBe('sem sinal');
    expect(tentativas.map((t) => t.status)).toEqual(['Falha', 'Sucesso']);
  });
});
