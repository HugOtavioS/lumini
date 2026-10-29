import { useState } from 'react';
import { UserPlus } from 'lucide-react';

import { api, ErroApi } from '../api';
import { Aviso, Carregando, Modal, Topo, toast, useDados } from '../components/comum';
import { haQuanto, iniciais } from '../formato';
import type { UsuarioEquipe } from '../tipos';

export function Equipe() {
  const { dados, erro, carregando, recarregar } = useDados(() => api.get<UsuarioEquipe[]>('/admin/usuarios'));
  const [novo, setNovo] = useState(false);

  async function alternar(u: UsuarioEquipe) {
    try {
      await api.patch(`/admin/usuarios/${u.id}`, { ativo: !u.ativo });
      toast(u.ativo ? `${u.nome} não consegue mais entrar.` : `${u.nome} pode entrar de novo.`);
      await recarregar();
    } catch (e) {
      toast(e instanceof ErroApi ? e.message : 'Não foi possível alterar.', true);
    }
  }

  return (
    <>
      <Topo titulo="Equipe">
        <button className="botao primario" onClick={() => setNovo(true)}><UserPlus size={18} /> Cadastrar técnico</button>
      </Topo>
      <div className="conteudo">
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {carregando && !dados ? <Carregando /> : (
          <div className="tabela-caixa">
            <table>
              <thead><tr><th>Nome</th><th>Papel</th><th className="direita">Propostas</th><th>Último acesso</th><th>Última sincronização</th><th>Acesso</th></tr></thead>
              <tbody>
                {(dados ?? []).map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span className="avatar" style={{ width: 34, height: 34, fontSize: 13, background: u.papel === 'Gestor' ? 'var(--azul-800)' : undefined }}>{iniciais(u.nome)}</span>
                        <div><strong>{u.nome}</strong><div className="contagem">{u.email}</div></div>
                      </div>
                    </td>
                    <td><span className={`selo ${u.papel === 'Gestor' ? 'neutro' : 'Gerada'}`}>{u.papel === 'Gestor' ? 'Gestor' : 'Técnico'}</span></td>
                    <td className="direita num">{u.propostas}</td>
                    <td className="contagem">{u.ultimoAcessoEm ? haQuanto(u.ultimoAcessoEm) : 'nunca'}</td>
                    <td className="contagem">{u.ultimaSincronizacao ? haQuanto(u.ultimaSincronizacao) : '—'}</td>
                    <td>
                      <label className="interruptor" style={{ justifyContent: 'flex-start' }}>
                        <input type="checkbox" checked={u.ativo} onChange={() => alternar(u)} aria-label={`Acesso de ${u.nome}`} />
                        <span className="contagem">{u.ativo ? 'Ativo' : 'Desativado'}</span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {novo && <NovoUsuario aoFechar={() => setNovo(false)} aoSalvar={async () => { setNovo(false); await recarregar(); }} />}
    </>
  );
}

function NovoUsuario({ aoFechar, aoSalvar }: { aoFechar: () => void; aoSalvar: () => Promise<void> }) {
  const [f, setF] = useState({ nome: '', email: '', telefone: '', senha: '', papel: 'Tecnico' });
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  async function enviar() {
    setSalvando(true);
    try {
      await api.post('/admin/usuarios', f);
      toast(`${f.nome} cadastrado. Passe o e-mail e a senha para o primeiro acesso no app.`);
      await aoSalvar();
    } catch (e) {
      setErroForm(e instanceof ErroApi ? e.message : 'Não foi possível cadastrar.');
    } finally {
      setSalvando(false);
    }
  }
  const campo = (chave: keyof typeof f, rotulo: string, tipo = 'text') => (
    <div className="campo"><label>{rotulo}</label><input className="entrada" type={tipo} value={f[chave]} onChange={(e) => setF({ ...f, [chave]: e.target.value })} /></div>
  );
  return (
    <Modal titulo="Cadastrar usuário" aoFechar={aoFechar}>
      <div className="formulario" style={{ marginTop: 0 }}>
        <div className="inteiro">{campo('nome', 'Nome completo')}</div>
        {campo('email', 'E-mail', 'email')}
        {campo('telefone', 'Telefone')}
        {campo('senha', 'Senha inicial (mín. 8 caracteres)', 'password')}
        <div className="campo"><label>Papel</label><select className="entrada" value={f.papel} onChange={(e) => setF({ ...f, papel: e.target.value })}><option value="Tecnico">Técnico (app)</option><option value="Gestor">Gestor (painel)</option></select></div>
      </div>
      {erroForm && <div className="aviso erro">{erroForm}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="botao" onClick={aoFechar}>Cancelar</button>
        <button className="botao primario" onClick={enviar} disabled={salvando}>Cadastrar</button>
      </div>
    </Modal>
  );
}
