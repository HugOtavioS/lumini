/**
 * @lumini/domain — regras de cálculo compartilhadas entre o app mobile e o
 * painel web. Nenhuma função deste pacote acessa banco ou rede por conta
 * própria: o que depende de rede (busca de HSP) recebe o `fetch` injetado.
 */
export * from './erros';
export * from './parametros';
export {
  arredondar,
  CASAS_DECIMAIS,
  formatarNumeroBr,
  normalizar180,
  normalizar360,
} from './util/numeros';

// SCRUM-12 — dimensionamento (kWp, perdas e geração estimada)
export * from './dimensionamento/perdas';
export * from './dimensionamento/dimensionamento';

// SCRUM-392 e SCRUM-394 — alertas de espaço insuficiente e superdimensionamento
export * from './dimensionamento/alertas';

// SCRUM-80 — posição e trajetória solar (NOAA/Meeus)
export * from './solar/posicaoSolar';
export * from './solar/trajetoria';

// SCRUM-81 — sombreamento por obstáculos e diagrama solar 2D (SVG)
export * from './sombreamento/sombreamento';
export * from './sombreamento/diagramaSvg';

// SCRUM-76 — catálogo de equipamentos (modelo, regras, filtros e carga inicial)
export * from './catalogo/tipos';
export * from './catalogo/catalogo';
export * from './catalogo/seed';

// SCRUM-395 — compatibilidade elétrica inversor × módulos (string sizing)
export * from './compatibilidade/stringSizing';
