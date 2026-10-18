/**
 * Servidor de referência da sincronização, em memória.
 *
 * Segue as regras que a API NestJS (SCRUM-30) precisa aplicar no push e no
 * pull, para que os testes de integração (SCRUM-86) rodem de ponta a ponta
 * antes de a API existir. Também serve de especificação executável: quando a
 * API estiver pronta, os mesmos cenários devem rodar contra ela.
 *
 * Regras do push, por operação (em ordem de dependência):
 * 1. dados mínimos válidos;
 * 2. mesma empresa do usuário (multi-tenant);
 * 3. RN07: o técnico só envia proposta "Gerada" ou posterior; o gestor (web)
 *    pode gravar qualquer status, menos "Em elaboração";
 * 4. o registro pai já existe (senão, recusa retentável: ele pode chegar depois);
 * 5. resolução de conflito (SCRUM-83), com Log de Auditoria e aviso.
 *
 * Simplificações: o pull devolve todos os registros sincronizáveis da
 * empresa (a API filtra por papel e por técnico), e não há autenticação.
 */
import {
  DEPENDENCIAS,
  ORDEM_DEPENDENCIA,
  STATUS_QUE_SINCRONIZAM,
  ehEntidadeSincronizavel,
  type AvisoSobrescrita,
  type CodigoRejeicao,
  type EntidadeSincronizavel,
  type OperacaoSync,
  type RegistroAuditoria,
  type RegistroLogSincronizacao,
  type RequisicaoPull,
  type RequisicaoPush,
  type RespostaPull,
  type RespostaPush,
  type ResultadoOperacao,
  type VersaoRegistro,
} from '../contrato';
import { resolverConflito } from '../conflito/resolverConflito';
import { gerarIdPadrao, isoDeMs, msDeIso } from '../util';

export interface SessaoServidor {
  idUsuario: string;
  idEmpresa: string;
  papel: 'Tecnico' | 'Gestor';
}

export interface OpcoesServidor {
  relogio?: () => number;
  toleranciaRelogioMs?: number;
  gerarId?: () => string;
}

interface Guardado {
  entidade: EntidadeSincronizavel;
  versao: VersaoRegistro;
  /** Ordem de gravação, usada como cursor do pull. */
  seq: number;
}

function chave(entidade: EntidadeSincronizavel, id: string): string {
  return `${entidade}:${id}`;
}

function rejeitada(op: OperacaoSync, codigo: CodigoRejeicao, mensagem: string, retentavel = false): ResultadoOperacao {
  return { idOperacao: op.idOperacao, situacao: 'rejeitada', codigo, mensagem, retentavel };
}

function problemasDaOperacao(op: OperacaoSync): string | null {
  if (!op || typeof op !== 'object') return 'Operação inválida.';
  if (!ehEntidadeSincronizavel(op.entidade)) return `Entidade desconhecida: ${String(op.entidade)}.`;
  const v = op.versao;
  if (!v || typeof v !== 'object') return 'Operação sem versão do registro.';
  if (typeof v.id !== 'string' || v.id === '') return 'Registro sem UUID.';
  if (typeof v.idEmpresa !== 'string' || v.idEmpresa === '') return 'Registro sem empresa.';
  if (msDeIso(v.updatedAt) === null) return 'updated_at inválido.';
  if (typeof v.updatedBy !== 'string' || v.updatedBy === '') return 'updated_by ausente.';
  if (!v.dados || typeof v.dados !== 'object' || Array.isArray(v.dados)) return 'Dados do registro ausentes.';
  if (op.baseUpdatedAt !== null && op.baseUpdatedAt !== undefined && msDeIso(op.baseUpdatedAt) === null) return 'Versão-base inválida.';
  return null;
}

export class ServidorSincronizacaoMemoria {
  readonly logAuditoria: RegistroAuditoria[] = [];
  readonly logSincronizacao: RegistroLogSincronizacao[] = [];
  private readonly registros = new Map<string, Guardado>();
  private readonly avisosPendentes: AvisoSobrescrita[] = [];
  private seq = 0;
  private readonly relogio: () => number;
  private readonly toleranciaRelogioMs: number | undefined;
  private readonly gerarId: () => string;

  constructor(opcoes: OpcoesServidor = {}) {
    this.relogio = opcoes.relogio ?? (() => Date.now());
    this.toleranciaRelogioMs = opcoes.toleranciaRelogioMs;
    this.gerarId = opcoes.gerarId ?? gerarIdPadrao;
  }

  /** POST /sync/push */
  push(sessao: SessaoServidor, requisicao: RequisicaoPush): RespostaPush {
    const agora = this.relogio();
    const ordem = (op: OperacaoSync) => (ehEntidadeSincronizavel(op?.entidade) ? ORDEM_DEPENDENCIA[op.entidade] : 99);
    const operacoes = Array.isArray(requisicao?.operacoes) ? [...requisicao.operacoes].sort((a, b) => ordem(a) - ordem(b)) : [];
    const resultados = operacoes.map((op) => this.aplicar(sessao, op, agora));
    const recusadas = resultados.filter((r) => r.situacao === 'rejeitada').length;
    this.logSincronizacao.push({
      idLogSync: this.gerarId(),
      idUsuario: sessao.idUsuario,
      idDispositivo: requisicao?.idDispositivo ?? 'desconhecido',
      dataHora: isoDeMs(agora),
      tipo: 'Push',
      status: 'Sucesso',
      qtdRegistros: operacoes.length,
      mensagemErro: recusadas > 0 ? `${recusadas} ${recusadas === 1 ? 'registro recusado' : 'registros recusados'}.` : null,
    });
    return { horaServidor: isoDeMs(agora), resultados };
  }

  /** POST /sync/pull: o que mudou desde o último cursor e os avisos do usuário. */
  pull(sessao: SessaoServidor, requisicao: RequisicaoPull & { idDispositivo?: string }): RespostaPull {
    const agora = this.relogio();
    const desde = requisicao.cursor ? Number(requisicao.cursor) : 0;
    const registros = [...this.registros.values()]
      .filter((g) => g.versao.idEmpresa === sessao.idEmpresa && g.seq > desde)
      .sort((a, b) => a.seq - b.seq)
      .map((g) => ({ entidade: g.entidade, versao: g.versao }));
    const avisos = this.avisosPendentes.filter((a) => a.idUsuario === sessao.idUsuario);
    for (const aviso of avisos) this.avisosPendentes.splice(this.avisosPendentes.indexOf(aviso), 1);
    this.logSincronizacao.push({
      idLogSync: this.gerarId(),
      idUsuario: sessao.idUsuario,
      idDispositivo: requisicao.idDispositivo ?? 'desconhecido',
      dataHora: isoDeMs(agora),
      tipo: 'Pull',
      status: 'Sucesso',
      qtdRegistros: registros.length,
      mensagemErro: null,
    });
    return { horaServidor: isoDeMs(agora), cursor: String(this.seq), registros, avisos };
  }

  /** Para os testes: a versão guardada de um registro. */
  obter(entidade: EntidadeSincronizavel, id: string): VersaoRegistro | undefined {
    return this.registros.get(chave(entidade, id))?.versao;
  }

  /** Para os testes: todos os registros de uma entidade. */
  listar(entidade: EntidadeSincronizavel): VersaoRegistro[] {
    return [...this.registros.values()].filter((g) => g.entidade === entidade).sort((a, b) => a.seq - b.seq).map((g) => g.versao);
  }

  private aplicar(sessao: SessaoServidor, op: OperacaoSync, agora: number): ResultadoOperacao {
    const problema = problemasDaOperacao(op);
    if (problema) return rejeitada(op, 'DADOS_INVALIDOS', problema);
    const { entidade, versao } = op;

    if (versao.idEmpresa !== sessao.idEmpresa) {
      return rejeitada(op, 'OUTRA_EMPRESA', 'O registro pertence a outra empresa.');
    }
    const guardado = this.registros.get(chave(entidade, versao.id));
    if (guardado && guardado.versao.idEmpresa !== sessao.idEmpresa) {
      return rejeitada(op, 'OUTRA_EMPRESA', 'O registro pertence a outra empresa.');
    }

    if (entidade === 'Proposta') {
      const status = versao.dados.status_proposta;
      const permitido =
        sessao.papel === 'Tecnico'
          ? (STATUS_QUE_SINCRONIZAM as readonly unknown[]).includes(status)
          : status !== 'Em elaboração' && typeof status === 'string';
      if (!permitido) return rejeitada(op, 'RN07', `RN07: proposta com status "${String(status)}" não é aceita na sincronização.`);
    }

    const dependencia = DEPENDENCIAS[entidade];
    if (dependencia) {
      const idPai = versao.dados[dependencia.campo];
      if (typeof idPai !== 'string' || idPai === '') {
        return rejeitada(op, 'DADOS_INVALIDOS', `Falta o campo ${dependencia.campo}.`);
      }
      const pai = this.registros.get(chave(dependencia.entidade, idPai));
      if (!pai || pai.versao.idEmpresa !== sessao.idEmpresa) {
        return rejeitada(op, 'DEPENDENCIA_AUSENTE', `O registro ${dependencia.entidade} ${idPai} ainda não chegou ao servidor.`, true);
      }
    }

    const r = resolverConflito({
      entidade,
      atual: guardado?.versao ?? null,
      recebida: versao,
      baseUpdatedAt: op.baseUpdatedAt ?? null,
      agora,
      origem: sessao.papel === 'Gestor' ? 'Web' : 'Mobile',
      gerarId: this.gerarId,
      ...(this.toleranciaRelogioMs !== undefined && { toleranciaRelogioMs: this.toleranciaRelogioMs }),
    });
    this.logAuditoria.push(...r.auditoria);

    switch (r.decisao) {
      case 'repetida':
        return { idOperacao: op.idOperacao, situacao: 'aplicada', versaoAceita: r.vencedora, conflito: false, avisos: [] };
      case 'manter':
        // Quem enviou fica sabendo na própria resposta.
        return {
          idOperacao: op.idOperacao,
          situacao: 'descartada',
          versaoServidor: r.vencedora,
          mensagem: r.aviso?.mensagem ?? 'Havia uma versão mais recente no servidor.',
        };
      default:
        this.seq += 1;
        this.registros.set(chave(entidade, versao.id), { entidade, versao: r.vencedora, seq: this.seq });
        // Quem teve a alteração sobrescrita fica sabendo no próximo pull.
        if (r.aviso) this.avisosPendentes.push(r.aviso);
        return { idOperacao: op.idOperacao, situacao: 'aplicada', versaoAceita: r.vencedora, conflito: r.conflito, avisos: r.observacoes };
    }
  }
}
