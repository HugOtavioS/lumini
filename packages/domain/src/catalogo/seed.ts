/**
 * SCRUM-76 — carga inicial do catálogo (seed) com itens reais das 6
 * categorias. Os dados ficam em `dados/catalogo-inicial.json`, com a fonte
 * das especificações e do preço de cada item.
 *
 * Uso típico: script de carga da empresa (NOVO-105) no banco central e seed
 * do SQLite em desenvolvimento. Em produção o catálogo chega ao app pelo pull.
 */
import { garantirSemErros } from '../erros';
import { calcularPrecoVenda, validarEquipamento } from './catalogo';
import dados from './dados/catalogo-inicial.json';
import type { Equipamento } from './tipos';

/** Item do arquivo de seed: um equipamento sem os campos que dependem da empresa/usuário. */
export type ItemSeedCatalogo = Omit<
  Equipamento,
  'idEmpresa' | 'margemPercentual' | 'precoVenda' | 'status' | 'createdAt' | 'updatedAt' | 'updatedBy'
> & {
  /** Onde as especificações e o preço foram conferidos (não vai para o banco). */
  fontes: { especificacoes: string; preco: string };
};

export interface DadosCatalogoInicial {
  versao: number;
  /** Data (AAAA-MM-DD) em que os preços foram levantados. */
  dataReferenciaPrecos: string;
  observacao: string;
  margemPadraoPerc: number;
  itens: ItemSeedCatalogo[];
}

/**
 * Conteúdo do seed. O JSON não carrega tipos literais, então a conversão é
 * feita aqui e a consistência é garantida em tempo de execução por
 * {@link validarEquipamento} (e pelos testes do pacote).
 */
export const DADOS_CATALOGO_INICIAL = dados as unknown as DadosCatalogoInicial;

export interface OpcoesCatalogoInicial {
  /** Empresa dona do catálogo (multi-tenant). */
  idEmpresa: string;
  /** Usuário registrado em `updated_by` (ex.: o gestor ou o usuário do script de carga). */
  idUsuario: string;
  /** Data/hora ISO da carga. Padrão: agora. */
  agora?: string;
  /** Margem aplicada a todos os itens (%). Padrão: a do arquivo de seed. */
  margemPercentual?: number;
}

/**
 * Monta os registros do catálogo inicial de uma empresa, com preço de venda
 * calculado e status `Ativo`. Valida cada item antes de devolver.
 *
 * @throws {ErroValidacao} se algum item do seed estiver incompleto.
 */
export function criarCatalogoInicial(opcoes: OpcoesCatalogoInicial): Equipamento[] {
  const agora = opcoes.agora ?? new Date().toISOString();
  const margem = opcoes.margemPercentual ?? DADOS_CATALOGO_INICIAL.margemPadraoPerc;
  return DADOS_CATALOGO_INICIAL.itens.map((item) => {
    const { fontes: _fontes, ...campos } = item;
    const equipamento: Equipamento = {
      ...campos,
      idEmpresa: opcoes.idEmpresa,
      margemPercentual: margem,
      precoVenda: calcularPrecoVenda(item.precoCusto, margem),
      status: 'Ativo',
      createdAt: agora,
      updatedAt: agora,
      updatedBy: opcoes.idUsuario,
    };
    garantirSemErros(validarEquipamento(equipamento).map((e) => ({ ...e, mensagem: `${item.modelo}: ${e.mensagem}` })));
    return equipamento;
  });
}
