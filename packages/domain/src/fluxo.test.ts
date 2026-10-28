/**
 * Teste de ponta a ponta do fluxo técnico (RF08 → RF06 → RF07 → RF09),
 * sem rede, e verificação do RNF01 (cálculo em até 3 s no dispositivo).
 *
 * O limite usado aqui é 300 ms — 10× mais apertado que o RNF01 — para
 * sobrar margem para aparelhos de entrada, que rodam JavaScript várias vezes
 * mais devagar que o computador do CI. A verificação oficial do RNF01 é no
 * aparelho, em modo avião (Especificação de Fluxos, RNF01; tarefa REV-4).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  areaDoModuloM2,
  calcularGeracaoEstimada,
  calcularQuantidadeModulos,
  criarCatalogoInicial,
  dimensionarSistema,
  gerarDiagramaSombreamento,
  obstaculoGeometricoParaAngular,
  obterHsp,
  PARAMETROS_TECNICOS_PADRAO,
  verificarCompatibilidadeCatalogo,
  verificarEspacoTelhado,
  verificarSuperdimensionamento,
  type LocalidadeClimatica,
} from './index';

const BASE_CONTINGENCIA: LocalidadeClimatica[] = [
  {
    idLocalidade: 'taubate',
    cidade: 'Taubaté',
    estado: 'SP',
    latitude: -23.0104,
    longitude: -45.5593,
    hspMedio: 4.8, // valor fictício de teste
    irradiacaoKwhM2Dia: 4.8,
    hspMensal: [5.5, 5.7, 5.0, 4.6, 3.9, 3.7, 3.9, 4.7, 4.8, 5.1, 5.3, 5.4],
    fonte: 'Contingência',
    dataAtualizacao: '2026-09-01T00:00:00.000Z',
  },
];

const catalogo = criarCatalogoInicial({ idEmpresa: 'empresa', idUsuario: 'usuario', agora: '2026-09-23T12:00:00Z' });

async function fluxoCompleto() {
  // RF08 — HSP pelo GPS, offline (base de contingência)
  const hsp = await obterHsp(
    { latitude: -23.0265, longitude: -45.5559 },
    { baseContingencia: BASE_CONTINGENCIA, estaOnline: () => false },
  );
  if (hsp.status !== 'ok') throw new Error('HSP indisponível');

  // RF06 — sombreamento (árvore a NE) + diagrama 2D
  const plano = { inclinacaoGraus: 20, azimuteGraus: 0 };
  const sombreamento = gerarDiagramaSombreamento({
    latitude: -23.0265,
    longitude: -45.5559,
    ano: 2026,
    plano,
    obstaculos: [obstaculoGeometricoParaAngular({ nome: 'Árvore', azimuteGraus: 35, distanciaM: 8, alturaM: 5, larguraM: 6 })],
  });

  // RF07 — dimensionamento
  const perdas = {
    temperaturaPerc: PARAMETROS_TECNICOS_PADRAO.perdaTemperaturaPerc,
    sujeiraPerc: PARAMETROS_TECNICOS_PADRAO.perdaSujeiraPerc,
    cabeamentoPerc: PARAMETROS_TECNICOS_PADRAO.perdaCabeamentoPerc,
    sombreamentoPerc: sombreamento.sombreamento.mediaAnualPerc,
  };
  const dimensionamento = dimensionarSistema({
    consumoMensalKwh: 600,
    hspMedio: hsp.dados.hspMedio,
    hspMensal: hsp.dados.hspMensal ?? undefined,
    perdas,
  });

  // RF09 — técnico escolhe módulo e inversor; app valida espaço, geração e compatibilidade
  const modulo = catalogo.find((e) => e.modelo.includes('CS6W-550MS'))!;
  const inversor = catalogo.find((e) => e.modelo.includes('MIN 5000TL-X'))!;
  const { quantidade, potenciaInstaladaKwp } = calcularQuantidadeModulos(dimensionamento.potenciaNecessariaKwp, modulo.potenciaW!);
  const espaco = verificarEspacoTelhado({
    areaMedidaM2: 40,
    quantidadeModulos: quantidade,
    areaModuloM2: areaDoModuloM2(modulo.comprimentoMm!, modulo.larguraMm!),
  });
  const geracao = calcularGeracaoEstimada({ potenciaKwp: potenciaInstaladaKwp, hspMedio: hsp.dados.hspMedio, perdas });
  const superdimensionamento = verificarSuperdimensionamento({
    consumoMensalKwh: 600,
    geracaoEstimadaKwhMes: geracao.mediaMensalKwh,
    limiteAlertaPerc: PARAMETROS_TECNICOS_PADRAO.limiteSuperdimensionamentoPerc,
  });
  const compatibilidade = verificarCompatibilidadeCatalogo({
    modulo,
    quantidadeModulos: quantidade,
    inversor,
    tipoLigacao: 'Bifásica',
  });

  return { hsp, sombreamento, dimensionamento, quantidade, espaco, geracao, superdimensionamento, compatibilidade };
}

describe('fluxo técnico completo (RF08 → RF06 → RF07 → RF09)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('funciona offline, sem nenhuma chamada de rede', async () => {
    const fetchEspiao = vi.fn(() => Promise.reject(new Error('sem rede')));
    vi.stubGlobal('fetch', fetchEspiao);

    const r = await fluxoCompleto();

    expect(fetchEspiao).not.toHaveBeenCalled();
    expect(r.hsp.status).toBe('ok');
    expect(r.dimensionamento.potenciaNecessariaKwp).toBeGreaterThan(4);
    expect(r.quantidade).toBeGreaterThan(0);
    expect(r.espaco.cabe).toBe(true);
    expect(r.superdimensionamento.nivel).not.toBe('alerta');
    expect(r.compatibilidade.compativel).toBe(true);
    expect(r.sombreamento.svg.startsWith('<svg')).toBe(true);
  });

  it('RNF01: o fluxo inteiro roda em menos de 300 ms (10× de margem sobre os 3 s)', async () => {
    await fluxoCompleto(); // aquecimento (JIT)
    const execucoes: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const inicio = performance.now();
      await fluxoCompleto();
      execucoes.push(performance.now() - inicio);
    }
    const pior = Math.max(...execucoes);
    expect(pior).toBeLessThan(300);
  });
});
