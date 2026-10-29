/**
 * SCRUM-17 — Testes da carga inicial idempotente do seed de HSP.
 */

import {
  aplicarMigracoes,
  criarSqliteEmMemoria,
  SqliteEmMemoria,
} from '../../database/testing/sqliteEmMemoria';
import { MIGRACOES_SPRINT_3 } from '../../database/migrations';
import { carregarSeedHsp } from '../carregarSeedHsp';
import {
  NOME_SEED_HSP,
  RegistroHspContingencia,
  SEED_HSP_CONTINGENCIA,
  VERSAO_SEED_HSP,
} from '../hspContingencia';

async function contarRegistros(db: SqliteEmMemoria): Promise<number> {
  const [linha] = await db.consultar<{ total: number }>(
    'SELECT COUNT(*) AS total FROM hsp_contingencia',
  );
  return linha.total;
}

describe('carregarSeedHsp', () => {
  let db: SqliteEmMemoria;

  beforeEach(async () => {
    db = criarSqliteEmMemoria();
    await aplicarMigracoes(db, MIGRACOES_SPRINT_3);
  });

  afterEach(() => db.fechar());

  it('popula a tabela na primeira execução e registra a versão', async () => {
    const r = await carregarSeedHsp(db);

    expect(r).toEqual({
      aplicado: true,
      versaoAnterior: null,
      versaoAtual: VERSAO_SEED_HSP,
      registros: SEED_HSP_CONTINGENCIA.length,
    });
    expect(await contarRegistros(db)).toBe(SEED_HSP_CONTINGENCIA.length);

    const [versao] = await db.consultar<{ versao: number }>(
      'SELECT versao FROM seed_versao WHERE nome = ?',
      [NOME_SEED_HSP],
    );
    expect(versao.versao).toBe(VERSAO_SEED_HSP);
  });

  it('é idempotente: rodar duas vezes não duplica registros', async () => {
    await carregarSeedHsp(db);
    const segunda = await carregarSeedHsp(db);

    expect(segunda.aplicado).toBe(false);
    expect(await contarRegistros(db)).toBe(SEED_HSP_CONTINGENCIA.length);
  });

  it('reaplica quando a versão do seed aumenta, sem duplicar', async () => {
    await carregarSeedHsp(db);

    const novos: RegistroHspContingencia[] = [
      { abrangencia: 'uf', uf: 'SP', hspMedioAnual: 4.7, fonte: 'teste', dadoDeExemplo: false },
    ];
    const r = await carregarSeedHsp(db, { registros: novos, versao: VERSAO_SEED_HSP + 1 });

    expect(r.aplicado).toBe(true);
    expect(r.versaoAnterior).toBe(VERSAO_SEED_HSP);
    expect(await contarRegistros(db)).toBe(1);

    await carregarSeedHsp(db, { registros: novos, versao: VERSAO_SEED_HSP + 1 });
    expect(await contarRegistros(db)).toBe(1);
  });

  it('não regride para uma versão menor', async () => {
    await carregarSeedHsp(db, { versao: 5 });
    const r = await carregarSeedHsp(db, { versao: 4 });
    expect(r.aplicado).toBe(false);
    expect(r.versaoAtual).toBe(5);
  });

  it('faz rollback completo se um registro for inválido', async () => {
    const invalidos: RegistroHspContingencia[] = [
      { abrangencia: 'uf', uf: 'SP', hspMedioAnual: 4.6, fonte: 'teste', dadoDeExemplo: false },
      // cidade sem código IBGE → erro
      { abrangencia: 'cidade', cidade: 'X', uf: 'SP', hspMedioAnual: 4.6, fonte: 'teste', dadoDeExemplo: false },
    ];

    await expect(carregarSeedHsp(db, { registros: invalidos })).rejects.toThrow(
      'sem código IBGE',
    );
    expect(await contarRegistros(db)).toBe(0);
    expect(await db.consultar('SELECT * FROM seed_versao')).toEqual([]);
  });

  it('o seed oficial não tem IDs duplicados', () => {
    const ids = SEED_HSP_CONTINGENCIA.map((r) =>
      r.abrangencia === 'cidade' ? `cidade:${r.codigoIbge}` : `uf:${r.uf}`,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});
