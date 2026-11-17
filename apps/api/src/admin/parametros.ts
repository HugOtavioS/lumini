import { BadRequestException } from '@nestjs/common';

import type { Banco } from '../db/banco';

// SCRUM-433 (RF29): parâmetros comerciais da empresa. O gestor edita no painel;
// o app baixa no login (GET /sync/parametros) e usa na precificação (RN03/RN06);
// o editor web usa o limite de ajuste (SCRUM-419).

export interface ParametrosComerciais {
  limiteAjustePrecoPerc: number;
  margemPadraoPerc: number;
  materiaisEletricosPorKwp: number;
  maoDeObraPorKwp: number;
  artHomologacaoPadrao: number;
  fretePadrao: number;
  validadePadraoDias: number;
  atualizadoEm: string | null;
  atualizadoPor: string | null;
}

export const PARAMETROS_PADRAO: Omit<ParametrosComerciais, 'atualizadoEm' | 'atualizadoPor'> = {
  limiteAjustePrecoPerc: 15,
  margemPadraoPerc: 25,
  materiaisEletricosPorKwp: 250,
  maoDeObraPorKwp: 800,
  artHomologacaoPadrao: 1200,
  fretePadrao: 800,
  validadePadraoDias: 15,
};

const COLUNAS: Record<keyof typeof PARAMETROS_PADRAO, string> = {
  limiteAjustePrecoPerc: 'limite_ajuste_preco_perc',
  margemPadraoPerc: 'margem_padrao_perc',
  materiaisEletricosPorKwp: 'materiais_eletricos_por_kwp',
  maoDeObraPorKwp: 'mao_de_obra_por_kwp',
  artHomologacaoPadrao: 'art_homologacao_padrao',
  fretePadrao: 'frete_padrao',
  validadePadraoDias: 'validade_padrao_dias',
};

/** Faixas aceitas, com a mensagem mostrada no painel. */
const FAIXAS: Record<keyof typeof PARAMETROS_PADRAO, { min: number; max: number; inteiro?: boolean; rotulo: string }> = {
  limiteAjustePrecoPerc: { min: 0, max: 50, rotulo: 'Limite de ajuste de preço do técnico (%)' },
  margemPadraoPerc: { min: 0, max: 200, rotulo: 'Margem sobre serviços e materiais (%)' },
  materiaisEletricosPorKwp: { min: 0, max: 10000, rotulo: 'Materiais elétricos por kWp (R$)' },
  maoDeObraPorKwp: { min: 0, max: 20000, rotulo: 'Mão de obra por kWp (R$)' },
  artHomologacaoPadrao: { min: 0, max: 100000, rotulo: 'Projeto, ART e homologação (R$)' },
  fretePadrao: { min: 0, max: 100000, rotulo: 'Logística e frete (R$)' },
  validadePadraoDias: { min: 1, max: 365, inteiro: true, rotulo: 'Validade padrão da proposta (dias)' },
};

export function lerParametros(banco: Banco, idEmpresa: string): ParametrosComerciais {
  const l = banco.um<Record<string, unknown>>('SELECT * FROM parametro_comercial WHERE id_empresa = ?', idEmpresa);
  const out = { ...PARAMETROS_PADRAO, atualizadoEm: null as string | null, atualizadoPor: null as string | null };
  if (!l) return out;
  for (const [k, col] of Object.entries(COLUNAS) as [keyof typeof PARAMETROS_PADRAO, string][]) out[k] = Number(l[col]);
  out.atualizadoEm = String(l.updated_at);
  out.atualizadoPor = String(l.updated_by);
  return out;
}

/** Valida e grava; devolve os campos que mudaram (para o Log de Auditoria). */
export function gravarParametros(banco: Banco, idEmpresa: string, idUsuario: string, entrada: Record<string, unknown>) {
  const atual = lerParametros(banco, idEmpresa);
  const novo = { ...atual };
  const erros: string[] = [];
  for (const k of Object.keys(COLUNAS) as (keyof typeof PARAMETROS_PADRAO)[]) {
    if (entrada[k] === undefined) continue;
    const v = Number(entrada[k]);
    const f = FAIXAS[k];
    if (!Number.isFinite(v) || v < f.min || v > f.max || (f.inteiro && !Number.isInteger(v))) {
      erros.push(`${f.rotulo}: informe ${f.inteiro ? 'um número inteiro' : 'um valor'} entre ${f.min} e ${f.max}.`);
      continue;
    }
    novo[k] = v;
  }
  if (erros.length > 0) throw new BadRequestException(erros.join(' '));
  const mudou = (Object.keys(COLUNAS) as (keyof typeof PARAMETROS_PADRAO)[]).filter((k) => novo[k] !== atual[k]);
  const agora = new Date().toISOString();
  const cols = Object.values(COLUNAS);
  const vals = (Object.keys(COLUNAS) as (keyof typeof PARAMETROS_PADRAO)[]).map((k) => novo[k]);
  banco.executar(
    `INSERT INTO parametro_comercial (id_empresa, ${cols.join(', ')}, updated_at, updated_by)
     VALUES (?, ${cols.map(() => '?').join(', ')}, ?, ?)
     ON CONFLICT (id_empresa) DO UPDATE SET ${cols.map((c) => `${c} = excluded.${c}`).join(', ')}, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    idEmpresa, ...vals, agora, idUsuario,
  );
  return { parametros: lerParametros(banco, idEmpresa), mudou: mudou.map((k) => ({ campo: COLUNAS[k], antes: atual[k], depois: novo[k] })), agora };
}
