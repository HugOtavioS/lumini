import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';

import { API_URL } from '../api';
import { useSessao } from '../sessao';

export function Login() {
  const { entrar } = useSessao();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !senha) return setErro('Informe e-mail e senha.');
    setEnviando(true);
    setErro(null);
    try {
      await entrar(email.trim(), senha);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível entrar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <section className="arte">
        <div className="marca" style={{ padding: 0 }}>
          <img src="/icone.svg" alt="" />
          Lumini
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2>As propostas da sua equipe, do telhado ao fechamento.</h2>
          <p style={{ marginTop: 16 }}>
            Acompanhe o funil, ajuste preços do catálogo e responda às propostas que os técnicos geraram em campo, mesmo sem internet.
          </p>
        </div>
        <small style={{ color: 'var(--azul-500)', position: 'relative', zIndex: 1 }}>Painel do Gestor Comercial</small>
      </section>
      <section className="form">
        <form onSubmit={enviar} noValidate>
          <div>
            <h1>Entrar no painel</h1>
            <p style={{ color: 'var(--texto-2)', margin: '6px 0 0' }}>Use o e-mail cadastrado pela sua empresa.</p>
          </div>
          <div className="campo">
            <label htmlFor="email">E-mail</label>
            <input id="email" className="entrada" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="senha">Senha</label>
            <input id="senha" className="entrada" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
          {erro && <div className="aviso erro">{erro}</div>}
          <button className="botao primario" type="submit" disabled={enviando}>
            {enviando && <Loader2 size={18} className="girar" />} Entrar
          </button>
          <div className="demo">
            <strong>Ambiente local</strong> ({API_URL})<br />
            gestora@solarvale.com.br · senha <span className="mono">lumini123</span>
          </div>
        </form>
      </section>
    </div>
  );
}
