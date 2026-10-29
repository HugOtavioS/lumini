import { criarCatalogoInicial, calcularAnaliseFinanceira, type Equipamento } from '@lumini/domain';
import { idOperacaoDe, type OperacaoSync, type ServidorSincronizacao, type SessaoServidor, type StatusProposta } from '@lumini/sync';

import { gerarHashSenha } from '../auth/senha';
import type { Banco } from './banco';

// Empresa de demonstração para rodar a API e o painel local. Os ids do técnico
// e da empresa são os mesmos do app (apps/mobile/src/data/mock/user.ts), para
// que a sincronização do app caia na mesma empresa.
//
// Usuários (senha de desenvolvimento: lumini123):
//   gestora@solarvale.com.br  — Gestora (painel web)
//   carlos@lumini.com         — Técnico (app)
//   ana@solarvale.com.br      — Técnica (app)

export const EMPRESA_DEMO = 'emp-001';
export const SENHA_DEMO = 'lumini123';
export const USUARIOS_DEMO = [
  { id: 'ges-001', nome: 'Juliana Prado', email: 'gestora@solarvale.com.br', papel: 'Gestor', telefone: '(12) 99610-2201' },
  { id: 'tec-001', nome: 'Carlos Campos', email: 'carlos@lumini.com', papel: 'Tecnico', telefone: '(12) 99777-1234' },
  { id: 'tec-002', nome: 'Ana Ribeiro', email: 'ana@solarvale.com.br', papel: 'Tecnico', telefone: '(12) 98122-4410' },
] as const;

/** HSP médio por UF — mesma base embutida no app (apps/mobile/src/data/contingency/contingencyBase.ts). */
export const BASE_CONTINGENCIA_INICIAL = {
  versao: 'embutida-2026.09',
  publicadaEm: '2026-09-01T00:00:00.000Z',
  hsp: {
    AC: { hsp: 4.6, latitude: -9.97 }, AL: { hsp: 5.4, latitude: -9.67 }, AP: { hsp: 4.9, latitude: 0.03 },
    AM: { hsp: 4.6, latitude: -3.12 }, BA: { hsp: 5.4, latitude: -12.97 }, CE: { hsp: 5.6, latitude: -3.73 },
    DF: { hsp: 5.3, latitude: -15.78 }, ES: { hsp: 5.0, latitude: -20.32 }, GO: { hsp: 5.3, latitude: -16.68 },
    MA: { hsp: 5.1, latitude: -2.53 }, MT: { hsp: 5.2, latitude: -15.6 }, MS: { hsp: 5.1, latitude: -20.44 },
    MG: { hsp: 5.2, latitude: -19.92 }, PA: { hsp: 4.9, latitude: -1.46 }, PB: { hsp: 5.5, latitude: -7.12 },
    PR: { hsp: 4.6, latitude: -25.43 }, PE: { hsp: 5.5, latitude: -8.05 }, PI: { hsp: 5.6, latitude: -5.09 },
    RJ: { hsp: 4.9, latitude: -22.91 }, RN: { hsp: 5.6, latitude: -5.79 }, RS: { hsp: 4.6, latitude: -30.03 },
    RO: { hsp: 4.7, latitude: -8.76 }, RR: { hsp: 4.9, latitude: 2.82 }, SC: { hsp: 4.4, latitude: -27.6 },
    SP: { hsp: 4.9, latitude: -23.55 }, SE: { hsp: 5.4, latitude: -10.91 }, TO: { hsp: 5.4, latitude: -10.18 },
  },
};

interface PropostaDemo {
  n: number;
  tecnico: 'tec-001' | 'tec-002';
  cliente: string;
  whatsapp: string;
  email: string | null;
  cidade: string;
  bairro: string;
  consumo: number;
  tarifa: number;
  kwp: number;
  total: number;
  diasAtras: number;
  /** Status final; o gestor move a partir de "Gerada". */
  status: StatusProposta;
  condicao: 'À vista' | 'Parcelado' | 'Entrada + parcelas';
}

const PROPOSTAS_DEMO: PropostaDemo[] = [
  { n: 31, tecnico: 'tec-001', cliente: 'Mariana Lopes', whatsapp: '12991234567', email: 'mariana.lopes@email.com', cidade: 'Taubaté', bairro: 'Jardim das Nações', consumo: 420, tarifa: 0.92, kwp: 3.85, total: 17900, diasAtras: 140, status: 'Aprovada', condicao: 'Parcelado' },
  { n: 32, tecnico: 'tec-002', cliente: 'Padaria Pão Dourado', whatsapp: '12988776655', email: 'contato@paodourado.com.br', cidade: 'São José dos Campos', bairro: 'Vila Ema', consumo: 1850, tarifa: 0.88, kwp: 15.4, total: 61800, diasAtras: 112, status: 'Em negociação', condicao: 'Entrada + parcelas' },
  { n: 33, tecnico: 'tec-001', cliente: 'Roberto Almeida', whatsapp: '12997651122', email: null, cidade: 'Caçapava', bairro: 'Vila Antônio Augusto', consumo: 310, tarifa: 0.92, kwp: 2.75, total: 13400, diasAtras: 96, status: 'Recusada', condicao: 'À vista' },
  { n: 34, tecnico: 'tec-002', cliente: 'Clínica Bem Viver', whatsapp: '12996540987', email: 'adm@bemviver.med.br', cidade: 'Jacareí', bairro: 'Centro', consumo: 980, tarifa: 0.9, kwp: 8.25, total: 36500, diasAtras: 68, status: 'Aprovada', condicao: 'Parcelado' },
  { n: 35, tecnico: 'tec-001', cliente: 'Fernanda Costa', whatsapp: '12992223344', email: 'fe.costa@email.com', cidade: 'Pindamonhangaba', bairro: 'Mombaça', consumo: 560, tarifa: 0.92, kwp: 4.95, total: 22300, diasAtras: 41, status: 'Em negociação', condicao: 'Parcelado' },
  { n: 36, tecnico: 'tec-001', cliente: 'Auto Peças Vale', whatsapp: '12993334455', email: 'compras@autopecasvale.com.br', cidade: 'Taubaté', bairro: 'Estiva', consumo: 1320, tarifa: 0.88, kwp: 11.0, total: 46900, diasAtras: 18, status: 'Gerada', condicao: 'Entrada + parcelas' },
  { n: 37, tecnico: 'tec-002', cliente: 'Lucas Nogueira', whatsapp: '12994445566', email: null, cidade: 'São José dos Campos', bairro: 'Urbanova', consumo: 690, tarifa: 0.9, kwp: 6.05, total: 26800, diasAtras: 6, status: 'Gerada', condicao: 'À vista' },
  { n: 38, tecnico: 'tec-001', cliente: 'Escola Pequeno Saber', whatsapp: '12995556677', email: 'diretoria@pequenosaber.edu.br', cidade: 'Caçapava', bairro: 'Centro', consumo: 1540, tarifa: 0.88, kwp: 13.2, total: 55400, diasAtras: 2, status: 'Gerada', condicao: 'Parcelado' },
];

const DIA = 24 * 60 * 60 * 1000;
const isoDiasAtras = (dias: number, horas = 0) => new Date(Date.now() - dias * DIA + horas * 60 * 60 * 1000).toISOString();

function operacoesDaProposta(p: PropostaDemo, emp: string, em: string, modulo: Equipamento, inversor: Equipamento): OperacaoSync[] {
  const id = `seed-${p.n}`;
  const idCli = `cli-${id}`;
  const idIns = `ins-${id}`;
  const geracaoMes = Math.round(p.kwp * 4.9 * 30 * 0.8 * 10) / 10;
  const analise = calcularAnaliseFinanceira({
    precoTotal: { valorTotal: p.total },
    geracaoAnualKwh: geracaoMes * 12,
    tarifaKwh: p.tarifa,
    premissas: { reajusteTarifarioAnual: 0.04 },
  });
  const modulos = Math.ceil((p.kwp * 1000) / (modulo.potenciaW ?? 550));
  const precoModulo = modulo.precoVenda;
  const precoInversor = inversor.precoVenda;
  const versao = (idRegistro: string, dados: Record<string, unknown>) => ({ id: idRegistro, idEmpresa: emp, updatedAt: em, updatedBy: p.tecnico, dados });
  const op = (entidade: OperacaoSync['entidade'], v: ReturnType<typeof versao>): OperacaoSync => ({
    idOperacao: idOperacaoDe(entidade, v.id),
    entidade,
    baseUpdatedAt: null,
    versao: v,
  });
  return [
    op('Cliente', versao(idCli, { id_cliente: idCli, id_usuario_responsavel: p.tecnico, nome_razao_social: p.cliente, contato_whatsapp: p.whatsapp, contato_email: p.email })),
    op('Instalacao', versao(idIns, {
      id_instalacao: idIns, id_cliente: idCli, cep: '12000000', logradouro: 'Rua das Palmeiras', numero: String(100 + p.n), bairro: p.bairro,
      cidade: p.cidade, estado: 'SP', uc_nis: `0${p.n}4471${p.n}`, tarifa_kwh: p.tarifa, modalidade_tarifaria: 'Convencional',
      tipo_ligacao: p.consumo > 900 ? 'Trifásico' : 'Bifásico', disjuntor_amperagem: p.consumo > 900 ? 63 : 40,
      consumo_mensal_kwh: p.consumo, tipo_telhado: 'Cerâmico', distancia_quadro_m: 12, necessidade_adequacao_quadro: false,
    })),
    op('Medicao', versao(`med-${id}-s1`, {
      id_medicao: `med-${id}-s1`, id_instalacao: idIns, secao: 1, metodo_medicao: p.n % 2 === 0 ? 'RA' : 'manual',
      area_m2: Math.round(modulos * 2.6 * 10) / 10, inclinacao_graus: 20, orientacao: 'N', calibrada: false, data_coleta: em,
    })),
    op('Proposta', versao(id, {
      id_proposta: id, id_instalacao: idIns, id_usuario_responsavel: p.tecnico, numero_proposta: `LUM-2026-${String(p.n).padStart(4, '0')}`,
      numero_versao: 1, status_proposta: 'Gerada', potencia_kwp: p.kwp, geracao_estimada_kwh_mes: geracaoMes, perdas_totais_perc: 20,
      valor_equipamentos: Math.round(modulos * precoModulo + precoInversor), valor_materiais_eletricos: Math.round(p.total * 0.06),
      valor_mao_de_obra: Math.round(p.total * 0.12), valor_art_homologacao: 1200, valor_logistica_frete: 600, margem_percentual: 20,
      valor_margem: Math.round(p.total / 6), valor_total: p.total,
      economia_mensal_estimada: Math.round(geracaoMes * p.tarifa * 100) / 100,
      payback_meses: analise.payback?.totalMeses ?? null, roi_percentual: Math.round(analise.roiPercentual * 10) / 10,
      validade_dias: 15, condicao_pagamento: p.condicao, parcelas: p.condicao === 'À vista' ? 1 : 12,
      entrada_perc: p.condicao === 'Entrada + parcelas' ? 30 : null, data_geracao: em,
      itens: [
        { id_item: `${id}-mod`, id_proposta: id, id_equipamento: modulo.idEquipamento, quantidade: modulos, preco_catalogo: precoModulo, ajuste_percentual: 0, preco_unitario: precoModulo, subtotal: modulos * precoModulo, fornecedor: modulo.fornecedor, observacoes: null },
        { id_item: `${id}-inv`, id_proposta: id, id_equipamento: inversor.idEquipamento, quantidade: 1, preco_catalogo: precoInversor, ajuste_percentual: 0, preco_unitario: precoInversor, subtotal: precoInversor, fornecedor: inversor.fornecedor, observacoes: null },
      ],
    })),
  ];
}

/** Cria a empresa de demonstração quando o banco ainda não tem nenhuma empresa. */
export function semearSeVazio(banco: Banco, servidor: ServidorSincronizacao): boolean {
  const existe = banco.um<{ n: number }>('SELECT COUNT(*) AS n FROM empresa');
  if (Number(existe?.n ?? 0) > 0) return false;

  const agora = new Date().toISOString();
  banco.transacao(() => {
    banco.executar('INSERT INTO empresa (id_empresa, razao_social, nome_fantasia, cnpj, criado_em) VALUES (?, ?, ?, ?, ?)',
      EMPRESA_DEMO, 'Solar Vale Energia Ltda.', 'Solar Vale Energia', '12.345.678/0001-90', isoDiasAtras(60));
    banco.executar(`INSERT INTO assinatura (id_assinatura, id_empresa, tipo_plano, limite_propostas_mes, status, inicio_em) VALUES (?, ?, 'Freemium', 25, 'Ativa', ?)`,
      'ass-001', EMPRESA_DEMO, isoDiasAtras(60));
    const hash = gerarHashSenha(SENHA_DEMO);
    for (const u of USUARIOS_DEMO) {
      banco.executar('INSERT INTO usuario (id_usuario, id_empresa, nome, email, senha_hash, papel, telefone, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        u.id, EMPRESA_DEMO, u.nome, u.email, hash, u.papel, u.telefone, isoDiasAtras(60));
    }
    const catalogo = criarCatalogoInicial({ idEmpresa: EMPRESA_DEMO, idUsuario: 'ges-001', agora });
    const modulo = catalogo.find((e) => e.categoria === 'Módulo')!;
    const inversor = catalogo.find((e) => e.categoria === 'Inversor')!;
    for (const eq of catalogo) {
      banco.executar(
        `INSERT INTO equipamento (id_equipamento, id_empresa, categoria, fabricante, modelo, fornecedor, potencia_w, preco_custo, margem_percentual, preco_venda, status, dados, created_at, updated_at, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        eq.idEquipamento, eq.idEmpresa, eq.categoria, eq.fabricante, eq.modelo, eq.fornecedor, eq.potenciaW, eq.precoCusto,
        eq.margemPercentual, eq.precoVenda, eq.status, JSON.stringify(eq), eq.createdAt, eq.updatedAt, eq.updatedBy,
      );
    }
    const c = BASE_CONTINGENCIA_INICIAL;
    banco.executar('INSERT INTO contingencia_versao (versao, publicada_em, dados) VALUES (?, ?, ?)', c.versao, c.publicadaEm, JSON.stringify(c.hsp));

    // Propostas: o técnico envia "Gerada" pelo app; a gestora move no painel.
    const gestora: SessaoServidor = { idUsuario: 'ges-001', idEmpresa: EMPRESA_DEMO, papel: 'Gestor' };
    for (const p of PROPOSTAS_DEMO) {
      const tecnico: SessaoServidor = { idUsuario: p.tecnico, idEmpresa: EMPRESA_DEMO, papel: 'Tecnico' };
      const em = isoDiasAtras(p.diasAtras);
      servidor.push(tecnico, { idDispositivo: `seed-${p.tecnico}`, operacoes: operacoesDaProposta(p, EMPRESA_DEMO, em, modulo, inversor) });
      const caminho: StatusProposta[] =
        p.status === 'Gerada' ? [] : p.status === 'Em negociação' ? ['Em negociação'] : ['Em negociação', p.status];
      let base = em;
      caminho.forEach((status, i) => {
        const atual = servidor.obter('Proposta', `seed-${p.n}`)!;
        const quando = isoDiasAtras(p.diasAtras, 24 * (i + 1));
        servidor.push(gestora, {
          idDispositivo: 'seed-painel',
          operacoes: [{ idOperacao: `Proposta:seed-${p.n}`, entidade: 'Proposta', baseUpdatedAt: base,
            versao: { ...atual, updatedAt: quando, updatedBy: 'ges-001', dados: { ...atual.dados, status_proposta: status } } }],
        });
        base = quando;
      });
    }
  });
  return true;
}
