import { Linking } from 'react-native';

import type { Proposal } from '@/domain/entities';
import { describePaymentCondition } from '@/domain/labels';
import { formatCurrency, formatNumber, slugifyFileName } from '@/utils/format';
import { notify } from '@/utils/notify';

export function proposalFileName(proposal: Proposal): string {
  return `Proposta_${slugifyFileName(proposal.client.name)}.pdf`;
}

/**
 * Abre o WhatsApp com o resumo da proposta. O anexo do PDF entra junto com a
 * geração do documento (RF12), via compartilhamento nativo de arquivos.
 */
function summaryText(proposal: Proposal): string {
  return [
    `Olá, ${proposal.client.name.split(' ')[0]}! Segue a sua proposta de energia solar Lumini (${proposal.number}).`,
    `Sistema de ${formatNumber(proposal.systemKwp, 2)} kWp, investimento de ${formatCurrency(proposal.pricing.total)}.`,
    // SCRUM-399
    `Condição de pagamento: ${describePaymentCondition(proposal.paymentCondition, proposal.pricing.total, formatCurrency)}.`,
    `Economia estimada em 25 anos: ${formatCurrency(proposal.viability.savings25y, 0)}.`,
  ].join('\n');
}

/** Canais disponíveis com os contatos do cliente (SCRUM-398). */
export function shareChannels(proposal: Proposal): { whatsapp: boolean; email: boolean } {
  return {
    whatsapp: proposal.client.whatsapp.replace(/\D/g, '').length >= 10,
    email: proposal.client.email.trim().length > 0,
  };
}

export async function shareViaWhatsApp(proposal: Proposal): Promise<void> {
  const phone = proposal.client.whatsapp.replace(/\D/g, '');
  if (!phone) {
    notify('Sem WhatsApp', 'O cliente não tem WhatsApp cadastrado. Envie a proposta por e-mail.');
    return;
  }
  const text = summaryText(proposal);
  const url = `https://wa.me/${phone ? `55${phone}` : ''}?text=${encodeURIComponent(text)}`;
  try {
    await Linking.openURL(url);
  } catch {
    notify('WhatsApp indisponível', 'Não foi possível abrir o WhatsApp neste dispositivo.');
  }
}

/** Abre o app de e-mail com o resumo da proposta para o e-mail do cliente (SCRUM-398). */
export async function shareViaEmail(proposal: Proposal): Promise<void> {
  const email = proposal.client.email.trim();
  if (!email) {
    notify('Sem e-mail', 'O cliente não tem e-mail cadastrado. Envie a proposta pelo WhatsApp.');
    return;
  }
  const subject = `Proposta de energia solar ${proposal.number}`;
  const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(summaryText(proposal))}`;
  try {
    await Linking.openURL(url);
  } catch {
    notify('E-mail indisponível', 'Não foi possível abrir o aplicativo de e-mail neste dispositivo.');
  }
}

/** Envia pelo canal disponível: WhatsApp primeiro, e-mail se não houver WhatsApp. */
export async function shareProposal(proposal: Proposal): Promise<void> {
  const channels = shareChannels(proposal);
  if (channels.whatsapp) return shareViaWhatsApp(proposal);
  if (channels.email) return shareViaEmail(proposal);
  notify('Sem contato', 'Cadastre o WhatsApp ou o e-mail do cliente para enviar a proposta.');
}
