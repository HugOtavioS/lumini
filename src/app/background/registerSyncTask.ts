/**
 * registerSyncTask.ts
 *
 * SCRUM-18 — Registro da sincronização automática, sem ação manual do técnico.
 *
 * Dois gatilhos complementares:
 * 1. Background (app em segundo plano ou fechado): expo-task-manager + expo-background-task,
 *    executado periodicamente pelo sistema operacional.
 * 2. Primeiro plano: NetInfo detecta a volta da rede e dispara o envio na hora.
 *
 * Uso (no arquivo de entrada do app, em escopo global, fora de componentes):
 *
 *   definirTarefaSync(criarSyncService);   // obrigatório em escopo global
 *   registrarTarefaSync();                 // na inicialização
 *   iniciarSyncAoReconectar(syncService);  // enquanto o app estiver aberto
 *
 * `criarSyncService` é a composição (db do SCRUM-66 já migrado + FilaSyncSqlite +
 * SyncLockSqlite + repositório de propostas + SyncApiHttp com obterApiBaseUrl()).
 * A tarefa em background pode rodar com o app fechado, então a fábrica precisa
 * abrir e inicializar o banco por conta própria (inicializarBancoDeDados).
 *
 * ── Limitações por plataforma ──
 * iOS:
 *   - O sistema (BGTaskScheduler) decide quando executar, com base em uso do app,
 *     bateria e rede. Não há garantia de horário nem de frequência.
 *   - A janela de execução é curta; por isso o SyncService processa no máximo
 *     `limitePorExecucao` itens e o restante fica para a próxima execução.
 *   - Se o usuário encerrar o app à força (swipe), o iOS não executa a tarefa
 *     até o app ser aberto de novo.
 *   - Não funciona no simulador de forma confiável; testar em aparelho.
 * Android:
 *   - Usa WorkManager; intervalo mínimo de 15 minutos.
 *   - Otimização de bateria do fabricante (Xiaomi, Samsung, Huawei...) pode adiar
 *     ou cancelar execuções. Orientar o técnico a liberar o app da otimização de bateria.
 *   - A tarefa pode rodar em um runtime JS separado: por isso o lock é persistente
 *     (SyncLockSqlite) e não só em memória.
 * Ambas: o gatilho de reconexão (NetInfo) só funciona com o app em primeiro plano.
 *
 * ⚠️ PENDÊNCIA: confirmar se o projeto é Expo (managed/prebuild). Em React Native
 *    bare sem expo-modules, trocar este arquivo por react-native-background-fetch,
 *    mantendo o SyncService intacto.
 */

import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import NetInfo from '@react-native-community/netinfo';
import { criarMonitorRede, FonteEstadoRede } from '@/data/sync/networkMonitor';
import type { ServicoSincronizacao } from '@/data/sync/SyncService';

export const NOME_TAREFA_SYNC = 'lumini-sync-propostas';

/** Mínimo aceito pelo Android WorkManager; o iOS trata como sugestão. */
export const INTERVALO_MINIMO_SYNC_MINUTOS = 15;

export type FabricaSyncService = () => Promise<ServicoSincronizacao>;

/** Define o executor da tarefa. Deve ser chamado em escopo global, no carregamento do app. */
export function definirTarefaSync(criarSyncService: FabricaSyncService): void {
  if (TaskManager.isTaskDefined(NOME_TAREFA_SYNC)) return;

  TaskManager.defineTask(NOME_TAREFA_SYNC, async () => {
    try {
      const servico = await criarSyncService();
      const resumo = await servico.sincronizarPendentes();
      return resumo.falhas.length > 0
        ? BackgroundTask.BackgroundTaskResult.Failed
        : BackgroundTask.BackgroundTaskResult.Success;
    } catch (erro) {
      console.error('[registerSyncTask] Falha na sincronização em background:', erro);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/**
 * Registra a tarefa periódica no sistema operacional (idempotente).
 * Retorna false quando o background está indisponível (ex.: restrito pelo usuário).
 */
export async function registrarTarefaSync(): Promise<boolean> {
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;

  if (!(await TaskManager.isTaskRegisteredAsync(NOME_TAREFA_SYNC))) {
    await BackgroundTask.registerTaskAsync(NOME_TAREFA_SYNC, {
      minimumInterval: INTERVALO_MINIMO_SYNC_MINUTOS,
    });
  }
  return true;
}

/**
 * Dispara a sincronização sempre que a rede volta (app em primeiro plano).
 * Retorna a função para parar de observar.
 */
export function iniciarSyncAoReconectar(
  servico: ServicoSincronizacao,
  fonteRede: FonteEstadoRede = NetInfo,
): () => void {
  return criarMonitorRede(fonteRede).aoReconectar(() => {
    servico.sincronizarPendentes().catch((erro: unknown) => {
      console.error('[registerSyncTask] Falha na sincronização ao reconectar:', erro);
    });
  });
}
