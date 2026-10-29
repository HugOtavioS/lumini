import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { definirAoExpirar, entrar as entrarApi, sair as sairApi, sessaoAtual, type Usuario } from './api';

interface ContextoSessao {
  usuario: Usuario | null;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => void;
}

const Contexto = createContext<ContextoSessao | null>(null);

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => sessaoAtual()?.usuario ?? null);
  useEffect(() => definirAoExpirar(() => setUsuario(null)), []);
  const entrar = useCallback(async (email: string, senha: string) => setUsuario(await entrarApi(email, senha)), []);
  const sair = useCallback(() => {
    sairApi();
    setUsuario(null);
  }, []);
  return <Contexto.Provider value={{ usuario, entrar, sair }}>{children}</Contexto.Provider>;
}

export function useSessao(): ContextoSessao {
  const c = useContext(Contexto);
  if (!c) throw new Error('useSessao fora do ProvedorSessao');
  return c;
}
