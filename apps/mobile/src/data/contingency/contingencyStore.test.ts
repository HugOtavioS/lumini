import { afterEach, describe, expect, it } from 'vitest';

import { executarMigracoes } from '@/data/database/migracoes';
import { bancoEmMemoria } from '@/data/database/testing';
import { BUILTIN_CONTINGENCY_BASE, getActiveContingencyBase, resetContingencyBase, type ContingencyBase } from './contingencyBase';
import { carregarBaseContingencia, inicializarContingencia, salvarBaseContingencia } from './contingencyStore';

async function bancoMigrado() {
  const banco = bancoEmMemoria();
  await executarMigracoes(banco);
  return banco;
}

const baseNova: ContingencyBase = {
  version: '2026.10.1',
  publishedAt: '2026-10-15T00:00:00.000Z',
  hspByState: { ...BUILTIN_CONTINGENCY_BASE.hspByState, SP: { hsp: 5.05, latitude: -23.55 } },
};

afterEach(resetContingencyBase);

describe('base de contingência no SQLite (SCRUM-17)', () => {
  it('grava a base embutida uma única vez (carga idempotente por versão)', async () => {
    const banco = await bancoMigrado();
    const primeira = await salvarBaseContingencia(banco, BUILTIN_CONTINGENCY_BASE);
    expect(primeira).toMatchObject({ aplicado: true, versaoAnterior: null, registros: 27 });
    const segunda = await salvarBaseContingencia(banco, BUILTIN_CONTINGENCY_BASE);
    expect(segunda.aplicado).toBe(false);
    const [{ total }] = (await banco.consultar<{ total: number }>('SELECT COUNT(*) AS total FROM hsp_contingencia')) as [{ total: number }];
    expect(total).toBe(27);
  });

  it('substitui por uma versão mais nova e recusa voltar para uma mais antiga', async () => {
    const banco = await bancoMigrado();
    await salvarBaseContingencia(banco, BUILTIN_CONTINGENCY_BASE);
    const troca = await salvarBaseContingencia(banco, baseNova);
    expect(troca).toMatchObject({ aplicado: true, versaoAnterior: BUILTIN_CONTINGENCY_BASE.version, versaoAtual: '2026.10.1' });
    expect((await salvarBaseContingencia(banco, BUILTIN_CONTINGENCY_BASE)).aplicado).toBe(false);
    const lida = await carregarBaseContingencia(banco);
    expect(lida?.version).toBe('2026.10.1');
    expect(lida?.hspByState.SP).toEqual({ hsp: 5.05, latitude: -23.55 });
  });

  it('na abertura do app passa a usar a base mais nova que estiver no banco', async () => {
    const banco = await bancoMigrado();
    await salvarBaseContingencia(banco, baseNova); // baixada antes pelo ContingencyUpdater
    const ativa = await inicializarContingencia(banco);
    expect(ativa.version).toBe('2026.10.1');
    expect(getActiveContingencyBase().version).toBe('2026.10.1');
  });

  it('sem base gravada, grava e mantém a embutida', async () => {
    const banco = await bancoMigrado();
    expect(await carregarBaseContingencia(banco)).toBeNull();
    expect((await inicializarContingencia(banco)).version).toBe(BUILTIN_CONTINGENCY_BASE.version);
    expect((await carregarBaseContingencia(banco))?.version).toBe(BUILTIN_CONTINGENCY_BASE.version);
  });

  it('não grava base inválida', async () => {
    const banco = await bancoMigrado();
    const invalida = { ...baseNova, hspByState: { SP: { hsp: 5, latitude: -23 } } } as ContingencyBase;
    await expect(salvarBaseContingencia(banco, invalida)).rejects.toThrow(/inválida/);
  });
});
