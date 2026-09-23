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
