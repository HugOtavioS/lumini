import { Link, useNavigate } from 'react-router';
import { ArrowRight, BadgeCheck, Clock, FileText, TrendingUp } from 'lucide-react';

import { api } from '../api';
import { Aviso, Carregando, SeloStatus, Topo, useDados } from '../components/comum';
import { brl, brlCurto, dataHora, haQuanto, mesCurto, num, pct } from '../formato';
import type { Resumo, StatusProposta } from '../tipos';

const FUNIL: Array<{ status: StatusProposta; rotulo: string; cor: string; fundo: string }> = [
  { status: 'Gerada', rotulo: 'Gerada (enviada ao cliente)', cor: 'linear-gradient(90deg, #f97316, #fdba74)', fundo: '#fff7ed' },
  { status: 'Em negociação', rotulo: 'Em negociação', cor: '#3b82f6', fundo: '#eff6ff' },
  { status: 'Reaberta', rotulo: 'Reaberta ao técnico', cor: '#eab308', fundo: '#fef9c3' },
  { status: 'Aprovada', rotulo: 'Aprovada', cor: '#22c55e', fundo: '#f0fdf4' },
  { status: 'Recusada', rotulo: 'Recusada', cor: '#ef4444', fundo: '#fef2f2' },
];
const COR_STATUS: Record<string, string> = { Gerada: '#f97316', 'Em negociação': '#3b82f6', Reaberta: '#eab308', Aprovada: '#22c55e', Recusada: '#ef4444' };

export function Dashboard() {
  const { dados, erro, carregando } = useDados(() => api.get<Resumo>('/admin/resumo'));
  const navegar = useNavigate();

  if (carregando && !dados) return (<><Topo titulo="Dashboard" /><Carregando /></>);
  if (erro || !dados) return (<><Topo titulo="Dashboard" /><div className="conteudo"><Aviso tipo="erro">{erro}</Aviso></div></>);

  const { propostas, plano } = dados;
  const maxFunil = Math.max(1, ...FUNIL.map((f) => propostas.porStatus[f.status] ?? 0));
  const maxMes = Math.max(1, ...dados.porMes.map((m) => m.valor));
  const maxTecnico = Math.max(1, ...dados.porTecnico.map((t) => t.propostas));
  const usoPlano = plano.limiteMes ? Math.min(1, plano.usadasMes / plano.limiteMes) : 0;
  const totalMedicoes = dados.origemMedicoes.ra + dados.origemMedicoes.manual;
  const fracaoRa = totalMedicoes > 0 ? dados.origemMedicoes.ra / totalMedicoes : 0;
  const aguardando = (propostas.porStatus.Gerada ?? 0) + (propostas.porStatus['Em negociação'] ?? 0);

  return (
    <>
      <Topo titulo="Dashboard" migalha={dados.empresa.nome} />
      <div className="conteudo">
        <div className="grade g4">
          <div className="cartao kpi">
            <div className="rotulo">Valor em aberto <span className="icone"><FileText size={18} /></span></div>
            <div className="valor num">{brlCurto(propostas.valorEmAberto)}</div>
            <div className="nota">propostas geradas e em negociação</div>
          </div>
          <div className="cartao kpi">
            <div className="rotulo">Taxa de conversão <span className="icone verde"><TrendingUp size={18} /></span></div>
            <div className="valor num">{pct(propostas.taxaConversao)}</div>
            <div className="nota verde">{propostas.porStatus.Aprovada ?? 0} aprovadas de {(propostas.porStatus.Aprovada ?? 0) + (propostas.porStatus.Recusada ?? 0)} encerradas</div>
          </div>
          <div className="cartao kpi">
            <div className="rotulo">Aguardando resposta <span className="icone"><Clock size={18} /></span></div>
            <div className="valor num">{aguardando}</div>
            <div className="nota">propostas pendentes de decisão</div>
          </div>
          <div className="cartao kpi destaque">
            <div className="rotulo">Limite de propostas <span className="selo" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>Plano {plano.tipo}</span></div>
            <div className="valor num">{plano.usadasMes}<small style={{ fontSize: 16, fontWeight: 500 }}> / {plano.limiteMes ?? '∞'}</small></div>
            <div className="barra" style={{ margin: '4px 0 10px' }}><i style={{ width: `${usoPlano * 100}%` }} /></div>
            <Link to="/plano" className="nota" style={{ textDecoration: 'underline', fontWeight: 600, color: '#fff' }}>Ver plano <ArrowRight size={13} style={{ verticalAlign: -2 }} /></Link>
          </div>
        </div>

        <div className="grade g-2-1">
          <section className="cartao">
            <h2>Funil de vendas</h2>
            <div className="sub">Propostas por etapa e valor de cada etapa</div>
            {FUNIL.map((f) => {
              const qtd = propostas.porStatus[f.status] ?? 0;
              return (
                <div className="funil-linha" key={f.status}>
                  <span style={{ fontWeight: 500 }}>{f.rotulo}</span>
                  <div className="trilho" style={{ background: f.fundo }}><i style={{ width: `${(qtd / maxFunil) * 100}%`, background: f.cor }} /></div>
                  <Link to={`/propostas?status=${encodeURIComponent(f.status)}`}>
                    <strong>{qtd} {qtd === 1 ? 'proposta' : 'propostas'}</strong>
                    <div className="contagem num">{brlCurto(propostas.valorPorStatus[f.status] ?? 0)}</div>
                  </Link>
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: 32, marginTop: 24, color: 'var(--texto-2)', flexWrap: 'wrap' }}>
              <span>Aprovado: <strong style={{ color: 'var(--verde-texto)' }}>{brl(propostas.valorAprovado)}</strong></span>
              <span>Potência aprovada: <strong style={{ color: 'var(--texto)' }}>{num(propostas.kwpAprovado, 1)} kWp</strong></span>
              <span>Ticket médio: <strong style={{ color: 'var(--texto)' }}>{brl(propostas.ticketMedio)}</strong></span>
            </div>
          </section>
          <section className="cartao">
            <h2>Atividade recente</h2>
            <div className="sub">Últimos movimentos no funil</div>
            <div style={{ marginTop: 10 }}>
              {dados.atividadeRecente.map((a) => (
                <div className="atividade clicavel" key={`${a.id}-${a.em}`} style={{ cursor: 'pointer' }} onClick={() => navegar(`/propostas/${a.id}`)}>
                  <span className="ponto" style={{ background: COR_STATUS[a.status] ?? '#94a3b8' }} />
                  <div>
                    <strong>{a.cliente ?? a.numero}</strong> · {a.status}
                    <div className="contagem">{haQuanto(a.em)}</div>
                  </div>
                </div>
              ))}
              {dados.atividadeRecente.length === 0 && <div className="vazio">Nenhuma movimentação ainda.</div>}
            </div>
          </section>
        </div>

        <div className="grade g2">
          <section className="cartao">
            <h2>Desempenho por técnico</h2>
            <div className="sub">Propostas geradas e aprovadas por técnico</div>
            {dados.porTecnico.map((t) => (
              <div key={t.id} style={{ marginTop: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <strong>{t.nome}</strong>
                  <span><strong>{t.propostas}</strong> propostas · <span style={{ color: 'var(--verde-texto)' }}>{t.aprovadas} aprovadas</span></span>
                </div>
                <div className="barra"><i style={{ width: `${(t.propostas / maxTecnico) * 100}%` }} /></div>
              </div>
            ))}
          </section>
          <section className="cartao">
            <h2>Valor gerado por mês</h2>
            <div className="sub">Últimos 6 meses · origem das medições: <strong style={{ color: 'var(--verde-texto)' }}>{pct(fracaoRa)} por RA</strong>, {pct(1 - fracaoRa)} manual</div>
            <div className="colunas-mes">
              {dados.porMes.map((m) => (
                <div className="col" key={m.mes} title={`${m.propostas} propostas · ${brl(m.valor)}`}>
                  <small className="num">{m.valor > 0 ? brlCurto(m.valor) : ''}</small>
                  <i style={{ height: `${(m.valor / maxMes) * 100}%` }} />
                  <small>{mesCurto(m.mes)}</small>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="cartao">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div>
              <h2>Últimas sincronizações</h2>
              <div className="sub">Envios e recebimentos dos aparelhos dos técnicos (RNF11)</div>
            </div>
            <Link to="/sincronizacoes" className="botao pequeno" style={{ marginLeft: 'auto' }}>Ver todas</Link>
          </div>
          <table style={{ marginTop: 12 }}>
            <tbody>
              {dados.ultimasSincronizacoes.map((s, i) => (
                <tr key={i}>
                  <td className="forte">{s.usuario}</td>
                  <td><span className={`selo ${s.tipo === 'Push' ? 'Gerada' : 'neutro'}`}>{s.tipo === 'Push' ? 'Envio' : 'Recebimento'}</span></td>
                  <td>{s.registros} registros</td>
                  <td className="contagem">{s.erro ?? 'Sucesso'}</td>
                  <td className="direita contagem">{dataHora(s.dataHora)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <p className="contagem" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><BadgeCheck size={14} /> Dados da API local · atualizados ao abrir a página</p>
      </div>
    </>
  );
}
