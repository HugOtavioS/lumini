import type { BancoSql } from '@lumini/sync';

import {
  BUILTIN_CONTINGENCY_BASE,
  UFS,
  getActiveContingencyBase,
  setActiveContingencyBase,
  validateContingencyBase,
  type ContingencyBase,
} from './contingencyBase';

// SCRUM-17 (Misael) + SCRUM-85 — persistência da base de contingência no SQLite.
//
// A carga é idempotente nos dois níveis da entrega do Misael:
// 1. controle de versão em `seed_versao`: só grava se a versão for mais nova;
// 2. substituição atômica: esvazia e repovoa `hsp_contingencia` numa transação,
//    com chaves determinísticas ('uf:SP'), então nunca há duplicação.
//
// A versão numérica é o instante de publicação (ms), o mesmo critério que o
// ContingencyUpdater usa para decidir qual base é mais nova.

export const NOME_SEED_HSP = 'hsp_contingencia';

export interface ResultadoCargaSeed {
  aplicado: boolean;
  versaoAnterior: string | null;
  versaoAtual: string;
  registros: number;
}

const versaoNumerica = (base: ContingencyBase) => Date.parse(base.publishedAt);

/** Grava a base se ela for mais nova que a do banco (nada acontece se não for). */
export async function salvarBaseContingencia(
  banco: BancoSql,
  base: ContingencyBase,
  agora: () => Date = () => new Date(),
): Promise<ResultadoCargaSeed> {
  const problemas = validateContingencyBase(base);
  if (problemas.length > 0) throw new Error(`Base de contingência inválida: ${problemas.join(' ')}`);
  const versao = versaoNumerica(base);

  return banco.emTransacao(async () => {
    const [atual] = await banco.consultar<{ versao: number; rotulo: string | null }>(
      'SELECT versao, rotulo FROM seed_versao WHERE nome = ?',
      [NOME_SEED_HSP],
    );
    const versaoAnterior = atual ? (atual.rotulo ?? String(atual.versao)) : null;
    if (atual && Number(atual.versao) >= versao) {
      return { aplicado: false, versaoAnterior, versaoAtual: versaoAnterior ?? base.version, registros: 0 };
    }

    await banco.executar('DELETE FROM hsp_contingencia');
    for (const uf of UFS) {
      const ref = base.hspByState[uf]!;
      await banco.executar(
        `INSERT INTO hsp_contingencia
          (id, abrangencia, codigo_ibge, cidade, cidade_chave, uf, hsp_medio_anual, hsp_mensal, latitude, fonte, dado_de_exemplo, versao_seed)
         VALUES (?, 'uf', NULL, NULL, NULL, ?, ?, NULL, ?, ?, 0, ?)`,
        [`uf:${uf}`, uf, ref.hsp, ref.latitude, `Base de contingência ${base.version}`, versao],
      );
    }
    await banco.executar(
      `INSERT INTO seed_versao (nome, versao, rotulo, publicada_em, aplicado_em) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (nome) DO UPDATE SET versao = excluded.versao, rotulo = excluded.rotulo,
         publicada_em = excluded.publicada_em, aplicado_em = excluded.aplicado_em`,
      [NOME_SEED_HSP, versao, base.version, base.publishedAt, agora().toISOString()],
    );
    return { aplicado: true, versaoAnterior, versaoAtual: base.version, registros: UFS.length };
  });
}

/** Lê a base gravada; `null` se não houver uma completa e válida. */
export async function carregarBaseContingencia(banco: BancoSql): Promise<ContingencyBase | null> {
  const [meta] = await banco.consultar<{ rotulo: string | null; publicada_em: string | null }>(
    'SELECT rotulo, publicada_em FROM seed_versao WHERE nome = ?',
    [NOME_SEED_HSP],
  );
  if (!meta?.rotulo || !meta.publicada_em) return null;
  const linhas = await banco.consultar<{ uf: string; hsp_medio_anual: number; latitude: number | null }>(
    "SELECT uf, hsp_medio_anual, latitude FROM hsp_contingencia WHERE abrangencia = 'uf'",
  );
  const base: ContingencyBase = {
    version: meta.rotulo,
    publishedAt: meta.publicada_em,
    hspByState: Object.fromEntries(
      linhas.map((l) => [l.uf, { hsp: Number(l.hsp_medio_anual), latitude: Number(l.latitude) }]),
    ),
  };
  return validateContingencyBase(base).length === 0 ? base : null;
}

/**
 * Na abertura do app: grava a base embutida (só se o banco não tiver uma mais
 * nova, ex.: baixada pelo ContingencyUpdater) e passa a usar a que está no banco.
 */
export async function inicializarContingencia(banco: BancoSql): Promise<ContingencyBase> {
  await salvarBaseContingencia(banco, BUILTIN_CONTINGENCY_BASE);
  const gravada = await carregarBaseContingencia(banco);
  if (gravada && versaoNumerica(gravada) > versaoNumerica(getActiveContingencyBase())) {
    setActiveContingencyBase(gravada);
  }
  return getActiveContingencyBase();
}
