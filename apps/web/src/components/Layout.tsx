import { NavLink, Outlet } from 'react-router';
import { CreditCard, Database, FileText, LayoutGrid, LogOut, RefreshCw, Users } from 'lucide-react';

import { useSessao } from '../sessao';
import { iniciais } from '../formato';

const ITENS = [
  { para: '/', icone: LayoutGrid, rotulo: 'Dashboard', fim: true },
  { para: '/propostas', icone: FileText, rotulo: 'Propostas' },
  { para: '/catalogo', icone: Database, rotulo: 'Catálogo' },
  { para: '/plano', icone: CreditCard, rotulo: 'Plano' },
  { para: '/equipe', icone: Users, rotulo: 'Equipe' },
  { para: '/sincronizacoes', icone: RefreshCw, rotulo: 'Sincronizações' },
];

export function Layout() {
  const { usuario, sair } = useSessao();
  return (
    <div className="casca">
      <aside className="lateral">
        <div className="marca">
          <img src="/icone.svg" alt="" />
          Lumini
        </div>
        <nav className="menu" aria-label="Menu principal">
          {ITENS.map(({ para, icone: Icone, rotulo, fim }) => (
            <NavLink key={para} to={para} end={fim} className={({ isActive }) => (isActive ? 'ativo' : '')}>
              <Icone size={20} />
              <span>{rotulo}</span>
            </NavLink>
          ))}
        </nav>
        {usuario && (
          <div className="usuario-lateral">
            <span className="avatar">{iniciais(usuario.nome)}</span>
            <div>
              <strong>{usuario.nome}</strong>
              <small>Gestora · {usuario.nomeEmpresa}</small>
            </div>
            <button className="sair" onClick={sair} title="Sair" aria-label="Sair">
              <LogOut size={18} />
            </button>
          </div>
        )}
      </aside>
      <main className="principal">
        <Outlet />
      </main>
    </div>
  );
}
