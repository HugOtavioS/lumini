import { cacheDirectory, deleteAsync, moveAsync } from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { Proposal } from '@/domain/entities';
import { notify } from '@/utils/notify';
import { proposalFileName } from '../share';
import { buildProposalHtml, type PdfExtras } from './template';

// SCRUM-22 / SCRUM-89 — PDF real da proposta no aparelho (RF12).
// expo-print transforma o HTML do template (SCRUM-23) em um arquivo A4 no
// próprio celular, sem internet; expo-sharing abre o compartilhamento nativo
// com o PDF anexado (WhatsApp, e-mail, Drive...). No navegador (preview web),
// abre a janela de impressão, onde dá para "Salvar como PDF".

const A4 = { width: 595, height: 842 };

/** Gera o arquivo PDF e devolve o caminho local (null no navegador). */
export async function generateProposalPdf(proposal: Proposal, extras: PdfExtras): Promise<string | null> {
  const html = buildProposalHtml(proposal, extras);
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return null;
  }
  const { uri } = await Print.printToFileAsync({ html, ...A4 });
  // Nome legível no anexo ("Proposta_Joao_Silva_v2.pdf") em vez do nome aleatório.
  if (!cacheDirectory) return uri;
  const target = `${cacheDirectory}${proposalFileName(proposal).replace(/\.pdf$/, '')}_v${proposal.version}.pdf`;
  try {
    await deleteAsync(target, { idempotent: true });
    await moveAsync({ from: uri, to: target });
    return target;
  } catch {
    return uri;
  }
}

/** Abre a pré-visualização do PDF (impressão do sistema). */
export async function openProposalPdf(proposal: Proposal, extras: PdfExtras): Promise<void> {
  try {
    const uri = await generateProposalPdf(proposal, extras);
    if (uri) await Print.printAsync({ uri });
  } catch {
    notify('PDF indisponível', 'Não foi possível gerar o PDF neste aparelho. Tente de novo.');
  }
}

/** Gera o PDF e abre o compartilhamento nativo com o arquivo anexado. */
export async function shareProposalPdf(proposal: Proposal, extras: PdfExtras): Promise<boolean> {
  try {
    const uri = await generateProposalPdf(proposal, extras);
    if (!uri) return true; // navegador: a janela de impressão já abriu
    if (!(await Sharing.isAvailableAsync())) {
      notify('Compartilhamento indisponível', 'Este aparelho não permite compartilhar arquivos. Use o envio por WhatsApp ou e-mail.');
      return false;
    }
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `Proposta ${proposal.number}` });
    return true;
  } catch {
    notify('PDF indisponível', 'Não foi possível gerar o PDF neste aparelho. Tente de novo.');
    return false;
  }
}
