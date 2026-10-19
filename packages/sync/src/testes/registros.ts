/** Apoio aos testes: registros de exemplo com os campos do Dicionário de Dados. */
import type { EntidadeSincronizavel, OperacaoSync, RequisicaoPush, RespostaPush, VersaoRegistro } from '../contrato';

export const EMPRESA = '7b0c3f8e-1d2a-4c5b-9e6f-000000000001';
export const TECNICO_ANA = 'a0a0a0a0-0000-4000-8000-00000000000a';
export const TECNICO_BRUNO = 'b0b0b0b0-0000-4000-8000-00000000000b';
export const GESTORA_CARLA = 'c0c0c0c0-0000-4000-8000-00000000000c';

export function versao(id: string, updatedAt: string, dados: Record<string, unknown>, updatedBy = TECNICO_ANA): VersaoRegistro {
  return { id, idEmpresa: EMPRESA, updatedAt, updatedBy, dados };
}

export function cliente(id: string, updatedAt: string, nome = 'Maria Souza'): VersaoRegistro {
  return versao(id, updatedAt, { id_cliente: id, nome, telefone: '(12) 99999-0000' });
}

export function instalacao(id: string, idCliente: string, updatedAt: string): VersaoRegistro {
  return versao(id, updatedAt, { id_instalacao: id, id_cliente: idCliente, cidade: 'Taubaté', estado: 'SP', consumo_medio_kwh: 500 });
}

export function proposta(
  id: string,
  idInstalacao: string,
  updatedAt: string,
  extra: Record<string, unknown> = {},
  updatedBy = TECNICO_ANA,
): VersaoRegistro {
  return versao(
    id,
    updatedAt,
    {
      id_proposta: id,
      id_instalacao: idInstalacao,
      status_proposta: 'Gerada',
      numero_versao: 1,
      potencia_kwp: 4.4,
      valor_total: 21500,
      itens: [
        { id_item: `${id}-i1`, id_equipamento: 'modulo-550', quantidade: 8, preco_unitario: 629.94 },
        { id_item: `${id}-i2`, id_equipamento: 'inversor-5k', quantidade: 1, preco_unitario: 4513.75 },
      ],
      ...extra,
    },
    updatedBy,
  );
}

export function operacao(entidade: EntidadeSincronizavel, v: VersaoRegistro, baseUpdatedAt: string | null = null): OperacaoSync {
  return { idOperacao: `${entidade}:${v.id}`, entidade, baseUpdatedAt, versao: v };
}

/** Resposta de um servidor que aceita tudo. */
export function aceitarTudo(req: RequisicaoPush, horaServidor = '2026-10-18T12:00:00.000Z'): RespostaPush {
  return {
    horaServidor,
    resultados: req.operacoes.map((op) => ({
      idOperacao: op.idOperacao,
      situacao: 'aplicada' as const,
      versaoAceita: op.versao,
      conflito: false,
      avisos: [],
    })),
  };
}

export function clonar<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}

/** Espera a promessa falhar e devolve o erro (falha o teste se ela não falhar). */
export async function capturarErro<E = Error>(promessa: Promise<unknown>): Promise<E> {
  try {
    await promessa;
  } catch (erro) {
    return erro as E;
  }
  throw new Error('Era esperado um erro, mas a operação deu certo.');
}
