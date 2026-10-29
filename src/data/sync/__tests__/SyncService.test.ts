/**
 * SCRUM-18 / SCRUM-405 — Testes do SyncService.
 * Rede e API mockadas; fila e lock sobre SQLite real em memória.
 */

import { StatusProposta } from '@/domain/proposta/StatusProposta';
import { StatusSync } from '@/domain/proposta/StatusSync';
import {
  EstadoPropostaSync,
  MOTIVOS_BLOQUEIO_SYNC,
} from '@/domain/proposta/podeSincronizar';
import {
  aplicarMigracoes,
  criarSqliteEmMemoria,
  SqliteEmMemoria,
} from '../../database/testing/sqliteEmMemoria';
import { MIGRACOES_SPRINT_3 } from '../../database/migrations';
import { ErroEnvioSync } from '../ErroEnvioSync';
import { criarMonitorRede, EstadoRede, FonteEstadoRede } from '../networkMonitor';
import { FilaSyncSqlite } from '../syncQueue';
import { SyncLockSqlite } from '../syncLock';
import { ApiSync, FontePropostasSync, SyncService } from '../SyncService';

interface Payload {
  idProposta: string;
}

const GERADA: EstadoPropostaSync = {
  status: StatusProposta.Gerada,
  dimensionamentoConcluido: true,
  precificacaoConcluida: true,
  pdfGerado: true,
};

/** Fonte de rede controlável, com a mesma forma do NetInfo. */
function criarRedeFake(inicial: boolean) {
  let estado: EstadoRede = { isConnected: inicial, isInternetReachable: inicial };
  const ouvintes = new Set<(e: EstadoRede) => void>();
  const fonte: FonteEstadoRede = {
    fetch: async () => estado,
    addEventListener(listener) {
      ouvintes.add(listener);
      listener(estado);
      return () => ouvintes.delete(listener);
    },
  };
  return {
    fonte,
    definir(online: boolean) {
      estado = { isConnected: online, isInternetReachable: online };
      ouvintes.forEach((l) => l(estado));
    },
  };
}

describe('SyncService', () => {
  let db: SqliteEmMemoria;
  let fila: FilaSyncSqlite;
  let agora: number;
  let estados: Map<string, EstadoPropostaSync>;
  let rede: ReturnType<typeof criarRedeFake>;
  let enviar: jest.Mock<Promise<void>, [Payload, string]>;
  let esperar: jest.Mock<Promise<void>, [number]>;

  function criarServico(opcoes: { idInstancia?: string } = {}) {
    const propostas: FontePropostasSync<Payload> = {
      obterEstado: async (id) => estados.get(id),
      montarPayload: async (id) => ({ idProposta: id }),
    };
    const api: ApiSync<Payload> = { enviarProposta: enviar };
    return new SyncService<Payload>({
      fila,
      lock: new SyncLockSqlite(db),
      propostas,
      api,
      rede: criarMonitorRede(rede.fonte),
      agora: () => agora,
      esperar,
      idInstancia: opcoes.idInstancia ?? 'teste',
    });
  }

  beforeEach(async () => {
    db = criarSqliteEmMemoria();
    await aplicarMigracoes(db, MIGRACOES_SPRINT_3);
    fila = new FilaSyncSqlite(db);
    agora = 1_000_000;
    estados = new Map([['p1', GERADA]]);
    rede = criarRedeFake(true);
    enviar = jest.fn<Promise<void>, [Payload, string]>(async () => undefined);
    esperar = jest.fn<Promise<void>, [number]>(async () => undefined);
  });

  afterEach(() => db.fechar());

  describe('enfileirar (integração com SCRUM-405)', () => {
    it('bloqueia proposta que não está "Gerada" e não a coloca na fila', async () => {
      estados.set('p2', { ...GERADA, status: StatusProposta.Precificada, pdfGerado: false });
      const r = await criarServico().enfileirar('p2');

      expect(r).toEqual({
        enfileirada: false,
        motivos: [
          MOTIVOS_BLOQUEIO_SYNC.statusNaoGerada(StatusProposta.Precificada),
          MOTIVOS_BLOQUEIO_SYNC.pdfPendente,
        ],
      });
      expect(await fila.obter('p2')).toBeUndefined();
    });

    it('bloqueia proposta inexistente', async () => {
      const r = await criarServico().enfileirar('nao-existe');
      expect(r.enfileirada).toBe(false);
    });

    it('enfileira proposta Gerada como pendente, sem duplicar', async () => {
      const servico = criarServico();
      expect(await servico.enfileirar('p1')).toEqual({ enfileirada: true, situacao: 'enfileirada' });
      expect(await servico.enfileirar('p1')).toEqual({ enfileirada: true, situacao: 'ja-na-fila' });
      expect((await fila.obter('p1'))?.statusSync).toBe(StatusSync.Pendente);
    });
  });

  describe('sincronizarPendentes', () => {
    it('sem rede: não executa e mantém a proposta pendente', async () => {
      rede = criarRedeFake(false);
      const servico = criarServico();
      await servico.enfileirar('p1');

      const r = await servico.sincronizarPendentes();

      expect(r.executada).toBe(false);
      expect(r.motivoNaoExecucao).toBe('sem-rede');
      expect(enviar).not.toHaveBeenCalled();
      expect((await fila.obter('p1'))?.statusSync).toBe(StatusSync.Pendente);
    });

    it('rede volta: envia automaticamente as pendentes, sem ação manual', async () => {
      rede = criarRedeFake(false);
      const servico = criarServico();
      await servico.enfileirar('p1');
      const execucoes: Array<Promise<unknown>> = [];

      const parar = criarMonitorRede(rede.fonte).aoReconectar(() => {
        execucoes.push(servico.sincronizarPendentes());
      });
      expect(execucoes).toHaveLength(0);

      rede.definir(true);
      await Promise.all(execucoes);
      parar();

      expect(execucoes).toHaveLength(1);
      expect(enviar).toHaveBeenCalledWith({ idProposta: 'p1' }, 'p1');
      expect((await fila.obter('p1'))?.statusSync).toBe(StatusSync.Sincronizada);
    });

    it('falha transitória: faz retry com backoff exponencial e conclui', async () => {
      enviar
        .mockRejectedValueOnce(new ErroEnvioSync('HTTP 503', true, 503))
        .mockRejectedValueOnce(new Error('Network request failed'));
      const servico = criarServico();
      await servico.enfileirar('p1');

      const r = await servico.sincronizarPendentes();

      expect(enviar).toHaveBeenCalledTimes(3);
      // Mesma chave de idempotência em todas as tentativas
      expect(enviar.mock.calls.map((c) => c[1])).toEqual(['p1', 'p1', 'p1']);
      expect(esperar.mock.calls.map((c) => c[0])).toEqual([2_000, 4_000]);
      expect(r.enviadas).toEqual(['p1']);
      expect((await fila.obter('p1'))?.statusSync).toBe(StatusSync.Sincronizada);
    });

    it('falha persistente: marca erro e reagenda com backoff entre execuções', async () => {
      enviar.mockRejectedValue(new ErroEnvioSync('HTTP 503', true, 503));
      const servico = criarServico();
      await servico.enfileirar('p1');

      const r1 = await servico.sincronizarPendentes();
      expect(r1.falhas).toEqual(['p1']);
      expect(await fila.obter('p1')).toMatchObject({
        statusSync: StatusSync.Erro,
        tentativas: 1,
        proximoEnvioEm: agora + 60_000,
        ultimoErro: 'HTTP 503',
      });

      // Antes do horário agendado, não reenvia
      enviar.mockClear();
      agora += 30_000;
      await servico.sincronizarPendentes();
      expect(enviar).not.toHaveBeenCalled();

      // Depois do horário, reenvia; o próximo atraso dobra
      agora += 30_000;
      await servico.sincronizarPendentes();
      expect(enviar).toHaveBeenCalled();
      expect(await fila.obter('p1')).toMatchObject({
        tentativas: 2,
        proximoEnvioEm: agora + 120_000,
      });
    });

    it('para de reenviar automaticamente ao atingir o limite de tentativas', async () => {
      enviar.mockRejectedValue(new ErroEnvioSync('HTTP 503', true, 503));
      const servico = criarServico();
      await servico.enfileirar('p1');
      await fila.marcarErro('p1', { tentativas: 9, proximoEnvioEm: agora, mensagem: 'x' }, agora);

      await servico.sincronizarPendentes();

      expect(await fila.obter('p1')).toMatchObject({
        statusSync: StatusSync.Erro,
        tentativas: 10,
        proximoEnvioEm: null,
      });
    });

    it('erro definitivo (HTTP 400): não faz retry', async () => {
      enviar.mockRejectedValue(new ErroEnvioSync('HTTP 400', false, 400));
      const servico = criarServico();
      await servico.enfileirar('p1');

      await servico.sincronizarPendentes();

      expect(enviar).toHaveBeenCalledTimes(1);
      expect(esperar).not.toHaveBeenCalled();
      expect(await fila.obter('p1')).toMatchObject({
        statusSync: StatusSync.Erro,
        proximoEnvioEm: null,
      });
    });

    it('rede cai durante o retry: devolve para pendente sem contar tentativa', async () => {
      enviar.mockImplementation(async () => {
        rede.definir(false);
        throw new Error('Network request failed');
      });
      const servico = criarServico();
      await servico.enfileirar('p1');

      const r = await servico.sincronizarPendentes();

      expect(r.interrompidaPorRede).toBe(true);
      expect(enviar).toHaveBeenCalledTimes(1);
      expect(await fila.obter('p1')).toMatchObject({
        statusSync: StatusSync.Pendente,
        tentativas: 0,
      });
    });

    it('revalida a RN07 no envio e bloqueia proposta que deixou de ser elegível', async () => {
      const servico = criarServico();
      await servico.enfileirar('p1');
      estados.set('p1', { ...GERADA, pdfGerado: false });

      const r = await servico.sincronizarPendentes();

      expect(r.bloqueadas).toEqual(['p1']);
      expect(enviar).not.toHaveBeenCalled();
      expect(await fila.obter('p1')).toMatchObject({
        statusSync: StatusSync.Erro,
        proximoEnvioEm: null,
        ultimoErro: MOTIVOS_BLOQUEIO_SYNC.pdfPendente,
      });
    });

    it('não reenvia proposta já sincronizada (idempotência local)', async () => {
      const servico = criarServico();
      await servico.enfileirar('p1');
      await servico.sincronizarPendentes();

      expect(await servico.enfileirar('p1')).toEqual({ enfileirada: true, situacao: 'ja-na-fila' });
      await servico.sincronizarPendentes();

      expect(enviar).toHaveBeenCalledTimes(1);
    });

    it('recupera item preso em "sincronizando" (app encerrado no meio do envio)', async () => {
      const servico = criarServico();
      await servico.enfileirar('p1');
      await fila.marcarSincronizando('p1', agora);

      await servico.sincronizarPendentes();

      expect((await fila.obter('p1'))?.statusSync).toBe(StatusSync.Sincronizada);
    });
  });

  describe('proteção contra execuções concorrentes', () => {
    it('chamadas simultâneas no mesmo runtime compartilham a execução', async () => {
      const servico = criarServico();
      await servico.enfileirar('p1');

      const [a, b] = await Promise.all([
        servico.sincronizarPendentes(),
        servico.sincronizarPendentes(),
      ]);

      expect(a).toBe(b);
      expect(enviar).toHaveBeenCalledTimes(1);
    });

    it('não executa enquanto outro runtime segura o lock', async () => {
      const outro = new SyncLockSqlite(db);
      await outro.adquirir('background', agora, 60_000);
      const servico = criarServico();
      await servico.enfileirar('p1');

      const r = await servico.sincronizarPendentes();

      expect(r.motivoNaoExecucao).toBe('lock-ocupado');
      expect(enviar).not.toHaveBeenCalled();
    });

    it('assume o lock quando ele expira (dono anterior morreu)', async () => {
      const outro = new SyncLockSqlite(db);
      await outro.adquirir('background', agora, 60_000);
      const servico = criarServico();
      await servico.enfileirar('p1');

      agora += 60_000;
      const r = await servico.sincronizarPendentes();

      expect(r.executada).toBe(true);
      expect(r.enviadas).toEqual(['p1']);
    });

    it('libera o lock ao final, mesmo após falhas', async () => {
      enviar.mockRejectedValue(new ErroEnvioSync('HTTP 503', true, 503));
      const servico = criarServico();
      await servico.enfileirar('p1');
      await servico.sincronizarPendentes();

      expect(await new SyncLockSqlite(db).adquirir('outro', agora, 1_000)).toBe(true);
    });
  });
});
