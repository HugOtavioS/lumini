import type { EntidadeSincronizavel, StatusProposta, VersaoRegistro } from '@lumini/sync';

import { findEquipment } from '@/data/mock/catalog';
import type {
  ConnectionType,
  Orientation,
  PaymentConditionType,
  Proposal,
  ProposalItem,
  RoofType,
} from '@/domain/entities';
import { connectionTypeLabels, roofTypeLabels } from '@/domain/labels';
import { statusDoContrato } from './status';

// Caminho inverso de `registros.ts`: monta as propostas do técnico a partir dos
// registros que a API devolve no pull (POST /sync/pull). É assim que o
// histórico do app passa a mostrar os dados gravados no banco central, e não os
// dados de demonstração.

type Dados = Record<string, unknown>;
export interface RegistroServidor {
  entidade: EntidadeSincronizavel;
  versao: VersaoRegistro;
}

const inverter = <K extends string>(mapa: Record<K, string>): Record<string, K> =>
  Object.fromEntries(Object.entries(mapa).map(([k, v]) => [v as string, k])) as Record<string, K>;
const LIGACAO = inverter<ConnectionType>(connectionTypeLabels);
const TELHADO = inverter<RoofType>(roofTypeLabels);
const CONDICAO: Record<string, PaymentConditionType> = {
  'À vista': 'a_vista',
  Parcelado: 'parcelado',
  'Entrada + parcelas': 'entrada_parcelas',
};

const num = (v: unknown, padrao = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || padrao);
const txt = (v: unknown, padrao = '') => (typeof v === 'string' ? v : v == null ? padrao : String(v));

export function propostasDoServidor(registros: readonly RegistroServidor[]): Proposal[] {
  const por = (entidade: EntidadeSincronizavel) => {
    const mapa = new Map<string, { dados: Dados; updatedAt: string }>();
    for (const r of registros) if (r.entidade === entidade) mapa.set(r.versao.id, { dados: r.versao.dados as Dados, updatedAt: r.versao.updatedAt });
    return mapa;
  };
  const clientes = por('Cliente');
  const instalacoes = por('Instalacao');
  const medicoes = [...por('Medicao').values()].map((m) => m.dados);
  const simulacoes = [...por('SimulacaoSombreamento').values()].map((s) => s.dados);
  const propostas: Proposal[] = [];

  for (const [id, { dados: p, updatedAt }] of por('Proposta')) {
    const idInstalacao = txt(p.id_instalacao);
    const ins = instalacoes.get(idInstalacao)?.dados ?? {};
    const cli = clientes.get(txt(ins.id_cliente))?.dados ?? {};
    const secoes = medicoes
      .filter((m) => m.id_instalacao === idInstalacao)
      .sort((a, b) => num(a.secao) - num(b.secao));
    const idsMedicao = new Set(secoes.map((m) => m.id_medicao));
    const sim = simulacoes.find((s) => idsMedicao.has(s.id_medicao));
    const sombreamento = num(sim?.sombreamento_perc);

    const itens: ProposalItem[] = (Array.isArray(p.itens) ? (p.itens as Dados[]) : []).map((i) => {
      const eq = findEquipment(txt(i.id_equipamento));
      const ajuste = num(i.ajuste_percentual);
      return {
        equipmentId: txt(i.id_equipamento),
        category: eq?.category ?? 'modulo',
        name: eq?.name ?? txt(i.id_equipamento, 'Equipamento'),
        quantity: num(i.quantidade, 1),
        catalogPrice: num(i.preco_catalogo, num(i.preco_unitario)),
        discountPct: ajuste < 0 ? -ajuste : 0,
        markupPct: ajuste > 0 ? ajuste : 0,
        supplier: txt(i.fornecedor),
        notes: txt(i.observacoes),
        powerW: eq?.powerW,
        phases: eq?.phases,
      };
    });

    const kwp = num(p.potencia_kwp);
    const geracao = num(p.geracao_estimada_kwh_mes);
    const total = num(p.valor_total);
    const economiaMes = num(p.economia_mensal_estimada);
    const paybackMeses = p.payback_meses == null ? NaN : num(p.payback_meses);
    const area = secoes.reduce((s, m) => s + num(m.area_m2), 0);
    const modulos = itens.filter((i) => i.category === 'modulo').reduce((s, i) => s + i.quantity, 0);
    const geradaEm = p.data_geracao ? txt(p.data_geracao) : undefined;

    propostas.push({
      id,
      number: txt(p.numero_proposta, id),
      technicianId: txt(p.id_usuario_responsavel),
      client: { name: txt(cli.nome_razao_social, 'Cliente'), whatsapp: txt(cli.contato_whatsapp), email: txt(cli.contato_email) },
      installation: {
        cep: txt(ins.cep),
        address: txt(ins.logradouro),
        number: txt(ins.numero),
        district: txt(ins.bairro),
        city: txt(ins.cidade),
        state: txt(ins.estado),
        consumerUnit: txt(ins.uc_nis),
        monthlyConsumptionKwh: num(ins.consumo_mensal_kwh),
        tariffPerKwh: num(ins.tarifa_kwh),
        tariffModality: ins.modalidade_tarifaria === 'Branca' ? 'branca' : 'convencional',
        connectionType: LIGACAO[txt(ins.tipo_ligacao)] ?? 'monofasica',
        mainBreakerAmps: num(ins.disjuntor_amperagem),
        roofType: TELHADO[txt(ins.tipo_telhado)] ?? 'ceramica',
        roofToPanelDistanceM: ins.distancia_quadro_m == null ? null : num(ins.distancia_quadro_m),
        panelUpgradeNeeded: Boolean(ins.necessidade_adequacao_quadro),
      },
      measurement: {
        source: secoes[0]?.metodo_medicao === 'RA' ? 'RA' : 'Manual',
        measuredAt: txt(secoes[0]?.data_coleta, updatedAt),
        sections: secoes.map((m, i) => ({
          id: `s${i + 1}`,
          areaM2: num(m.area_m2),
          inclinationDeg: num(m.inclinacao_graus),
          orientation: (txt(m.orientacao, 'N') as Orientation) ?? 'N',
        })),
      },
      shadingPct: sombreamento,
      sizing: {
        hsp: 0,
        hspSource: 'contingencia',
        losses: { temperaturePct: 0, soilingPct: 0, cablingPct: 0, shadingPct: sombreamento, totalPct: num(p.perdas_totais_perc) },
        requiredKwp: kwp,
        referenceModuleW: modulos > 0 ? Math.round((kwp * 1000) / modulos) : 0,
        moduleCount: modulos,
        installedKwp: kwp,
        estimatedMonthlyKwh: geracao,
        requiredAreaM2: area,
        measuredAreaM2: area,
        alerts: [],
      },
      items: itens,
      systemKwp: kwp,
      monthlyGenerationKwh: geracao,
      pricing: {
        equipment: num(p.valor_equipamentos),
        electricalMaterials: num(p.valor_materiais_eletricos),
        electricalComplement: 0,
        labor: num(p.valor_mao_de_obra),
        projectAndApproval: num(p.valor_art_homologacao),
        freight: num(p.valor_logistica_frete),
        marginPct: num(p.margem_percentual),
        margin: num(p.valor_margem),
        commercialDiscount: Math.max(0, num(p.valor_equipamentos) + num(p.valor_materiais_eletricos) + num(p.valor_mao_de_obra) + num(p.valor_art_homologacao) + num(p.valor_logistica_frete) + num(p.valor_margem) - total),
        total,
      },
      viability: {
        monthlySavings: economiaMes,
        paybackYears: Number.isFinite(paybackMeses) ? paybackMeses / 12 : Infinity,
        roiPct: num(p.roi_percentual),
        savings25y: economiaMes * 12 * 25,
        co2AvoidedTon: 0,
        cumulativeSavings: Array.from({ length: 25 }, (_, ano) => economiaMes * 12 * (ano + 1)),
      },
      validityDays: num(p.validade_dias, 15),
      paymentCondition: {
        type: CONDICAO[txt(p.condicao_pagamento)] ?? 'a_vista',
        installments: num(p.parcelas, 1),
        downPaymentPct: num(p.entrada_perc),
      },
      status: statusDoContrato[txt(p.status_proposta) as StatusProposta] ?? 'gerada',
      syncStatus: 'sincronizado',
      version: num(p.numero_versao, 1),
      syncBase: { [`Proposta:${id}`]: updatedAt },
      createdAt: geradaEm ?? updatedAt,
      generatedAt: geradaEm,
      updatedAt,
    });
  }
  return propostas.sort((a, b) => (b.generatedAt ?? b.createdAt).localeCompare(a.generatedAt ?? a.createdAt));
}
