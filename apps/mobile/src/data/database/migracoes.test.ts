import { describe, expect, it } from 'vitest';

import { MIGRACOES, executarMigracoes } from './migracoes';
import { bancoEmMemoria } from './testing';

describe('executarMigracoes', () => {
  it('cria as tabelas na ordem de versão e registra cada migração', async () => {
    const banco = bancoEmMemoria();
    const aplicadas = await executarMigracoes(banco);
    expect(aplicadas).toEqual(MIGRACOES.map((m) => m.versao).sort((a, b) => a - b));
    const tabelas = (await banco.consultar<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")).map((t) => t.name);
    expect(tabelas).toEqual(expect.arrayContaining(['hsp_contingencia', 'seed_versao', 'sync_lock', 'app_config', 'schema_migracoes']));
  });

  it('é idempotente: rodar de novo não reaplica nada', async () => {
    const banco = bancoEmMemoria();
    await executarMigracoes(banco);
    expect(await executarMigracoes(banco)).toEqual([]);
  });

  it('desfaz a migração inteira se um comando falhar', async () => {
    const banco = bancoEmMemoria();
    const quebrada = { versao: 1, nome: 'quebrada', up: ['CREATE TABLE ok (id INTEGER)', 'ISSO NAO E SQL'], down: [] };
    await expect(executarMigracoes(banco, [quebrada])).rejects.toThrow();
    const tabelas = await banco.consultar<{ name: string }>("SELECT name FROM sqlite_master WHERE name = 'ok'");
    expect(tabelas).toEqual([]);
  });
});
