/**
 * Ambiente dos testes de integração (SCRUM-86): aparelhos com SQLite de
 * verdade em arquivo, uma rede que cai e volta, e o servidor de referência.
 */
import type { AvisoSobrescrita, EntidadeSincronizavel, RequisicaoPush, RespostaPush, VersaoRegistro } from '../contrato';
import { FilaSincronizacao, podeEntrarNaFila, type EventoFila, type OpcoesFila, type SyncStatus } from '../fila/fila';
import { aplicarPull } from '../recebimento';
import type { ServidorSincronizacaoMemoria, SessaoServidor } from '../servidor/servidorReferencia';
import { ErroDeRede, ErroHttp, type TransporteSync } from '../transporte';
import { EMPRESA, clonar } from './registros';
import { abrirBanco, type BancoDeTeste } from './sqlite';

/** A rede entre os aparelhos e a API. */
export class Rede {
  /** A internet existe (para todos). */
  online = true;
  /** A API está fora do ar (os aparelhos têm internet, mas o push falha). */
  apiForaDoAr = false;
  /** A próxima resposta se perde depois de o servidor aplicar (conexão cai no meio). */
  perderProximaResposta = false;
  /** Quantas requisições chegaram ao servidor. */
  pushesRecebidos = 0;
}

export interface RegistroLocal {
  entidade: EntidadeSincronizavel;
  versao: VersaoRegistro;
  syncStatus: SyncStatus;
}

const SQL_REGISTROS_LOCAIS = `CREATE TABLE IF NOT EXISTS registros_locais (
  chave TEXT PRIMARY KEY NOT NULL,
  entidade TEXT NOT NULL,
  payload TEXT NOT NULL,
  sync_status TEXT NOT NULL
)`;

/**
 * Um celular com o app: grava os registros no SQLite (como os repositórios do
 * app farão), põe na fila o que pode subir e reage aos eventos da fila.
 */
export class AparelhoSimulado {
  online = true;
  readonly eventos: EventoFila[] = [];
  readonly avisos: AvisoSobrescrita[] = [];
  /** Mensagens que o app mostraria ao técnico (conflitos perdidos e avisos do pull). */
  readonly mensagens: string[] = [];
  fila!: FilaSincronizacao;
  private aberto: BancoDeTeste | null = null;
  private cursor: string | null = null;

  constructor(
    readonly nome: string,
    readonly sessao: SessaoServidor,
    private readonly caminhoBanco: string,
    private readonly servidor: ServidorSincronizacaoMemoria,
    private readonly rede: Rede,
    private readonly opcoesFila: Partial<OpcoesFila> = {},
  ) {}

  /** Abre o app: banco, tabelas e fila (que já tenta enviar o que estiver pendente). */
  async abrir(): Promise<void> {
    this.aberto = abrirBanco(this.caminhoBanco);
    await this.aberto.banco.executar(SQL_REGISTROS_LOCAIS);
    this.fila = await FilaSincronizacao.abrir({
      banco: this.aberto.banco,
      transporte: this.transporte(),
      idDispositivo: `aparelho-${this.nome}`,
      idUsuario: this.sessao.idUsuario,
      conectividade: { estaOnline: () => this.online && this.rede.online },
      esperaAposEnfileirarMs: null,
      aleatorio: () => 1,
      aoResultado: (e) => this.aoResultado(e),
      ...this.opcoesFila,
    });
    await this.fila.iniciar();
  }

  /** Fecha o app (ou o sistema mata o processo). */
  fechar(): void {
    this.fila.parar();
    this.aberto?.fechar();
    this.aberto = null;
  }

  get banco(): BancoDeTeste {
    if (!this.aberto) throw new Error(`O app do aparelho ${this.nome} está fechado.`);
    return this.aberto;
  }

  desconectar(): void {
    this.online = false;
  }

  /** A conexão voltou (o NetInfo avisa o app). */
  async conectar() {
    this.online = true;
    return this.fila.aoMudarConexao(true);
  }

  /**
   * O técnico salva um registro. `em` é a hora do relógio do aparelho.
   * Devolve `true` se o registro entrou na fila.
   */
  async salvar(entidade: EntidadeSincronizavel, id: string, dados: Record<string, unknown>, em: string): Promise<boolean> {
    const anterior = await this.registro(entidade, id);
    const versao: VersaoRegistro = { id, idEmpresa: EMPRESA, updatedAt: em, updatedBy: this.sessao.idUsuario, dados: clonar(dados) };
    await this.gravarLocal({ entidade, versao, syncStatus: 'Pendente' });
    const entrada = {
      entidade,
      versao,
      // A base é a última versão confirmada pelo servidor, se havia uma.
      baseUpdatedAt: anterior?.syncStatus === 'Sincronizado' ? anterior.versao.updatedAt : null,
    };
    if (!podeEntrarNaFila(entrada)) return false; // RN07: fica só no aparelho
    await this.fila.enfileirar(entrada);
    return true;
  }

  /** Pull (login, refresh ou depois do push). */
  async puxar(): Promise<{ aplicados: number; mantidosPorPendencia: number }> {
    if (!this.online || !this.rede.online) throw new ErroDeRede('Sem conexão.');
    const resposta = clonar(this.servidor.pull(this.sessao, { cursor: this.cursor, idDispositivo: `aparelho-${this.nome}` }));
    this.cursor = resposta.cursor;
    for (const aviso of resposta.avisos) {
      this.avisos.push(aviso);
      this.mensagens.push(aviso.mensagem);
    }
    return aplicarPull(resposta, {
      temPendencia: async (entidade, id) => (await this.fila.obter(entidade, id)) !== null,
      salvarLocal: (entidade, versao) => this.gravarLocal({ entidade, versao, syncStatus: 'Sincronizado' }),
    });
  }

  async registro(entidade: EntidadeSincronizavel, id: string): Promise<RegistroLocal | undefined> {
    const [linha] = await this.banco.banco.consultar<{ payload: string; sync_status: SyncStatus }>(
      'SELECT payload, sync_status FROM registros_locais WHERE chave = ?',
      [`${entidade}:${id}`],
    );
    return linha ? { entidade, versao: JSON.parse(linha.payload) as VersaoRegistro, syncStatus: linha.sync_status } : undefined;
  }

  private async gravarLocal(r: RegistroLocal): Promise<void> {
    await this.banco.banco.executar(
      `INSERT INTO registros_locais (chave, entidade, payload, sync_status) VALUES (?, ?, ?, ?)
       ON CONFLICT (chave) DO UPDATE SET payload = excluded.payload, sync_status = excluded.sync_status`,
      [`${r.entidade}:${r.versao.id}`, r.entidade, JSON.stringify(r.versao), r.syncStatus],
    );
  }

  private async aoResultado(evento: EventoFila): Promise<void> {
    this.eventos.push(evento);
    const local = await this.registro(evento.entidade, evento.idRegistro);
    if (evento.tipo === 'sincronizado') {
      if (!evento.aindaPendente && local) {
        // Grava o updated_at aceito (o servidor pode ter corrigido o relógio).
        await this.gravarLocal({ ...local, versao: { ...local.versao, updatedAt: evento.versaoAceita.updatedAt }, syncStatus: 'Sincronizado' });
      }
    } else if (evento.tipo === 'substituido') {
      this.mensagens.push(evento.mensagem);
      if (!evento.aindaPendente) await this.gravarLocal({ entidade: evento.entidade, versao: evento.versaoServidor, syncStatus: 'Sincronizado' });
    } else if (local) {
      await this.gravarLocal({ ...local, syncStatus: 'Erro' });
    }
  }

  private transporte(): TransporteSync {
    return {
      enviar: async (req: RequisicaoPush): Promise<RespostaPush> => {
        if (!this.online || !this.rede.online) throw new ErroDeRede('Sem conexão com a internet.');
        if (this.rede.apiForaDoAr) throw new ErroHttp(503, 'A API respondeu HTTP 503.');
        this.rede.pushesRecebidos += 1;
        const resposta = this.servidor.push(this.sessao, clonar(req));
        if (this.rede.perderProximaResposta) {
          this.rede.perderProximaResposta = false;
          throw new ErroDeRede('A conexão caiu antes de a resposta chegar.');
        }
        return clonar(resposta);
      },
    };
  }
}
