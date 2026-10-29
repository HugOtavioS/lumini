import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { Toasts } from './components/comum';
import { Layout } from './components/Layout';
import { Catalogo } from './pages/Catalogo';
import { Dashboard } from './pages/Dashboard';
import { Equipe } from './pages/Equipe';
import { Login } from './pages/Login';
import { Plano } from './pages/Plano';
import { PropostaDetalhe } from './pages/PropostaDetalhe';
import { Propostas } from './pages/Propostas';
import { Sincronizacoes } from './pages/Sincronizacoes';
import { ProvedorSessao, useSessao } from './sessao';
import './styles.css';

function Rotas() {
  const { usuario } = useSessao();
  if (!usuario) return <Login />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="propostas" element={<Propostas />} />
        <Route path="propostas/:id" element={<PropostaDetalhe />} />
        <Route path="catalogo" element={<Catalogo />} />
        <Route path="plano" element={<Plano />} />
        <Route path="equipe" element={<Equipe />} />
        <Route path="sincronizacoes" element={<Sincronizacoes />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ProvedorSessao>
        <Rotas />
        <Toasts />
      </ProvedorSessao>
    </BrowserRouter>
  </StrictMode>,
);
