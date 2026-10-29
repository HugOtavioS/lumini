import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Check, Handshake, Lock, MessageCircle, RotateCcw, X, FilePlus2 } from 'lucide-react';
import { motivoBloqueio, type AcaoGestor } from '@lumini/sync';

import { api, ErroApi } from '../api';
import { Aviso, Carregando, Modal, SeloStatus, Topo, toast, useDados } from '../components/comum';
import { brl, data, dataHora, num, telefone } from '../formato';
import type { DetalheProposta, StatusProposta } from '../tipos';

// RF27 / RN11: os botões vêm de `acoesDoGestor` (@lumini/sync), a mesma regra
// que a API aplica no push. O que não aparece aqui, a API também recusaria.
const ACOES: Partial<Record<AcaoGestor, { rotulo: string; status: StatusProposta; classe: string; icone: typeof Check; confirmar: string }>> = {
  mover_negociacao: { rotulo: 'Mover para negociação', status: 'Em negociação', classe: 'botao', icone: Handshake, confirmar: 'A proposta passa para "Em negociação".' },
  gerar_nova_versao: { rotulo: 'Gerar nova versão', status: 'Gerada', classe: 'botao', icone: FilePlus2, confirmar: 'A proposta volta para "Gerada" com o número de versão seguinte.' },
  reabrir: { rotulo: 'Reabrir para o técnico', status: 'Reaberta', classe: 'botao escuro', icone: RotateCcw, confirmar: 'O técnico volta a poder editar a proposta no app (RN11). Ela só sobe de novo quando ele gerar o PDF.' },
  recusar: { rotulo: 'Recusada', status: 'Recusada', classe: 'botao perigo', icone: X, confirmar: 'A proposta fica somente leitura para todos (RN11).' },
  aprovar: { rotulo: 'Aprovada', status: 'Aprovada', classe: 'botao sucesso', icone: Check, confirmar: 'A proposta fica somente leitura para todos (RN11).' },
};

const linha = (rotulo: string, valor: React.ReactNode) => (
  <>
    <dt>{rotulo}</dt>
    <dd>{valor}</dd>
  </>
);

export function PropostaDetalhe() {
  const { id = '' } = useParams();
  const { dados, erro, carregando, setDados } = useDados(() => api.get<DetalheProposta>(`/admin/propostas/${id}`), [id]);
  const [confirmando, setConfirmando] = useState<AcaoGestor | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function aplicar(acao: AcaoGestor) {
    const a = ACOES[acao];
    if (!a) return;
    setSalvando(true);
    try {
      setDados(await api.post<DetalheProposta>(`/admin/propostas/${id}/status`, { status: a.status }));
      toast(`Proposta atualizada: ${a.status}.`);
    } catch (e) {
      toast(e instanceof ErroApi ? e.message : 'Não foi possível atualizar.', true);
    } finally {
      setSalvando(false);
      setConfirmando(null);
    }
  }

  if (carregando && !dados) return (<><Topo titulo="Proposta" /><Carregando /></>);
  if (erro || !dados) return (<><Topo titulo="Proposta" /><div className="conteudo"><Aviso tipo="erro">{erro}</Aviso></div></>);

  const p = dados.proposta;
  const c = dados.cliente ?? {};
  const ins = dados.instalacao ?? {};
  const status = p.status_proposta as StatusProposta;
  const bloqueio = motivoBloqueio('Gestor', status);
  const validade = typeof p.data_geracao === 'string' && typeof p.validade_dias === 'number'
    ? new Date(Date.parse(p.data_geracao) + p.validade_dias * 86_400_000).toISOString() : null;
  const metodo = String(dados.medicoes[0]?.metodo_medicao ?? '').toUpperCase() === 'RA' ? 'RA' : 'Manual';
  const area = dados.medicoes.reduce((t, m) => t + Number(m.area_m2 ?? 0), 0);
  const whatsapp = String(c.contato_whatsapp ?? '').replace(/\D/g, '');
  const custos: Array<[string, unknown]> = [
    ['Materiais elétricos', p.valor_materiais_eletricos], ['Mão de obra', p.valor_mao_de_obra],
    ['Projeto / ART / homologação', p.valor_art_homologacao], ['Logística / frete', p.valor_logistica_frete], [`Margem (${num(p.margem_percentual)}%)`, p.valor_margem],
  ];
  const acao = confirmando ? ACOES[confirmando] : undefined;

  return (
    <>
      <Topo titulo={String(c.nome_razao_social ?? p.numero_proposta)} migalha={<><Link to="/propostas">Propostas</Link> › {String(p.numero_proposta)} · versão {String(p.numero_versao ?? 1)}</>}>
        <SeloStatus status={status} />
        {dados.acoesPermitidas.filter((a) => ACOES[a]).map((a) => {
          const def = ACOES[a]!;
          const Icone = def.icone;
          return (
            <button key={a} className={`${def.classe} pequeno`} onClick={() => setConfirmando(a)} disabled={salvando}>
              <Icone size={16} /> {def.rotulo}
            </button>
          );
        })}
      </Topo>
      <div className="conteudo">
        {bloqueio && (
          <Aviso><Lock size={14} style={{ verticalAlign: -2 }} /> {bloqueio}</Aviso>
        )}
        <div className="grade g2">
          <section className="cartao">
            <h2>Dados do cliente</h2>
            <dl className="lista-dl">
              {linha('Nome', String(c.nome_razao_social ?? '—'))}
              {linha('Endereço', [ins.logradouro, ins.numero].filter(Boolean).join(', ') + (ins.cidade ? ` — ${ins.bairro ? `${ins.bairro}, ` : ''}${ins.cidade}/${ins.estado}` : ''))}
              {linha('WhatsApp', whatsapp ? <a href={`https://wa.me/55${whatsapp}`} target="_blank" rel="noreferrer" style={{ color: 'var(--verde-texto)' }}><MessageCircle size={14} style={{ verticalAlign: -2 }} /> {telefone(whatsapp)}</a> : '—')}
              {linha('E-mail', String(c.contato_email ?? '—'))}
              {linha('Técnico responsável', dados.tecnico?.nome ?? '—')}
              {linha('Data de emissão', data(p.data_geracao))}
              {linha('Validade', validade ? `${String(p.validade_dias)} dias (até ${data(validade)})` : '—')}
              {linha('Condição de pagamento', `${String(p.condicao_pagamento ?? '—')}${Number(p.parcelas) > 1 ? ` · ${String(p.parcelas)}x` : ''}${p.entrada_perc ? ` · entrada ${String(p.entrada_perc)}%` : ''}`)}
            </dl>
          </section>
          <section className="cartao">
            <div className="rotulo-laranja">Viabilidade financeira</div>
            <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }} className="num">{brl(p.valor_total)}</div>
            <div className="sub">Valor total do investimento</div>
            <dl className="lista-dl">
              {linha('Retorno estimado (payback)', typeof p.payback_meses === 'number' ? `${Math.floor(p.payback_meses / 12)} anos e ${p.payback_meses % 12} meses` : '—')}
              {linha('ROI em 25 anos', typeof p.roi_percentual === 'number' ? `${num(p.roi_percentual, 0)}%` : '—')}
              {linha('Consumo do cliente', `${num(ins.consumo_mensal_kwh, 0)} kWh/mês`)}
              {linha('Tarifa', `${brl(ins.tarifa_kwh)}/kWh`)}
            </dl>
            <div className="caixa-verde" style={{ marginTop: 18 }}>Economia mensal estimada: {brl(p.economia_mensal_estimada)}/mês</div>
          </section>
        </div>

        <div className="grade g2">
          <section className="cartao">
            <h2>Resumo técnico do projeto</h2>
            <dl className="lista-dl">
              {linha('Potência de pico', `${num(p.potencia_kwp)} kWp`)}
              {linha('Geração estimada', <span style={{ color: 'var(--verde-texto)' }}>{num(p.geracao_estimada_kwh_mes, 0)} kWh/mês</span>)}
              {linha('Perdas totais', `${num(p.perdas_totais_perc, 1)}%`)}
              {linha('Ligação / telhado', `${String(ins.tipo_ligacao ?? '—')} · ${String(ins.tipo_telhado ?? '—')}`)}
              {linha('Área medida', `${num(area, 1)} m² em ${dados.medicoes.length} ${dados.medicoes.length === 1 ? 'seção' : 'seções'}`)}
              {linha('Origem da medição', <span className={`selo ${metodo}`}>{metodo === 'RA' ? 'RA' : 'Manual'}</span>)}
            </dl>
          </section>
          <section className="cartao">
            <h2>Histórico da proposta</h2>
            <div className="sub">Mudanças de status e alterações registradas no Log de Auditoria</div>
            <ul className="linha-tempo">
              {[...dados.linhaDoTempo].reverse().map((l) => (
                <li key={l.em}><SeloStatus status={l.status} /><span className="contagem">{dataHora(l.em)}</span></li>
              ))}
            </ul>
            {dados.historico.length > 0 && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--azul-100)', paddingTop: 12 }}>
                {dados.historico.slice(0, 5).map((h, i) => (
                  <div key={i} className="contagem" style={{ marginTop: 4 }}>
                    <strong style={{ color: 'var(--texto)' }}>{h.usuario ?? 'Sistema'}</strong> ({h.origem}) · {h.campo}: {h.valorAnterior ?? '—'} → {h.valorNovo ?? '—'} · {dataHora(h.dataHora)}
                    {h.motivo && <> · <em>{h.motivo}</em></>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="cartao">
          <h2>Equipamentos e investimento</h2>
          <table style={{ marginTop: 12 }}>
            <thead>
              <tr><th>Item</th><th className="direita">Qtd</th><th className="direita">Preço unit.</th><th className="direita">Subtotal</th></tr>
            </thead>
            <tbody>
              {p.itens.map((item) => (
                <tr key={String(item.id_item)}>
                  <td className="forte">{String(item.descricao)} {item.categoria ? <span className="contagem">· {String(item.categoria)}</span> : null}</td>
                  <td className="direita num">{num(item.quantidade, 0)}</td>
                  <td className="direita num">{brl(item.preco_unitario)}</td>
                  <td className="direita num forte">{brl(item.subtotal)}</td>
                </tr>
              ))}
              {custos.map(([rotulo, valor]) => (
                <tr key={rotulo}><td>{rotulo}</td><td className="direita contagem">—</td><td className="direita contagem">—</td><td className="direita num">{brl(valor)}</td></tr>
              ))}
              <tr><td className="forte">Total</td><td /><td /><td className="direita num" style={{ fontSize: 18, fontWeight: 800 }}>{brl(p.valor_total)}</td></tr>
            </tbody>
          </table>
        </section>
      </div>

      {confirmando && acao && (
        <Modal titulo={`${acao.rotulo}?`} aoFechar={() => setConfirmando(null)}>
          <p style={{ margin: 0, color: 'var(--azul-600)' }}>{acao.confirmar}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="botao" onClick={() => setConfirmando(null)}>Cancelar</button>
            <button className="botao primario" onClick={() => aplicar(confirmando)} disabled={salvando}>Confirmar</button>
          </div>
        </Modal>
      )}
    </>
  );
}
