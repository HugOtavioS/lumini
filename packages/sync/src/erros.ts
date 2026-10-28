/** Erro de validação com a lista de campos problemáticos (mesmo formato do `@lumini/domain`). */
export interface ErroCampo {
  campo: string;
  mensagem: string;
}

export class ErroValidacao extends Error {
  readonly erros: ErroCampo[];

  constructor(erros: ErroCampo[]) {
    super(erros.map((e) => e.mensagem).join(' '));
    this.name = 'ErroValidacao';
    this.erros = erros;
  }
}

export function garantirSemErros(erros: ErroCampo[]): void {
  if (erros.length > 0) throw new ErroValidacao(erros);
}
