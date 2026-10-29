/**
 * SCRUM-17 — Testes do fallback de HSP (tempo real → contingência local).
 */

import {
  FonteHspTempoReal,
  HspIndisponivelError,
  LocalizacaoHsp,
} from '@/domain/repositories/HspRepository';
import {
  aplicarMigracoes,
  criarSqliteEmMemoria,
  SqliteEmMemoria,
} from '../../database/testing/sqliteEmMemoria';
import { MIGRACOES_SPRINT_3 } from '../../database/migrations';
import { carregarSeedHsp } from '../../seeds/carregarSeedHsp';
import { HspRepositorySqlite } from '../HspRepositorySqlite';

const SAO_PAULO: LocalizacaoHsp = { codigoIbge: '3550308', cidade: 'São Paulo', uf: 'SP' };

function fonte(impl: FonteHspTempoReal['buscarHsp']): FonteHspTempoReal {
  return { buscarHsp: jest.fn(impl) };
}

describe('HspRepositorySqlite.resolverHsp', () => {
  let db: SqliteEmMemoria;

  beforeEach(async () => {
    db = criarSqliteEmMemoria();
    await aplicarMigracoes(db, MIGRACOES_SPRINT_3);
    await carregarSeedHsp(db, {
      versao: 1,
      registros: [
        { abrangencia: 'cidade', codigoIbge: '3550308', cidade: 'São Paulo', uf: 'SP', hspMedioAnual: 4.5, fonte: 'seed-cidade', dadoDeExemplo: true },
        { abrangencia: 'uf', uf: 'SP', hspMedioAnual: 4.6, hspMensal: [5, 5, 5, 4, 4, 4, 4, 4, 5, 5, 5, 5], fonte: 'seed-uf', dadoDeExemplo: false },
      ],
    });
  });

  afterEach(() => db.fechar());

  it('usa o dado em tempo real quando disponível', async () => {
    const repo = new HspRepositorySqlite({
      db,
      fonteTempoReal: fonte(async () => ({ hspMedioAnual: 4.9, fonte: 'api' })),
    });

    await expect(repo.resolverHsp(SAO_PAULO)).resolves.toEqual({
      hspMedioAnual: 4.9,
      fonte: 'api',
      origem: 'tempo-real',
      dadoDeExemplo: false,
    });
  });

  it('cai na contingência quando a fonte lança erro', async () => {
    const repo = new HspRepositorySqlite({
      db,
      fonteTempoReal: fonte(async () => {
        throw new Error('HTTP 500');
      }),
    });

    const r = await repo.resolverHsp(SAO_PAULO);
    expect(r).toMatchObject({
      hspMedioAnual: 4.5,
      origem: 'contingencia',
      motivoFallback: 'erro',
      abrangencia: 'cidade',
      dadoDeExemplo: true,
    });
  });

  it('cai na contingência sem chamar a fonte quando está offline', async () => {
    const f = fonte(async () => ({ hspMedioAnual: 4.9, fonte: 'api' }));
    const repo = new HspRepositorySqlite({
      db,
      fonteTempoReal: f,
      estaOnline: async () => false,
    });

    const r = await repo.resolverHsp(SAO_PAULO);
    expect(r.origem).toBe('contingencia');
    expect(r.motivoFallback).toBe('sem-rede');
    expect(f.buscarHsp).not.toHaveBeenCalled();
  });

  it('cai na contingência no timeout e aborta a requisição', async () => {
    jest.useFakeTimers();
    let sinal: AbortSignal | undefined;
    const repo = new HspRepositorySqlite({
      db,
      timeoutMs: 1000,
      fonteTempoReal: fonte((_local, signal) => {
        sinal = signal;
        return new Promise(() => undefined); // nunca responde
      }),
    });

    const promessa = repo.resolverHsp(SAO_PAULO);
    await jest.advanceTimersByTimeAsync(1000);
    const r = await promessa;
    jest.useRealTimers();

    expect(r.origem).toBe('contingencia');
    expect(r.motivoFallback).toBe('timeout');
    expect(sinal?.aborted).toBe(true);
  });

  it('trata resposta inválida da fonte como ausência de dado', async () => {
    const repo = new HspRepositorySqlite({
      db,
      fonteTempoReal: fonte(async () => ({ hspMedioAnual: Number.NaN, fonte: 'api' })),
    });

    const r = await repo.resolverHsp(SAO_PAULO);
    expect(r.origem).toBe('contingencia');
    expect(r.motivoFallback).toBe('sem-dado');
  });

  it('encontra a cidade pelo nome normalizado quando não há código IBGE', async () => {
    const repo = new HspRepositorySqlite({
      db,
      estaOnline: async () => false,
      fonteTempoReal: fonte(async () => ({ hspMedioAnual: 1, fonte: 'api' })),
    });

    const r = await repo.resolverHsp({ cidade: '  SAO   paulo ', uf: 'sp' });
    expect(r.abrangencia).toBe('cidade');
    expect(r.hspMedioAnual).toBe(4.5);
  });

  it('usa a média da UF quando a cidade não está na base', async () => {
    const repo = new HspRepositorySqlite({
      db,
      estaOnline: async () => false,
      fonteTempoReal: fonte(async () => ({ hspMedioAnual: 1, fonte: 'api' })),
    });

    const r = await repo.resolverHsp({ codigoIbge: '3509502', cidade: 'Campinas', uf: 'SP' });
    expect(r).toMatchObject({
      abrangencia: 'uf',
      hspMedioAnual: 4.6,
      hspMensal: [5, 5, 5, 4, 4, 4, 4, 4, 5, 5, 5, 5],
      fonte: 'seed-uf',
      dadoDeExemplo: false,
    });
  });

  it('lança HspIndisponivelError quando não há tempo real nem contingência', async () => {
    const repo = new HspRepositorySqlite({
      db,
      estaOnline: async () => false,
      fonteTempoReal: fonte(async () => ({ hspMedioAnual: 1, fonte: 'api' })),
    });

    await expect(
      repo.resolverHsp({ cidade: 'Recife', uf: 'PE' }),
    ).rejects.toBeInstanceOf(HspIndisponivelError);
  });
});
