/**
 * SCRUM-12 (subtarefa 2) / SCRUM-74 — cálculo das perdas do sistema.
 *
 * RN01 considera quatro componentes de perda: temperatura, sujeira,
 * cabeamento e sombreamento. O Dicionário de Dados define
 * `perdas_totais_perc` como a **soma** dos componentes, e esse é o método
 * padrão. O método multiplicativo (1 − Π(1 − pᵢ)) fica disponível como opção,
 * porque é fisicamente mais preciso quando as perdas são grandes.
 */
import { garantirSemErros, ehNumeroFinito, type ErroCampo } from '../erros';
import { arredondar, CASAS_DECIMAIS } from '../util/numeros';

/** Componentes de perda, em percentual (0 a 100). */
export interface ComponentesPerdas {
  temperaturaPerc: number;
  sujeiraPerc: number;
  cabeamentoPerc: number;
  sombreamentoPerc: number;
}

/** Como os componentes são combinados no total. */
export type MetodoCombinacaoPerdas = 'aditivo' | 'multiplicativo';

export interface ResultadoPerdas {
  /** Perda total em % (arredondada a 2 casas). */
  totalPerc: number;
  /**
   * Fração de energia que sobra depois das perdas, `1 − total/100`
   * (também chamada de taxa de desempenho). Sem arredondamento.
   */
  fatorDesempenho: number;
  metodo: MetodoCombinacaoPerdas;
  componentes: ComponentesPerdas;
}

const ROTULOS: Record<keyof ComponentesPerdas, string> = {
  temperaturaPerc: 'perda por temperatura',
  sujeiraPerc: 'perda por sujeira',
  cabeamentoPerc: 'perda no cabeamento',
  sombreamentoPerc: 'sombreamento',
};

/** Valida os componentes de perda; retorna a lista de erros (vazia se tudo certo). */
export function validarPerdas(
  perdas: ComponentesPerdas,
  metodo: MetodoCombinacaoPerdas = 'aditivo',
): ErroCampo[] {
  const erros: ErroCampo[] = [];
  for (const campo of Object.keys(ROTULOS) as (keyof ComponentesPerdas)[]) {
    const valor = perdas[campo];
    if (!ehNumeroFinito(valor)) {
      erros.push({ campo, mensagem: `Informe a ${ROTULOS[campo]} (%).` });
    } else if (valor < 0 || valor >= 100) {
      erros.push({ campo, mensagem: `A ${ROTULOS[campo]} deve estar entre 0 % e 100 %.` });
    }
  }
  if (erros.length === 0 && metodo === 'aditivo') {
    const soma = perdas.temperaturaPerc + perdas.sujeiraPerc + perdas.cabeamentoPerc + perdas.sombreamentoPerc;
    if (soma >= 100) {
      erros.push({ campo: 'perdas', mensagem: 'A soma das perdas precisa ser menor que 100 %.' });
    }
  }
  return erros;
}

/**
 * Combina os componentes de perda em um total.
 *
 * @example
 * calcularPerdasTotais({ temperaturaPerc: 10, sujeiraPerc: 3, cabeamentoPerc: 2, sombreamentoPerc: 3 })
 * // → { totalPerc: 18, fatorDesempenho: 0.82, ... }
 */
export function calcularPerdasTotais(
  perdas: ComponentesPerdas,
  metodo: MetodoCombinacaoPerdas = 'aditivo',
): ResultadoPerdas {
  garantirSemErros(validarPerdas(perdas, metodo));

  const fracoes = [
    perdas.temperaturaPerc,
    perdas.sujeiraPerc,
    perdas.cabeamentoPerc,
    perdas.sombreamentoPerc,
  ].map((p) => p / 100);

  const totalFracao =
    metodo === 'aditivo'
      ? fracoes.reduce((acc, p) => acc + p, 0)
      : 1 - fracoes.reduce((acc, p) => acc * (1 - p), 1);

  return {
    totalPerc: arredondar(totalFracao * 100, CASAS_DECIMAIS.percentual),
    fatorDesempenho: 1 - totalFracao,
    metodo,
    componentes: { ...perdas },
  };
}
