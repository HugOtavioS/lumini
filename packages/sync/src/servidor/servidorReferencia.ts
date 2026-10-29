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
 * 5. reenvio (a resposta anterior se perdeu): a mesma versão, vinda do mesmo
 *    aparelho, não gera nada novo, nem no Log de Auditoria nem em avisos;
 * 6. RN11 (SCRUM-406): o papel precisa poder editar a proposta no status em
 *    que ela está no servidor, e a transição de status precisa ser permitida
 *    (técnico: "Em elaboração"/"Reaberta" → "Gerada"; gestor: "Gerada"/
 *    "Em negociação" → negociação, nova versão, reaberta, aprovada ou
 *    recusada; "Aprovada" e "Recusada" são somente leitura). Gravação fora
 *    da regra é recusada sem passar pelo last-write-wins;
 * 7. resolução de conflito (SCRUM-83), com Log de Auditoria e aviso.
 *
 * Para as regras 5 e 6, o servidor guarda qual aparelho gravou cada registro e
 * qual foi o último envio de cada aparelho para cada registro.
 *
 * Simplificações: o pull devolve todos os registros sincronizáveis da
 * empresa (a API filtra por papel e por técnico), e não há autenticação.
 *
 * As regras ficam em `ServidorSincronizacao`, que grava por uma porta
 * (`ArmazenamentoServidor`). `ServidorSincronizacaoMemoria` usa a porta em
 * memória (testes); a API usa a mesma classe com a porta em SQLite (e, depois,
 * PostgreSQL no RDS). A porta é síncrona porque o SQLite do Node é síncrono.
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
  type StatusProposta,
  type VersaoRegistro,
} from '../contrato';
import { mensagemReenvioSuperado, resolverConflito } from '../conflito/resolverConflito';
import { ehStatusProposta, verificarGravacaoRN11 } from '../regras/rn11';
import { gerarIdPadrao, isoDeMs, jsonEstavel, msDeIso } from '../util';

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

export interface Guardado {
  entidade: EntidadeSincronizavel;
  versao: VersaoRegistro;
  /** Ordem de gravação, usada como cursor do pull. */
  seq: number;
  /** Aparelho que gravou a versão atual (`null` se a requisição não informou). */
  idDispositivo: string | null;
}

/** Último envio de um aparelho para um registro, para reconhecer o reenvio quando a resposta se perde. */
export interface UltimoEnvio {
  impressao: string;
  /** Mensagem da resposta quando a alteração foi descartada pelo last-write-wins; `null` quando foi gravada. */
  mensagemDescarte: string | null;
}


/** Onde o servidor guarda o que recebe. Uma implementação por banco. */
export interface ArmazenamentoServidor {
  /** Registro atual (chave `Entidade:id`). */
  obter(chave: string): Guardado | undefined;
  /** Grava a versão vencedora e devolve a nova posição (cursor do pull). */
  gravar(chave: string, registro: Omit<Guardado, 'seq'>): number;
  /** Maior posição gravada até agora (0 se vazio). */
  posicaoAtual(): number;
  /** Registros da empresa gravados depois da posição `desde`, em ordem. */
  listarDesde(idEmpresa: string, desde: number): Guardado[];
  statusNaVersao(chave: string, updatedAt: string): StatusProposta | null;
  guardarStatusDaVersao(chave: string, updatedAt: string, status: StatusProposta): void;
  /** Chave: `idDispositivo|Entidade:id`. */
  ultimoEnvio(chaveEnvio: string): UltimoEnvio | undefined;
  registrarEnvio(chaveEnvio: string, envio: UltimoEnvio): void;
  registrarAuditoria(linhas: readonly RegistroAuditoria[]): void;
  registrarLogSincronizacao(linha: RegistroLogSincronizacao): void;
  adicionarAviso(aviso: AvisoSobrescrita): void;
  /** Devolve e remove os avisos pendentes do usuário. */
  retirarAvisos(idUsuario: string): AvisoSobrescrita[];
  /** Tudo ou nada (um push inteiro). */
  emTransacao<T>(tarefa: () => T): T;
}

function chave(entidade: EntidadeSincronizavel, id: string): string {
  return `${entidade}:${id}`;
}

/** Identifica uma versão enviada: o reenvio de uma resposta perdida chega igual. */
function impressaoDe(versao: VersaoRegistro): string {
  return jsonEstavel({ updatedAt: versao.updatedAt, updatedBy: versao.updatedBy, dados: versao.dados });
}

function mesmoConteudo(a: VersaoRegistro, b: VersaoRegistro): boolean {
  return a.updatedBy === b.updatedBy && jsonEstavel(a.dados) === jsonEstavel(b.dados);
}

function statusDe(versao: VersaoRegistro): StatusProposta | null {
  const status = versao.dados.status_proposta;
  return ehStatusProposta(status) ? status : null;
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

/** Porta em memória: testes e demonstrações. */
export class ArmazenamentoMemoria implements ArmazenamentoServidor {
  readonly logAuditoria: RegistroAuditoria[] = [];
  readonly logSincronizacao: RegistroLogSincronizacao[] = [];
  private readonly registros = new Map<string, Guardado>();
  private readonly envios = new Map<string, UltimoEnvio>();
  private readonly avisos: AvisoSobrescrita[] = [];
  private readonly statusPorVersao = new Map<string, Map<string, StatusProposta>>();
  private seq = 0;

  obter(chaveRegistro: string): Guardado | undefined {
    return this.registros.get(chaveRegistro);
  }
  gravar(chaveRegistro: string, registro: Omit<Guardado, 'seq'>): number {
    this.seq += 1;
    this.registros.set(chaveRegistro, { ...registro, seq: this.seq });
    return this.seq;
  }
  posicaoAtual(): number {
    return this.seq;
  }
  listarDesde(idEmpresa: string, desde: number): Guardado[] {
    return [...this.registros.values()].filter((g) => g.versao.idEmpresa === idEmpresa && g.seq > desde).sort((a, b) => a.seq - b.seq);
  }
  todos(): Guardado[] {
    return [...this.registros.values()].sort((a, b) => a.seq - b.seq);
  }
  statusNaVersao(chaveRegistro: string, updatedAt: string): StatusProposta | null {
    return this.statusPorVersao.get(chaveRegistro)?.get(updatedAt) ?? null;
  }
  guardarStatusDaVersao(chaveRegistro: string, updatedAt: string, status: StatusProposta): void {
    const porVersao = this.statusPorVersao.get(chaveRegistro) ?? new Map<string, StatusProposta>();
    porVersao.set(updatedAt, status);
    this.statusPorVersao.set(chaveRegistro, porVersao);
  }
  ultimoEnvio(chaveEnvio: string): UltimoEnvio | undefined {
    return this.envios.get(chaveEnvio);
  }
  registrarEnvio(chaveEnvio: string, envio: UltimoEnvio): void {
    this.envios.set(chaveEnvio, envio);
  }
  registrarAuditoria(linhas: readonly RegistroAuditoria[]): void {
    this.logAuditoria.push(...linhas);
  }
  registrarLogSincronizacao(linha: RegistroLogSincronizacao): void {
    this.logSincronizacao.push(linha);
  }
  adicionarAviso(aviso: AvisoSobrescrita): void {
    this.avisos.push(aviso);
  }
  retirarAvisos(idUsuario: string): AvisoSobrescrita[] {
    const meus = this.avisos.filter((a) => a.idUsuario === idUsuario);
    for (const aviso of meus) this.avisos.splice(this.avisos.indexOf(aviso), 1);
    return meus;
  }
  emTransacao<T>(tarefa: () => T): T {
    return tarefa();
  }
}

/** As regras do push e do pull, sobre qualquer armazenamento. */
export class ServidorSincronizacao {
  private readonly relogio: () => number;
  private readonly toleranciaRelogioMs: number | undefined;
  private readonly gerarId: () => string;

  constructor(
    protected readonly armazenamento: ArmazenamentoServidor,
    opcoes: OpcoesServidor = {},
  ) {
    this.relogio = opcoes.relogio ?? (() => Date.now());
    this.toleranciaRelogioMs = opcoes.toleranciaRelogioMs;
    this.gerarId = opcoes.gerarId ?? gerarIdPadrao;
  }

  /** POST /sync/push */
  push(sessao: SessaoServidor, requisicao: RequisicaoPush): RespostaPush {
    const agora = this.relogio();
    const idDispositivo = typeof requisicao?.idDispositivo === 'string' && requisicao.idDispositivo !== '' ? requisicao.idDispositivo : null;
    const ordem = (op: OperacaoSync) => (ehEntidadeSincronizavel(op?.entidade) ? ORDEM_DEPENDENCIA[op.entidade] : 99);
    const operacoes = Array.isArray(requisicao?.operacoes) ? [...requisicao.operacoes].sort((a, b) => ordem(a) - ordem(b)) : [];
    return this.armazenamento.emTransacao(() => {
      const resultados = operacoes.map((op) => this.aplicar(sessao, idDispositivo, op, agora));
      const recusadas = resultados.filter((r) => r.situacao === 'rejeitada').length;
      this.armazenamento.registrarLogSincronizacao({
        idLogSync: this.gerarId(),
        idUsuario: sessao.idUsuario,
        idDispositivo: idDispositivo ?? 'desconhecido',
        dataHora: isoDeMs(agora),
        tipo: 'Push',
        status: 'Sucesso',
        qtdRegistros: operacoes.length,
        mensagemErro: recusadas > 0 ? `${recusadas} ${recusadas === 1 ? 'registro recusado' : 'registros recusados'}.` : null,
      });
      return { horaServidor: isoDeMs(agora), resultados };
    });
  }

  /** POST /sync/pull: o que mudou desde o último cursor e os avisos do usuário. */
  pull(sessao: SessaoServidor, requisicao: RequisicaoPull & { idDispositivo?: string }): RespostaPull {
    const agora = this.relogio();
    const desde = requisicao?.cursor ? Number(requisicao.cursor) || 0 : 0;
    return this.armazenamento.emTransacao(() => {
      const registros = this.armazenamento
        .listarDesde(sessao.idEmpresa, desde)
        .map((g) => ({ entidade: g.entidade, versao: g.versao }));
      const avisos = this.armazenamento.retirarAvisos(sessao.idUsuario);
      this.armazenamento.registrarLogSincronizacao({
        idLogSync: this.gerarId(),
        idUsuario: sessao.idUsuario,
        idDispositivo: requisicao?.idDispositivo ?? 'desconhecido',
        dataHora: isoDeMs(agora),
        tipo: 'Pull',
        status: 'Sucesso',
        qtdRegistros: registros.length,
        mensagemErro: null,
      });
      return { horaServidor: isoDeMs(agora), cursor: String(this.armazenamento.posicaoAtual()), registros, avisos };
    });
  }

  /** A versão guardada de um registro. */
  obter(entidade: EntidadeSincronizavel, id: string): VersaoRegistro | undefined {
    return this.armazenamento.obter(chave(entidade, id))?.versao;
  }

  private statusNaVersao(chaveRegistro: string, updatedAt: string | null): StatusProposta | null {
    if (updatedAt === null) return null;
    return this.armazenamento.statusNaVersao(chaveRegistro, updatedAt);
  }

  private aplicar(sessao: SessaoServidor, idDispositivo: string | null, op: OperacaoSync, agora: number): ResultadoOperacao {
    const problema = problemasDaOperacao(op);
    if (problema) return rejeitada(op, 'DADOS_INVALIDOS', problema);
    const { entidade, versao } = op;

    if (versao.idEmpresa !== sessao.idEmpresa) {
      return rejeitada(op, 'OUTRA_EMPRESA', 'O registro pertence a outra empresa.');
    }
    const chaveRegistro = chave(entidade, versao.id);
    const guardado = this.armazenamento.obter(chaveRegistro);
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
      const pai = this.armazenamento.obter(chave(dependencia.entidade, idPai));
      if (!pai || pai.versao.idEmpresa !== sessao.idEmpresa) {
        return rejeitada(op, 'DEPENDENCIA_AUSENTE', `O registro ${dependencia.entidade} ${idPai} ainda não chegou ao servidor.`, true);
      }
    }

    // Reenvio de uma versão que este aparelho já tinha mandado (a resposta se
    // perdeu) e que não é mais a do servidor: ela já foi decidida da primeira
    // vez. O aparelho recebe a versão atual, sem nada novo no log nem avisos.
    const chaveEnvio = idDispositivo === null ? null : `${idDispositivo}|${chaveRegistro}`;
    const impressao = impressaoDe(versao);
    const envioAnterior = chaveEnvio === null ? undefined : this.armazenamento.ultimoEnvio(chaveEnvio);
    if (guardado && envioAnterior?.impressao === impressao && !mesmoConteudo(guardado.versao, versao)) {
      return {
        idOperacao: op.idOperacao,
        situacao: 'descartada',
        versaoServidor: guardado.versao,
        mensagem: envioAnterior.mensagemDescarte ?? mensagemReenvioSuperado(entidade),
      };
    }

    // RN11 (SCRUM-406): antes da regra de conflito. O reenvio de uma versão
    // igual à guardada não é uma edição e passa direto.
    if (entidade === 'Proposta' && !(guardado && mesmoConteudo(guardado.versao, versao))) {
      const rn11 = verificarGravacaoRN11({
        papel: sessao.papel,
        statusAtual: guardado ? statusDe(guardado.versao) : null,
        statusBase: guardado ? this.statusNaVersao(chaveRegistro, op.baseUpdatedAt ?? null) ?? statusDe(guardado.versao) : null,
        statusNovo: versao.dados.status_proposta,
      });
      if (!rn11.permitido) {
        if (chaveEnvio) this.armazenamento.registrarEnvio(chaveEnvio, { impressao, mensagemDescarte: null });
        return rejeitada(op, 'RN11', rn11.mensagem);
      }
    }

    const r = resolverConflito({
      entidade,
      atual: guardado?.versao ?? null,
      recebida: versao,
      baseUpdatedAt: op.baseUpdatedAt ?? null,
      agora,
      origem: sessao.papel === 'Gestor' ? 'Web' : 'Mobile',
      atualGravadaPeloMesmoAparelho: idDispositivo !== null && guardado?.idDispositivo === idDispositivo,
      gerarId: this.gerarId,
      ...(this.toleranciaRelogioMs !== undefined && { toleranciaRelogioMs: this.toleranciaRelogioMs }),
    });
    this.armazenamento.registrarAuditoria(r.auditoria);

    switch (r.decisao) {
      case 'repetida':
        if (chaveEnvio) this.armazenamento.registrarEnvio(chaveEnvio, { impressao, mensagemDescarte: null });
        return { idOperacao: op.idOperacao, situacao: 'aplicada', versaoAceita: r.vencedora, conflito: false, avisos: [] };
      case 'manter': {
        // Quem enviou fica sabendo na própria resposta.
        const mensagem = r.aviso?.mensagem ?? 'Havia uma versão mais recente no servidor.';
        if (chaveEnvio) this.armazenamento.registrarEnvio(chaveEnvio, { impressao, mensagemDescarte: mensagem });
        return { idOperacao: op.idOperacao, situacao: 'descartada', versaoServidor: r.vencedora, mensagem };
      }
      default:
        this.armazenamento.gravar(chaveRegistro, { entidade, versao: r.vencedora, idDispositivo });
        if (entidade === 'Proposta') {
          const status = statusDe(r.vencedora);
          if (status !== null) this.armazenamento.guardarStatusDaVersao(chaveRegistro, r.vencedora.updatedAt, status);
        }
        if (chaveEnvio) this.armazenamento.registrarEnvio(chaveEnvio, { impressao, mensagemDescarte: null });
        // Quem teve a alteração sobrescrita fica sabendo no próximo pull.
        if (r.aviso) this.armazenamento.adicionarAviso(r.aviso);
        return { idOperacao: op.idOperacao, situacao: 'aplicada', versaoAceita: r.vencedora, conflito: r.conflito, avisos: r.observacoes };
    }
  }
}

/** Servidor de referência em memória (testes de integração e do app). */
export class ServidorSincronizacaoMemoria extends ServidorSincronizacao {
  private readonly memoria: ArmazenamentoMemoria;

  constructor(opcoes: OpcoesServidor = {}) {
    const memoria = new ArmazenamentoMemoria();
    super(memoria, opcoes);
    this.memoria = memoria;
  }

  get logAuditoria(): RegistroAuditoria[] {
    return this.memoria.logAuditoria;
  }

  get logSincronizacao(): RegistroLogSincronizacao[] {
    return this.memoria.logSincronizacao;
  }

  /** Para os testes: todos os registros de uma entidade. */
  listar(entidade: EntidadeSincronizavel): VersaoRegistro[] {
    return this.memoria.todos().filter((g) => g.entidade === entidade).map((g) => g.versao);
  }
}
