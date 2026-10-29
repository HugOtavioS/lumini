import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { config } from '@/data/config';
import { rodarSyncEmSegundoPlano } from './backgroundSyncRunner';
import { openLocalDatabase } from './openDatabase';
import { QueueSyncService } from './syncService';

// SCRUM-18 (Misael) — sincronização automática com o app em segundo plano ou
// fechado (expo-task-manager + expo-background-task). Com o app aberto, a volta
// da rede já dispara o envio pela própria fila (AppStore → setOnline).
//
// Limitações (da análise do Misael):
// - iOS (BGTaskScheduler): o sistema decide quando rodar (uso, bateria, rede);
//   sem garantia de horário; não roda se o usuário encerrar o app à força;
//   testar em aparelho, não no simulador.
// - Android (WorkManager): intervalo mínimo de 15 min; otimização de bateria
//   de alguns fabricantes pode adiar — orientar o técnico a liberar o app.
// - Precisa de development build (módulo nativo), não roda no Expo Go.

export const NOME_TAREFA_SYNC = 'lumini-sync-propostas';
export const INTERVALO_MINIMO_SYNC_MINUTOS = 15;

// Definida no carregamento do módulo (escopo global), como o TaskManager exige.
if (!TaskManager.isTaskDefined(NOME_TAREFA_SYNC)) {
  TaskManager.defineTask(NOME_TAREFA_SYNC, async () => {
    try {
      const resultado = await rodarSyncEmSegundoPlano({
        hasApi: config.hasApi,
        abrirBanco: openLocalDatabase,
        criarServico: (ctx, banco) =>
          QueueSyncService.create(
            // JWT entra com o login real (SCRUM-397); no segundo plano virá do armazenamento seguro.
            { ctx, onUpdate: () => {}, getToken: () => null, isOnline: true },
            banco,
          ),
      });
      return resultado === 'com_erro'
        ? BackgroundTask.BackgroundTaskResult.Failed
        : BackgroundTask.BackgroundTaskResult.Success;
    } catch (erro) {
      console.error('[sync] Falha na sincronização em segundo plano:', erro);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/** Registra a tarefa periódica no sistema (idempotente). `false` se o SO não permitir. */
export async function registrarTarefaSync(): Promise<boolean> {
  if (!config.hasApi) return false;
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
  if (!(await TaskManager.isTaskRegisteredAsync(NOME_TAREFA_SYNC))) {
    await BackgroundTask.registerTaskAsync(NOME_TAREFA_SYNC, { minimumInterval: INTERVALO_MINIMO_SYNC_MINUTOS });
  }
  return true;
}

export async function cancelarTarefaSync(): Promise<void> {
  if (await TaskManager.isTaskRegisteredAsync(NOME_TAREFA_SYNC)) {
    await BackgroundTask.unregisterTaskAsync(NOME_TAREFA_SYNC);
  }
}
