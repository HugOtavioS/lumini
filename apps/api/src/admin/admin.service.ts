import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  calcularPrecoVenda,
  CATEGORIAS_EQUIPAMENTO,
  precificarProposta,
  recalcularViabilidade,
  validarEquipamento,
  validarItensEDesconto,
  type Equipamento,
} from '@lumini/domain';
import { STATUS_PROPOSTA, acoesDoGestor, ehStatusProposta, type StatusProposta } from '@lumini/sync';

import type { UsuarioAutenticado } from '../auth/auth.service';
import { gerarHashSenha } from '../auth/senha';
import { BancoService } from '../banco.service';
import { inicioDoMes, limiteDaEmpresa, propostasAcimaDoLimite } from './limitePlano';
import { gravarParametros, lerParametros } from './parametros';

// Painel do gestor (UC10–UC13, RF20–RF27): indicadores, propostas, catálogo,
// usuários, plano e logs. Tudo filtrado pela empresa do token (multi-tenant).

interface LinhaPropostaLista {
  id_proposta: string;
  numero_proposta: string;
  numero_versao: number;
  status_proposta: StatusProposta;
  potencia_kwp: number;
  valor_total: number;
  economia_mensal_estimada: number;
  payback_meses: number | null;
  data_geracao: string | null;
  updated_at: string;
  id_usuario_responsavel: string;
  tecnico: string | null;
  cliente: string | null;
  cidade: string | null;
  estado: string | null;
}


@Injectable()
export class AdminService {
  constructor(@Inject(BancoService) private readonly bd: BancoService) {}

  private get banco() {
    return this.bd.banco;
  }

  // ---------- Indicadores (RF21 / UC11) ----------

  resumo(u: UsuarioAutenticado) {
    const empresa = this.banco.um<{ nome_fantasia: string; razao_social: string; cnpj: string | null }>(
      'SELECT nome_fantasia, razao_social, cnpj FROM empresa WHERE id_empresa = ?', u.idEmpresa,
    );
    const propostas = this.listarPropostas(u, {});
    const porStatus = Object.fromEntries(STATUS_PROPOSTA.map((s) => [s, 0])) as Record<StatusProposta, number>;
    const valorPorStatus = Object.fromEntries(STATUS_PROPOSTA.map((s) => [s, 0])) as Record<StatusProposta, number>;
    for (const p of propostas) {
      porStatus[p.status] = (porStatus[p.status] ?? 0) + 1;
      valorPorStatus[p.status] = (valorPorStatus[p.status] ?? 0) + p.valorTotal;
    }
    const soma = (lista: typeof propostas, campo: 'valorTotal' | 'potenciaKwp') => lista.reduce((t, p) => t + (p[campo] ?? 0), 0);
    const aprovadas = propostas.filter((p) => p.status === 'Aprovada');
    const recusadas = propostas.filter((p) => p.status === 'Recusada');
    const emAberto = propostas.filter((p) => p.status === 'Gerada' || p.status === 'Em negociação');
    const encerradas = aprovadas.length + recusadas.length;

    const tecnicos = this.banco.todos<{ id_usuario: string; nome: string }>(
      "SELECT id_usuario, nome FROM usuario WHERE id_empresa = ? AND papel = 'Tecnico' ORDER BY nome", u.idEmpresa,
    );
    const porTecnico = tecnicos.map((t) => {
      const doTecnico = propostas.filter((p) => p.idTecnico === t.id_usuario);
      const aprov = doTecnico.filter((p) => p.status === 'Aprovada');
      return { id: t.id_usuario, nome: t.nome, propostas: doTecnico.length, aprovadas: aprov.length, valorAprovado: soma(aprov, 'valorTotal') };
    });

    // Últimos 6 meses (propostas geradas por mês e valor).
    const hoje = new Date();
    const porMes = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - i), 1);
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const doMes = propostas.filter((p) => (p.dataGeracao ?? p.atualizadaEm).slice(0, 7) === chave);
      return { mes: chave, propostas: doMes.length, valor: soma(doMes, 'valorTotal'), aprovadas: doMes.filter((p) => p.status === 'Aprovada').length };
    });

    // Origem das medições (RA × manual) e últimas mudanças de status no funil.
    const origens = this.banco.todos<{ metodo: string | null; n: number }>(
      "SELECT json_extract(dados, '$.metodo_medicao') AS metodo, COUNT(*) AS n FROM registro_sync WHERE entidade = 'Medicao' AND id_empresa = ? GROUP BY metodo",
      u.idEmpresa,
    );
    const contar = (m: string) => origens.filter((o) => (o.metodo ?? '').toUpperCase() === m).reduce((t, o) => t + Number(o.n), 0);
    const atividadeRecente = this.banco.todos<{ id: string; status: string; em: string; cliente: string | null; numero: string | null }>(
      `SELECT sv.id_registro AS id, sv.status, sv.updated_at AS em, c.nome_razao_social AS cliente, p.numero_proposta AS numero
         FROM status_versao sv
         JOIN vw_proposta p ON p.id_proposta = sv.id_registro AND p.id_empresa = ?
         LEFT JOIN vw_instalacao i ON i.id_instalacao = p.id_instalacao
         LEFT JOIN vw_cliente c ON c.id_cliente = i.id_cliente
        WHERE sv.entidade = 'Proposta'
        ORDER BY sv.updated_at DESC LIMIT 6`,
      u.idEmpresa,
    );

    return {
      origemMedicoes: { ra: contar('RA'), manual: contar('MANUAL') },
      atividadeRecente,
      empresa: { nome: empresa?.nome_fantasia ?? '', razaoSocial: empresa?.razao_social ?? '', cnpj: empresa?.cnpj ?? null },
      plano: this.plano(u),
      propostas: {
        total: propostas.length,
        porStatus,
        valorPorStatus,
        valorEmAberto: soma(emAberto, 'valorTotal'),
        valorAprovado: soma(aprovadas, 'valorTotal'),
        kwpAprovado: soma(aprovadas, 'potenciaKwp'),
        taxaConversao: encerradas > 0 ? aprovadas.length / encerradas : null,
        ticketMedio: propostas.length > 0 ? soma(propostas, 'valorTotal') / propostas.length : 0,
      },
      porTecnico,
      porMes,
      ultimasSincronizacoes: this.sincronizacoes(u, 6),
      recentes: propostas.slice(0, 5),
    };
  }

  // ---------- Propostas (RF22 / RF27 / UC11) ----------

  listarPropostas(u: UsuarioAutenticado, filtro: { status?: string; tecnico?: string; busca?: string }) {
    const linhas = this.banco.todos<LinhaPropostaLista>(
      `SELECT p.id_proposta, p.numero_proposta, p.numero_versao, p.status_proposta, p.potencia_kwp, p.valor_total,
              p.economia_mensal_estimada, p.payback_meses, p.data_geracao, p.updated_at, p.id_usuario_responsavel,
              us.nome AS tecnico, c.nome_razao_social AS cliente, i.cidade, i.estado
         FROM vw_proposta p
         LEFT JOIN vw_instalacao i ON i.id_instalacao = p.id_instalacao
         LEFT JOIN vw_cliente c ON c.id_cliente = i.id_cliente
         LEFT JOIN usuario us ON us.id_usuario = p.id_usuario_responsavel
        WHERE p.id_empresa = ?
        ORDER BY COALESCE(p.data_geracao, p.updated_at) DESC`,
      u.idEmpresa,
    );
    const busca = filtro.busca?.trim().toLowerCase();
    const acimaDoLimite = propostasAcimaDoLimite(this.banco, u.idEmpresa);
    return linhas
      .filter((l) => !filtro.status || l.status_proposta === filtro.status)
      .filter((l) => !filtro.tecnico || l.id_usuario_responsavel === filtro.tecnico)
      .filter((l) => !busca || [l.numero_proposta, l.cliente, l.cidade].some((t) => t?.toLowerCase().includes(busca)))
      .map((l) => ({
        id: l.id_proposta,
        numero: l.numero_proposta,
        versao: Number(l.numero_versao),
        status: l.status_proposta,
        potenciaKwp: Number(l.potencia_kwp),
        valorTotal: Number(l.valor_total),
        economiaMensal: Number(l.economia_mensal_estimada),
        paybackMeses: l.payback_meses === null ? null : Number(l.payback_meses),
        dataGeracao: l.data_geracao,
        atualizadaEm: l.updated_at,
        idTecnico: l.id_usuario_responsavel,
        tecnico: l.tecnico,
        cliente: l.cliente,
        cidade: l.cidade ? `${l.cidade}/${l.estado ?? ''}` : null,
        /** SCRUM-436: gerada além do limite mensal do plano. */
        excedeuLimite: acimaDoLimite.has(l.id_proposta),
      }));
  }

  /** SCRUM-90: versões da proposta — as anteriores guardadas e a atual. */
  versoesProposta(u: UsuarioAutenticado, id: string) {
    const atual = this.registro(u, 'Proposta', id);
    if (!atual) throw new NotFoundException('Proposta não encontrada.');
    const anteriores = this.banco
      .todos<{ numero_versao: number; dados: string; updated_at: string; nome: string | null }>(
        `SELECT v.numero_versao, v.dados, v.updated_at, us.nome FROM proposta_versao v
           LEFT JOIN usuario us ON us.id_usuario = v.updated_by
          WHERE v.id_proposta = ? AND v.id_empresa = ? ORDER BY v.numero_versao DESC`,
        id, u.idEmpresa,
      )
      .map((l) => {
        const d = JSON.parse(l.dados) as Record<string, unknown>;
        return { versao: Number(l.numero_versao), atual: false, status: d.status_proposta ?? null, valorTotal: Number(d.valor_total ?? 0), salvaEm: l.updated_at, salvaPor: l.nome };
      });
    const autor = this.banco.um<{ nome: string }>('SELECT nome FROM usuario WHERE id_usuario = ?', atual.updatedBy);
    const versaoAtual = Number(atual.dados.numero_versao ?? 1);
    return [
      { versao: versaoAtual, atual: true, status: atual.dados.status_proposta ?? null, valorTotal: Number(atual.dados.valor_total ?? 0), salvaEm: atual.updatedAt, salvaPor: autor?.nome ?? null },
      ...anteriores.filter((v) => v.versao !== versaoAtual),
    ];
  }

  detalheProposta(u: UsuarioAutenticado, id: string, versao?: number) {
    const proposta = this.registro(u, 'Proposta', id);
    if (!proposta) throw new NotFoundException('Proposta não encontrada.');
    let dados = proposta.dados;
    // SCRUM-90: ?versao=N abre uma versão anterior (somente leitura).
    const versaoAtual = Number(dados.numero_versao ?? 1);
    const ehAnterior = versao !== undefined && Number.isFinite(versao) && versao !== versaoAtual;
    if (ehAnterior) {
      const l = this.banco.um<{ dados: string }>(
        'SELECT dados FROM proposta_versao WHERE id_proposta = ? AND id_empresa = ? AND numero_versao = ?', id, u.idEmpresa, versao,
      );
      if (!l) throw new NotFoundException(`A versão ${versao} desta proposta não foi encontrada.`);
      dados = JSON.parse(l.dados) as Record<string, unknown>;
    }
    const instalacao = this.registro(u, 'Instalacao', String(dados.id_instalacao ?? ''));
    const cliente = instalacao ? this.registro(u, 'Cliente', String(instalacao.dados.id_cliente ?? '')) : null;
    const medicoes = instalacao
      ? this.banco
          .todos<{ dados: string }>(
            "SELECT dados FROM registro_sync WHERE entidade = 'Medicao' AND id_empresa = ? AND json_extract(dados, '$.id_instalacao') = ? ORDER BY json_extract(dados, '$.secao')",
            u.idEmpresa, instalacao.id,
          )
          .map((l) => JSON.parse(l.dados) as Record<string, unknown>)
      : [];
    const equipamentos = new Map(
      this.banco.todos<{ id_equipamento: string; categoria: string; fabricante: string; modelo: string }>(
        'SELECT id_equipamento, categoria, fabricante, modelo FROM equipamento WHERE id_empresa = ?', u.idEmpresa,
      ).map((e) => [e.id_equipamento, e]),
    );
    const itens = (Array.isArray(dados.itens) ? (dados.itens as Record<string, unknown>[]) : []).map((item) => {
      const eq = equipamentos.get(String(item.id_equipamento));
      return { ...item, categoria: eq?.categoria ?? null, descricao: eq ? `${eq.fabricante} ${eq.modelo}` : String(item.id_equipamento) };
    });
    const tecnico = this.banco.um<{ nome: string; email: string; telefone: string | null }>(
      'SELECT nome, email, telefone FROM usuario WHERE id_usuario = ?', String(dados.id_usuario_responsavel ?? ''),
    );
    const historico = this.banco.todos<Record<string, unknown>>(
      `SELECT a.data_hora AS dataHora, a.campo, a.valor_anterior AS valorAnterior, a.valor_novo AS valorNovo, a.origem, a.motivo, us.nome AS usuario
         FROM log_auditoria a LEFT JOIN usuario us ON us.id_usuario = a.id_usuario
        WHERE a.id_empresa = ? AND a.entidade = 'Proposta' AND a.id_registro = ?
        ORDER BY a.data_hora DESC LIMIT 50`,
      u.idEmpresa, id,
    );
    const linhaDoTempo = this.banco.todos<{ status: string; em: string }>(
      "SELECT status, updated_at AS em FROM status_versao WHERE entidade = 'Proposta' AND id_registro = ? ORDER BY updated_at",
      id,
    );
    const status = ehStatusProposta(dados.status_proposta) ? dados.status_proposta : null;
    return {
      id,
      atualizadaEm: proposta.updatedAt,
      atualizadaPor: proposta.updatedBy,
      proposta: { ...dados, itens },
      cliente: cliente?.dados ?? null,
      instalacao: instalacao?.dados ?? null,
      medicoes,
      tecnico: tecnico ?? null,
      historico,
      linhaDoTempo,
      acoesPermitidas: status && !ehAnterior ? acoesDoGestor(status) : [],
      versaoAtual,
      versaoAnterior: ehAnterior,
      excedeuLimite: propostasAcimaDoLimite(this.banco, u.idEmpresa).has(id),
      limitePlano: limiteDaEmpresa(this.banco, u.idEmpresa),
      /** O editor só abre onde a RN11 deixa o gestor editar. */
      podeEditar: !ehAnterior && (status === 'Gerada' || status === 'Em negociação'),
      limiteAjustePrecoPerc: lerParametros(this.banco, u.idEmpresa).limiteAjustePrecoPerc,
    };
  }

  /**
   * SCRUM-419 — Editor de Proposta. O navegador recalcula com @lumini/domain e
   * manda itens, desconto e valores; a API confere com a mesma função (não é ela
   * quem decide o preço), grava uma nova versão pelo mesmo push do app (RN11)
   * e registra cada mudança no Log de Auditoria.
   */
  editarProposta(u: UsuarioAutenticado, id: string, corpo: Record<string, unknown>) {
    const atual = this.bd.servidor.obter('Proposta', id);
    if (!atual || atual.idEmpresa !== u.idEmpresa) throw new NotFoundException('Proposta não encontrada.');
    const antes = atual.dados;
    const status = antes.status_proposta;
    if (status !== 'Gerada' && status !== 'Em negociação') {
      throw new ConflictException(`O gestor só edita propostas "Gerada" ou "Em negociação" (RN11). Esta está "${String(status)}".`);
    }
    const params = lerParametros(this.banco, u.idEmpresa);
    const catalogo = new Map(
      this.banco.todos<{ id_equipamento: string; preco_venda: number; status: string; fornecedor: string; potencia_w: number | null; categoria: string }>(
        'SELECT id_equipamento, preco_venda, status, fornecedor, potencia_w, categoria FROM equipamento WHERE id_empresa = ?', u.idEmpresa,
      ).map((e) => [e.id_equipamento, e]),
    );
    const itensAntes = new Map((Array.isArray(antes.itens) ? (antes.itens as Record<string, unknown>[]) : []).map((i) => [String(i.id_equipamento), i]));
    const entrada = Array.isArray(corpo.itens) ? (corpo.itens as Record<string, unknown>[]) : [];
    const erros: string[] = [];
    const itens = entrada.map((i, n) => {
      const idEq = String(i.id_equipamento ?? '');
      const eq = catalogo.get(idEq);
      const anterior = itensAntes.get(idEq);
      if (!eq) erros.push(`Item ${n + 1}: equipamento não encontrado no catálogo da empresa.`);
      else if (!anterior && eq.status !== 'Ativo') erros.push(`Item ${n + 1}: equipamento oculto no catálogo não pode entrar na proposta.`);
      // Item que já estava mantém o preço de catálogo da época; item novo usa o preço atual.
      const precoCatalogo = anterior ? Number(anterior.preco_catalogo ?? anterior.preco_unitario) : Number(eq?.preco_venda ?? 0);
      return {
        id_equipamento: idEq,
        quantidade: Number(i.quantidade),
        precoCatalogo,
        ajustePercentual: Number(i.ajuste_percentual ?? 0),
        fornecedor: String(anterior?.fornecedor ?? eq?.fornecedor ?? ''),
        potenciaW: eq?.potencia_w ?? null,
        categoria: eq?.categoria ?? null,
      };
    });
    const desconto = Number(corpo.desconto_comercial_perc ?? 0);
    erros.push(...validarItensEDesconto(itens, desconto, params.limiteAjustePrecoPerc));
    if (erros.length > 0) throw new BadRequestException(erros.join(' '));

    const servicos = {
      materiaisEletricos: Number(antes.valor_materiais_eletricos ?? 0),
      maoDeObra: Number(antes.valor_mao_de_obra ?? 0),
      artHomologacao: Number(antes.valor_art_homologacao ?? 0),
      logisticaFrete: Number(antes.valor_logistica_frete ?? 0),
    };
    const preco = precificarProposta({ itens, servicos, margemPercentual: Number(antes.margem_percentual ?? 0), descontoComercialPerc: desconto });
    // Conferência do valor que o navegador calculou (mesma função, mesmo resultado).
    if (corpo.valor_total !== undefined && Math.abs(Number(corpo.valor_total) - preco.valorTotal) > 0.01) {
      throw new BadRequestException('O total enviado não confere com a regra de precificação (RN03). Recarregue a proposta e tente de novo.');
    }
    // Potência e geração acompanham os módulos; os serviços ficam como o técnico gerou.
    const kwpModulos = (lista: { categoria: unknown; potenciaW?: unknown; quantidade: unknown }[]) =>
      lista.filter((i) => i.categoria === 'Módulo').reduce((t, i) => t + (Number(i.potenciaW ?? 0) * Number(i.quantidade)) / 1000, 0);
    const kwpAntes = kwpModulos([...itensAntes.values()].map((i) => ({ categoria: catalogo.get(String(i.id_equipamento))?.categoria, potenciaW: catalogo.get(String(i.id_equipamento))?.potencia_w, quantidade: i.quantidade })));
    const kwpDepois = kwpModulos(itens);
    const kwpBase = Number(antes.potencia_kwp ?? 0);
    const potenciaKwp = kwpAntes > 0 && kwpDepois > 0 ? Math.round(kwpBase * (kwpDepois / kwpAntes) * 1000) / 1000 : kwpBase;
    const geracao = kwpBase > 0 ? Math.round(Number(antes.geracao_estimada_kwh_mes ?? 0) * (potenciaKwp / kwpBase) * 10) / 10 : Number(antes.geracao_estimada_kwh_mes ?? 0);
    const instalacao = this.registro(u, 'Instalacao', String(antes.id_instalacao ?? ''));
    const tarifa = Number(instalacao?.dados.tarifa_kwh ?? 0);
    const viab = recalcularViabilidade({ valorTotal: preco.valorTotal, geracaoMensalKwh: geracao, tarifaKwh: tarifa });

    const dados: Record<string, unknown> = {
      ...antes,
      itens: preco.itens.map(({ item, precoUnitario, subtotal }) => ({
        id_item: `${id}-${item.id_equipamento}`,
        id_proposta: id,
        id_equipamento: item.id_equipamento,
        quantidade: item.quantidade,
        preco_catalogo: item.precoCatalogo,
        ajuste_percentual: item.ajustePercentual,
        preco_unitario: precoUnitario,
        subtotal,
        fornecedor: item.fornecedor,
        observacoes: null,
      })),
      potencia_kwp: potenciaKwp,
      geracao_estimada_kwh_mes: geracao,
      valor_equipamentos: preco.valorEquipamentos,
      valor_margem: preco.valorMargem,
      desconto_comercial_perc: desconto,
      valor_total: preco.valorTotal,
      economia_mensal_estimada: viab.economiaMensal,
      economia_25_anos: viab.economia25Anos,
      payback_meses: viab.paybackMeses,
      roi_percentual: viab.roiPercentual,
      numero_versao: Number(antes.numero_versao ?? 1) + 1,
    };
    const agora = new Date(Math.max(Date.now(), Date.parse(atual.updatedAt) + 1)).toISOString();
    const r = this.bd.servidor.push(u, {
      idDispositivo: `painel-${u.idUsuario}`,
      operacoes: [{ idOperacao: `Proposta:${id}`, entidade: 'Proposta', baseUpdatedAt: atual.updatedAt, versao: { ...atual, updatedAt: agora, updatedBy: u.idUsuario, dados } }],
    });
    const resultado = r.resultados[0]!;
    if (resultado.situacao !== 'aplicada') throw new ConflictException(resultado.mensagem);

    // Log de Auditoria (Dicionário 8.1): uma linha por mudança.
    const log = (campo: string, de: unknown, para: unknown) =>
      this.banco.executar(
        `INSERT INTO log_auditoria (id_log, id_empresa, entidade, id_registro, campo, valor_anterior, valor_novo, id_usuario, origem, data_hora, motivo)
         VALUES (?, ?, 'Proposta', ?, ?, ?, ?, ?, 'Web', ?, 'Editor de proposta no painel')`,
        randomUUID(), u.idEmpresa, id, campo, de == null ? null : String(de), para == null ? null : String(para), u.idUsuario, agora,
      );
    const nome = (idEq: string) => {
      const e = this.banco.um<{ fabricante: string; modelo: string }>('SELECT fabricante, modelo FROM equipamento WHERE id_equipamento = ?', idEq);
      return e ? `${e.fabricante} ${e.modelo}` : idEq;
    };
    const novosItens = new Map(itens.map((i) => [i.id_equipamento, i]));
    for (const [idEq, i] of itensAntes) {
      const n = novosItens.get(idEq);
      if (!n) log('(item removido)', `${nome(idEq)} × ${String(i.quantidade)}`, null);
      else {
        if (Number(i.quantidade) !== n.quantidade) log(`quantidade · ${nome(idEq)}`, i.quantidade, n.quantidade);
        if (Number(i.ajuste_percentual ?? 0) !== n.ajustePercentual) log(`ajuste_percentual · ${nome(idEq)}`, i.ajuste_percentual ?? 0, n.ajustePercentual);
      }
    }
    for (const [idEq, n] of novosItens) if (!itensAntes.has(idEq)) log('(item incluído)', null, `${nome(idEq)} × ${n.quantidade}`);
    if (Number(antes.desconto_comercial_perc ?? 0) !== desconto) log('desconto_comercial_perc', antes.desconto_comercial_perc ?? 0, desconto);
    if (Number(antes.valor_total ?? 0) !== preco.valorTotal) log('valor_total', antes.valor_total, preco.valorTotal);
    log('numero_versao', antes.numero_versao ?? 1, dados.numero_versao);
    return this.detalheProposta(u, id);
  }

  // ---------- Parâmetros comerciais (SCRUM-433 / RF29) ----------

  parametros(u: UsuarioAutenticado) {
    return lerParametros(this.banco, u.idEmpresa);
  }

  salvarParametros(u: UsuarioAutenticado, corpo: Record<string, unknown>) {
    const r = gravarParametros(this.banco, u.idEmpresa, u.idUsuario, corpo);
    for (const m of r.mudou) {
      this.banco.executar(
        `INSERT INTO log_auditoria (id_log, id_empresa, entidade, id_registro, campo, valor_anterior, valor_novo, id_usuario, origem, data_hora, motivo)
         VALUES (?, ?, 'Empresa', ?, ?, ?, ?, ?, 'Web', ?, 'Parâmetros comerciais')`,
        randomUUID(), u.idEmpresa, u.idEmpresa, m.campo, String(m.antes), String(m.depois), u.idUsuario, r.agora,
      );
    }
    return r.parametros;
  }

  /** RF27: o gestor muda o status. Passa pelo mesmo push do app, então o RN11 vale aqui também. */
  mudarStatus(u: UsuarioAutenticado, id: string, novo: unknown) {
    if (!ehStatusProposta(novo)) throw new BadRequestException('Status inválido.');
    const atual = this.bd.servidor.obter('Proposta', id);
    if (!atual || atual.idEmpresa !== u.idEmpresa) throw new NotFoundException('Proposta não encontrada.');
    const agora = new Date(Math.max(Date.now(), Date.parse(atual.updatedAt) + 1)).toISOString();
    const dados: Record<string, unknown> = { ...atual.dados, status_proposta: novo };
    // "Gerar nova versão": a proposta volta a "Gerada" com o número de versão seguinte.
    if (novo === 'Gerada' && atual.dados.status_proposta === 'Em negociação') dados.numero_versao = Number(atual.dados.numero_versao ?? 1) + 1;
    const r = this.bd.servidor.push(u, {
      idDispositivo: `painel-${u.idUsuario}`,
      operacoes: [{ idOperacao: `Proposta:${id}`, entidade: 'Proposta', baseUpdatedAt: atual.updatedAt, versao: { ...atual, updatedAt: agora, updatedBy: u.idUsuario, dados } }],
    });
    const resultado = r.resultados[0]!;
    if (resultado.situacao === 'rejeitada') throw new ConflictException(resultado.mensagem);
    if (resultado.situacao === 'descartada') throw new ConflictException(resultado.mensagem);
    // Log de Auditoria (Dicionário 8.1): quem mudou o status pelo painel.
    this.banco.executar(
      `INSERT INTO log_auditoria (id_log, id_empresa, entidade, id_registro, campo, valor_anterior, valor_novo, id_usuario, origem, data_hora, motivo)
       VALUES (?, ?, 'Proposta', ?, 'status_proposta', ?, ?, ?, 'Web', ?, 'Alteração de status no painel')`,
      randomUUID(), u.idEmpresa, id, String(atual.dados.status_proposta ?? ''), novo, u.idUsuario, agora,
    );
    return this.detalheProposta(u, id);
  }

  // ---------- Catálogo (RF23 / UC12) ----------

  listarEquipamentos(u: UsuarioAutenticado) {
    return this.banco
      .todos<{ dados: string; status: string; preco_custo: number; margem_percentual: number; preco_venda: number; updated_at: string }>(
        'SELECT dados, status, preco_custo, margem_percentual, preco_venda, updated_at FROM equipamento WHERE id_empresa = ? ORDER BY categoria, fabricante, modelo',
        u.idEmpresa,
      )
      .map((l) => ({ ...(JSON.parse(l.dados) as Equipamento), status: l.status, precoCusto: l.preco_custo, margemPercentual: l.margem_percentual, precoVenda: l.preco_venda, updatedAt: l.updated_at }));
  }

  salvarEquipamento(u: UsuarioAutenticado, entrada: Partial<Equipamento>, id?: string) {
    const agora = new Date().toISOString();
    const existente = id ? this.listarEquipamentos(u).find((e) => e.idEquipamento === id) : undefined;
    if (id && !existente) throw new NotFoundException('Equipamento não encontrado.');
    const precoCusto = Number(entrada.precoCusto ?? existente?.precoCusto);
    const margem = Number(entrada.margemPercentual ?? existente?.margemPercentual ?? 20);
    const eq: Equipamento = {
      ...(existente ?? {}),
      ...entrada,
      idEquipamento: existente?.idEquipamento ?? randomUUID(),
      idEmpresa: u.idEmpresa,
      categoria: (entrada.categoria ?? existente?.categoria) as Equipamento['categoria'],
      fabricante: String(entrada.fabricante ?? existente?.fabricante ?? '').trim(),
      modelo: String(entrada.modelo ?? existente?.modelo ?? '').trim(),
      fornecedor: String(entrada.fornecedor ?? existente?.fornecedor ?? '').trim(),
      unidadeVenda: (entrada.unidadeVenda ?? existente?.unidadeVenda ?? 'un') as Equipamento['unidadeVenda'],
      potenciaW: entrada.potenciaW === undefined ? (existente?.potenciaW ?? null) : entrada.potenciaW === null ? null : Number(entrada.potenciaW),
      garantiaAnos: entrada.garantiaAnos === undefined ? (existente?.garantiaAnos ?? null) : entrada.garantiaAnos === null ? null : Number(entrada.garantiaAnos),
      precoCusto,
      margemPercentual: margem,
      precoVenda: Number.isFinite(precoCusto) ? calcularPrecoVenda(precoCusto, margem) : NaN,
      status: (entrada.status ?? existente?.status ?? 'Ativo') as Equipamento['status'],
      createdAt: existente?.createdAt ?? agora,
      updatedAt: agora,
      updatedBy: u.idUsuario,
    };
    if (!(CATEGORIAS_EQUIPAMENTO as readonly string[]).includes(eq.categoria)) throw new BadRequestException('Categoria inválida.');
    const erros = validarEquipamento(eq);
    if (erros.length > 0) throw new BadRequestException(erros.map((e) => e.mensagem).join(' '));
    this.banco.executar(
      `INSERT INTO equipamento (id_equipamento, id_empresa, categoria, fabricante, modelo, fornecedor, potencia_w, preco_custo, margem_percentual, preco_venda, status, dados, created_at, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id_equipamento) DO UPDATE SET categoria = excluded.categoria, fabricante = excluded.fabricante, modelo = excluded.modelo,
         fornecedor = excluded.fornecedor, potencia_w = excluded.potencia_w, preco_custo = excluded.preco_custo,
         margem_percentual = excluded.margem_percentual, preco_venda = excluded.preco_venda, status = excluded.status,
         dados = excluded.dados, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
      eq.idEquipamento, eq.idEmpresa, eq.categoria, eq.fabricante, eq.modelo, eq.fornecedor, eq.potenciaW, eq.precoCusto,
      eq.margemPercentual, eq.precoVenda, eq.status, JSON.stringify(eq), eq.createdAt, eq.updatedAt, eq.updatedBy,
    );
    return eq;
  }

  // ---------- Usuários (técnicos da empresa) ----------

  listarUsuarios(u: UsuarioAutenticado) {
    return this.banco.todos<Record<string, unknown>>(
      `SELECT us.id_usuario AS id, us.nome, us.email, us.papel, us.telefone, us.ativo = 1 AS ativo, us.criado_em AS criadoEm,
              us.ultimo_acesso_em AS ultimoAcessoEm,
              (SELECT COUNT(*) FROM vw_proposta p WHERE p.id_usuario_responsavel = us.id_usuario) AS propostas,
              (SELECT MAX(data_hora) FROM log_sincronizacao l WHERE l.id_usuario = us.id_usuario) AS ultimaSincronizacao
         FROM usuario us WHERE us.id_empresa = ? ORDER BY us.papel DESC, us.nome`,
      u.idEmpresa,
    ).map((l) => ({ ...l, id: String(l.id), ativo: Boolean(l.ativo) }));
  }

  criarUsuario(u: UsuarioAutenticado, e: { nome?: unknown; email?: unknown; papel?: unknown; senha?: unknown; telefone?: unknown }) {
    const nome = typeof e.nome === 'string' ? e.nome.trim() : '';
    const email = typeof e.email === 'string' ? e.email.trim().toLowerCase() : '';
    const papel = e.papel === 'Gestor' ? 'Gestor' : 'Tecnico';
    const senha = typeof e.senha === 'string' ? e.senha : '';
    if (nome.length < 3) throw new BadRequestException('Informe o nome completo.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('E-mail inválido.');
    if (senha.length < 8) throw new BadRequestException('A senha precisa ter pelo menos 8 caracteres.');
    if (this.banco.um('SELECT 1 FROM usuario WHERE email = ?', email)) throw new ConflictException('Já existe um usuário com este e-mail.');
    const id = randomUUID();
    this.banco.executar(
      'INSERT INTO usuario (id_usuario, id_empresa, nome, email, senha_hash, papel, telefone, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id, u.idEmpresa, nome, email, gerarHashSenha(senha), papel, typeof e.telefone === 'string' ? e.telefone : null, new Date().toISOString(),
    );
    return this.listarUsuarios(u).find((x) => x.id === id);
  }

  definirAtivo(u: UsuarioAutenticado, id: string, ativo: unknown) {
    if (id === u.idUsuario) throw new BadRequestException('Você não pode desativar o próprio acesso.');
    const n = this.banco.executar('UPDATE usuario SET ativo = ? WHERE id_usuario = ? AND id_empresa = ?', ativo ? 1 : 0, id, u.idEmpresa);
    if (n === 0) throw new NotFoundException('Usuário não encontrado.');
    if (!ativo) this.banco.executar('UPDATE sessao_refresh SET revogada = 1 WHERE id_usuario = ?', id);
    return this.listarUsuarios(u).find((x) => x.id === id);
  }

  // ---------- Plano (RF24 / UC13) e logs ----------

  plano(u: UsuarioAutenticado) {
    const a = this.banco.um<{ tipo_plano: string; limite_propostas_mes: number | null; status: string; inicio_em: string }>(
      'SELECT tipo_plano, limite_propostas_mes, status, inicio_em FROM assinatura WHERE id_empresa = ?', u.idEmpresa,
    );
    const usadas = Number(
      this.banco.um<{ n: number }>('SELECT COUNT(*) AS n FROM vw_proposta WHERE id_empresa = ? AND data_geracao >= ?', u.idEmpresa, inicioDoMes())?.n ?? 0,
    );
    const solicitacoes = this.banco.todos<{ dados: string; updated_at: string }>(
      "SELECT dados, updated_at FROM registro_sync WHERE entidade = 'SolicitacaoUpgrade' AND id_empresa = ? ORDER BY updated_at DESC",
      u.idEmpresa,
    ).map((l) => ({ ...(JSON.parse(l.dados) as Record<string, unknown>), criadaEm: l.updated_at }));
    return {
      tipo: a?.tipo_plano ?? 'Freemium',
      status: a?.status ?? 'Ativa',
      limiteMes: a?.limite_propostas_mes ?? null,
      usadasMes: usadas,
      /** SCRUM-436: geradas offline além do limite neste mês. */
      acimaDoLimiteMes: propostasAcimaDoLimite(this.banco, u.idEmpresa).size,
      inicioEm: a?.inicio_em ?? null,
      solicitacoesUpgrade: solicitacoes,
    };
  }

  sincronizacoes(u: UsuarioAutenticado, limite = 50) {
    return this.banco.todos<Record<string, unknown>>(
      `SELECT l.data_hora AS dataHora, l.tipo, l.status, l.qtd_registros AS registros, l.mensagem_erro AS erro, l.id_dispositivo AS dispositivo, us.nome AS usuario
         FROM log_sincronizacao l JOIN usuario us ON us.id_usuario = l.id_usuario
        WHERE us.id_empresa = ? ORDER BY l.data_hora DESC LIMIT ?`,
      u.idEmpresa, limite,
    );
  }

  private registro(u: UsuarioAutenticado, entidade: string, id: string) {
    const l = this.banco.um<{ id_registro: string; dados: string; updated_at: string; updated_by: string }>(
      'SELECT id_registro, dados, updated_at, updated_by FROM registro_sync WHERE entidade = ? AND id_registro = ? AND id_empresa = ?',
      entidade, id, u.idEmpresa,
    );
    return l ? { id: l.id_registro, dados: JSON.parse(l.dados) as Record<string, unknown>, updatedAt: l.updated_at, updatedBy: l.updated_by } : null;
  }
}
