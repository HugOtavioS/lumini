/**
 * Erros de validação do pacote de domínio.
 *
 * As funções de cálculo validam as entradas antes de calcular. Quando algo
 * está inválido elas lançam {@link ErroValidacao}, que carrega a lista de
 * campos com problema — o app e a web podem usar essa lista para destacar
 * os campos no formulário (ex.: RF03 4a, RF05 5a).
 */

/** Problema encontrado em um campo de entrada. */
export interface ErroCampo {
  /** Nome do campo, igual ao nome da propriedade na entrada (ex.: `consumoMensalKwh`). */
  campo: string;
  /** Mensagem em português, pronta para exibir ao técnico. */
  mensagem: string;
}

/** Lançado quando os dados de entrada de um cálculo são inválidos. */
export class ErroValidacao extends Error {
  readonly erros: readonly ErroCampo[];

  constructor(erros: readonly ErroCampo[]) {
    super(erros.map((e) => e.mensagem).join(' '));
    this.name = 'ErroValidacao';
    this.erros = erros;
  }
}

/** Lança {@link ErroValidacao} se a lista tiver algum erro. */
export function garantirSemErros(erros: readonly ErroCampo[]): void {
  if (erros.length > 0) {
    throw new ErroValidacao(erros);
  }
}

/** `true` quando o valor é um número finito (rejeita `NaN`, `Infinity` e não-números). */
export function ehNumeroFinito(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor);
}
