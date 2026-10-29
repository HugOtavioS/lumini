import {
  ORDEM_DEPENDENCIA,
  idOperacaoDe,
  podeEntrarNaFila,
  type EntidadeSincronizavel,
  type EntradaFila,
} from '@lumini/sync';

import type { PaymentConditionType, Proposal, TariffModality, UpgradeRequest } from '@/domain/entities';
import { connectionTypeLabels, roofTypeLabels } from '@/domain/labels';
import { netAdjustmentPct, unitPrice } from '@/domain/services/pricing';
import { statusParaContrato } from './status';

// Converte a proposta do app nos registros do contrato da sincronização
// (@lumini/sync), com os nomes de campo do Dicionário de Dados v1.4.
//
// Enquanto os repositórios em SQLite (RF15) não existem, o app guarda cliente,
// instalação e medição dentro da proposta. Os ids desses registros são
// derivados do id da proposta, de forma estável: o mesmo cliente gera sempre o
// mesmo id, e o servidor reconhece o reenvio. Quando houver repositórios, cada
// registro passa a ter o próprio UUID e basta trocar as funções `idDe*`.

export interface ContextoSync {
  idEmpresa: string;
  idUsuario: string;
}

export const idClienteDe = (proposalId: string) => `cli-${proposalId}`;
export const idInstalacaoDe = (proposalId: string) => `ins-${proposalId}`;
export const idMedicaoDe = (proposalId: string, sectionId: string) => `med-${proposalId}-${sectionId}`;
export const idSimulacaoDe = (proposalId: string) => `sim-${proposalId}`;

const MODALIDADE: Record<TariffModality, string> = { convencional: 'Convencional', branca: 'Branca' };
const CONDICAO: Record<PaymentConditionType, string> = {
  a_vista: 'À vista',
  parcelado: 'Parcelado',
  entrada_parcelas: 'Entrada + parcelas',
};

const soDigitos = (texto: string) => texto.replace(/\D/g, '');
const arred = (valor: number, casas = 2) => Math.round(valor * 10 ** casas) / 10 ** casas;

/**
 * Registros de uma proposta, na ordem de dependência da DAS 4.1
 * (cliente → instalação → medição → simulação → proposta com os itens).
 * Cada entrada já leva a versão-base guardada em `proposal.syncBase`.
 */
export function registrosDaProposta(proposal: Proposal, ctx: ContextoSync): EntradaFila[] {
  const updatedAt = proposal.updatedAt;
  const versao = (id: string, dados: Record<string, unknown>) => ({
    id,
    idEmpresa: ctx.idEmpresa,
    updatedAt,
    updatedBy: ctx.idUsuario,
    dados,
  });
  const { client, installation, measurement } = proposal;
  const idCliente = idClienteDe(proposal.id);
  const idInstalacao = idInstalacaoDe(proposal.id);
  const entradas: EntradaFila[] = [];

  entradas.push({
    entidade: 'Cliente',
    versao: versao(idCliente, {
      id_cliente: idCliente,
      id_usuario_responsavel: proposal.technicianId,
      nome_razao_social: client.name,
      contato_whatsapp: soDigitos(client.whatsapp) || null,
      contato_email: client.email.trim() || null,
    }),
  });

  entradas.push({
    entidade: 'Instalacao',
    versao: versao(idInstalacao, {
      id_instalacao: idInstalacao,
      id_cliente: idCliente,
      cep: soDigitos(installation.cep),
      logradouro: installation.address,
      numero: installation.number,
      bairro: installation.district,
      cidade: installation.city,
      estado: installation.state,
      uc_nis: installation.consumerUnit,
      tarifa_kwh: installation.tariffPerKwh,
      modalidade_tarifaria: MODALIDADE[installation.tariffModality],
      tipo_ligacao: connectionTypeLabels[installation.connectionType],
      disjuntor_amperagem: installation.mainBreakerAmps,
      consumo_mensal_kwh: installation.monthlyConsumptionKwh,
      tipo_telhado: roofTypeLabels[installation.roofType],
      distancia_quadro_m: installation.roofToPanelDistanceM,
      necessidade_adequacao_quadro: installation.panelUpgradeNeeded,
    }),
  });

  measurement.sections.forEach((section, index) => {
    const idMedicao = idMedicaoDe(proposal.id, section.id);
    entradas.push({
      entidade: 'Medicao',
      versao: versao(idMedicao, {
        id_medicao: idMedicao,
        id_instalacao: idInstalacao,
        secao: index + 1,
        metodo_medicao: measurement.source,
        area_m2: section.areaM2,
        inclinacao_graus: section.inclinationDeg,
        orientacao: section.orientation,
        calibrada: false,
        data_coleta: measurement.measuredAt,
      }),
    });
  });

  const primeiraSecao = measurement.sections[0];
  if (primeiraSecao) {
    const idSimulacao = idSimulacaoDe(proposal.id);
    entradas.push({
      entidade: 'SimulacaoSombreamento',
      versao: versao(idSimulacao, {
        id_simulacao: idSimulacao,
        id_medicao: idMedicaoDe(proposal.id, primeiraSecao.id),
        origem: measurement.source === 'RA' ? 'Sun path + RA' : 'Estimativa manual',
        data_referencia: (proposal.generatedAt ?? proposal.createdAt).slice(0, 10),
        sombreamento_perc: proposal.shadingPct,
      }),
    });
  }

  const { pricing, viability } = proposal;
  entradas.push({
    entidade: 'Proposta',
    versao: versao(proposal.id, {
      id_proposta: proposal.id,
      id_instalacao: idInstalacao,
      id_usuario_responsavel: proposal.technicianId,
      numero_proposta: proposal.number,
      numero_versao: proposal.version,
      status_proposta: statusParaContrato[proposal.status],
      potencia_kwp: arred(proposal.systemKwp, 3),
      geracao_estimada_kwh_mes: arred(proposal.monthlyGenerationKwh, 1),
      perdas_totais_perc: arred(proposal.sizing.losses.totalPct, 2),
      valor_equipamentos: arred(pricing.equipment),
      valor_materiais_eletricos: arred(pricing.electricalMaterials),
      valor_mao_de_obra: arred(pricing.labor),
      valor_art_homologacao: arred(pricing.projectAndApproval),
      valor_logistica_frete: arred(pricing.freight),
      margem_percentual: pricing.marginPct,
      valor_margem: arred(pricing.margin),
      valor_total: arred(pricing.total),
      economia_mensal_estimada: arred(viability.monthlySavings),
      payback_meses: Number.isFinite(viability.paybackYears) ? Math.round(viability.paybackYears * 12) : null,
      roi_percentual: arred(viability.roiPct, 1),
      validade_dias: proposal.validityDays,
      condicao_pagamento: CONDICAO[proposal.paymentCondition.type],
      parcelas: proposal.paymentCondition.installments,
      entrada_perc: proposal.paymentCondition.downPaymentPct,
      data_geracao: proposal.generatedAt ?? null,
      itens: proposal.items.map((item) => ({
        id_item: `${proposal.id}-${item.equipmentId}`,
        id_proposta: proposal.id,
        id_equipamento: item.equipmentId,
        quantidade: item.quantity,
        preco_catalogo: item.catalogPrice,
        ajuste_percentual: arred(netAdjustmentPct(item.discountPct, item.markupPct), 2),
        preco_unitario: arred(unitPrice(item)),
        subtotal: arred(unitPrice(item) * item.quantity),
        fornecedor: item.supplier,
        observacoes: item.notes || null,
      })),
    }),
  });

  return entradas
    .map((entrada) => ({ ...entrada, baseUpdatedAt: proposal.syncBase?.[idOperacaoDe(entrada.entidade, entrada.versao.id)] ?? null }))
    .sort((a, b) => ORDEM_DEPENDENCIA[a.entidade] - ORDEM_DEPENDENCIA[b.entidade]);
}

/**
 * O que impede a proposta de subir (SCRUM-405, regra do Misael): além do status
 * do RN07, dimensionamento, precificação e PDF precisam estar concluídos.
 * Lista vazia = pode subir.
 */
export function motivosBloqueioSync(proposal: Proposal, ctx: ContextoSync): string[] {
  const motivos: string[] = [];
  const proposta = registrosDaProposta(proposal, ctx).find((e) => e.entidade === 'Proposta');
  if (proposta === undefined || !podeEntrarNaFila(proposta)) {
    motivos.push(`Status da proposta é ${statusParaContrato[proposal.status]}; a sincronização exige "Gerada" ou posterior (RN07).`);
  }
  if (!(proposal.systemKwp > 0) || !(proposal.monthlyGenerationKwh > 0)) motivos.push('Dimensionamento não concluído.');
  if (!(proposal.pricing.total > 0) || proposal.items.length === 0) motivos.push('Precificação não concluída.');
  if (!proposal.generatedAt) motivos.push('PDF da proposta não gerado.');
  return motivos;
}

/** A proposta pode subir agora? (RN07 + SCRUM-405; "Reaberta" fica no aparelho.) */
export function propostaPodeSubir(proposal: Proposal, ctx: ContextoSync): boolean {
  return motivosBloqueioSync(proposal, ctx).length === 0;
}

/** Solicitação de upgrade (RF28) no formato do contrato. */
export function registroDaSolicitacao(request: UpgradeRequest, ctx: ContextoSync): EntradaFila {
  return {
    entidade: 'SolicitacaoUpgrade',
    versao: {
      id: request.id,
      idEmpresa: ctx.idEmpresa,
      updatedAt: request.createdAt,
      updatedBy: ctx.idUsuario,
      dados: {
        id_solicitacao: request.id,
        id_usuario_solicitante: ctx.idUsuario,
        mensagem: request.message ?? null,
        status: 'Pendente',
      },
    },
    baseUpdatedAt: null,
  };
}

/** Proposta a que um registro da fila pertence (os ids derivados carregam o id da proposta). */
export function propostaDoRegistro(entidade: EntidadeSincronizavel, idRegistro: string, idsConhecidos: Iterable<string>): string | null {
  if (entidade === 'Proposta') return idRegistro;
  if (entidade === 'SolicitacaoUpgrade') return null;
  for (const id of idsConhecidos) {
    const pertence =
      idRegistro === idClienteDe(id) ||
      idRegistro === idInstalacaoDe(id) ||
      idRegistro === idSimulacaoDe(id) ||
      idRegistro.startsWith(`med-${id}-`);
    if (pertence) return id;
  }
  return null;
}
