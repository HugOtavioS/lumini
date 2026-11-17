import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Minus, Plus, Save, Trash2 } from 'lucide-react';
import { precificarProposta, recalcularViabilidade, validarItensEDesconto } from '@lumini/domain';

import { api, ErroApi } from '../api';
import { Aviso, Carregando, SeloStatus, Topo, toast, useDados } from '../components/comum';
import { brl, num, periodo } from '../formato';
import type { DetalheProposta, EquipamentoCatalogo, StatusProposta } from '../tipos';

// SCRUM-419 — Editor de Proposta (RF27). O gestor troca equipamentos, muda
// quantidades e ajustes e aplica o desconto comercial. O recálculo roda aqui,
// no navegador, com @lumini/domain (SCRUM-421 / D23); a API confere o total
// com a mesma função, grava uma nova versão e registra tudo no Log de Auditoria.

interface Linha {
  idEquipamento: string;
  quantidade: number;
  ajustePercentual: number;
  precoCatalogo: number;
  descricao: string;
  categoria: string | null;
  potenciaW: number | null;
}

const n = (v: unknown, padrao = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || padrao);

export function PropostaEditor() {
  const { id = '' } = useParams();
  const navegar = useNavigate();
  const det = useDados(() => api.get<DetalheProposta>(`/admin/propostas/${id}`), [id]);
  const cat = useDados(() => api.get<EquipamentoCatalogo[]>('/admin/equipamentos'));
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [desconto, setDesconto] = useState<number | null>(null);
  const [novoId, setNovoId] = useState('');
  const [salvando, setSalvando] = useState(false);

  const catalogo = useMemo(() => new Map((cat.dados ?? []).map((e) => [e.idEquipamento, e])), [cat.dados]);
  const p = det.dados?.proposta;

  // Estado inicial: os itens como estão na proposta.
  const iniciais = useMemo<Linha[]>(() => {
    if (!p) return [];
    return p.itens.map((i) => {
      const eq = catalogo.get(String(i.id_equipamento));
      return {
        idEquipamento: String(i.id_equipamento),
        quantidade: n(i.quantidade, 1),
        ajustePercentual: n(i.ajuste_percentual),
        precoCatalogo: n(i.preco_catalogo, n(i.preco_unitario)),
        descricao: String(i.descricao ?? (eq ? `${eq.fabricante} ${eq.modelo}` : i.id_equipamento)),
        categoria: (i.categoria as string | null) ?? eq?.categoria ?? null,
        potenciaW: eq?.potenciaW ?? null,
      };
    });
  }, [p, catalogo]);
  const itens = linhas ?? iniciais;
  const descontoAtual = desconto ?? n(p?.desconto_comercial_perc);

  if ((det.carregando && !det.dados) || (cat.carregando && !cat.dados)) return (<><Topo titulo="Editar proposta" /><Carregando /></>);
  if (det.erro || !det.dados || !p) return (<><Topo titulo="Editar proposta" /><div className="conteudo"><Aviso tipo="erro">{det.erro}</Aviso></div></>);

  const dados = det.dados;
  const status = p.status_proposta as StatusProposta;
  const limite = dados.limiteAjustePrecoPerc;
  const servicos = {
    materiaisEletricos: n(p.valor_materiais_eletricos),
    maoDeObra: n(p.valor_mao_de_obra),
    artHomologacao: n(p.valor_art_homologacao),
    logisticaFrete: n(p.valor_logistica_frete),
  };
  const preco = precificarProposta({ itens, servicos, margemPercentual: n(p.margem_percentual), descontoComercialPerc: descontoAtual });
  const erros = validarItensEDesconto(itens, descontoAtual, limite);

  // Potência e geração acompanham os módulos (mesma regra da API).
  const kwp = (ls: Linha[]) => ls.filter((l) => l.categoria === 'Módulo').reduce((t, l) => t + ((l.potenciaW ?? 0) * l.quantidade) / 1000, 0);
  const kwpBase = n(p.potencia_kwp);
  const kwpNovo = kwp(iniciais) > 0 && kwp(itens) > 0 ? kwpBase * (kwp(itens) / kwp(iniciais)) : kwpBase;
  const geracao = kwpBase > 0 ? n(p.geracao_estimada_kwh_mes) * (kwpNovo / kwpBase) : n(p.geracao_estimada_kwh_mes);
  const viab = recalcularViabilidade({ valorTotal: preco.valorTotal, geracaoMensalKwh: geracao, tarifaKwh: n(dados.instalacao?.tarifa_kwh) });
  const mudou = linhas !== null || desconto !== null;

  const alterar = (i: number, patch: Partial<Linha>) => setLinhas(itens.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const remover = (i: number) => setLinhas(itens.filter((_, j) => j !== i));
  const trocar = (i: number, idEq: string) => {
    const eq = catalogo.get(idEq);
    if (!eq) return;
    alterar(i, { idEquipamento: eq.idEquipamento, precoCatalogo: eq.precoVenda, ajustePercentual: 0, descricao: `${eq.fabricante} ${eq.modelo}`, categoria: eq.categoria, potenciaW: eq.potenciaW });
  };
  const incluir = () => {
    const eq = catalogo.get(novoId);
    if (!eq || itens.some((l) => l.idEquipamento === eq.idEquipamento)) return;
    setLinhas([...itens, { idEquipamento: eq.idEquipamento, quantidade: 1, ajustePercentual: 0, precoCatalogo: eq.precoVenda, descricao: `${eq.fabricante} ${eq.modelo}`, categoria: eq.categoria, potenciaW: eq.potenciaW }]);
    setNovoId('');
  };

  async function salvar() {
    setSalvando(true);
    try {
      await api.put<DetalheProposta>(`/admin/propostas/${id}`, {
        itens: itens.map((l) => ({ id_equipamento: l.idEquipamento, quantidade: l.quantidade, ajuste_percentual: l.ajustePercentual })),
        desconto_comercial_perc: descontoAtual,
        valor_total: preco.valorTotal,
      });
      toast(`Proposta salva: versão ${n(p!.numero_versao, 1) + 1}. O técnico recebe na próxima sincronização.`);
      navegar(`/propostas/${id}`);
    } catch (e) {
      toast(e instanceof ErroApi ? e.message : 'Não foi possível salvar.', true);
    } finally {
      setSalvando(false);
    }
  }

  const ativos = (cat.dados ?? []).filter((e) => e.status === 'Ativo');
  const mesmaCategoria = (categoria: string | null) => ativos.filter((e) => !categoria || e.categoria === categoria);

  return (
    <>
      <Topo
        titulo={`Editar ${String(p.numero_proposta)}`}
        migalha={<><Link to="/propostas">Propostas</Link> › <Link to={`/propostas/${id}`}>{String(p.numero_proposta)}</Link> › editor · versão {String(p.numero_versao ?? 1)} → {n(p.numero_versao, 1) + 1}</>}
      >
        <SeloStatus status={status} />
        <Link className="botao pequeno" to={`/propostas/${id}`}>Cancelar</Link>
        <button className="botao primario pequeno" onClick={salvar} disabled={!dados.podeEditar || !mudou || erros.length > 0 || salvando}>
          <Save size={16} /> Salvar nova versão
        </button>
      </Topo>
      <div className="conteudo">
        {!dados.podeEditar && <Aviso tipo="erro">Esta proposta está "{status}". Pela RN11, o gestor só edita propostas "Gerada" ou "Em negociação".</Aviso>}
        {erros.length > 0 && <Aviso tipo="erro">{erros.join(' ')}</Aviso>}

        <section className="cartao">
          <h2>Equipamentos</h2>
          <div className="sub">Trocar um equipamento usa o preço de venda atual do catálogo. O ajuste por item fica entre −{num(limite, 0)}% e +{num(limite, 0)}% (limite da empresa).</div>
          <table style={{ marginTop: 12 }}>
            <thead>
              <tr><th>Equipamento</th><th className="direita">Qtd</th><th className="direita">Catálogo</th><th className="direita">Ajuste %</th><th className="direita">Preço unit.</th><th className="direita">Subtotal</th><th /></tr>
            </thead>
            <tbody>
              {itens.map((l, i) => (
                <tr key={`${l.idEquipamento}-${i}`}>
                  <td>
                    <select className="entrada" value={l.idEquipamento} onChange={(e) => trocar(i, e.target.value)} aria-label={`Equipamento do item ${i + 1}`} disabled={!dados.podeEditar}>
                      {!catalogo.has(l.idEquipamento) && <option value={l.idEquipamento}>{l.descricao}</option>}
                      {mesmaCategoria(l.categoria).map((e) => (
                        <option key={e.idEquipamento} value={e.idEquipamento}>{e.fabricante} {e.modelo} — {brl(e.precoVenda)}</option>
                      ))}
                    </select>
                    {l.categoria && <span className="contagem">{l.categoria}</span>}
                  </td>
                  <td className="direita">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <button className="botao pequeno" aria-label="Diminuir" onClick={() => alterar(i, { quantidade: Math.max(1, l.quantidade - 1) })} disabled={!dados.podeEditar}><Minus size={14} /></button>
                      <input className="entrada num" style={{ width: 64, textAlign: 'center' }} inputMode="numeric" value={l.quantidade} aria-label={`Quantidade do item ${i + 1}`}
                        onChange={(e) => alterar(i, { quantidade: Number(e.target.value.replace(/\D/g, '')) || 0 })} disabled={!dados.podeEditar} />
                      <button className="botao pequeno" aria-label="Aumentar" onClick={() => alterar(i, { quantidade: l.quantidade + 1 })} disabled={!dados.podeEditar}><Plus size={14} /></button>
                    </span>
                  </td>
                  <td className="direita num">{brl(l.precoCatalogo)}</td>
                  <td className="direita">
                    <input className="entrada num" style={{ width: 80, textAlign: 'right' }} value={l.ajustePercentual} aria-label={`Ajuste do item ${i + 1}`}
                      onChange={(e) => alterar(i, { ajustePercentual: Number(e.target.value.replace(',', '.')) || 0 })} disabled={!dados.podeEditar} />
                  </td>
                  <td className="direita num">{brl(preco.itens[i]?.precoUnitario)}</td>
                  <td className="direita num forte">{brl(preco.itens[i]?.subtotal)}</td>
                  <td className="direita">
                    <button className="botao perigo pequeno" aria-label="Remover item" onClick={() => remover(i)} disabled={!dados.podeEditar || itens.length === 1}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {dados.podeEditar && (
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <select className="entrada" value={novoId} onChange={(e) => setNovoId(e.target.value)} aria-label="Equipamento a incluir">
                <option value="">Incluir equipamento do catálogo…</option>
                {ativos.filter((e) => !itens.some((l) => l.idEquipamento === e.idEquipamento)).map((e) => (
                  <option key={e.idEquipamento} value={e.idEquipamento}>{e.categoria} · {e.fabricante} {e.modelo} — {brl(e.precoVenda)}</option>
                ))}
              </select>
              <button className="botao" onClick={incluir} disabled={!novoId}><Plus size={16} /> Incluir</button>
            </div>
          )}
        </section>

        <div className="grade g2">
          <section className="cartao">
            <h2>Valores (RN03)</h2>
            <dl className="lista-dl">
              <dt>Equipamentos</dt><dd className="num">{brl(preco.valorEquipamentos)}</dd>
              <dt>Serviços e materiais</dt><dd className="num">{brl(preco.valorServicos)}</dd>
              <dt>Margem ({num(p.margem_percentual)}% sobre serviços)</dt><dd className="num">{brl(preco.valorMargem)}</dd>
              <dt>Valor bruto</dt><dd className="num">{brl(preco.valorBruto)}</dd>
              <dt>
                <label htmlFor="desconto">Desconto comercial (%)</label>
              </dt>
              <dd>
                <input id="desconto" className="entrada num" style={{ width: 100, textAlign: 'right' }} value={descontoAtual}
                  onChange={(e) => setDesconto(Number(e.target.value.replace(',', '.')) || 0)} disabled={!dados.podeEditar} />
              </dd>
              <dt>Desconto</dt><dd className="num">− {brl(preco.valorDesconto)}</dd>
            </dl>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 18, borderTop: '1px solid var(--azul-100)', paddingTop: 14 }}>
              <span className="contagem">Total: antes {brl(p.valor_total)}</span>
              <span style={{ fontSize: 28, fontWeight: 800 }} className="num">{brl(preco.valorTotal)}</span>
            </div>
          </section>
          <section className="cartao">
            <h2>Sistema e viabilidade</h2>
            <dl className="lista-dl">
              <dt>Potência</dt><dd className="num">{num(p.potencia_kwp)} → {num(kwpNovo)} kWp</dd>
              <dt>Geração estimada</dt><dd className="num">{num(geracao, 0)} kWh/mês</dd>
              <dt>Economia mensal</dt><dd className="num">{brl(viab.economiaMensal)}</dd>
              <dt>Payback</dt><dd>{periodo(viab.paybackMeses)}</dd>
              <dt>ROI em 25 anos</dt><dd className="num">{num(viab.roiPercentual, 0)}%</dd>
            </dl>
            <div className="sub" style={{ marginTop: 14 }}>Calculado no navegador com @lumini/domain, a mesma regra do app. Ao salvar, a API confere o total e grava a versão {n(p.numero_versao, 1) + 1}.</div>
          </section>
        </div>
      </div>
    </>
  );
}
