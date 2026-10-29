import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Download, Search } from 'lucide-react';
import { STATUS_PROPOSTA } from '@lumini/sync';

import { api } from '../api';
import { Aviso, Carregando, SeloStatus, Topo, useDados } from '../components/comum';
import { brl, data, num } from '../formato';
import type { PropostaLista, UsuarioEquipe } from '../tipos';

function exportarCsv(linhas: PropostaLista[]) {
  const cab = ['Número', 'Cliente', 'Cidade', 'Técnico', 'Potência (kWp)', 'Valor (R$)', 'Status', 'Data'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const corpo = linhas.map((p) => [p.numero, p.cliente, p.cidade, p.tecnico, num(p.potenciaKwp), p.valorTotal.toFixed(2).replace('.', ','), p.status, data(p.dataGeracao)].map(esc).join(';'));
  const blob = new Blob([`﻿${[cab.join(';'), ...corpo].join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `propostas-lumini-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function Propostas() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const tecnico = params.get('tecnico') ?? '';
  const [busca, setBusca] = useState('');
  const navegar = useNavigate();
  const lista = useDados(() => api.get<PropostaLista[]>('/admin/propostas'));
  const equipe = useDados(() => api.get<UsuarioEquipe[]>('/admin/usuarios'));

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (lista.dados ?? [])
      .filter((p) => !status || p.status === status)
      .filter((p) => !tecnico || p.idTecnico === tecnico)
      .filter((p) => !termo || [p.cliente, p.numero, p.cidade].some((t) => t?.toLowerCase().includes(termo)));
  }, [lista.dados, status, tecnico, busca]);

  const definir = (chave: string, valor: string) => {
    const novo = new URLSearchParams(params);
    if (valor) novo.set(chave, valor);
    else novo.delete(chave);
    setParams(novo, { replace: true });
  };

  return (
    <>
      <Topo titulo="Propostas comerciais">
        <button className="botao" onClick={() => exportarCsv(filtradas)} disabled={filtradas.length === 0}>
          <Download size={18} /> Exportar CSV
        </button>
      </Topo>
      <div className="conteudo">
        <div className="filtros">
          <select className="entrada" style={{ width: 200 }} value={tecnico} onChange={(e) => definir('tecnico', e.target.value)} aria-label="Técnico">
            <option value="">Todos os técnicos</option>
            {(equipe.dados ?? []).filter((u) => u.papel === 'Tecnico').map((u) => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>
          <select className="entrada" style={{ width: 200 }} value={status} onChange={(e) => definir('status', e.target.value)} aria-label="Status">
            <option value="">Todos os status</option>
            {STATUS_PROPOSTA.filter((s) => s !== 'Em elaboração').map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <label className="busca">
            <Search size={17} />
            <input className="entrada" placeholder="Buscar cliente, número ou cidade…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </label>
        </div>
        <span className="contagem" style={{ marginTop: -12 }}>{filtradas.length} {filtradas.length === 1 ? 'proposta encontrada' : 'propostas encontradas'}</span>
        {lista.erro && <Aviso tipo="erro">{lista.erro}</Aviso>}
        {lista.carregando && !lista.dados ? (
          <Carregando />
        ) : (
          <div className="tabela-caixa">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Número</th>
                  <th>Técnico</th>
                  <th className="direita">Potência</th>
                  <th className="direita">Valor</th>
                  <th>Data</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((p) => (
                  <tr key={p.id} className="clicavel" onClick={() => navegar(`/propostas/${p.id}`)}>
                    <td className="forte">
                      {p.cliente ?? '—'}
                      <div className="contagem" style={{ fontWeight: 400 }}>{p.cidade}</div>
                    </td>
                    <td className="mono">{p.numero}{p.versao > 1 ? ` · v${p.versao}` : ''}</td>
                    <td>{p.tecnico ?? '—'}</td>
                    <td className="direita mono">{num(p.potenciaKwp)} kWp</td>
                    <td className="direita mono" style={{ fontWeight: 600 }}>{brl(p.valorTotal)}</td>
                    <td>{data(p.dataGeracao ?? p.atualizadaEm)}</td>
                    <td><SeloStatus status={p.status} /></td>
                  </tr>
                ))}
                {filtradas.length === 0 && (
                  <tr><td colSpan={7} className="vazio">Nenhuma proposta com esses filtros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
