import { Award, CheckCircle2 } from 'lucide-react';

import { api } from '../api';
import { Aviso, Carregando, Topo, toast, useDados } from '../components/comum';
import { data, dataHora } from '../formato';
import type { Plano as PlanoDados } from '../tipos';

// RF24 / UC13. Valores e limites dos planos pagos ainda são de exemplo
// (protótipo "Web Plano e Assinatura"); o Freemium vem da API.
const PLANOS = [
  { nome: 'Freemium', preco: 'R$ 0', limite: '25 propostas/mês', itens: ['Até 25 propostas comerciais por mês', 'Catálogo de equipamentos', 'Técnicos ilimitados no app', 'Suporte por e-mail'] },
  { nome: 'Mensal', preco: 'R$ 290', limite: '100 propostas/mês', itens: ['Até 100 propostas por mês', 'Catálogo completo integrado', 'Simulação de sombreamento', 'Suporte prioritário'] },
  { nome: 'Anual', preco: 'Sob consulta', limite: 'Ilimitado', itens: ['Propostas ilimitadas', 'Integração por API', 'Treinamento da equipe', 'Gerente de conta'] },
];

export function Plano() {
  const { dados, erro, carregando } = useDados(() => api.get<PlanoDados>('/admin/plano'));
  if (carregando && !dados) return (<><Topo titulo="Plano e assinatura" /><Carregando /></>);
  if (erro || !dados) return (<><Topo titulo="Plano e assinatura" /><div className="conteudo"><Aviso tipo="erro">{erro}</Aviso></div></>);
  const uso = dados.limiteMes ? Math.min(1, dados.usadasMes / dados.limiteMes) : 0;
  const hoje = new Date();
  const diasParaReset = Math.ceil((new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1).getTime() - hoje.getTime()) / 86_400_000);

  return (
    <>
      <Topo titulo="Plano e assinatura" />
      <div className="conteudo">
        <section className="cartao" style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <span className="kpi"><span className="icone" style={{ width: 48, height: 48, borderRadius: 12 }}><Award size={24} /></span></span>
          <div>
            <h2>Seu plano: Lumini {dados.tipo} <span className="selo Gerada" style={{ verticalAlign: 3 }}>{dados.status}</span></h2>
            <div className="sub">Assinatura desde {data(dados.inicioEm)} · o contador zera em {diasParaReset} {diasParaReset === 1 ? 'dia' : 'dias'}</div>
          </div>
          <div style={{ marginLeft: 'auto', minWidth: 280 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: 8 }}>
              Propostas no mês <span className="mono" style={{ color: 'var(--laranja-600)' }}>{dados.usadasMes} / {dados.limiteMes ?? '∞'}</span>
            </div>
            <div className="barra"><i style={{ width: `${uso * 100}%`, background: uso >= 0.9 ? 'var(--vermelho)' : undefined }} /></div>
          </div>
        </section>
        {uso >= 0.8 && <Aviso>Vocês já usaram {Math.round(uso * 100)}% do limite do mês. Quando o limite acabar, o app bloqueia novas propostas até o próximo mês (RN05).</Aviso>}

        <div className="grade" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {PLANOS.map((p) => {
            const atual = p.nome === dados.tipo;
            return (
              <section key={p.nome} className="cartao" style={{ display: 'flex', flexDirection: 'column', gap: 16, borderColor: atual ? 'var(--laranja-500)' : undefined, borderWidth: atual ? 2 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><h2>{p.nome}</h2>{atual && <span className="selo Gerada">Plano atual</span>}</div>
                <div style={{ fontSize: 32, fontWeight: 800 }}>{p.preco}{p.preco.startsWith('R$') && <small style={{ fontSize: 15, fontWeight: 500, color: 'var(--texto-2)' }}>/mês</small>}</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  {p.itens.map((i) => <li key={i} style={{ display: 'flex', gap: 8, color: 'var(--azul-600)' }}><CheckCircle2 size={18} color="var(--verde)" style={{ flex: 'none' }} />{i}</li>)}
                </ul>
                <button className={`botao ${atual ? '' : 'primario'}`} disabled={atual} onClick={() => toast('Solicitação registrada. A equipe Lumini entra em contato para concluir a troca de plano.')}>
                  {atual ? 'Plano atual' : 'Solicitar upgrade'}
                </button>
              </section>
            );
          })}
        </div>

        <section className="cartao">
          <h2>Pedidos de upgrade dos técnicos</h2>
          <div className="sub">Enviados pelo app quando o limite do mês acaba (RF28)</div>
          {dados.solicitacoesUpgrade.length === 0 ? <div className="vazio">Nenhum pedido até agora.</div> : (
            <table style={{ marginTop: 12 }}>
              <tbody>
                {dados.solicitacoesUpgrade.map((s) => (
                  <tr key={String(s.id_solicitacao)}><td className="forte">{String(s.id_usuario_solicitante)}</td><td>{String(s.mensagem ?? 'Sem mensagem')}</td><td><span className="selo neutro">{String(s.status)}</span></td><td className="direita contagem">{dataHora(s.criadaEm)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
