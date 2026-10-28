/**
 * Contrato da sincronização entre o app (e a web) e a API.
 *
 * Versão inicial, escrita para a fila (SCRUM-82), a regra de conflito
 * (SCRUM-83) e os testes de integração (SCRUM-86). O SCRUM-67 deve
 * formalizar estes tipos em `packages/contracts`, como prevê a DAS v1.2.
 *
 * Os campos dos registros (`dados`) usam os nomes do Dicionário de Dados
 * (snake_case). Os campos de controle (`updated_at`, `updated_by`) viajam
 * fora de `dados`, em `updatedAt` e `updatedBy`, e o `sync_status` nunca
 * viaja: ele existe só no banco local.
 */

/** Entidades que o app envia no push, na ordem de dependência da DAS 4.1. */
export const ENTIDADES_SINCRONIZAVEIS = [
  'Cliente',
  'Instalacao',
  'Medicao',
  'SimulacaoSombreamento',
  'Proposta',
  'SolicitacaoUpgrade',
] as const;

export type EntidadeSincronizavel = (typeof ENTIDADES_SINCRONIZAVEIS)[number];

/**
 * Ordem de envio (DAS 4.1: cliente → instalação → medição → proposta → itens).
 * Os itens viajam dentro da proposta, em `dados.itens`, então a proposta e os
 * itens chegam juntos e a regra de conflito vale para o conjunto.
 */
export const ORDEM_DEPENDENCIA: Readonly<Record<EntidadeSincronizavel, number>> = Object.freeze({
  Cliente: 1,
  Instalacao: 2,
  Medicao: 3,
  SimulacaoSombreamento: 4,
  Proposta: 5,
  SolicitacaoUpgrade: 6,
});

/** Chave estrangeira obrigatória de cada entidade: o registro pai precisa chegar antes. */
export const DEPENDENCIAS: Readonly<Record<EntidadeSincronizavel, { entidade: EntidadeSincronizavel; campo: string } | null>> =
  Object.freeze({
    Cliente: null,
    Instalacao: { entidade: 'Cliente', campo: 'id_cliente' },
    Medicao: { entidade: 'Instalacao', campo: 'id_instalacao' },
    SimulacaoSombreamento: { entidade: 'Medicao', campo: 'id_medicao' },
    Proposta: { entidade: 'Instalacao', campo: 'id_instalacao' },
    SolicitacaoUpgrade: null,
  });

/** Valores de `status_proposta` (Dicionário 7.1). */
export const STATUS_PROPOSTA = ['Em elaboração', 'Gerada', 'Em negociação', 'Reaberta', 'Aprovada', 'Recusada'] as const;
export type StatusProposta = (typeof STATUS_PROPOSTA)[number];

/**
 * RN07: só entram na fila propostas "Gerada" ou posteriores. "Em elaboração"
 * e "Reaberta" são os status em que o técnico está editando (DAS 4.3); as
 * edições ficam no aparelho até a proposta voltar a "Gerada".
 */
export const STATUS_QUE_SINCRONIZAM: readonly StatusProposta[] = ['Gerada', 'Em negociação', 'Aprovada', 'Recusada'];

/** Uma versão de um registro, como o cliente envia e o servidor guarda. */
export interface VersaoRegistro {
  /** UUID gerado no dispositivo (idempotência, DAS 4.2). */
  id: string;
  idEmpresa: string;
  /** Momento da alteração (ISO 8601), carimbado por quem editou. */
  updatedAt: string;
  /** Usuário que fez a alteração. */
  updatedBy: string;
  /** Campos do registro com os nomes do Dicionário. Na Proposta, inclui `itens` (Item da Proposta). */
  dados: Record<string, unknown>;
}

export interface OperacaoSync {
  /** Uma operação por registro: `${entidade}:${id}`. */
  idOperacao: string;
  entidade: EntidadeSincronizavel;
  /**
   * `updated_at` da versão do servidor que o aparelho conhecia quando a edição
   * começou. `null` quando o registro foi criado no aparelho. É o que permite
   * separar uma edição normal de uma edição concorrente (SCRUM-83).
   */
  baseUpdatedAt: string | null;
  versao: VersaoRegistro;
}

export interface RequisicaoPush {
  /** Identificador da instalação do app (Log de Sincronização). */
  idDispositivo: string;
  operacoes: OperacaoSync[];
}

/** `RN11`: o papel do usuário não pode editar a proposta no status em que ela está (SCRUM-406). */
export type CodigoRejeicao = 'DADOS_INVALIDOS' | 'RN07' | 'RN11' | 'DEPENDENCIA_AUSENTE' | 'OUTRA_EMPRESA' | 'SEM_PERMISSAO';

export type ResultadoOperacao =
  | {
      idOperacao: string;
      /** O servidor ficou com a versão enviada. */
      situacao: 'aplicada';
      /** Versão guardada (o `updatedAt` pode ter sido corrigido pelo servidor). */
      versaoAceita: VersaoRegistro;
      /** `true` quando a versão enviada sobrescreveu uma alteração concorrente. */
      conflito: boolean;
      avisos: string[];
    }
  | {
      idOperacao: string;
      /** Conflito: o servidor já tinha uma versão mais recente e ficou com ela. */
      situacao: 'descartada';
      versaoServidor: VersaoRegistro;
      mensagem: string;
    }
  | {
      idOperacao: string;
      situacao: 'rejeitada';
      codigo: CodigoRejeicao;
      mensagem: string;
      /** `true` quando vale tentar de novo depois (ex.: o registro pai ainda não chegou). */
      retentavel: boolean;
    };

export interface RespostaPush {
  horaServidor: string;
  resultados: ResultadoOperacao[];
}

export interface RequisicaoPull {
  /** Cursor devolvido no último pull; `null` no primeiro. */
  cursor: string | null;
}

/** Aviso para quem teve a alteração sobrescrita por uma versão mais recente (DAS 4.3). */
export interface AvisoSobrescrita {
  idAviso: string;
  /** Usuário que deve ser avisado. */
  idUsuario: string;
  entidade: EntidadeSincronizavel;
  idRegistro: string;
  /** Usuário cuja versão prevaleceu. */
  sobrescritoPor: string;
  /** Quando a regra foi aplicada (hora do servidor). */
  em: string;
  mensagem: string;
}

export interface RespostaPull {
  horaServidor: string;
  cursor: string;
  registros: { entidade: EntidadeSincronizavel; versao: VersaoRegistro }[];
  avisos: AvisoSobrescrita[];
}

/** Entidades aceitas no Log de Auditoria (Dicionário 8.1, ampliado na v1.4). */
export type EntidadeAuditada =
  | 'Equipamento'
  | 'ItemProposta'
  | 'Proposta'
  | 'Assinatura'
  | 'Usuario'
  | 'Cliente'
  | 'Instalacao'
  | 'Medicao'
  | 'SimulacaoSombreamento'
  | 'SolicitacaoUpgrade';

/** Uma linha do Log de Auditoria (Dicionário 8.1). */
export interface RegistroAuditoria {
  idLog: string;
  idEmpresa: string;
  entidade: EntidadeAuditada;
  idRegistro: string;
  campo: string;
  valorAnterior: string | null;
  valorNovo: string | null;
  /** Quem fez a alteração que prevaleceu. */
  idUsuario: string;
  origem: 'Mobile' | 'Web' | 'API';
  dataHora: string;
  /** Por que a linha existe (ex.: conflito de sincronização). Coluna nova na v1.4. */
  motivo: string | null;
}

/** Uma linha do Log de Sincronização (Dicionário 8.2; RNF11). */
export interface RegistroLogSincronizacao {
  idLogSync: string;
  idUsuario: string;
  idDispositivo: string;
  dataHora: string;
  tipo: 'Pull' | 'Push';
  status: 'Sucesso' | 'Falha';
  qtdRegistros: number;
  mensagemErro: string | null;
}

export function idOperacaoDe(entidade: EntidadeSincronizavel, idRegistro: string): string {
  return `${entidade}:${idRegistro}`;
}

export function ehEntidadeSincronizavel(valor: unknown): valor is EntidadeSincronizavel {
  return typeof valor === 'string' && (ENTIDADES_SINCRONIZAVEIS as readonly string[]).includes(valor);
}
