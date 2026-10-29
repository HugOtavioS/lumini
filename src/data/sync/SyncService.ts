/**
 * SyncService.ts
 *
 * SCRUM-18 — Envio automático das propostas pendentes (geradas offline).
 * SCRUM-405 — Integração com a RN07: podeSincronizar é avaliada antes de enfileirar
 *             e novamente antes de cada envio.
 *
 * Fluxo de sincronizarPendentes():
 * 1. Sem rede → não executa.
 * 2. Adquire o lock persistente (e reaproveita a execução em andamento no mesmo runtime).
 * 3. Recupera itens presos em 'sincronizando' por um encerramento abrupto.
 * 4. Para cada item elegível: revalida a RN07 → 'sincronizando' → monta o payload
 *    (contrato SCRUM-67) → upload com retry e backoff → 'sincronizada' ou 'erro'.
 *
 * Idempotência: cada upload leva a chave de idempotência = ID da proposta.
 * Reenviar a mesma proposta não deve duplicar registros no servidor
 * (o servidor precisa fazer upsert por essa chave; ver pendências).
 */

import {
  EstadoPropostaSync,
  podeSincronizar,
} from '@/domain/proposta/podeSincronizar';
import { atrasoBackoffExponencial } from './backoff';
import { ErroEnvioSync, normalizarErroEnvio } from './ErroEnvioSync';
import type { MonitorRede } from './networkMonitor';
import type { FilaSync, ItemFilaSync, SituacaoEnfileiramento } from './syncQueue';
import type { SyncLock } from './syncLock';

/**
 * Acesso às propostas locais. Implementado pelo repositório de propostas
 * (PENDÊNCIA: merge com o repositório do SCRUM-41/66).
 */
export interface FontePropostasSync<TPayload> {
  obterEstado(propostaId: string): Promise<EstadoPropostaSync | undefined>;
  /** Monta o payload de upload conforme o contrato do SCRUM-67. */
  montarPayload(propostaId: string): Promise<TPayload>;
}

export interface ApiSync<TPayload> {
  /** Deve lançar ErroEnvioSync em caso de falha. */
  enviarProposta(payload: TPayload, chaveIdempotencia: string): Promise<void>;
}

export interface ConfigSync {
  /** Tentativas de upload dentro de uma mesma execução. */
  tentativasPorExecucao: number;
  /** Base do backoff entre tentativas na mesma execução. */
  backoffEnvioBaseMs: number;
  backoffEnvioMaxMs: number;
  /** Base do reagendamento entre execuções, após esgotar as tentativas da execução. */
  reagendamentoBaseMs: number;
  reagendamentoMaxMs: number;
  /** Execuções com falha antes de parar de reenviar automaticamente. */
  maxTentativas: number;
  /** Duração do lock. Deve ser maior que a execução mais longa esperada. */
  duracaoLockMs: number;
  /** Itens processados por execução (o iOS limita o tempo em background). */
  limitePorExecucao: number;
}

/**
 * Valores padrão: decisões operacionais, não dados externos. Ajustáveis por injeção.
 * - 3 tentativas com 2 s → 4 s de espera cabem na janela curta de background do iOS.
 * - Reagendamento 1 min, 2 min, 4 min... até 6 h evita gastar bateria com servidor fora do ar.
 * - Após 10 execuções com falha o item fica em 'erro' sem reenvio automático.
 */
export const CONFIG_SYNC_PADRAO: ConfigSync = {
  tentativasPorExecucao: 3,
  backoffEnvioBaseMs: 2_000,
  backoffEnvioMaxMs: 10_000,
  reagendamentoBaseMs: 60_000,
  reagendamentoMaxMs: 6 * 60 * 60_000,
  maxTentativas: 10,
  duracaoLockMs: 5 * 60_000,
  limitePorExecucao: 20,
};

export interface DependenciasSyncService<TPayload> {
  fila: FilaSync;
  lock: SyncLock;
  propostas: FontePropostasSync<TPayload>;
  api: ApiSync<TPayload>;
  rede: MonitorRede;
  config?: Partial<ConfigSync>;
  agora?: () => number;
  esperar?: (ms: number) => Promise<void>;
  /** Identificador desta instância como dona do lock. */
  idInstancia?: string;
}

export type ResultadoEnfileirar =
  | { enfileirada: true; situacao: SituacaoEnfileiramento }
  | { enfileirada: false; motivos: string[] };

export type MotivoNaoExecucao = 'sem-rede' | 'lock-ocupado';

export interface ResumoSync {
  executada: boolean;
  motivoNaoExecucao?: MotivoNaoExecucao;
  enviadas: string[];
  /** Falharam e foram reagendadas ou marcadas como erro definitivo. */
  falhas: string[];
  /** Barradas pela RN07 no momento do envio. */
  bloqueadas: string[];
  /** A rede caiu durante a execução; voltam para 'pendente' sem contar tentativa. */
  interrompidaPorRede: boolean;
}

/** Contrato mínimo consumido pela camada app (tarefa em background, reconexão). */
export interface ServicoSincronizacao {
  sincronizarPendentes(): Promise<ResumoSync>;
}

type ResultadoEnvio =
  | { tipo: 'ok' }
  | { tipo: 'rede-perdida' }
  | { tipo: 'falha'; erro: ErroEnvioSync };

const esperarPadrao = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function resumoVazio(): ResumoSync {
  return { executada: true, enviadas: [], falhas: [], bloqueadas: [], interrompidaPorRede: false };
}

export class SyncService<TPayload> implements ServicoSincronizacao {
  private readonly config: ConfigSync;
  private readonly agora: () => number;
  private readonly esperar: (ms: number) => Promise<void>;
  private readonly idInstancia: string;
  private execucaoAtual: Promise<ResumoSync> | null = null;

  constructor(private readonly deps: DependenciasSyncService<TPayload>) {
    this.config = { ...CONFIG_SYNC_PADRAO, ...deps.config };
    this.agora = deps.agora ?? Date.now;
    this.esperar = deps.esperar ?? esperarPadrao;
    this.idInstancia =
      deps.idInstancia ?? `sync-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  /**
   * Coloca a proposta na fila de sync, somente se a RN07 permitir (SCRUM-405).
   */
  async enfileirar(propostaId: string): Promise<ResultadoEnfileirar> {
    const estado = await this.deps.propostas.obterEstado(propostaId);
    if (!estado) {
      return { enfileirada: false, motivos: [`Proposta ${propostaId} não encontrada.`] };
    }

    const validacao = podeSincronizar(estado);
    if (!validacao.permitido) {
      return { enfileirada: false, motivos: validacao.motivos };
    }

    const situacao = await this.deps.fila.enfileirar(propostaId, this.agora());
    return { enfileirada: true, situacao };
  }

  /**
   * Envia as propostas elegíveis. Chamadas concorrentes no mesmo runtime
   * recebem a mesma execução; entre runtimes, o lock persistente decide.
   */
  sincronizarPendentes(): Promise<ResumoSync> {
    if (!this.execucaoAtual) {
      this.execucaoAtual = this.executar().finally(() => {
        this.execucaoAtual = null;
      });
    }
    return this.execucaoAtual;
  }

  private async executar(): Promise<ResumoSync> {
    if (!(await this.deps.rede.estaOnline())) {
      return { ...resumoVazio(), executada: false, motivoNaoExecucao: 'sem-rede' };
    }

    const { lock, fila } = this.deps;
    const adquirido = await lock.adquirir(this.idInstancia, this.agora(), this.config.duracaoLockMs);
    if (!adquirido) {
      return { ...resumoVazio(), executada: false, motivoNaoExecucao: 'lock-ocupado' };
    }

    const resumo = resumoVazio();
    try {
      // Com o lock em mãos, nenhum outro envio está em curso: 'sincronizando' é resíduo.
      await fila.recuperarTravadas(this.agora());
      const itens = await fila.listarElegiveis(this.agora(), this.config.limitePorExecucao);

      for (const item of itens) {
        const continuar = await this.processarItem(item, resumo);
        if (!continuar) break;
      }
    } finally {
      await lock.liberar(this.idInstancia);
    }
    return resumo;
  }

  /** Retorna false quando a execução deve parar (rede perdida). */
  private async processarItem(item: ItemFilaSync, resumo: ResumoSync): Promise<boolean> {
    const { fila, propostas } = this.deps;
    const id = item.propostaId;

    const estado = await propostas.obterEstado(id);
    const validacao = estado
      ? podeSincronizar(estado)
      : { permitido: false, motivos: [`Proposta ${id} não encontrada.`] };

    if (!validacao.permitido) {
      await fila.marcarErro(
        id,
        { tentativas: item.tentativas, proximoEnvioEm: null, mensagem: validacao.motivos.join(' ') },
        this.agora(),
      );
      resumo.bloqueadas.push(id);
      return true;
    }

    await fila.marcarSincronizando(id, this.agora());

    let resultado: ResultadoEnvio;
    try {
      const payload = await propostas.montarPayload(id);
      resultado = await this.enviarComRetry(payload, id);
    } catch (erro) {
      // Falha ao montar o payload é local e não se resolve sozinha.
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      resultado = {
        tipo: 'falha',
        erro: new ErroEnvioSync(`Falha ao montar payload: ${mensagem}`, false),
      };
    }

    switch (resultado.tipo) {
      case 'ok':
        await fila.marcarSincronizada(id, this.agora());
        resumo.enviadas.push(id);
        return true;

      case 'rede-perdida':
        await fila.devolverParaPendente(id, this.agora());
        resumo.interrompidaPorRede = true;
        return false;

      case 'falha': {
        const tentativas = item.tentativas + 1;
        const reenviar = resultado.erro.retentavel && tentativas < this.config.maxTentativas;
        const proximoEnvioEm = reenviar
          ? this.agora() +
            atrasoBackoffExponencial(
              tentativas - 1,
              this.config.reagendamentoBaseMs,
              this.config.reagendamentoMaxMs,
            )
          : null;

        await fila.marcarErro(
          id,
          { tentativas, proximoEnvioEm, mensagem: resultado.erro.message },
          this.agora(),
        );
        resumo.falhas.push(id);
        return true;
      }
    }
  }

  private async enviarComRetry(payload: TPayload, chave: string): Promise<ResultadoEnvio> {
    const { api, rede } = this.deps;
    const { tentativasPorExecucao, backoffEnvioBaseMs, backoffEnvioMaxMs } = this.config;
    let ultimoErro = new ErroEnvioSync('Nenhuma tentativa de envio realizada.', true);

    for (let tentativa = 0; tentativa < tentativasPorExecucao; tentativa++) {
      try {
        await api.enviarProposta(payload, chave);
        return { tipo: 'ok' };
      } catch (erro) {
        ultimoErro = normalizarErroEnvio(erro);
        if (!ultimoErro.retentavel) break;
        if (!(await rede.estaOnline())) return { tipo: 'rede-perdida' };
        if (tentativa < tentativasPorExecucao - 1) {
          await this.esperar(
            atrasoBackoffExponencial(tentativa, backoffEnvioBaseMs, backoffEnvioMaxMs),
          );
        }
      }
    }

    return { tipo: 'falha', erro: ultimoErro };
  }
}
