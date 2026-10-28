import type { SyncOutcome } from '@/data/sync/syncService';
import { notify } from '@/utils/notify';

/** Mensagem do resultado do "Forçar sincronização agora" (SCRUM-404), no Perfil e no Histórico. */
export function notifySyncOutcome(outcome: SyncOutcome): void {
  if (outcome === 'offline') notify('Sem conexão', 'Não há conexão no momento. Tentaremos novamente assim que ela voltar.');
  if (outcome === 'nada_pendente') notify('Tudo sincronizado', 'Não há propostas pendentes de sincronização.');
  if (outcome === 'com_erro') notify('Sincronização incompleta', 'Alguns registros não subiram. Veja o status de cada proposta no Histórico.');
}
