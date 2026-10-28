import { describe, expect, it, vi } from 'vitest';
import { distanciaKm, localidadeMaisProxima, referenciaEstadual } from './baseContingencia';
import {
  criarProvedorNasaPower,
  ErroProvedorHsp,
  interpretarRespostaNasaPower,
  montarUrlNasaPower,
} from './nasaPower';
import { chaveCacheHsp, criarCacheHspEmMemoria, obterHsp } from './obterHsp';
import { gerarBaseContingencia, lerAtlasLabren, lerMunicipiosIbge } from './importacaoAtlas';
import type { EventoHsp, FetchLike, LocalidadeClimatica, ProvedorHspOnline } from './tipos';

// ---------------------------------------------------------------------------
// Dados de teste. Os valores de HSP abaixo são FICTÍCIOS (só para os testes);
// a base real vem do SCRUM-17 (ver importacaoAtlas.ts).
// ---------------------------------------------------------------------------

function localidade(cidade: string, estado: string, latitude: number, longitude: number, hsp: number): LocalidadeClimatica {
  return {
    idLocalidade: `${cidade}-${estado}`,
    cidade,
    estado,
    latitude,
    longitude,
    hspMedio: hsp,
    irradiacaoKwhM2Dia: hsp,
    hspMensal: Array.from({ length: 12 }, (_, i) => hsp + (i < 3 || i > 9 ? 0.5 : -0.5)),
    fonte: 'Contingência',
    dataAtualizacao: '2026-09-01T00:00:00.000Z',
  };
}

const BASE: LocalidadeClimatica[] = [
  localidade('Taubaté', 'SP', -23.0104, -45.5593, 4.8),
  localidade('São José dos Campos', 'SP', -23.1896, -45.8841, 4.9),
  localidade('Campinas', 'SP', -22.9053, -47.0659, 5.0),
  localidade('Manaus', 'AM', -3.11866, -60.0212, 4.5),
];

const TAUBATE_GPS = { latitude: -23.0265, longitude: -45.5559 }; // centro de Taubaté, ~2 km da localidade

/** Resposta no formato documentado da NASA POWER (valores fictícios). */
function respostaNasa(ann: number, meses?: number[]): unknown {
  const m = meses ?? [5.6, 5.8, 5.1, 4.6, 3.9, 3.7, 3.9, 4.7, 4.8, 5.2, 5.5, 5.6];
  const nomes = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-45.56, -23.03, 600] },
    properties: { parameter: { ALLSKY_SFC_SW_DWN: { ...Object.fromEntries(nomes.map((n, i) => [n, m[i]])), ANN: ann } } },
    header: {
      title: 'NASA/POWER Source Native Resolution Climatology Climatologies',
      fill_value: -999.0,
      range: '20-year Meteorological and Solar Monthly & Annual Climatologies (January 2001 - December 2020)',
    },
    messages: [],
    parameters: { ALLSKY_SFC_SW_DWN: { units: 'kW-hr/m^2/day', longname: 'All Sky Surface Shortwave Downward Irradiance' } },
  };
}

function provedorFixo(hsp: number): ProvedorHspOnline & { chamadas: number } {
  const p = {
    nome: 'Teste',
    chamadas: 0,
    async buscar() {
      p.chamadas += 1;
      return { hspMedio: hsp, hspMensal: null, descricao: 'Provedor de teste' };
    },
  };
  return p;
}

describe('NASA POWER — montar a consulta e interpretar a resposta', () => {
  it('monta a URL de climatologia com coordenadas arredondadas (privacidade)', () => {
    const url = montarUrlNasaPower(-23.026512, -45.555934);
    expect(url).toBe(
      'https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=-45.56&latitude=-23.03&format=JSON',
    );
  });

  it('lê o HSP anual e mensal', () => {
    const r = interpretarRespostaNasaPower(respostaNasa(4.87));
    expect(r.hspMedio).toBe(4.87);
    expect(r.hspMensal).toHaveLength(12);
    expect(r.hspMensal![0]).toBe(5.6);
    expect(r.descricao).toContain('NASA POWER');
    expect(r.descricao).toContain('2001 - December 2020');
  });

  it('descarta meses com valor de preenchimento (-999) e usa o anual', () => {
    const r = interpretarRespostaNasaPower(respostaNasa(4.87, [5.6, -999, 5.1, 4.6, 3.9, 3.7, 3.9, 4.7, 4.8, 5.2, 5.5, 5.6]));
    expect(r.hspMensal).toBeNull();
    expect(r.hspMedio).toBe(4.87);
  });

  it('sem anual válido, usa a média dos meses', () => {
    const r = interpretarRespostaNasaPower(respostaNasa(-999, Array(12).fill(5)));
    expect(r.hspMedio).toBe(5);
  });

  it('rejeita resposta sem dados, sem o parâmetro ou com unidade errada', () => {
    expect(() => interpretarRespostaNasaPower(respostaNasa(-999, Array(12).fill(-999)))).toThrow(ErroProvedorHsp);
    expect(() => interpretarRespostaNasaPower({ header: 'erro', messages: ['Invalid'] })).toThrow(/Invalid/);
    const unidadeErrada = respostaNasa(18) as { parameters: { ALLSKY_SFC_SW_DWN: { units: string } } };
    unidadeErrada.parameters.ALLSKY_SFC_SW_DWN.units = 'MJ/m^2/day';
    expect(() => interpretarRespostaNasaPower(unidadeErrada)).toThrow(/Unidade/);
    expect(() => interpretarRespostaNasaPower('texto')).toThrow(ErroProvedorHsp);
  });

  it('provedor usa o fetch injetado e trata erro HTTP', async () => {
    const fetchOk: FetchLike = vi.fn(async () => ({ ok: true, status: 200, json: async () => respostaNasa(4.87) }));
    const provedor = criarProvedorNasaPower({ fetch: fetchOk });
    const sinal = new AbortController().signal;
    await expect(provedor.buscar(-23.02, -45.55, sinal)).resolves.toMatchObject({ hspMedio: 4.87 });
    expect(fetchOk).toHaveBeenCalledWith(expect.stringContaining('latitude=-23.02'), expect.objectContaining({ signal: sinal }));

    const fetch422: FetchLike = async () => ({ ok: false, status: 422, json: async () => ({ messages: ['Latitude fora do intervalo'] }) });
    await expect(criarProvedorNasaPower({ fetch: fetch422 }).buscar(0, 0, sinal)).rejects.toThrow(/HTTP 422.*Latitude/);
  });
});

describe('base de contingência', () => {
  it('distância de 1° de longitude no equador ≈ 111,2 km', () => {
    expect(distanciaKm(0, 0, 0, 1)).toBeCloseTo(111.195, 2);
    expect(distanciaKm(-23, -45, -23, -45)).toBe(0);
  });

  it('encontra a localidade mais próxima', () => {
    const r = localidadeMaisProxima(TAUBATE_GPS.latitude, TAUBATE_GPS.longitude, BASE);
    expect(r!.localidade.cidade).toBe('Taubaté');
    expect(r!.distanciaKm).toBeLessThan(3);
    expect(localidadeMaisProxima(0, 0, [])).toBeNull();
  });

  it('média estadual como referência regional', () => {
    const sp = referenciaEstadual('sp', BASE);
    expect(sp!.quantidade).toBe(3);
    expect(sp!.hspMedio).toBeCloseTo(4.9, 10);
    expect(sp!.hspMensal).toHaveLength(12);
    expect(referenciaEstadual('RS', BASE)).toBeNull();
  });
});

describe('obterHsp — SCRUM-8 (HSP pelo GPS, sem procura manual)', () => {
  it('online: busca na API, grava no cache e depois usa o cache sem rede', async () => {
    const provedor = provedorFixo(4.87);
    const cache = criarCacheHspEmMemoria();
    const opcoes = { baseContingencia: BASE, provedor, cache, estaOnline: () => true };

    const primeira = await obterHsp(TAUBATE_GPS, opcoes);
    expect(primeira).toMatchObject({ status: 'ok', dados: { hspMedio: 4.87, fonte: 'API', aproximado: false } });
    expect(cache.tamanho()).toBe(1);

    const segunda = await obterHsp(TAUBATE_GPS, opcoes);
    expect(segunda).toMatchObject({ status: 'ok', dados: { hspMedio: 4.87, fonte: 'Cache' } });
    expect(provedor.chamadas).toBe(1);
  });

  it('sem internet: nem chama a API e usa a base de contingência (RN02)', async () => {
    const provedor = provedorFixo(4.87);
    const log: EventoHsp[] = [];
    const r = await obterHsp(TAUBATE_GPS, {
      baseContingencia: BASE,
      provedor,
      estaOnline: () => false,
      registrarLog: (e) => log.push(e),
    });
    expect(provedor.chamadas).toBe(0);
    expect(r).toMatchObject({
      status: 'ok',
      dados: { hspMedio: 4.8, fonte: 'Contingência', aproximado: false, localidade: { cidade: 'Taubaté', estado: 'SP' } },
    });
    if (r.status === 'ok') {
      expect(r.dados.hspMensal).toHaveLength(12);
      expect(r.avisos.join(' ')).toContain('Sem internet');
    }
    expect(log.map((e) => e.tipo)).toEqual(['offline', 'contingencia']);
  });

  it('não trava: se a API não responde, cai na contingência no tempo-limite', async () => {
    const travado: ProvedorHspOnline = { nome: 'Travado', buscar: () => new Promise(() => {}) };
    const log: EventoHsp[] = [];
    const inicio = Date.now();
    const r = await obterHsp(TAUBATE_GPS, {
      baseContingencia: BASE,
      provedor: travado,
      timeoutMs: 50,
      registrarLog: (e) => log.push(e),
    });
    expect(Date.now() - inicio).toBeLessThan(1000);
    expect(r).toMatchObject({ status: 'ok', dados: { fonte: 'Contingência' } });
    expect(log.map((e) => e.tipo)).toContain('api_timeout');
  });

  it('o sinal de abortar chega ao provedor quando o tempo esgota', async () => {
    let abortado = false;
    const provedor: ProvedorHspOnline = {
      nome: 'Abortável',
      buscar: (_lat, _lon, sinal) =>
        new Promise((_, rejeitar) => {
          sinal.addEventListener('abort', () => {
            abortado = true;
            rejeitar(new Error('abortado'));
          });
        }),
    };
    await obterHsp(TAUBATE_GPS, { baseContingencia: BASE, provedor, timeoutMs: 20 });
    expect(abortado).toBe(true);
  });

  it('erro na API também cai na contingência e fica no log (RNF12)', async () => {
    const quebrado: ProvedorHspOnline = {
      nome: 'Quebrado',
      buscar: async () => {
        throw new Error('HTTP 500');
      },
    };
    const log: EventoHsp[] = [];
    const r = await obterHsp(TAUBATE_GPS, { baseContingencia: BASE, provedor: quebrado, registrarLog: (e) => log.push(e) });
    expect(r.status).toBe('ok');
    expect(log[0]).toMatchObject({ tipo: 'api_falhou' });
    expect(log[0]!.mensagem).toContain('HTTP 500');
  });

  it('localidade de contingência a mais de 50 km: valor marcado como aproximado', async () => {
    const r = await obterHsp({ latitude: -21.1775, longitude: -47.8103 }, { baseContingencia: BASE }); // Ribeirão Preto
    expect(r).toMatchObject({ status: 'ok', dados: { aproximado: true, localidade: { cidade: 'Campinas' } } });
    if (r.status === 'ok') expect(r.avisos.join(' ')).toContain('aproximado');
  });

  it('sem GPS: usa a cidade da instalação (sem diferenciar acentos)', async () => {
    const r = await obterHsp({ cidade: 'sao jose dos campos', estado: 'sp' }, { baseContingencia: BASE });
    expect(r).toMatchObject({ status: 'ok', dados: { hspMedio: 4.9, aproximado: false, localidade: { distanciaKm: null } } });
  });

  it('cidade fora da base: média do estado, marcada como aproximada (RF08 2b)', async () => {
    const r = await obterHsp({ cidade: 'Pindamonhangaba', estado: 'SP' }, { baseContingencia: BASE });
    expect(r).toMatchObject({ status: 'ok', dados: { hspMedio: 4.9, aproximado: true } });
  });

  it('coordenadas inválidas: avisa e usa a cidade', async () => {
    const r = await obterHsp({ latitude: 999, longitude: -45, cidade: 'Taubaté', estado: 'SP' }, { baseContingencia: BASE });
    expect(r).toMatchObject({ status: 'ok', dados: { hspMedio: 4.8 } });
    if (r.status === 'ok') expect(r.avisos[0]).toContain('inválidas');
  });

  it('sem internet e sem base: indisponível, para o técnico informar (nunca lança erro)', async () => {
    const r = await obterHsp(TAUBATE_GPS, { baseContingencia: [], provedor: provedorFixo(5), estaOnline: () => false });
    expect(r.status).toBe('indisponivel');
    if (r.status === 'indisponivel') expect(r.motivo).toContain('manualmente');
  });

  it('falhas no log, no cache e na verificação de conexão não derrubam o fluxo', async () => {
    const cacheQuebrado = {
      obter: () => {
        throw new Error('SQLite fechado');
      },
      salvar: () => {
        throw new Error('disco cheio');
      },
    };
    const r = await obterHsp(TAUBATE_GPS, {
      baseContingencia: BASE,
      provedor: provedorFixo(4.87),
      cache: cacheQuebrado,
      estaOnline: () => {
        throw new Error('NetInfo indisponível');
      },
      registrarLog: () => {
        throw new Error('log quebrado');
      },
    });
    // estaOnline falhou → tratado como offline → contingência
    expect(r).toMatchObject({ status: 'ok', dados: { fonte: 'Contingência' } });
  });

  it('chave de cache agrupa pontos próximos (~11 km)', () => {
    expect(chaveCacheHsp(-23.0104, -45.5593)).toBe(chaveCacheHsp(-23.0265, -45.5559));
    expect(chaveCacheHsp(-23.0104, -45.5593)).not.toBe(chaveCacheHsp(-23.19, -45.88));
  });
});

describe('importação do Atlas LABREN (ponte para o SCRUM-17)', () => {
  // Trecho FICTÍCIO no formato do arquivo do Atlas (valores em Wh/m²/dia).
  const atlasCsv = [
    'ID;LON;LAT;ANNUAL;JAN;FEB;MAR;APR;MAY;JUN;JUL;AUG;SEP;OCT;NOV;DEC',
    '1;-45.55;-23.05;4800;5400;5600;5000;4600;4000;3800;4000;4700;4800;5100;5300;5300',
    '2;-45.85;-23.15;4900;5500;5700;5100;4700;4100;3900;4100;4800;4900;5200;5400;5400',
    '3;-60.05;-3.15;4500;4200;4300;4300;4200;4400;4700;4900;5200;5100;4900;4600;4300',
  ].join('\n');
  const municipiosCsv = [
    'codigo_ibge,nome,latitude,longitude,capital,codigo_uf,siafi_id,ddd,fuso_horario',
    '3554102,Taubaté,-23.0104,-45.5593,0,35,7183,12,America/Sao_Paulo',
    '3549904,São José dos Campos,-23.1896,-45.8841,0,35,7099,12,America/Sao_Paulo',
    '1302603,Manaus,-3.11866,-60.0212,1,13,0255,92,America/Porto_Velho',
  ].join('\n');
  const estadosCsv = ['codigo_uf,uf,nome,latitude,longitude,regiao', '13,AM,Amazonas,-3.47,-65.1,Norte', '35,SP,São Paulo,-22.19,-48.79,Sudeste'].join('\n');

  it('lê a grade e converte Wh/m²/dia para kWh/m²/dia', () => {
    const celulas = lerAtlasLabren(atlasCsv);
    expect(celulas).toHaveLength(3);
    expect(celulas[0]).toMatchObject({ latitude: -23.05, longitude: -45.55, anual: 4.8 });
    expect(celulas[0]!.mensal[5]).toBeCloseTo(3.8, 10);
  });

  it('gera uma localidade por município, com a célula mais próxima', () => {
    const base = gerarBaseContingencia(lerMunicipiosIbge(municipiosCsv, estadosCsv), lerAtlasLabren(atlasCsv), {
      dataAtualizacao: '2026-09-23T00:00:00.000Z',
      gerarId: (codigo) => `id-${codigo}`,
    });
    expect(base.map((l) => [l.cidade, l.estado, l.hspMedio])).toEqual([
      ['Taubaté', 'SP', 4.8],
      ['São José dos Campos', 'SP', 4.9],
      ['Manaus', 'AM', 4.5],
    ]);
    expect(base[0]).toMatchObject({ idLocalidade: 'id-3554102', fonte: 'Contingência', irradiacaoKwhM2Dia: 4.8 });
    expect(base[0]!.hspMensal).toHaveLength(12);
  });

  it('aceita cabeçalho em português, vírgula decimal e valores já em kWh', () => {
    const csv = ['id;longitude;latitude;anual;jan;fev;mar;abr;mai;jun;jul;ago;set;out;nov;dez', '1;-45,55;-23,05;4,8;5,4;5,6;5;4,6;4;3,8;4;4,7;4,8;5,1;5,3;5,3'].join('\n');
    expect(lerAtlasLabren(csv)[0]).toMatchObject({ longitude: -45.55, anual: 4.8 });
  });

  it('recusa arquivo sem as colunas esperadas', () => {
    expect(() => lerAtlasLabren('a;b;c\n1;2;3')).toThrow(/colunas/);
  });
});
