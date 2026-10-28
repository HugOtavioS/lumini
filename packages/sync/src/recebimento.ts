/**
 * Aplicação, no aparelho, do que veio no pull.
 *
 * O aparelho nunca resolve conflito sozinho: se o registro ainda tem
 * alteração na fila, a versão local fica como está e sobe no próximo push,
 * quando o servidor aplica a regra do SCRUM-83 e devolve quem venceu. Assim
 * todos os aparelhos chegam ao mesmo resultado.
 */
import type { EntidadeSincronizavel, RespostaPull, VersaoRegistro } from './contrato';

export interface OpcoesAplicarPull {
  /** O registro ainda tem alteração na fila? (`FilaSincronizacao.obter(...) !== null`) */
  temPendencia: (entidade: EntidadeSincronizavel, idRegistro: string) => boolean | Promise<boolean>;
  /** Grava a versão do servidor no banco local, com `sync_status = Sincronizado`. */
  salvarLocal: (entidade: EntidadeSincronizavel, versao: VersaoRegistro) => void | Promise<void>;
}

export async function aplicarPull(
  resposta: RespostaPull,
  opcoes: OpcoesAplicarPull,
): Promise<{ aplicados: number; mantidosPorPendencia: number }> {
  let aplicados = 0;
  let mantidosPorPendencia = 0;
  for (const { entidade, versao } of resposta.registros) {
    if (await opcoes.temPendencia(entidade, versao.id)) {
      mantidosPorPendencia += 1;
      continue;
    }
    await opcoes.salvarLocal(entidade, versao);
    aplicados += 1;
  }
  return { aplicados, mantidosPorPendencia };
}
