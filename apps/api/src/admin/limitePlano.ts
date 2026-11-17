import type { Banco } from '../db/banco';

// SCRUM-32 (RN05 / D11): limite do Freemium = 25 propostas geradas por mês,
// por empresa, contadas na primeira passagem para "Gerada" (data_geracao).
// O app bloqueia antes de gerar (SCRUM-434); quando uma proposta é gerada
// offline acima do limite, a API aceita, revalida na sincronização
// (SCRUM-435) e sinaliza a proposta para o gestor (SCRUM-436).

export const inicioDoMes = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();

export function limiteDaEmpresa(banco: Banco, idEmpresa: string): number | null {
  const a = banco.um<{ limite_propostas_mes: number | null; status: string }>(
    'SELECT limite_propostas_mes, status FROM assinatura WHERE id_empresa = ?', idEmpresa,
  );
  return a?.limite_propostas_mes == null ? null : Number(a.limite_propostas_mes);
}

/** Propostas geradas no mês além do limite, na ordem em que foram geradas. */
export function propostasAcimaDoLimite(banco: Banco, idEmpresa: string, agora = new Date()): Set<string> {
  const limite = limiteDaEmpresa(banco, idEmpresa);
  if (limite === null) return new Set();
  const doMes = banco.todos<{ id_proposta: string }>(
    'SELECT id_proposta FROM vw_proposta WHERE id_empresa = ? AND data_geracao >= ? ORDER BY data_geracao, id_proposta',
    idEmpresa, inicioDoMes(agora),
  );
  return new Set(doMes.slice(limite).map((l) => l.id_proposta));
}

export const AVISO_LIMITE = (limite: number) =>
  `Limite do plano Freemium atingido: esta proposta passou das ${limite} propostas do mês. Ela foi aceita e sinalizada para o gestor (RN05).`;
