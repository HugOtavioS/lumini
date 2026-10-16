import { Linking } from 'react-native';

import type { Proposal } from '@/domain/entities';
import { formatCurrency, formatNumber, slugifyFileName } from '@/utils/format';
import { notify } from '@/utils/notify';

export function proposalFileName(proposal: Proposal): string {
  return `Proposta_${slugifyFileName(proposal.client.name)}.pdf`;
}

/**
 * Abre o WhatsApp com o resumo da proposta. O anexo do PDF entra junto com a
 * geração do documento (RF12), via compartilhamento nativo de arquivos.
 */
export async function shareViaWhatsApp(proposal: Proposal): Promise<void> {
  const phone = proposal.client.whatsapp.replace(/\D/g, '');
  const text = [
    `Olá, ${proposal.client.name.split(' ')[0]}! Segue a sua proposta de energia solar Lumini (${proposal.number}).`,
    `Sistema de ${formatNumber(proposal.systemKwp, 2)} kWp, investimento de ${formatCurrency(proposal.pricing.total)}.`,
    `Economia estimada em 25 anos: ${formatCurrency(proposal.viability.savings25y, 0)}.`,
  ].join('\n');
  const url = `https://wa.me/${phone ? `55${phone}` : ''}?text=${encodeURIComponent(text)}`;
  try {
    await Linking.openURL(url);
  } catch {
    notify('WhatsApp indisponível', 'Não foi possível abrir o WhatsApp neste dispositivo.');
  }
}
