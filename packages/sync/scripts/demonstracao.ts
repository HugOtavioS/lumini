/**
 * Demonstração da sincronização offline (SCRUM-82, SCRUM-83, SCRUM-86 e
 * SCRUM-87): roda cada cenário com aparelhos simulados (SQLite de verdade em
 * arquivo temporário), mostra o que acontece e confere o critério de aceite.
 *
 * Uso, na raiz do repositório: `npm run demo:sync`
 *
 * Não usa a internet e não altera arquivos do repositório. Termina com
 * código 1 se alguma conferência falhar.
 */
import type { EntidadeSincronizavel } from '../src/contrato';
import {
  MB,
  avaliarArmazenamento,
  confirmarPlano,
  executarLimpeza,
  formatarBytes,
  planejarLimpeza,
  verificarEspacoParaGravar,
  type PropostaArmazenada,
} from '../src/armazenamento/politica';
import { ServidorSincronizacaoMemoria } from '../src/servidor/servidorReferencia';
import { AparelhoSimulado, Rede } from '../src/testes/ambiente';
import { EMPRESA, TECNICO_ANA, TECNICO_BRUNO } from '../src/testes/registros';
import { criarPastaTemporaria } from '../src/testes/sqlite';

// ---------------------------------------------------------------------------
// Saída e conferências
// ---------------------------------------------------------------------------

const conferencias: { item: string; texto: string; ok: boolean }[] = [];
let itemAtual = '';

function secao(item: string, titulo: string): void {
  itemAtual = item;
  const cabecalho = `${item} · ${titulo}`;
  console.log('');
  console.log(cabecalho);
  console.log('='.repeat(cabecalho.length));
}

function linha(texto = ''): void {
  console.log(texto === '' ? '' : `  ${texto}`);
}

function conferir(texto: string, ok: boolean): void {
  conferencias.push({ item: itemAtual, texto, ok });
  console.log(`  [${ok ? 'OK' : 'FALHOU'}] ${texto}`);
}

const reais = (valor: unknown) => `R$ ${Number(valor).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

// ---------------------------------------------------------------------------
// Relógio simulado: a demonstração "pula" o tempo em vez de esperar de verdade
// ---------------------------------------------------------------------------

class RelogioSimulado {
  agora = Date.parse('2026-10-18T15:00:00.000Z');
  private proximoId = 1;
  private readonly tarefas = new Map<number, { quando: number; tarefa: () => void }>();

  agendar = (tarefa: () => void, ms: number): number => {
    const id = this.proximoId++;
    this.tarefas.set(id, { quando: this.agora + ms, tarefa });
    return id;
  };

  cancelar = (id: unknown): void => {
    this.tarefas.delete(id as number);
  };

  /** Avança o relógio, rodando as tarefas agendadas no caminho. */
  async avancar(ms: number): Promise<void> {
    const fim = this.agora + ms;
    for (;;) {
      const proxima = [...this.tarefas.entries()].filter(([, t]) => t.quando <= fim).sort((a, b) => a[1].quando - b[1].quando)[0];
      if (!proxima) break;
      const [id, { quando, tarefa }] = proxima;
      this.tarefas.delete(id);
      this.agora = quando;
      tarefa();
      for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0)); // deixa a rodada terminar
    }
    this.agora = fim;
  }
}

const ITENS = [
  { id_item: 'item-1', id_equipamento: 'modulo-canadian-550', quantidade: 8, preco_unitario: 629.94 },
  { id_item: 'item-2', id_equipamento: 'inversor-growatt-5k', quantidade: 1, preco_unitario: 4513.75 },
];

const ORCAMENTO: [EntidadeSincronizavel, string, Record<string, unknown>][] = [
  ['Cliente', 'cli-1', { id_cliente: 'cli-1', nome: 'Maria Souza', telefone: '(12) 99999-0000' }],
  ['Instalacao', 'ins-1', { id_instalacao: 'ins-1', id_cliente: 'cli-1', cidade: 'Taubaté', estado: 'SP', consumo_medio_kwh: 500 }],
  ['Medicao', 'med-1', { id_medicao: 'med-1', id_instalacao: 'ins-1', area_m2: 41, inclinacao_graus: 20, orientacao: 'N' }],
  ['SimulacaoSombreamento', 'sim-1', { id_simulacao: 'sim-1', id_medicao: 'med-1', media_anual_perc: 3.6 }],
  ['Proposta', 'pro-1', { id_proposta: 'pro-1', id_instalacao: 'ins-1', status_proposta: 'Gerada', potencia_kwp: 4.4, valor_total: 21500, itens: ITENS }],
];

async function principal(): Promise<void> {
  console.log('Lumini · demonstração da sincronização offline');
  console.log(`Node ${process.version}`);
  const pasta = criarPastaTemporaria();
  const abertos: AparelhoSimulado[] = [];
  try {
    // -----------------------------------------------------------------------
    secao('SCRUM-82', 'Fila persistente, com retry e backoff exponencial');
    const relogio = new RelogioSimulado();
    const rede = new Rede();
    const servidor = new ServidorSincronizacaoMemoria({ relogio: () => relogio.agora });
    const opcoesFila = { relogio: () => relogio.agora, agendar: relogio.agendar, cancelar: relogio.cancelar };
    const ana = new AparelhoSimulado('ana', { idUsuario: TECNICO_ANA, idEmpresa: EMPRESA, papel: 'Tecnico' }, pasta.arquivo('ana.db'), servidor, rede, opcoesFila);
    abertos.push(ana);
    await ana.abrir();
    ana.desconectar();

    linha('1) Em campo, sem sinal, a Ana faz um orçamento completo.');
    for (const [entidade, id, dados] of ORCAMENTO) await ana.salvar(entidade, id, dados, '2026-10-18T14:00:00.000Z');
    const naFila = (await ana.fila.listar()).map((i) => i.entidade);
    linha(`   Na fila: ${naFila.join(' → ')}`);
    conferir('os 5 registros entraram na fila, em ordem de dependência', naFila.join() === 'Cliente,Instalacao,Medicao,SimulacaoSombreamento,Proposta');

    linha('2) Ela fecha o app. Mais tarde, abre de novo (ainda sem sinal).');
    ana.fechar();
    await ana.abrir();
    ana.desconectar();
    const depoisDeAbrir = await ana.fila.resumo();
    conferir(`a fila sobreviveu ao fechamento do app (${depoisDeAbrir.pendentes} pendentes)`, depoisDeAbrir.pendentes === 5);

    linha('3) Chega o sinal, mas a API está fora do ar: a fila tenta sozinha, esperando cada vez mais.');
    rede.apiForaDoAr = true;
    const inicio = relogio.agora;
    await ana.conectar();
    const horarios: number[] = [];
    for (const passo of [2_000, 4_000, 8_000]) {
      await relogio.avancar(passo);
      const [ultima] = await ana.banco.banco.consultar<{ data_hora: string }>(
        "SELECT data_hora FROM log_sincronizacao WHERE status = 'Falha' ORDER BY data_hora DESC LIMIT 1",
      );
      horarios.push(Date.parse(ultima?.data_hora ?? '') - inicio);
    }
    linha(`   Tentativas com falha em: 0 s, ${horarios.map((ms) => `${ms / 1000} s`).join(', ')} (depois de cada falha, a espera dobra)`);
    conferir('retentativa automática com espera de 2 s, 4 s e 8 s', horarios.join() === '2000,6000,14000');
    const statusComErro = (await ana.registro('Proposta', 'pro-1'))?.syncStatus;
    conferir(`enquanto falha, a proposta aparece como "${statusComErro}" (RF15, 4a)`, statusComErro === 'Erro');

    linha('4) A API volta. Na próxima tentativa (16 s depois), tudo sobe.');
    rede.apiForaDoAr = false;
    await relogio.avancar(16_000);
    const vazia = (await ana.fila.listar()).length === 0;
    const iguais = ORCAMENTO.every(([entidade, id, dados]) => JSON.stringify(servidor.obter(entidade, id)?.dados) === JSON.stringify(dados));
    conferir('fila vazia e registros "Sincronizado" no aparelho', vazia && (await ana.registro('Proposta', 'pro-1'))?.syncStatus === 'Sincronizado');
    conferir('o backend ficou com exatamente os dados do aparelho', iguais);
    const log = await ana.banco.banco.consultar<{ status: string }>('SELECT status FROM log_sincronizacao');
    linha(`   Log de sincronização (RNF11): ${log.filter((l) => l.status === 'Falha').length} falhas e ${log.filter((l) => l.status === 'Sucesso').length} sucesso registrados.`);

    // -----------------------------------------------------------------------
    secao('SCRUM-83', 'Mesma proposta editada offline em dois aparelhos');
    const bruno = new AparelhoSimulado('bruno', { idUsuario: TECNICO_BRUNO, idEmpresa: EMPRESA, papel: 'Tecnico' }, pasta.arquivo('bruno.db'), servidor, rede, opcoesFila);
    abertos.push(bruno);
    await bruno.abrir();
    await bruno.puxar();
    linha(`A Ana e o Bruno têm a proposta de ${reais(21500)}. Os dois ficam sem sinal e editam:`);
    ana.desconectar();
    bruno.desconectar();
    const base = ORCAMENTO[4]![2];
    await ana.salvar('Proposta', 'pro-1', { ...base, valor_total: 22000 }, '2026-10-18T15:05:00.000Z');
    const itensBruno = [ITENS[0]!, { id_item: 'item-3', id_equipamento: 'inversor-deye-6k', quantidade: 1, preco_unitario: 2180.71 }];
    await bruno.salvar('Proposta', 'pro-1', { ...base, valor_total: 24500, itens: itensBruno }, '2026-10-18T15:10:00.000Z');
    linha(`   - Ana, às 12:05: valor ${reais(22000)}`);
    linha(`   - Bruno, às 12:10: valor ${reais(24500)} e troca o inversor Growatt pelo Deye`);
    linha('A Ana reconecta primeiro; o Bruno, depois.');
    relogio.agora = Date.parse('2026-10-18T15:30:00.000Z');
    await ana.conectar();
    await bruno.conectar();
    const final = servidor.obter('Proposta', 'pro-1');
    linha(`No servidor: ${reais(final?.dados.valor_total)}, versão do ${final?.updatedBy === TECNICO_BRUNO ? 'Bruno' : 'outro usuário'}.`);
    conferir('venceu a edição mais recente (last-write-wins por updated_at)', final?.dados.valor_total === 24500 && final.updatedBy === TECNICO_BRUNO);
    linha('Log de auditoria:');
    for (const l of servidor.logAuditoria) linha(`   ${l.entidade} ${l.idRegistro} · ${l.campo}: ${l.valorAnterior ?? '—'} → ${l.valorNovo ?? '—'}`);
    linha(`   Motivo: ${servidor.logAuditoria[0]?.motivo ?? '—'}`);
    conferir('cada campo sobrescrito ficou no log de auditoria', servidor.logAuditoria.length === 3);
    await ana.puxar();
    linha(`Aviso que a Ana recebe: "${ana.mensagens[0] ?? '—'}"`);
    const anaFinal = (await ana.registro('Proposta', 'pro-1'))?.versao;
    const brunoFinal = (await bruno.registro('Proposta', 'pro-1'))?.versao;
    conferir('a Ana foi avisada, e os dois aparelhos terminaram iguais ao servidor', ana.mensagens.length === 1 && JSON.stringify(anaFinal) === JSON.stringify(final) && JSON.stringify(brunoFinal) === JSON.stringify(final));

    linha('');
    linha('E se a edição mais antiga chegar por último? A Ana edita às 12:40 e o Bruno às 12:45, mas o Bruno sincroniza antes.');
    ana.desconectar();
    bruno.desconectar();
    const auditoriaAntes = servidor.logAuditoria.length;
    await ana.salvar('Proposta', 'pro-1', { ...final!.dados, valor_total: 23000 }, '2026-10-18T15:40:00.000Z');
    await bruno.salvar('Proposta', 'pro-1', { ...final!.dados, valor_total: 25000 }, '2026-10-18T15:45:00.000Z');
    relogio.agora = Date.parse('2026-10-18T16:00:00.000Z');
    await bruno.conectar();
    await ana.conectar();
    const descarte = servidor.logAuditoria.slice(auditoriaAntes);
    linha(`No servidor: ${reais(servidor.obter('Proposta', 'pro-1')?.dados.valor_total)}. A Ana vê: "${ana.mensagens.at(-1) ?? '—'}"`);
    conferir(
      'a edição mais antiga foi descartada, e o valor que se perdeu ficou no log',
      servidor.obter('Proposta', 'pro-1')?.dados.valor_total === 25000 && descarte.some((l) => l.valorAnterior === '23000' && l.valorNovo === '25000'),
    );

    // -----------------------------------------------------------------------
    secao('SCRUM-86', 'Fluxo completo offline → reconexão → sincronização');
    linha('Os cenários acima usam o mesmo ambiente dos testes de integração: aparelhos com SQLite em arquivo,');
    linha('rede que cai e volta e o servidor de referência com as regras da API.');
    linha('Mais um caso: a conexão cai depois de o servidor gravar, antes de a resposta chegar.');
    const tablet = new AparelhoSimulado('ana-tablet', { idUsuario: TECNICO_ANA, idEmpresa: EMPRESA, papel: 'Tecnico' }, pasta.arquivo('ana-tablet.db'), servidor, rede, opcoesFila);
    abertos.push(tablet);
    await tablet.abrir();
    await tablet.salvar('Cliente', 'cli-2', { id_cliente: 'cli-2', nome: 'João Pereira' }, '2026-10-18T15:50:00.000Z');
    rede.perderProximaResposta = true;
    await tablet.fila.processar();
    await tablet.fila.retentarAgora();
    conferir('o reenvio não duplicou o cliente no servidor (idempotência pelo UUID)', servidor.listar('Cliente').filter((c) => c.id === 'cli-2').length === 1);

    linha('E se a resposta se perder e a Ana corrigir o cadastro antes do reenvio?');
    const auditoriaAntesDoReenvio = servidor.logAuditoria.length;
    await tablet.salvar('Cliente', 'cli-2', { id_cliente: 'cli-2', nome: 'João Pereira', telefone: '(12) 98888-0000' }, '2026-10-18T15:52:00.000Z');
    rede.perderProximaResposta = true;
    await tablet.fila.processar();
    await tablet.salvar('Cliente', 'cli-2', { id_cliente: 'cli-2', nome: 'João Pereira', telefone: '(12) 98888-1111' }, '2026-10-18T15:53:00.000Z');
    await tablet.fila.retentarAgora();
    conferir(
      'a correção subiu sem virar conflito com ela mesma (nada novo no log, nenhum aviso)',
      servidor.obter('Cliente', 'cli-2')?.dados.telefone === '(12) 98888-1111' &&
        servidor.logAuditoria.length === auditoriaAntesDoReenvio &&
        tablet.mensagens.length === 0,
    );
    linha('Para rodar todos os cenários como testes automáticos: npm test (ou npm run test:detalhado para ver um por um).');

    // -----------------------------------------------------------------------
    secao('SCRUM-87', 'Limite de armazenamento local e limpeza manual');
    const agora = '2026-10-18T12:00:00.000Z';
    const diasAtras = (d: number) => new Date(Date.parse(agora) - d * 86_400_000).toISOString();
    const propostas: PropostaArmazenada[] = [
      ...Array.from({ length: 200 }, (_, i) => ({
        idProposta: `antiga-${i}`,
        statusProposta: 'Gerada' as const,
        syncStatus: 'Sincronizado' as const,
        temPendencia: false,
        atualizadoEm: diasAtras(100 + i),
        bytesArquivos: 2 * MB,
      })),
      ...Array.from({ length: 30 }, (_, i) => ({
        idProposta: `recente-${i}`,
        statusProposta: 'Gerada' as const,
        syncStatus: (i < 3 ? 'Pendente' : 'Sincronizado') as 'Pendente' | 'Sincronizado',
        temPendencia: i < 3,
        atualizadoEm: diasAtras(i),
        bytesArquivos: 2 * MB,
      })),
    ];
    const situacao = avaliarArmazenamento({ propostas, bytesBanco: 0, espacoLivreAparelhoBytes: 8_000 * MB, agora });
    linha(`230 propostas no aparelho: ${formatarBytes(situacao.usoBytes)} de ${formatarBytes(situacao.limiteBytes)} (nível "${situacao.nivel}").`);
    linha(`Aviso: "${situacao.mensagem}"`);
    conferir('acima de 80 % do limite, o app avisa e diz quanto dá para liberar', situacao.nivel === 'atencao' && situacao.liberavelBytes === 400 * MB);

    const plano = planejarLimpeza({ propostas, agora });
    linha(`Tela de confirmação: "${plano.resumo}"`);
    conferir('a lista só tem propostas sincronizadas há mais de 90 dias (nenhuma pendente ou recente)', plano.itens.length === 200 && plano.itens.every((i) => i.idProposta.startsWith('antiga-')));
    let apagadas = 0;
    const removerArquivos = async () => {
      apagadas += 1;
    };
    const semConfirmar = await executarLimpeza({ plano, confirmacao: null, propostasAtuais: propostas, removerArquivos, agora }).catch((e: unknown) => e);
    conferir('sem a confirmação do técnico, nada é apagado', semConfirmar instanceof Error && apagadas === 0);
    const limpeza = await executarLimpeza({ plano, confirmacao: confirmarPlano(plano, agora), propostasAtuais: propostas, removerArquivos, agora });
    linha(`O técnico confirma: ${limpeza.removidas.length} propostas tiveram os arquivos removidos, ${formatarBytes(limpeza.bytesLiberados)} liberados.`);
    conferir('com a confirmação, os arquivos são removidos e o espaço é liberado', limpeza.bytesLiberados === 400 * MB);

    const critico = avaliarArmazenamento({ propostas: propostas.slice(200), espacoLivreAparelhoBytes: 120 * MB, agora });
    conferir('celular com 120 MB livres: aviso destacado, mesmo com o Lumini ocupando pouco', critico.nivel === 'critico' && critico.avisoDestacado);
    const gravar = verificarEspacoParaGravar({ espacoLivreAparelhoBytes: 30 * MB, bytesNecessarios: 1 * MB });
    linha(`Gerar PDF com 30 MB livres: "${gravar.mensagem}"`);
    conferir('sem espaço de verdade, o PDF não é gravado e a proposta não se perde (RNF14)', gravar.pode === false);
    conferir('o limite não bloqueia trabalho: com espaço no celular, grava mesmo acima dos 500 MB', verificarEspacoParaGravar({ espacoLivreAparelhoBytes: 5_000 * MB, bytesNecessarios: 1 * MB }).pode);
  } finally {
    for (const a of abertos) {
      try {
        a.fechar();
      } catch {
        // já fechado
      }
    }
    pasta.apagar();
  }

  console.log('');
  console.log('Resumo');
  console.log('======');
  const itens = [...new Set(conferencias.map((c) => c.item))];
  for (const item of itens) {
    const doItem = conferencias.filter((c) => c.item === item);
    const ok = doItem.filter((c) => c.ok).length;
    console.log(`  ${item.padEnd(11)}${ok === doItem.length ? 'OK    ' : 'FALHOU'}  ${ok} de ${doItem.length} ${doItem.length === 1 ? 'conferência' : 'conferências'}`);
  }
  const falhas = conferencias.filter((c) => !c.ok);
  console.log('');
  if (falhas.length === 0) {
    console.log(`  Tudo certo: as ${itens.length} tasks passaram em todas as conferências.`);
  } else {
    console.log(`  ${falhas.length} ${falhas.length === 1 ? 'conferência falhou' : 'conferências falharam'}:`);
    for (const f of falhas) console.log(`  - ${f.item}: ${f.texto}`);
  }
  process.exitCode = falhas.length > 0 ? 1 : 0;
}

principal().catch((erro: unknown) => {
  console.error('');
  console.error('A demonstração parou com um erro:');
  console.error(erro);
  process.exitCode = 1;
});
