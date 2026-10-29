/**
 * carregarSeedHsp.ts
 *
 * SCRUM-17 — Carga inicial idempotente do seed de HSP de contingência.
 *
 * Idempotência garantida em dois níveis:
 * 1. Controle de versão: se seed_versao já registra VERSAO_SEED_HSP (ou maior),
 *    nada é feito.
 * 2. Substituição atômica: quando a versão é nova, a tabela é esvaziada e
 *    repovoada dentro de uma única transação, com chaves primárias determinísticas
 *    (ex.: 'cidade:3550308', 'uf:SP'). Nunca há duplicação.
 */

import type { SqlExecutor } from '../database/SqlExecutor';
import {
  NOME_SEED_HSP,
  RegistroHspContingencia,
  SEED_HSP_CONTINGENCIA,
  VERSAO_SEED_HSP,
} from './hspContingencia';
import { chaveCidade } from '../repositories/chaveCidade';

export interface ResultadoCargaSeed {
  aplicado: boolean;
  versaoAnterior: number | null;
  versaoAtual: number;
  registros: number;
}

export interface OpcoesCargaSeedHsp {
  registros?: readonly RegistroHspContingencia[];
  versao?: number;
  agora?: () => Date;
}

export function idRegistroHsp(registro: RegistroHspContingencia): string {
  if (registro.abrangencia === 'cidade') {
    if (!registro.codigoIbge) {
      throw new Error(
        `Registro de HSP da cidade ${registro.cidade ?? '?'}/${registro.uf} sem código IBGE.`,
      );
    }
    return `cidade:${registro.codigoIbge}`;
  }
  return `uf:${registro.uf.toUpperCase()}`;
}

export async function carregarSeedHsp(
  db: SqlExecutor,
  opcoes: OpcoesCargaSeedHsp = {},
): Promise<ResultadoCargaSeed> {
  const registros = opcoes.registros ?? SEED_HSP_CONTINGENCIA;
  const versao = opcoes.versao ?? VERSAO_SEED_HSP;
  const agora = opcoes.agora ?? (() => new Date());

  return db.transacao(async (tx) => {
    const [atual] = await tx.consultar<{ versao: number }>(
      'SELECT versao FROM seed_versao WHERE nome = ?',
      [NOME_SEED_HSP],
    );
    const versaoAnterior = atual ? atual.versao : null;

    if (versaoAnterior !== null && versaoAnterior >= versao) {
      return { aplicado: false, versaoAnterior, versaoAtual: versaoAnterior, registros: 0 };
    }

    await tx.executar('DELETE FROM hsp_contingencia');

    for (const r of registros) {
      await tx.executar(
        `INSERT INTO hsp_contingencia
          (id, abrangencia, codigo_ibge, cidade, cidade_chave, uf,
           hsp_medio_anual, hsp_mensal, fonte, dado_de_exemplo, versao_seed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          idRegistroHsp(r),
          r.abrangencia,
          r.codigoIbge ?? null,
          r.cidade ?? null,
          r.cidade ? chaveCidade(r.cidade) : null,
          r.uf.toUpperCase(),
          r.hspMedioAnual,
          r.hspMensal ? JSON.stringify(r.hspMensal) : null,
          r.fonte,
          r.dadoDeExemplo ? 1 : 0,
          versao,
        ],
      );
    }

    await tx.executar(
      `INSERT INTO seed_versao (nome, versao, aplicado_em) VALUES (?, ?, ?)
       ON CONFLICT (nome) DO UPDATE SET versao = excluded.versao, aplicado_em = excluded.aplicado_em`,
      [NOME_SEED_HSP, versao, agora().toISOString()],
    );

    return { aplicado: true, versaoAnterior, versaoAtual: versao, registros: registros.length };
  });
}
