import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Info, Loader2 } from 'lucide-react';

import { ErroApi } from '../api';
import type { StatusProposta } from '../tipos';

export function Topo({ titulo, migalha, children }: { titulo: ReactNode; migalha?: ReactNode; children?: ReactNode }) {
  return (
    <header className="topo">
      <div>
        {migalha && <div className="migalha">{migalha}</div>}
        <h1>{titulo}</h1>
      </div>
      {children && <div className="acoes">{children}</div>}
    </header>
  );
}

export const SeloStatus = ({ status }: { status: StatusProposta | string }) => (
  <span className={`selo ${String(status).replace(/\s+/g, '-')}`}>{status}</span>
);

export const Carregando = () => (
  <div className="carregando">
    <Loader2 className="girar" size={22} />
  </div>
);

export function Aviso({ tipo = 'info', children }: { tipo?: 'info' | 'erro' | 'ok'; children: ReactNode }) {
  return (
    <div className={`aviso ${tipo === 'info' ? '' : tipo}`}>
      <Info size={18} style={{ flex: 'none', marginTop: 2 }} />
      <div>{children}</div>
    </div>
  );
}

/** Carrega dados da API e expõe estado de carregamento/erro e um "recarregar". */
export function useDados<T>(carregar: () => Promise<T>, deps: unknown[] = []) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const executar = useCallback(carregar, deps);
  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      setDados(await executar());
      setErro(null);
    } catch (e) {
      setErro(e instanceof ErroApi || e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }, [executar]);
  useEffect(() => {
    void recarregar();
  }, [recarregar]);
  return { dados, erro, carregando, recarregar, setDados };
}

let mostrarToast: ((texto: string, erro?: boolean) => void) | null = null;
export const toast = (texto: string, erro = false) => mostrarToast?.(texto, erro);

export function Toasts() {
  const [atual, setAtual] = useState<{ texto: string; erro: boolean } | null>(null);
  useEffect(() => {
    mostrarToast = (texto, erro = false) => setAtual({ texto, erro });
    return () => {
      mostrarToast = null;
    };
  }, []);
  useEffect(() => {
    if (!atual) return;
    const t = setTimeout(() => setAtual(null), 4000);
    return () => clearTimeout(t);
  }, [atual]);
  return atual ? <div className={`toast ${atual.erro ? 'erro' : ''}`} role="status">{atual.texto}</div> : null;
}

export function Modal({ titulo, aoFechar, children }: { titulo: string; aoFechar: () => void; children: ReactNode }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aoFechar]);
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <h2 style={{ fontSize: 20 }}>{titulo}</h2>
        {children}
      </div>
    </div>
  );
}
