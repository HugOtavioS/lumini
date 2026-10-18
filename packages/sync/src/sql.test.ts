import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { Trava, adaptarExpoSqlite, adaptarSqliteSincrono, type ValorSql } from './sql';

describe('adaptadores de SQLite', () => {
  it('SQLite síncrono (node:sqlite): executa, consulta e faz transação com rollback', async () => {
    const banco = adaptarSqliteSincrono(new DatabaseSync(':memory:'));
    await banco.executar('CREATE TABLE t (id TEXT PRIMARY KEY, n INTEGER)');
    expect(await banco.executar('INSERT INTO t VALUES (?, ?)', ['a', 1])).toEqual({ alteradas: 1 });
    await expect(
      banco.emTransacao(async () => {
        await banco.executar('INSERT INTO t VALUES (?, ?)', ['b', 2]);
        throw new Error('falhou no meio');
      }),
    ).rejects.toThrow('falhou no meio');
    expect(await banco.consultar('SELECT id FROM t ORDER BY id')).toEqual([{ id: 'a' }]);
    expect(await banco.emTransacao(async () => banco.executar('UPDATE t SET n = 5'))).toEqual({ alteradas: 1 });
  });

  it('expo-sqlite: repassa para runAsync, getAllAsync e withTransactionAsync', async () => {
    const chamadas: [string, string, ValorSql[] | undefined][] = [];
    const db = {
      runAsync: async (sql: string, p: ValorSql[]) => {
        chamadas.push(['run', sql, p]);
        return { changes: 3 };
      },
      getAllAsync: async <T,>(sql: string, p: ValorSql[]) => {
        chamadas.push(['all', sql, p]);
        return [{ x: 1 }] as T[];
      },
      withTransactionAsync: async (tarefa: () => Promise<void>) => {
        chamadas.push(['begin', '', undefined]);
        await tarefa();
        chamadas.push(['commit', '', undefined]);
      },
    };
    const banco = adaptarExpoSqlite(db);
    expect(await banco.executar('UPDATE t SET a = ?', [1])).toEqual({ alteradas: 3 });
    expect(await banco.consultar('SELECT 1')).toEqual([{ x: 1 }]);
    expect(await banco.emTransacao(async () => 'valor')).toBe('valor');
    expect(chamadas.map((c) => c[0])).toEqual(['run', 'all', 'begin', 'commit']);
    expect(chamadas[0]?.[2]).toEqual([1]);
    expect(chamadas[1]?.[2]).toEqual([]);
  });

  it('a trava executa uma tarefa por vez, na ordem de chegada', async () => {
    const trava = new Trava();
    const ordem: string[] = [];
    const demorada = trava.executar(async () => {
      ordem.push('a:início');
      await new Promise((r) => setTimeout(r, 20));
      ordem.push('a:fim');
    });
    const rapida = trava.executar(async () => {
      ordem.push('b');
    });
    await Promise.all([demorada, rapida]);
    expect(ordem).toEqual(['a:início', 'a:fim', 'b']);
    await expect(trava.executar(async () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    expect(await trava.executar(async () => 'depois do erro')).toBe('depois do erro');
  });
});
