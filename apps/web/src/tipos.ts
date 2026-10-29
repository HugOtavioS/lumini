import type { StatusProposta, AcaoGestor } from '@lumini/sync';

export type { StatusProposta, AcaoGestor };

export interface PropostaLista {
  id: string;
  numero: string;
  versao: number;
  status: StatusProposta;
  potenciaKwp: number;
  valorTotal: number;
  economiaMensal: number;
  paybackMeses: number | null;
  dataGeracao: string | null;
  atualizadaEm: string;
  idTecnico: string;
  tecnico: string | null;
  cliente: string | null;
  cidade: string | null;
}

export interface Plano {
  tipo: string;
  status: string;
  limiteMes: number | null;
  usadasMes: number;
  inicioEm: string | null;
  solicitacoesUpgrade: Array<Record<string, unknown> & { criadaEm: string }>;
}

export interface Resumo {
  empresa: { nome: string; razaoSocial: string; cnpj: string | null };
  plano: Plano;
  propostas: {
    total: number;
    porStatus: Record<StatusProposta, number>;
    valorPorStatus: Record<StatusProposta, number>;
    valorEmAberto: number;
    valorAprovado: number;
    kwpAprovado: number;
    taxaConversao: number | null;
    ticketMedio: number;
  };
  porTecnico: Array<{ id: string; nome: string; propostas: number; aprovadas: number; valorAprovado: number }>;
  porMes: Array<{ mes: string; propostas: number; valor: number; aprovadas: number }>;
  ultimasSincronizacoes: LogSync[];
  recentes: PropostaLista[];
  origemMedicoes: { ra: number; manual: number };
  atividadeRecente: Array<{ id: string; status: StatusProposta; em: string; cliente: string | null; numero: string | null }>;
}

export interface LogSync {
  dataHora: string;
  tipo: 'Push' | 'Pull';
  status: string;
  registros: number;
  erro: string | null;
  dispositivo: string;
  usuario: string;
}

export interface DetalheProposta {
  id: string;
  atualizadaEm: string;
  proposta: Record<string, unknown> & { itens: Array<Record<string, unknown>> };
  cliente: Record<string, unknown> | null;
  instalacao: Record<string, unknown> | null;
  medicoes: Array<Record<string, unknown>>;
  tecnico: { nome: string; email: string; telefone: string | null } | null;
  historico: Array<{ dataHora: string; campo: string; valorAnterior: string | null; valorNovo: string | null; origem: string; motivo: string | null; usuario: string | null }>;
  linhaDoTempo: Array<{ status: StatusProposta; em: string }>;
  acoesPermitidas: AcaoGestor[];
}

export interface UsuarioEquipe {
  id: string;
  nome: string;
  email: string;
  papel: 'Tecnico' | 'Gestor';
  telefone: string | null;
  ativo: boolean;
  criadoEm: string;
  ultimoAcessoEm: string | null;
  propostas: number;
  ultimaSincronizacao: string | null;
}
