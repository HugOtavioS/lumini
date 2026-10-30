import type {
  ArmazenamentoServidor,
  AvisoSobrescrita,
  EntidadeSincronizavel,
  Guardado,
  RegistroAuditoria,
  RegistroLogSincronizacao,
  StatusProposta,
  UltimoEnvio,
  VersaoRegistro,
} from '@lumini/sync';

import type { Banco } from './banco';

// Porta de armazenamento do servidor de sincronização (@lumini/sync) em
// SQLite. As regras (RN07, RN11, dependências, reenvio, last-write-wins com
// auditoria) são as mesmas do servidor de referência do Pedro; aqui só se grava.

interface LinhaRegistro {
  entidade: string;
  id_registro: string;
  id_empresa: string;
  dados: string;
  updated_at: string;
  updated_by: string;
  id_dispositivo: string | null;
  seq: number;
}

const separar = (chave: string): [string, string] => {
  const i = chave.indexOf(':');
  return [chave.slice(0, i), chave.slice(i + 1)];
};

function guardadoDe(l: LinhaRegistro): Guardado {
  const versao: VersaoRegistro = {
    id: l.id_registro,
    idEmpresa: l.id_empresa,
    updatedAt: l.updated_at,
    updatedBy: l.updated_by,
    dados: JSON.parse(l.dados) as Record<string, unknown>,
  };
  return { entidade: l.entidade as EntidadeSincronizavel, versao, seq: Number(l.seq), idDispositivo: l.id_dispositivo };
}

export class ArmazenamentoSqlite implements ArmazenamentoServidor {
  constructor(private readonly banco: Banco) {}

  obter(chave: string): Guardado | undefined {
    const [entidade, id] = separar(chave);
    const l = this.banco.um<LinhaRegistro>('SELECT * FROM registro_sync WHERE entidade = ? AND id_registro = ?', entidade, id);
    return l ? guardadoDe(l) : undefined;
  }

  gravar(chave: string, registro: Omit<Guardado, 'seq'>): number {
    const [entidade, id] = separar(chave);
    const seq = this.posicaoAtual() + 1;
    const v = registro.versao;
    this.banco.executar(
      `INSERT INTO registro_sync (entidade, id_registro, id_empresa, dados, updated_at, updated_by, id_dispositivo, seq)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (entidade, id_registro) DO UPDATE SET
         id_empresa = excluded.id_empresa, dados = excluded.dados, updated_at = excluded.updated_at,
         updated_by = excluded.updated_by, id_dispositivo = excluded.id_dispositivo, seq = excluded.seq`,
      entidade, id, v.idEmpresa, JSON.stringify(v.dados), v.updatedAt, v.updatedBy, registro.idDispositivo, seq,
    );
    return seq;
  }

  posicaoAtual(): number {
    return Number(this.banco.um<{ seq: number | null }>('SELECT MAX(seq) AS seq FROM registro_sync')?.seq ?? 0);
  }

  listarDesde(idEmpresa: string, desde: number): Guardado[] {
    return this.banco
      .todos<LinhaRegistro>('SELECT * FROM registro_sync WHERE id_empresa = ? AND seq > ? ORDER BY seq', idEmpresa, desde)
      .map(guardadoDe);
  }

  statusNaVersao(chave: string, updatedAt: string): StatusProposta | null {
    const [entidade, id] = separar(chave);
    const l = this.banco.um<{ status: string }>(
      'SELECT status FROM status_versao WHERE entidade = ? AND id_registro = ? AND updated_at = ?', entidade, id, updatedAt,
    );
    return (l?.status as StatusProposta | undefined) ?? null;
  }

  guardarStatusDaVersao(chave: string, updatedAt: string, status: StatusProposta): void {
    const [entidade, id] = separar(chave);
    this.banco.executar(
      'INSERT INTO status_versao (entidade, id_registro, updated_at, status) VALUES (?, ?, ?, ?) ON CONFLICT (entidade, id_registro, updated_at) DO UPDATE SET status = excluded.status',
      entidade, id, updatedAt, status,
    );
  }

  ultimoEnvio(chaveEnvio: string): UltimoEnvio | undefined {
    const l = this.banco.um<{ impressao: string; mensagem_descarte: string | null }>(
      'SELECT impressao, mensagem_descarte FROM ultimo_envio WHERE chave_envio = ?', chaveEnvio,
    );
    return l ? { impressao: l.impressao, mensagemDescarte: l.mensagem_descarte } : undefined;
  }

  registrarEnvio(chaveEnvio: string, envio: UltimoEnvio): void {
    this.banco.executar(
      `INSERT INTO ultimo_envio (chave_envio, impressao, mensagem_descarte) VALUES (?, ?, ?)
       ON CONFLICT (chave_envio) DO UPDATE SET impressao = excluded.impressao, mensagem_descarte = excluded.mensagem_descarte`,
      chaveEnvio, envio.impressao, envio.mensagemDescarte,
    );
  }

  registrarAuditoria(linhas: readonly RegistroAuditoria[]): void {
    for (const a of linhas) {
      this.banco.executar(
        `INSERT INTO log_auditoria (id_log, id_empresa, entidade, id_registro, campo, valor_anterior, valor_novo, id_usuario, origem, data_hora, motivo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        a.idLog, a.idEmpresa, a.entidade, a.idRegistro, a.campo, a.valorAnterior, a.valorNovo, a.idUsuario, a.origem, a.dataHora, a.motivo,
      );
    }
  }

  registrarLogSincronizacao(l: RegistroLogSincronizacao): void {
    this.banco.executar(
      `INSERT INTO log_sincronizacao (id_log_sync, id_usuario, id_dispositivo, data_hora, tipo, status, qtd_registros, mensagem_erro)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      l.idLogSync, l.idUsuario, l.idDispositivo, l.dataHora, l.tipo, l.status, l.qtdRegistros, l.mensagemErro,
    );
  }

  adicionarAviso(aviso: AvisoSobrescrita): void {
    this.banco.executar(
      'INSERT INTO aviso_pendente (id_aviso, id_usuario, conteudo, criado_em) VALUES (?, ?, ?, ?)',
      aviso.idAviso, aviso.idUsuario, JSON.stringify(aviso), aviso.em,
    );
  }

  retirarAvisos(idUsuario: string): AvisoSobrescrita[] {
    const linhas = this.banco.todos<{ conteudo: string }>(
      'SELECT conteudo FROM aviso_pendente WHERE id_usuario = ? ORDER BY criado_em', idUsuario,
    );
    this.banco.executar('DELETE FROM aviso_pendente WHERE id_usuario = ?', idUsuario);
    return linhas.map((l) => JSON.parse(l.conteudo) as AvisoSobrescrita);
  }

  emTransacao<T>(tarefa: () => T): T {
    return this.banco.transacao(tarefa);
  }
}
