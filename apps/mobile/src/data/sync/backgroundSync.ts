// No navegador (preview web) não há tarefa em segundo plano: a fila real só
// roda no aparelho. Ver backgroundSync.native.ts.

export const NOME_TAREFA_SYNC = 'lumini-sync-propostas';

export async function registrarTarefaSync(): Promise<boolean> {
  return false;
}

export async function cancelarTarefaSync(): Promise<void> {}
