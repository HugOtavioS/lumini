# Lumini — `packages/domain`

Pacote TypeScript com as regras de cálculo compartilhadas entre o app mobile e o painel web — fonte única de verdade para dimensionamento, alertas, compatibilidade elétrica, HSP, trajetória solar, sombreamento e calibração da RA. **A API não usa este pacote** (ela é apenas de sincronização e persistência — D15/D23).

- TypeScript puro, sem dependências de execução e sem APIs do Node: roda no app (React Native/Hermes) e no navegador.
- Nada aqui acessa banco ou rede por conta própria. A única função que usa rede (`obterHsp`) recebe o provedor/`fetch` injetado e nunca trava.
- Funções de cálculo validam a entrada e lançam `ErroValidacao` com a lista de campos (`erros: { campo, mensagem }[]`), para o formulário destacar o que está errado.
- O pacote exporta o código-fonte (`main: src/index.ts`); o Metro (Expo) e o bundler da web compilam junto com o app.

## Como usar

```bash
npm ci                          # na raiz do monorepo
npm test                        # typecheck + testes de todos os pacotes
npm test -w @lumini/domain      # só este pacote
npm run test:watch -w @lumini/domain
npm run test:detalhado          # lista cada teste, agrupado por item do backlog
npm run demo                    # demonstração: roda cada task com um exemplo
npm run demo:sem-internet       # a mesma demonstração, sem tentar a NASA POWER
```

A demonstração (`scripts/demonstracao.ts`) percorre os itens na ordem do Jira (SCRUM-8, 12, 76, 79, 80, 81, 392, 394, 395), mostra os números de cada um e confere o critério de aceite (`[OK]`, `[FALHOU]` ou `[AVISO]`). Termina com código 1 se alguma conferência falhar e não altera arquivos do repositório: o diagrama do SCRUM-81 vai para a pasta temporária do sistema. Com internet, o HSP do SCRUM-8 vem da NASA POWER; sem ela, a demonstração usa um valor fictício, marcado como tal na tela.

```ts
import { dimensionarSistema, verificarCompatibilidadeCatalogo, obterHsp } from '@lumini/domain';
```

## Conteúdo

| Item do backlog | Módulo | Principais funções |
|---|---|---|
| NOVO-107 | `erros.ts`, `util/`, `parametros.ts` | `ErroValidacao`, `arredondar`, `PARAMETROS_TECNICOS_PADRAO` |
| SCRUM-12 (e SCRUM-74) | `dimensionamento/perdas.ts`, `dimensionamento/dimensionamento.ts` | `calcularPerdasTotais`, `dimensionarSistema`, `calcularGeracaoEstimada`, `calcularQuantidadeModulos` |
| SCRUM-392 | `dimensionamento/alertas.ts` | `verificarEspacoTelhado`, `verificarEspacoPorPotencia`, `areaDoModuloM2` |
| SCRUM-394 | `dimensionamento/alertas.ts` | `verificarSuperdimensionamento` |
| SCRUM-76 | `catalogo/` | tipo `Equipamento`, `criarCatalogoInicial`, `validarEquipamento`, `filtrarCatalogo`, `calcularPrecoVenda` |
| SCRUM-395 | `compatibilidade/stringSizing.ts` | `verificarCompatibilidade`, `verificarCompatibilidadeCatalogo` |
| SCRUM-8 | `hsp/` | `obterHsp`, `criarProvedorNasaPower`, `localidadeMaisProxima`, importador do Atlas (SCRUM-17) |
| SCRUM-80 | `solar/` | `calcularPosicaoSolar`, `calcularTrajetoriaDiaria`, `calcularTrajetoriaAnual`, `calcularEventosSolares` |
| SCRUM-81 | `sombreamento/` | `calcularSombreamento`, `gerarDiagramaSombreamento` (SVG), `obstaculoGeometricoParaAngular` |
| SCRUM-79 | `medicao/` | `medirPoligono` (vértices da RA → área/inclinação/orientação), `avaliarCalibracao`, `consolidarCalibracao` |

### Dimensionamento (SCRUM-12)

```ts
const r = dimensionarSistema({
  consumoMensalKwh: 500,
  hspMedio: 4.9,
  perdas: { temperaturaPerc: 10, sujeiraPerc: 3, cabeamentoPerc: 2, sombreamentoPerc: 3 },
});
r.potenciaNecessariaKwp; // 4.15  →  RN01: 500 / (4,9 × 30 × 0,82)
```

Perdas: soma dos componentes (padrão do Dicionário de Dados) ou `metodoPerdas: 'multiplicativo'`. Geração na mesma convenção de 30 dias da RN01. Todo o fluxo técnico roda em ~4 ms no computador do CI; o teste `fluxo.test.ts` exige menos de 300 ms (10× de margem sobre os 3 s do RNF01).

### Alertas (SCRUM-392 e SCRUM-394)

- **Espaço:** área exigida = módulos × área do módulo × (1 + folga de 10 %), comparada com a área medida. Devolve `ok` / `atencao` (≥ 90 % de ocupação) / `insuficiente`, e quantos módulos cabem.
- **Superdimensionamento:** alerta quando a geração passa do consumo além do limite da empresa (`limite_superdimensionamento_perc`, padrão 20 %; atenção a partir de 15 %). A Lei 14.300 não fixa esse percentual: ela define o excedente como crédito (art. 1º, IX) que expira em 60 meses (art. 13) — é isso que a mensagem explica.

### Catálogo (SCRUM-76)

`catalogo/dados/catalogo-inicial.json` tem 15 itens reais nas 6 categorias (4 módulos, 5 inversores, 2 estruturas, 2 string box, 1 cabo, 1 conector), cada um com a fonte das especificações (datasheet) e do preço (loja, 23/09/2026). `criarCatalogoInicial({ idEmpresa, idUsuario })` monta os registros com preço de venda = custo × (1 + margem) e valida cada item. Os preços são só referência inicial: quem mantém o catálogo é o gestor (RF25).

### Compatibilidade elétrica (SCRUM-395)

Voc no frio (0 °C) × tensão máxima, curto no calor (70 °C) × limite do MPPT, faixa do MPPT, tensão de partida, corrente de operação, fases × tipo de ligação e relação CC/CA. Erros bloqueiam a confirmação; alertas pedem confirmação do técnico. Sem arranjo informado, a função procura um (funciona com vários inversores, microinversores e MPPTs diferentes).

```ts
const r = verificarCompatibilidadeCatalogo({ modulo, quantidadeModulos: 10, inversor, tipoLigacao: 'Bifásica' });
r.bloqueia;           // false
r.descricaoArranjo;   // "MPPT 1: 1 string de 5 módulos | MPPT 2: 1 string de 5 módulos"
r.problemas;          // [{ nivel: 'erro' | 'alerta' | 'info', codigo, mensagem }]
```

### HSP pela localização (SCRUM-8)

```ts
const r = await obterHsp(
  { latitude, longitude, cidade, estado },
  { baseContingencia, provedor: criarProvedorNasaPower(), estaOnline: () => netInfo.isConnected, cache },
);
if (r.status === 'ok') r.dados.hspMedio; // fonte: 'API' | 'Cache' | 'Contingência'
else r.motivo;                            // pedir o HSP ao técnico
```

Ordem: cache do ponto → NASA POWER (tempo-limite de 8 s) → localidade mais próxima da base de contingência (aproximada acima de 50 km) → cidade/UF → média do estado → `indisponivel`. Nunca lança erro.

**Base de contingência (SCRUM-17):** o pacote não traz valores de HSP embutidos. Para gerar a base oficial, baixe o arquivo de irradiação global horizontal do [Atlas Brasileiro de Energia Solar 2017 (INPE/LABREN)](https://labren.ccst.inpe.br/atlas_2017.html) e a lista de municípios do IBGE ([kelvins/municipios-brasileiros](https://github.com/kelvins/municipios-brasileiros)) e rode:

```bash
npm run importar-atlas -w @lumini/domain -- --atlas global_horizontal_means.csv \
  --municipios municipios.csv --estados estados.csv --saida contingencia-hsp.json
```

### Trajetória solar e sombreamento (SCRUM-80 e SCRUM-81)

- Posição do sol pelo algoritmo do NOAA (Meeus), validada contra o SPA do NREL (pvlib) em 384 amostras: erro de posição < 0,02° e nascer/pôr do sol < 2 min.
- Sombreamento por obstáculos (perfil de horizonte) com irradiância de céu claro; diagrama solar polar em SVG para `SvgXml` (app) e para a web. Decisão 2D × 3D em [`docs/avaliacoes`](../../docs/avaliacoes/SCRUM-81_Visualizacao_Sombreamento_2D_x_3D.md). Exemplo: `npm run exemplo-sombreamento -w @lumini/domain`.

### Calibração da RA (SCRUM-79)

Protocolo em [`docs/testes`](../../docs/testes/SCRUM-79_Protocolo_Calibracao_RA.md). Depois do teste:

```bash
npm run calibracao -w @lumini/domain -- --arquivo registro.csv --saida relatorio-calibracao.md
```

## Pendências para os próximos itens

- **SCRUM-17:** gerar e carregar a base de contingência real (importador pronto).
- **NOVO-103:** confirmar a NASA POWER como serviço de clima (ou plugar outro `ProvedorHspOnline`).
- **SCRUM-5/SCRUM-11:** ligar a cena do ViroReact a `medirPoligono` e executar o protocolo de calibração nos aparelhos.
- **REV-4:** medir o RNF01 nos aparelhos de referência, em modo avião.
