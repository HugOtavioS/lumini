/**
 * SCRUM-406 (NOVO-106) — RN11: quem pode editar a proposta em cada status.
 *
 * Adendo 1 à ERS, Seção 4:
 * - o **técnico** edita em "Em elaboração" e "Reaberta" (no app);
 * - o **gestor** edita em "Gerada" e "Em negociação" (no editor web);
 * - **ninguém** edita em "Aprovada" e "Recusada" (somente leitura).
 *
 * As transições de status seguem o RF27 (passo 5) e o DAS 4.3:
 * - o técnico só leva a proposta para "Gerada" (gerar o PDF), saindo de
 *   "Em elaboração" ou "Reaberta";
 * - o gestor, a partir de "Gerada" ou "Em negociação", pode manter o status,
 *   mover para "Em negociação", gerar nova versão ("Gerada"), reabrir para o
 *   técnico ("Reaberta") ou encerrar ("Aprovada" / "Recusada").
 *
 * Este módulo é a fonte única da regra: o app usa `podeEditar` para habilitar
 * ou bloquear a edição, a web usa `acoesDoGestor` para decidir os botões do
 * editor e a API (e o servidor de referência) usa `verificarGravacaoRN11`
 * antes da regra de conflito (SCRUM-83), recusando a gravação fora da regra.
 *
 * TypeScript puro: roda no app (Hermes), na web e na API.
 */
import type { StatusProposta } from '../contrato';

export type PapelUsuario = 'Tecnico' | 'Gestor';

/** Status em que cada papel pode editar a proposta. */
export const STATUS_EDITAVEIS: Readonly<Record<PapelUsuario, readonly StatusProposta[]>> = Object.freeze({
  Tecnico: ['Em elaboração', 'Reaberta'],
  Gestor: ['Gerada', 'Em negociação'],
});

/** Status finais: ninguém edita. */
export const STATUS_SOMENTE_LEITURA: readonly StatusProposta[] = ['Aprovada', 'Recusada'];

/** Status para os quais cada papel pode levar uma proposta que ele está editando. */
export const STATUS_DESTINO: Readonly<Record<PapelUsuario, readonly StatusProposta[]>> = Object.freeze({
  Tecnico: ['Em elaboração', 'Gerada'],
  Gestor: ['Gerada', 'Em negociação', 'Reaberta', 'Aprovada', 'Recusada'],
});

/** O papel pode editar uma proposta neste status? */
export function podeEditar(papel: PapelUsuario, status: StatusProposta): boolean {
  return STATUS_EDITAVEIS[papel].includes(status);
}

/** A proposta está encerrada (somente leitura para todos)? */
export function ehSomenteLeitura(status: StatusProposta): boolean {
  return STATUS_SOMENTE_LEITURA.includes(status);
}

/** Quem edita a proposta neste status (`null` quando ninguém edita). */
export function responsavelPelaEdicao(status: StatusProposta): PapelUsuario | null {
  if (podeEditar('Tecnico', status)) return 'Tecnico';
  if (podeEditar('Gestor', status)) return 'Gestor';
  return null;
}

/**
 * A transição `de → para` é permitida para o papel?
 * `de = null` significa proposta nova (só o técnico cria propostas).
 */
export function transicaoPermitida(papel: PapelUsuario, de: StatusProposta | null, para: StatusProposta): boolean {
  if (de === null) return papel === 'Tecnico' && STATUS_DESTINO.Tecnico.includes(para);
  return podeEditar(papel, de) && STATUS_DESTINO[papel].includes(para);
}

export type AcaoGestor = 'editar' | 'mover_negociacao' | 'gerar_nova_versao' | 'reabrir' | 'aprovar' | 'recusar';

/**
 * Ações que o editor web mostra ao gestor para uma proposta neste status
 * (RF27, passo 5). Lista vazia = proposta somente leitura para o gestor.
 */
export function acoesDoGestor(status: StatusProposta): AcaoGestor[] {
  if (!podeEditar('Gestor', status)) return [];
  const acoes: AcaoGestor[] = ['editar', 'gerar_nova_versao', 'reabrir', 'aprovar', 'recusar'];
  if (status !== 'Em negociação') acoes.splice(1, 0, 'mover_negociacao');
  return acoes;
}

/** Mensagem curta para a interface explicar por que a proposta não pode ser editada. */
export function motivoBloqueio(papel: PapelUsuario, status: StatusProposta): string | null {
  if (podeEditar(papel, status)) return null;
  if (ehSomenteLeitura(status)) return `Proposta "${status}": somente leitura (RN11).`;
  return papel === 'Tecnico'
    ? `Proposta "${status}": em edição pelo gestor comercial. Peça ao gestor para reabri-la (RN11).`
    : `Proposta "${status}": em edição pelo técnico. Ela volta para você quando for gerada de novo (RN11).`;
}

export function ehStatusProposta(valor: unknown): valor is StatusProposta {
  return (
    typeof valor === 'string' &&
    ['Em elaboração', 'Gerada', 'Em negociação', 'Reaberta', 'Aprovada', 'Recusada'].includes(valor)
  );
}

export interface GravacaoProposta {
  papel: PapelUsuario;
  /** Status da versão guardada no servidor; `null` se a proposta ainda não existe lá. */
  statusAtual: StatusProposta | null;
  /**
   * Status da versão a partir da qual o usuário começou a editar (a
   * versão-base da operação). Igual a `statusAtual` numa edição normal; numa
   * edição concorrente (outro aparelho gravou depois que este baixou a
   * proposta), é o status que o usuário via quando editou. `null` para
   * proposta criada no aparelho.
   */
  statusBase: StatusProposta | null;
  /** Status da versão que chegou. */
  statusNovo: unknown;
}

export type ResultadoRN11 = { permitido: true } | { permitido: false; mensagem: string };

/**
 * Checagem da API no push, antes da regra de conflito (SCRUM-83). Uma
 * gravação recusada aqui não passa pelo last-write-wins nem gera Log de
 * Auditoria.
 *
 * 1. Proposta encerrada no servidor ("Aprovada"/"Recusada"): recusa.
 * 2. Técnico com a proposta já com o gestor no servidor ("Em negociação"):
 *    recusa — a negociação não volta para trás por uma edição atrasada.
 * 3. A permissão é avaliada no status em que o usuário começou a editar
 *    (`statusBase`): se ele podia editar ali e a transição para `statusNovo`
 *    é permitida, a gravação segue; se duas edições permitidas se cruzaram
 *    (ex.: dois técnicos editando a mesma proposta "Reaberta"), quem decide
 *    é o last-write-wins.
 */
export function verificarGravacaoRN11(g: GravacaoProposta): ResultadoRN11 {
  const negar = (mensagem: string): ResultadoRN11 => ({ permitido: false, mensagem: `RN11: ${mensagem}` });
  if (!ehStatusProposta(g.statusNovo)) return negar(`status "${String(g.statusNovo)}" desconhecido.`);
  const para = g.statusNovo;
  const quem = g.papel === 'Tecnico' ? 'o técnico' : 'o gestor';

  if (g.statusAtual !== null && ehSomenteLeitura(g.statusAtual)) {
    return negar(`a proposta está "${g.statusAtual}" e não pode mais ser alterada.`);
  }
  if (g.papel === 'Tecnico' && g.statusAtual === 'Em negociação') {
    return negar('a proposta já está "Em negociação" com o gestor; o técnico só edita em "Em elaboração" ou "Reaberta".');
  }

  const de = g.statusAtual === null ? null : g.statusBase ?? g.statusAtual;
  if (transicaoPermitida(g.papel, de, para)) return { permitido: true };

  if (de === null) {
    return negar(g.papel === 'Gestor' ? 'o gestor não cria propostas; elas nascem no app do técnico.' : `o técnico não cria proposta "${para}".`);
  }
  if (!STATUS_DESTINO[g.papel].includes(para)) return negar(`${quem} não pode mudar a proposta para "${para}".`);
  return negar(
    g.papel === 'Tecnico'
      ? `a proposta está "${de}", em edição pelo gestor; o técnico só edita em "Em elaboração" ou "Reaberta".`
      : `a proposta está "${de}"; o gestor só edita em "Gerada" ou "Em negociação".`,
  );
}
