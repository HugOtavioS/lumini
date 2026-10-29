import { RefreshCw } from 'lucide-react';

import { api } from '../api';
import { Aviso, Carregando, Topo, useDados } from '../components/comum';
import { dataHora } from '../formato';
import type { LogSync } from '../tipos';

export function Sincronizacoes() {
  const { dados, erro, carregando, recarregar } = useDados(() => api.get<LogSync[]>('/admin/sincronizacoes'));
  return (
    <>
      <Topo titulo="Sincronizações" migalha="Log de Sincronização (RNF11)">
        <button className="botao" onClick={() => void recarregar()}><RefreshCw size={16} /> Atualizar</button>
      </Topo>
      <div className="conteudo">
        <Aviso>Cada vez que um aparelho envia propostas (push) ou recebe atualizações (pull), a API registra aqui. Recusas aparecem com o motivo, por exemplo RN07 ou RN11.</Aviso>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {carregando && !dados ? <Carregando /> : (
          <div className="tabela-caixa">
            <table>
              <thead><tr><th>Quando</th><th>Usuário</th><th>Tipo</th><th>Aparelho</th><th className="direita">Registros</th><th>Resultado</th></tr></thead>
              <tbody>
                {(dados ?? []).map((s, i) => (
                  <tr key={i}>
                    <td className="mono">{dataHora(s.dataHora)}</td>
                    <td className="forte">{s.usuario}</td>
                    <td><span className={`selo ${s.tipo === 'Push' ? 'Gerada' : 'neutro'}`}>{s.tipo === 'Push' ? 'Envio' : 'Recebimento'}</span></td>
                    <td className="mono contagem">{s.dispositivo}</td>
                    <td className="direita num">{s.registros}</td>
                    <td>{s.erro ? <span style={{ color: 'var(--amarelo-texto)' }}>{s.erro}</span> : <span style={{ color: 'var(--verde-texto)' }}>Sucesso</span>}</td>
                  </tr>
                ))}
                {dados?.length === 0 && <tr><td colSpan={6} className="vazio">Nenhuma sincronização registrada.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
