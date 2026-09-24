/**
 * Demonstração das tasks de Lógica/Cálculo: roda cada item do backlog com um
 * exemplo, mostra o resultado na tela e confere o critério de aceite.
 *
 * Uso, na raiz do repositório:
 *   npm run demo                   tenta buscar o HSP na NASA POWER (precisa de internet)
 *   npm run demo:sem-internet      não usa a internet
 *
 * Não altera nenhum arquivo do repositório: o diagrama do SCRUM-81 é salvo na
 * pasta temporária do sistema. Termina com código 1 se alguma conferência falhar.
 */
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  areaDoModuloM2,
  calcularGeracaoEstimada,
  calcularQuantidadeModulos,
  calcularTrajetoriaAnual,
  calcularTrajetoriaDiaria,
  CATEGORIAS_EQUIPAMENTO,
  consolidarCalibracao,
  contarPorCategoria,
  criarCatalogoInicial,
  criarProvedorNasaPower,
  DADOS_CATALOGO_INICIAL,
  dimensionarSistema,
  formatarNumeroBr,
  gerarDiagramaSombreamento,
  medirPoligono,
  NOMES_MESES,
  obstaculoGeometricoParaAngular,
  obterHsp,
  PARAMETROS_TECNICOS_PADRAO,
  verificarCompatibilidadeCatalogo,
  verificarEspacoTelhado,
  verificarSuperdimensionamento,
  type ComponentesPerdas,
  type EntradaCalibracao,
  type Equipamento,
  type EventoHsp,
  type LocalidadeClimatica,
  type ObstaculoAngular,
  type PlanoTelhado,
  type Ponto3D,
  type ProvedorHspOnline,
  type RespostaProvedorHsp,
} from '../src/index';

// ---------------------------------------------------------------------------
// Saída na tela e conferências
// ---------------------------------------------------------------------------

type Situacao = 'OK' | 'FALHOU' | 'AVISO';

const conferencias: { item: string; texto: string; situacao: Situacao }[] = [];
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

function registrar(situacao: Situacao, texto: string): void {
  conferencias.push({ item: itemAtual, texto, situacao });
  console.log(`  [${situacao}] ${texto}`);
}

function conferir(texto: string, ok: boolean): void {
  registrar(ok ? 'OK' : 'FALHOU', texto);
}

const n = (valor: number, casas = 2): string => formatarNumeroBr(valor, casas);
const pct = (valor: number, casas = 1): string => `${formatarNumeroBr(valor, casas)}%`;
const reais = (valor: number): string => `R$ ${formatarNumeroBr(valor, 2)}`;
const coluna = (texto: string, largura: number): string =>
  texto.length > largura - 1 ? `${texto.slice(0, largura - 4)}... ` : texto.padEnd(largura);
const nomeDoItem = (e: Equipamento): string => `${e.fabricante} ${e.modelo}`;
const dataBr = (iso: string): string => iso.slice(0, 10).split('-').reverse().join('/');

const ROTULO_NIVEL: Record<string, string> = {
  ok: 'OK',
  atencao: 'ATENÇÃO',
  insuficiente: 'NÃO CABE',
  alerta: 'ALERTA',
};

function imprimirMensal(rotulo: string, valores: readonly number[], casas: number): void {
  const partes = valores.map((v, i) => `${NOMES_MESES[i]} ${n(v, casas)}`);
  linha(`${rotulo} ${partes.slice(0, 6).join(' · ')}`);
  linha(`${' '.repeat(rotulo.length)} ${partes.slice(6).join(' · ')}`);
}

/** Roda um cálculo com o `fetch` trocado por um contador, para provar que ele não usa a internet. */
async function semInternet<T>(calculo: () => T | Promise<T>): Promise<{ valor: T; chamadasDeRede: number; ms: number }> {
  const global = globalThis as { fetch?: unknown };
  const fetchOriginal = global.fetch;
  let chamadasDeRede = 0;
  global.fetch = () => {
    chamadasDeRede += 1;
    return Promise.reject(new Error('sem rede'));
  };
  try {
    const inicio = performance.now();
    const valor = await calculo();
    return { valor, chamadasDeRede, ms: performance.now() - inicio };
  } finally {
    global.fetch = fetchOriginal;
  }
}

// ---------------------------------------------------------------------------
// Cenário usado em todas as tasks
// ---------------------------------------------------------------------------

const SEM_INTERNET = process.argv.includes('--sem-internet');
const LOCAL = { nome: 'Taubaté-SP', latitude: -23.0265, longitude: -45.5559 };
const UBATUBA = { nome: 'Ubatuba-SP', latitude: -23.4336, longitude: -45.0838 };
const CONSUMO_KWH_MES = 500;
const ANO = 2026;
const PLANO: PlanoTelhado = { inclinacaoGraus: 20, azimuteGraus: 0 };
const OBSTACULOS: ObstaculoAngular[] = [
  obstaculoGeometricoParaAngular({ nome: 'Árvore', azimuteGraus: 35, distanciaM: 8, alturaM: 5, larguraM: 6 }),
  { nome: "Caixa d'água", azimuteInicialGraus: 285, azimuteFinalGraus: 310, elevacaoGraus: 18 },
];
const PERDAS_PADRAO: ComponentesPerdas = {
  temperaturaPerc: PARAMETROS_TECNICOS_PADRAO.perdaTemperaturaPerc,
  sujeiraPerc: PARAMETROS_TECNICOS_PADRAO.perdaSujeiraPerc,
  cabeamentoPerc: PARAMETROS_TECNICOS_PADRAO.perdaCabeamentoPerc,
  sombreamentoPerc: PARAMETROS_TECNICOS_PADRAO.sombreamentoPadraoPerc,
};
/** HSP FICTÍCIO, usado só quando a NASA POWER não responde (a base real vem do SCRUM-17). */
const HSP_FICTICIO = { medio: 4.8, mensal: [5.5, 5.7, 5.0, 4.6, 3.9, 3.7, 3.9, 4.7, 4.8, 5.1, 5.3, 5.4] };

const catalogo = criarCatalogoInicial({ idEmpresa: 'demonstracao', idUsuario: 'demonstracao' });

function doCatalogo(trechoDoModelo: string): Equipamento {
  const equipamento = catalogo.find((e) => e.modelo.includes(trechoDoModelo));
  if (!equipamento) throw new Error(`"${trechoDoModelo}" não está no catálogo.`);
  return equipamento;
}

const MODULO_550 = doCatalogo('CS6W-550MS');
const MODULO_700 = doCatalogo('HY-M12/132H-700');
const INVERSOR_GROWATT = doCatalogo('MIN 5000TL-X');
const INVERSOR_DEYE = doCatalogo('SUN-6K');
const AREA_MODULO_550 = areaDoModuloM2(MODULO_550.comprimentoMm!, MODULO_550.larguraMm!);

interface HspDaDemonstracao {
  medio: number;
  mensal: number[] | null;
  origem: string;
  base: LocalidadeClimatica[];
}

interface Kit {
  quantidade: number;
  potenciaInstaladaKwp: number;
  geracaoMensalKwh: number;
}

// ---------------------------------------------------------------------------
// SCRUM-8
// ---------------------------------------------------------------------------

async function scrum8(): Promise<HspDaDemonstracao> {
  secao('SCRUM-8', 'HSP automático pela localização do GPS');
  linha(`GPS do técnico: ${LOCAL.nome} (${n(LOCAL.latitude, 4)}; ${n(LOCAL.longitude, 4)}). Ninguém digita nem procura o HSP.`);

  let medio: number | null = null;
  let mensal: number[] | null = null;
  let descricao = '';

  if (SEM_INTERNET) {
    linha('1) Com internet: pulado (demo:sem-internet).');
  } else {
    linha('1) Com internet: buscando na NASA POWER...');
    const eventos: EventoHsp[] = [];
    const inicio = performance.now();
    const r = await obterHsp(
      { latitude: LOCAL.latitude, longitude: LOCAL.longitude },
      {
        baseContingencia: [],
        provedor: criarProvedorNasaPower(),
        estaOnline: () => true,
        registrarLog: (e) => eventos.push(e),
      },
    );
    const segundos = (performance.now() - inicio) / 1000;
    if (r.status === 'ok') {
      medio = r.dados.hspMedio;
      mensal = r.dados.hspMensal;
      descricao = r.dados.descricaoFonte;
      linha(`   HSP de ${n(medio)} h/dia em ${n(segundos, 1)} s (${descricao}).`);
      if (mensal) imprimirMensal('   HSP por mês:', mensal, 2);
      conferir('com internet, o HSP vem da API pela coordenada do GPS', r.dados.fonte === 'API');
    } else {
      const falha = eventos.find((e) => e.tipo === 'api_falhou' || e.tipo === 'api_timeout');
      linha(`   A NASA POWER não respondeu (${(falha?.mensagem ?? r.motivo).replace(/\.$/, '')}).`);
      registrar('AVISO', 'sem acesso à NASA POWER agora; o resto da demonstração usa um HSP FICTÍCIO');
    }
  }

  const daApi = medio !== null;
  const base: LocalidadeClimatica[] = [
    {
      idLocalidade: 'demonstracao-taubate',
      cidade: 'Taubaté',
      estado: 'SP',
      latitude: -23.0104,
      longitude: -45.5593,
      hspMedio: medio ?? HSP_FICTICIO.medio,
      irradiacaoKwhM2Dia: medio ?? HSP_FICTICIO.medio,
      hspMensal: daApi ? mensal : HSP_FICTICIO.mensal,
      fonte: 'Contingência',
      dataAtualizacao: new Date().toISOString(),
    },
  ];
  linha(
    daApi
      ? 'Base de contingência desta demonstração: só Taubaté, com o valor que acabou de vir da API.'
      : 'Base de contingência desta demonstração: só Taubaté, com valor FICTÍCIO (a base real é o SCRUM-17).',
  );

  const offline = { baseContingencia: base, estaOnline: () => false };

  const perto = await obterHsp({ latitude: LOCAL.latitude, longitude: LOCAL.longitude }, offline);
  if (perto.status === 'ok') {
    const loc = perto.dados.localidade;
    linha(`2) Sem internet, em Taubaté: ${n(perto.dados.hspMedio)} h/dia da base (${loc?.cidade}-${loc?.estado}, a ${n(loc?.distanciaKm ?? 0, 1)} km).`);
  }
  conferir('sem internet, usa a base de contingência', perto.status === 'ok' && perto.dados.fonte === 'Contingência' && !perto.dados.aproximado);

  const longe = await obterHsp({ latitude: UBATUBA.latitude, longitude: UBATUBA.longitude }, offline);
  if (longe.status === 'ok') {
    linha(`3) Sem internet, em ${UBATUBA.nome}: usa Taubaté, a ${n(longe.dados.localidade?.distanciaKm ?? 0, 0)} km, e marca o valor como aproximado.`);
  }
  conferir('a mais de 50 km da cidade da base, o valor vem marcado como aproximado', longe.status === 'ok' && longe.dados.aproximado);

  const apiMuda: ProvedorHspOnline = {
    nome: 'API que não responde',
    buscar: () => new Promise<RespostaProvedorHsp>(() => undefined),
  };
  const inicioMuda = performance.now();
  const muda = await obterHsp(
    { latitude: LOCAL.latitude, longitude: LOCAL.longitude },
    { baseContingencia: base, provedor: apiMuda, estaOnline: () => true, timeoutMs: 2000 },
  );
  const esperaMuda = (performance.now() - inicioMuda) / 1000;
  linha(`4) Internet ligada, mas a API não responde: desistiu em ${n(esperaMuda, 1)} s e usou a base (no app o limite é 8 s).`);
  conferir('não trava quando a API não responde', muda.status === 'ok' && muda.dados.fonte === 'Contingência' && esperaMuda < 3);

  const nada = await obterHsp({ latitude: LOCAL.latitude, longitude: LOCAL.longitude }, { baseContingencia: [], estaOnline: () => false });
  linha(`5) Sem internet e sem base: "${nada.status === 'indisponivel' ? nada.motivo : 'devolveu um valor'}"`);
  conferir('sem nenhum dado, avisa e pede o HSP ao técnico, sem erro', nada.status === 'indisponivel');

  return {
    medio: medio ?? HSP_FICTICIO.medio,
    mensal: daApi ? mensal : HSP_FICTICIO.mensal,
    origem: daApi ? 'NASA POWER' : 'valor FICTÍCIO',
    base,
  };
}

// ---------------------------------------------------------------------------
// SCRUM-12
// ---------------------------------------------------------------------------

async function scrum12(hsp: HspDaDemonstracao): Promise<Kit> {
  secao('SCRUM-12', 'Dimensionamento no aparelho: kWp, perdas e geração estimada');
  const perdas = PERDAS_PADRAO;
  const somaPerdas = perdas.temperaturaPerc + perdas.sujeiraPerc + perdas.cabeamentoPerc + perdas.sombreamentoPerc;

  const { valor: dim, chamadasDeRede, ms } = await semInternet(() =>
    dimensionarSistema({ consumoMensalKwh: CONSUMO_KWH_MES, hspMedio: hsp.medio, hspMensal: hsp.mensal ?? undefined, perdas }),
  );
  const kwpAParte = CONSUMO_KWH_MES / (hsp.medio * 30 * (1 - somaPerdas / 100));

  linha(`Consumo: ${CONSUMO_KWH_MES} kWh/mês · HSP: ${n(hsp.medio)} h/dia (${hsp.origem})`);
  linha(
    `Perdas: temperatura ${pct(perdas.temperaturaPerc, 0)} + sujeira ${pct(perdas.sujeiraPerc, 0)} + cabeamento ` +
      `${pct(perdas.cabeamentoPerc, 0)} + sombreamento ${pct(perdas.sombreamentoPerc, 0)} = ${pct(dim.perdasTotaisPerc, 0)}`,
  );
  linha(`RN01: kWp = ${CONSUMO_KWH_MES} / (${n(hsp.medio)} x 30 x (1 - ${n(somaPerdas / 100)})) = ${n(dim.potenciaNecessariaKwp)} kWp`);

  const { quantidade, potenciaInstaladaKwp } = calcularQuantidadeModulos(dim.potenciaNecessariaKwp, MODULO_550.potenciaW!);
  const geracao = calcularGeracaoEstimada({
    potenciaKwp: potenciaInstaladaKwp,
    hspMedio: hsp.medio,
    hspMensal: hsp.mensal ?? undefined,
    perdas,
  });
  linha(`Com o módulo ${nomeDoItem(MODULO_550)} (${MODULO_550.potenciaW} W): ${quantidade} módulos = ${n(potenciaInstaladaKwp)} kWp instalados`);
  linha(`Geração estimada: ${n(geracao.mediaMensalKwh, 0)} kWh/mês · ${n(geracao.anualKwh, 0)} kWh/ano`);
  if (geracao.porMesKwh) imprimirMensal('Por mês (kWh):', geracao.porMesKwh, 0);

  conferir(`o kWp bate com a conta da RN01 feita à parte (${n(kwpAParte, 4)} kWp)`, Math.abs(kwpAParte - dim.potenciaNecessariaKwp) < 0.006);
  conferir(`o cálculo não usou a internet (${chamadasDeRede} chamadas de rede)`, chamadasDeRede === 0);

  // RNF01: o fluxo técnico inteiro, sem internet, como no aparelho.
  const fluxo = async (): Promise<void> => {
    const h = await obterHsp({ latitude: LOCAL.latitude, longitude: LOCAL.longitude }, { baseContingencia: hsp.base, estaOnline: () => false });
    if (h.status !== 'ok') throw new Error('HSP indisponível no fluxo.');
    const sombra = gerarDiagramaSombreamento({ latitude: LOCAL.latitude, longitude: LOCAL.longitude, ano: ANO, plano: PLANO, obstaculos: OBSTACULOS });
    const p = { ...perdas, sombreamentoPerc: sombra.sombreamento.mediaAnualPerc };
    const d = dimensionarSistema({ consumoMensalKwh: CONSUMO_KWH_MES, hspMedio: h.dados.hspMedio, perdas: p });
    const q = calcularQuantidadeModulos(d.potenciaNecessariaKwp, MODULO_550.potenciaW!);
    verificarEspacoTelhado({ areaMedidaM2: 40, quantidadeModulos: q.quantidade, areaModuloM2: AREA_MODULO_550 });
    const g = calcularGeracaoEstimada({ potenciaKwp: q.potenciaInstaladaKwp, hspMedio: h.dados.hspMedio, perdas: p });
    verificarSuperdimensionamento({ consumoMensalKwh: CONSUMO_KWH_MES, geracaoEstimadaKwhMes: g.mediaMensalKwh });
    verificarCompatibilidadeCatalogo({ modulo: MODULO_550, quantidadeModulos: q.quantidade, inversor: INVERSOR_GROWATT, tipoLigacao: 'Bifásica' });
  };
  await fluxo(); // aquecimento
  let pior = 0;
  let redeNoFluxo = 0;
  for (let i = 0; i < 5; i += 1) {
    const r = await semInternet(fluxo);
    pior = Math.max(pior, r.ms);
    redeNoFluxo += r.chamadasDeRede;
  }
  linha(`Tempo: ${n(ms, 3)} ms só o kWp; ${n(pior, 1)} ms o fluxo inteiro sem internet (HSP, sombra, kWp, alertas e compatibilidade).`);
  conferir(
    `RNF01: fluxo inteiro em ${n(pior, 1)} ms, abaixo de 3 s, sem internet (${redeNoFluxo} chamadas de rede)`,
    pior < 3000 && redeNoFluxo === 0,
  );

  return { quantidade, potenciaInstaladaKwp, geracaoMensalKwh: geracao.mediaMensalKwh };
}

// ---------------------------------------------------------------------------
// SCRUM-76
// ---------------------------------------------------------------------------

function scrum76(): void {
  secao('SCRUM-76', 'Catálogo local de equipamentos');
  const contagem = contarPorCategoria(catalogo);
  linha(
    `${catalogo.length} itens reais. Preço de custo de referência de ${dataBr(DADOS_CATALOGO_INICIAL.dataReferenciaPrecos)}; ` +
      `venda = custo + ${n(DADOS_CATALOGO_INICIAL.margemPadraoPerc, 0)}% de margem.`,
  );
  linha(CATEGORIAS_EQUIPAMENTO.map((c) => `${c}: ${contagem[c]}`).join(' · '));
  linha('');
  linha(`${coluna('Categoria', 11)}${coluna('Fabricante', 16)}${coluna('Modelo', 34)}${coluna('Potência', 10)}${coluna('Custo', 12)}Venda`);
  for (const e of catalogo) {
    const potencia = e.potenciaW ? `${n(e.potenciaW, 0)} W` : '-';
    linha(`${coluna(e.categoria, 11)}${coluna(e.fabricante, 16)}${coluna(e.modelo, 34)}${coluna(potencia, 10)}${coluna(reais(e.precoCusto), 12)}${reais(e.precoVenda)}`);
  }
  conferir('as 6 categorias têm itens', CATEGORIAS_EQUIPAMENTO.every((c) => contagem[c] > 0));
  conferir(
    'todo item tem fabricante e preço; módulos e inversores têm potência',
    catalogo.every(
      (e) =>
        e.fabricante.trim() !== '' &&
        e.precoCusto > 0 &&
        e.precoVenda > 0 &&
        ((e.categoria !== 'Módulo' && e.categoria !== 'Inversor') || (e.potenciaW ?? 0) > 0),
    ),
  );
}

// ---------------------------------------------------------------------------
// SCRUM-79
// ---------------------------------------------------------------------------

function scrum79(): void {
  secao('SCRUM-79', 'Medição por RA e calibração contra medida conhecida');
  linha('A RA ainda não existe (SCRUM-5 e SCRUM-11): os pontos e as medições abaixo são SIMULADOS.');

  const inclinacao = (20 * Math.PI) / 180;
  const beiral = { y: -4 * Math.sin(inclinacao), z: -4 * Math.cos(inclinacao) };
  const cantos: Ponto3D[] = [
    { x: 0, y: 0, z: 0 },
    { x: 5, y: 0, z: 0 },
    { x: 5, ...beiral },
    { x: 0, ...beiral },
  ];
  const medida = medirPoligono(cantos, { rumoInicialGraus: 0 });
  linha('1) Os 4 cantos de um telhado de 5,00 m x 4,00 m, inclinado 20° e voltado para o Norte, viram:');
  linha(
    `   área ${n(medida.areaM2)} m² · inclinação ${n(medida.inclinacaoGraus)}° · azimute ${n(medida.azimuteGraus ?? 0)}° ` +
      `(${medida.orientacao ?? '-'}) · lados ${medida.ladosM.map((l) => n(l)).join(' / ')} m`,
  );
  conferir(
    'os pontos da RA viram a área, a inclinação e a orientação certas',
    Math.abs(medida.areaM2 - 20) < 0.01 && Math.abs(medida.inclinacaoGraus - 20) < 0.01 && medida.orientacao === 'N',
  );

  linha('');
  linha('2) Calibração: sala de 4,00 m x 3,00 m (12,00 m²), rampa de 20° e parede voltada para o Norte (0°).');
  linha('   5 medições de cada grandeza por celular:');
  const celular = (comprimentos: number[], areas: number[]): EntradaCalibracao[] => [
    { grandeza: 'comprimento', valorReferencia: 4, medicoes: comprimentos },
    { grandeza: 'area', valorReferencia: 12, medicoes: areas },
    { grandeza: 'inclinacao', valorReferencia: 20, medicoes: [19.1, 20.6, 21.2, 19.5, 20.3] },
    { grandeza: 'azimute', valorReferencia: 0, medicoes: [355, 4, 358, 7, 2] },
  ];
  const bom = consolidarCalibracao(celular([4.02, 3.97, 4.05, 3.99, 4.03], [12.1, 11.8, 12.3, 11.9, 12.2]));
  const ruim = consolidarCalibracao(celular([4.23, 4.25, 4.22, 4.26, 4.24], [13.4, 13.6, 13.3, 13.5, 13.4]));
  for (const [nome, r] of [
    ['Celular A', bom],
    ['Celular B', ruim],
  ] as const) {
    linha(`   ${nome}: ${r.resumo}`);
    for (const g of r.resultados) linha(`     - ${g.resumo}`);
  }
  conferir('celular com as medições dentro da tolerância: calibrado', bom.calibrada);
  conferir(
    'celular com erro sistemático: não calibrado, com fator de correção sugerido',
    !ruim.calibrada && ruim.resultados.some((g) => g.fatorCorrecaoSugerido !== null),
  );
  linha('Protocolo do teste real: docs/testes/SCRUM-79_Protocolo_Calibracao_RA.md');
}

// ---------------------------------------------------------------------------
// SCRUM-80
// ---------------------------------------------------------------------------

function direcaoDoSol(azimute: number): string {
  return azimute < 90 || azimute > 270 ? 'ao Norte' : 'ao Sul';
}

function scrum80(): void {
  secao('SCRUM-80', 'Trajetória do sol por coordenadas e data');
  linha(`${LOCAL.nome}, ${ANO}. Algoritmo NOAA/Meeus; nos testes, comparado com o SPA do NREL (erro menor que 0,02°).`);
  const local = { latitude: LOCAL.latitude, longitude: LOCAL.longitude };
  const inverno = calcularTrajetoriaDiaria({ ...local, data: { ano: ANO, mes: 6, dia: 21 } });
  const verao = calcularTrajetoriaDiaria({ ...local, data: { ano: ANO, mes: 12, dia: 21 }, passoMinutos: 60 });
  for (const [rotulo, t] of [
    ['21/06 (inverno)', inverno],
    ['21/12 (verão)', verao],
  ] as const) {
    linha(
      `${rotulo}: nasce ${t.nascerDoSol} · se põe ${t.porDoSol} · ${n(t.duracaoDiaHoras, 1)} h de sol · ` +
        `às ${t.meioDiaSolar} fica a ${n(t.elevacaoMaximaGraus, 1)}° de altura, ${direcaoDoSol(t.azimuteMeioDiaGraus)}`,
    );
  }

  linha('');
  linha('Ao longo do dia 21/12, de hora em hora (altura / azimute do sol):');
  const deHoraEmHora = verao.pontos.filter((p) => p.minutosLocal % 60 === 0);
  for (let i = 0; i < deHoraEmHora.length; i += 4) {
    const grupo = deHoraEmHora.slice(i, i + 4);
    linha(`  ${grupo.map((p) => `${p.horaLocal}  ${n(p.elevacaoGraus, 0).padStart(2)}° / ${n(p.azimuteGraus, 0).padStart(3)}°`).join('     ')}`);
  }

  linha('');
  linha('Ao longo do ano (dia 21 de cada mês):');
  linha(`  ${coluna('Mês', 6)}${coluna('Nasce', 8)}${coluna('Se põe', 9)}${coluna('Horas de sol', 14)}Altura máxima ao meio-dia`);
  for (const t of calcularTrajetoriaAnual({ ...local, ano: ANO })) {
    linha(
      `  ${coluna(NOMES_MESES[t.data.mes - 1] ?? '', 6)}${coluna(t.nascerDoSol ?? '-', 8)}${coluna(t.porDoSol ?? '-', 9)}` +
        `${coluna(n(t.duracaoDiaHoras, 1), 14)}${n(t.elevacaoMaximaGraus, 1)}° ${direcaoDoSol(t.azimuteMeioDiaGraus)}`,
    );
  }
  conferir('no verão o dia é mais longo que no inverno', verao.duracaoDiaHoras > inverno.duracaoDiaHoras);
  conferir('em 21/06 o sol do meio-dia fica ao Norte', direcaoDoSol(inverno.azimuteMeioDiaGraus) === 'ao Norte');
  conferir('em 21/12 o sol passa quase a pino em Taubaté, perto do Trópico de Capricórnio', verao.elevacaoMaximaGraus > 85);
}

// ---------------------------------------------------------------------------
// SCRUM-81
// ---------------------------------------------------------------------------

function scrum81(): void {
  secao('SCRUM-81', 'Sombreamento em 2D sobre o telhado medido');
  linha("Telhado de 20° voltado para o Norte; árvore a Nordeste (a 8 m, 5 m acima do telhado) e caixa d'água a Oeste-Noroeste.");
  const inicio = performance.now();
  const diagrama = gerarDiagramaSombreamento({
    latitude: LOCAL.latitude,
    longitude: LOCAL.longitude,
    ano: ANO,
    titulo: `Demonstração · ${LOCAL.nome}`,
    plano: PLANO,
    obstaculos: OBSTACULOS,
  });
  const ms = performance.now() - inicio;
  const mensal = diagrama.sombreamento.mensal.map((m) => m.sombreamentoPerc);
  imprimirMensal('Perda por sombra (%):', mensal, 1);
  linha(`Média anual: ${pct(diagrama.sombreamento.mediaAnualPerc)}. No app, esse valor substitui os 3% padrão nas perdas do SCRUM-12.`);

  const arquivo = join(tmpdir(), 'lumini-demonstracao-sombreamento.svg');
  let salvo = false;
  try {
    writeFileSync(arquivo, diagrama.svg, 'utf8');
    salvo = true;
  } catch (erro) {
    linha(`Não consegui salvar o diagrama: ${erro instanceof Error ? erro.message : String(erro)}`);
  }
  if (salvo) {
    linha(`Diagrama 2D (feito em ${n(ms, 0)} ms) salvo em:`);
    linha(`   ${arquivo}`);
    linha('   Abra esse arquivo no navegador para ver o caminho do sol, os obstáculos e a sombra de cada mês.');
  }
  linha('Avaliação 2D x 3D: docs/avaliacoes/SCRUM-81_Visualizacao_Sombreamento_2D_x_3D.md (decisão: 2D no MVP).');
  conferir('o diagrama 2D foi gerado', salvo && diagrama.svg.startsWith('<svg'));
  conferir('a árvore a Nordeste faz mais sombra no inverno (sol baixo) que no verão', (mensal[5] ?? 0) > (mensal[11] ?? 0));
}

// ---------------------------------------------------------------------------
// SCRUM-392
// ---------------------------------------------------------------------------

function scrum392(kit: Kit): void {
  secao('SCRUM-392', 'Alerta de espaço insuficiente no telhado');
  const referencia = verificarEspacoTelhado({ areaMedidaM2: 1000, quantidadeModulos: kit.quantidade, areaModuloM2: AREA_MODULO_550 });
  const necessaria = referencia.areaNecessariaM2;
  linha(
    `Kit do SCRUM-12: ${kit.quantidade} módulos de ${n(MODULO_550.comprimentoMm! / 1000, 3)} m x ` +
      `${n(MODULO_550.larguraMm! / 1000, 3)} m (${n(AREA_MODULO_550)} m² cada).`,
  );
  linha(`Área necessária, com 10% de folga para a instalação: ${n(necessaria)} m².`);
  const areas = [Math.ceil(necessaria * 1.8), Math.round((necessaria / 0.95) * 10) / 10, Math.round(necessaria * 0.6 * 10) / 10];
  const niveis: string[] = [];
  for (const areaM2 of areas) {
    const r = verificarEspacoTelhado({ areaMedidaM2: areaM2, quantidadeModulos: kit.quantidade, areaModuloM2: AREA_MODULO_550 });
    niveis.push(r.nivel);
    linha(`Telhado medido de ${n(areaM2)} m²: ${ROTULO_NIVEL[r.nivel]} (ocupação de ${pct(r.ocupacaoPerc, 0)})`);
    linha(`   "${r.mensagem}"`);
  }
  conferir(
    'telhado grande: ok; quase cheio: atenção; pequeno: alerta dizendo quantos módulos cabem',
    niveis.join(',') === 'ok,atencao,insuficiente',
  );
}

// ---------------------------------------------------------------------------
// SCRUM-394
// ---------------------------------------------------------------------------

function scrum394(kit: Kit): void {
  secao('SCRUM-394', 'Alerta de superdimensionamento (Lei 14.300)');
  const limite = PARAMETROS_TECNICOS_PADRAO.limiteSuperdimensionamentoPerc;
  linha(`Consumo: ${CONSUMO_KWH_MES} kWh/mês. Limite da empresa: ${limite}% acima do consumo (atenção a partir de 15%).`);
  const casos = [
    { rotulo: `kit do SCRUM-12, ${kit.quantidade} módulos`, geracao: kit.geracaoMensalKwh },
    { rotulo: 'exemplo', geracao: CONSUMO_KWH_MES * 1.17 },
    { rotulo: 'exemplo', geracao: CONSUMO_KWH_MES * 1.3 },
  ];
  const niveis: string[] = [];
  let baseLegal = '';
  for (const c of casos) {
    const r = verificarSuperdimensionamento({
      consumoMensalKwh: CONSUMO_KWH_MES,
      geracaoEstimadaKwhMes: c.geracao,
      limiteAlertaPerc: limite,
    });
    niveis.push(r.nivel);
    baseLegal = r.baseLegal;
    linha(`Geração de ${n(c.geracao, 0)} kWh/mês (${c.rotulo}): ${pct(r.excedentePerc)} acima do consumo, ${ROTULO_NIVEL[r.nivel]}`);
    linha(`   "${r.mensagem}"`);
  }
  linha(`Base legal citada: ${baseLegal}`);
  conferir('o kit dimensionado pela RN01 não dispara o alerta', niveis[0] !== 'alerta');
  conferir('17% acima do consumo: atenção; 30% acima: alerta', niveis[1] === 'atencao' && niveis[2] === 'alerta');
}

// ---------------------------------------------------------------------------
// SCRUM-395
// ---------------------------------------------------------------------------

function scrum395(kit: Kit): void {
  secao('SCRUM-395', 'Compatibilidade elétrica inversor x módulos (string sizing)');
  linha(
    `Premissas: ${PARAMETROS_TECNICOS_PADRAO.temperaturaMinimaAmbienteC} °C no frio (a tensão sobe) e célula a ` +
      `${PARAMETROS_TECNICOS_PADRAO.temperaturaMaximaCelulaC} °C no calor (a corrente sobe); ligação bifásica.`,
  );
  const casos = [
    { modulo: MODULO_550, quantidade: kit.quantidade, inversor: INVERSOR_GROWATT },
    { modulo: MODULO_700, quantidade: 8, inversor: INVERSOR_GROWATT },
    { modulo: MODULO_700, quantidade: 8, inversor: INVERSOR_DEYE },
  ];
  const resultados = casos.map((c) => {
    const r = verificarCompatibilidadeCatalogo({
      modulo: c.modulo,
      quantidadeModulos: c.quantidade,
      inversor: c.inversor,
      tipoLigacao: 'Bifásica',
    });
    const veredito = r.bloqueia ? 'BLOQUEADO' : r.exigeConfirmacao ? 'COMPATÍVEL, com alertas para o técnico confirmar' : 'COMPATÍVEL';
    linha('');
    linha(`${c.quantidade} x ${nomeDoItem(c.modulo)} + ${nomeDoItem(c.inversor)}: ${veredito}`);
    if (r.descricaoArranjo) linha(`   Arranjo: ${r.descricaoArranjo}`);
    linha(
      `   Por módulo: tensão no frio ${n(r.valoresPorModulo.vocMaxV, 1)} V · corrente de curto no calor ` +
        `${n(r.valoresPorModulo.iscMaxA, 1)} A · relação CC/CA ${n(r.relacaoCcCa, 2)}`,
    );
    for (const p of r.problemas) {
      const rotulo = p.nivel === 'erro' ? 'ERRO' : p.nivel === 'alerta' ? 'ALERTA' : 'INFO';
      linha(`   ${rotulo}: ${p.mensagem}`);
    }
    return r;
  });
  const [a, b, c] = resultados;
  conferir('Canadian 550 W no Growatt MIN 5000TL-X: compatível, com o arranjo das strings', !!a && !a.bloqueia && a.descricaoArranjo !== null);
  conferir(
    'Honor 700 W no Growatt MIN 5000TL-X: bloqueado pela corrente de curto acima do limite do MPPT',
    !!b && b.bloqueia && b.problemas.some((p) => p.codigo === 'CORRENTE_CURTO_ACIMA'),
  );
  conferir('Honor 700 W no Deye SUN-6K: compatível', !!c && !c.bloqueia);
}

// ---------------------------------------------------------------------------
// Resumo
// ---------------------------------------------------------------------------

function resumo(): void {
  console.log('');
  console.log('Resumo');
  console.log('======');
  const itens = [...new Set(conferencias.map((c) => c.item))];
  for (const item of itens) {
    const doItem = conferencias.filter((c) => c.item === item);
    const ok = doItem.filter((c) => c.situacao === 'OK').length;
    const falhou = doItem.filter((c) => c.situacao === 'FALHOU').length;
    const avisos = doItem.filter((c) => c.situacao === 'AVISO').length;
    const extra = avisos > 0 ? ` (${avisos} ${avisos === 1 ? 'aviso' : 'avisos'})` : '';
    const total = ok + falhou;
    console.log(`  ${coluna(item, 11)}${falhou === 0 ? 'OK    ' : 'FALHOU'}  ${ok} de ${total} ${total === 1 ? 'conferência' : 'conferências'}${extra}`);
  }
  const falhas = conferencias.filter((c) => c.situacao === 'FALHOU');
  console.log('');
  if (falhas.length === 0) {
    console.log(`  Tudo certo: as ${itens.length} tasks passaram em todas as conferências.`);
  } else {
    console.log(`  ${falhas.length} ${falhas.length === 1 ? 'conferência falhou' : 'conferências falharam'}:`);
    for (const f of falhas) console.log(`  - ${f.item}: ${f.texto}`);
  }
  process.exitCode = falhas.length > 0 ? 1 : 0;
}

async function principal(): Promise<void> {
  console.log('Lumini · demonstração das tasks de Lógica/Cálculo');
  console.log(`Node ${process.version}${SEM_INTERNET ? ' · sem internet' : ''}`);
  const hsp = await scrum8();
  const kit = await scrum12(hsp);
  scrum76();
  scrum79();
  scrum80();
  scrum81();
  scrum392(kit);
  scrum394(kit);
  scrum395(kit);
  resumo();
}

principal().catch((erro: unknown) => {
  console.error('');
  console.error('A demonstração parou com um erro:');
  console.error(erro);
  process.exitCode = 1;
});
