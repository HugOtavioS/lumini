import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { Printer } from 'lucide-react';

import { api } from '../api';
import { Aviso, Carregando, useDados } from '../components/comum';
import { brl, data, num, periodo } from '../formato';
import type { DetalheProposta, Resumo } from '../tipos';

// SCRUM-422 — "novo PDF" depois da edição/aprovação no painel. A página segue o
// modelo de 3 páginas do protótipo (02_Proposta) e é impressa pelo navegador
// ("Salvar como PDF"), sem biblioteca extra. Abre fora do menu lateral.

const n = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);

export function PropostaPdf() {
  const { id = '' } = useParams();
  const det = useDados(() => api.get<DetalheProposta>(`/admin/propostas/${id}`), [id]);
  const resumo = useDados(() => api.get<Resumo>('/admin/resumo'));
  const pronto = !!det.dados && !!resumo.dados;
  useEffect(() => {
    if (pronto) document.title = `Proposta ${String(det.dados!.proposta.numero_proposta)} v${String(det.dados!.proposta.numero_versao ?? 1)}`;
  }, [pronto, det.dados]);

  if (det.carregando || resumo.carregando) return <Carregando />;
  if (!det.dados) return <div className="conteudo"><Aviso tipo="erro">{det.erro}</Aviso></div>;
  const { proposta: p, cliente, instalacao, medicoes, tecnico } = det.dados;
  const c = cliente ?? {};
  const ins = instalacao ?? {};
  const empresa = resumo.dados?.empresa;
  const validade = typeof p.data_geracao === 'string' ? new Date(Date.parse(p.data_geracao) + n(p.validade_dias || 15) * 86_400_000).toISOString() : null;
  const area = medicoes.reduce((t, m) => t + n(m.area_m2), 0);
  const payback = periodo(p.payback_meses);
  const bruto = n(p.valor_equipamentos) + n(p.valor_materiais_eletricos) + n(p.valor_mao_de_obra) + n(p.valor_art_homologacao) + n(p.valor_logistica_frete) + n(p.valor_margem);

  return (
    <div className="pdf">
      <div className="pdf-barra">
        <Link className="botao pequeno" to={`/propostas/${id}`}>Voltar</Link>
        <button className="botao primario pequeno" onClick={() => window.print()}><Printer size={16} /> Imprimir / salvar PDF</button>
      </div>

      <section className="pdf-pagina pdf-capa">
        <div className="pdf-marca">{empresa?.nome ?? 'Lumini'}</div>
        <div>
          <div className="rotulo-laranja">Proposta comercial de energia solar</div>
          <h1>{String(c.nome_razao_social ?? 'Cliente')}</h1>
          <p>{[ins.logradouro, ins.numero].filter(Boolean).join(', ')}{ins.cidade ? ` — ${String(ins.cidade)}/${String(ins.estado ?? '')}` : ''}</p>
        </div>
        <dl className="lista-dl">
          <dt>Proposta</dt><dd>{String(p.numero_proposta)} · versão {String(p.numero_versao ?? 1)}</dd>
          <dt>Emissão</dt><dd>{data(p.data_geracao)}</dd>
          <dt>Válida até</dt><dd>{data(validade)}</dd>
          <dt>Responsável técnico</dt><dd>{tecnico?.nome ?? '—'}</dd>
          <dt>Situação</dt><dd>{String(p.status_proposta)}</dd>
        </dl>
      </section>

      <section className="pdf-pagina">
        <h2>Resumo técnico</h2>
        <dl className="lista-dl">
          <dt>Potência do sistema</dt><dd>{num(p.potencia_kwp)} kWp</dd>
          <dt>Geração estimada</dt><dd>{num(p.geracao_estimada_kwh_mes, 0)} kWh/mês</dd>
          <dt>Consumo do cliente</dt><dd>{num(ins.consumo_mensal_kwh, 0)} kWh/mês</dd>
          <dt>Perdas totais</dt><dd>{num(p.perdas_totais_perc, 1)}%</dd>
          <dt>Área de telhado medida</dt><dd>{num(area, 1)} m²</dd>
          <dt>Ligação / telhado</dt><dd>{String(ins.tipo_ligacao ?? '—')} · {String(ins.tipo_telhado ?? '—')}</dd>
        </dl>
        <h2 style={{ marginTop: 28 }}>Equipamentos</h2>
        <table>
          <thead><tr><th>Item</th><th className="direita">Qtd</th><th className="direita">Preço unit.</th><th className="direita">Subtotal</th></tr></thead>
          <tbody>
            {p.itens.map((i) => (
              <tr key={String(i.id_item)}><td>{String(i.descricao)}</td><td className="direita">{num(i.quantidade, 0)}</td><td className="direita">{brl(i.preco_unitario)}</td><td className="direita">{brl(i.subtotal)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="pdf-pagina">
        <h2>Investimento e retorno</h2>
        <dl className="lista-dl">
          <dt>Equipamentos</dt><dd>{brl(p.valor_equipamentos)}</dd>
          <dt>Materiais elétricos</dt><dd>{brl(p.valor_materiais_eletricos)}</dd>
          <dt>Mão de obra</dt><dd>{brl(p.valor_mao_de_obra)}</dd>
          <dt>Projeto, ART e homologação</dt><dd>{brl(p.valor_art_homologacao)}</dd>
          <dt>Logística e frete</dt><dd>{brl(p.valor_logistica_frete)}</dd>
          <dt>Margem</dt><dd>{brl(p.valor_margem)}</dd>
          {n(p.desconto_comercial_perc) > 0 && (<><dt>Desconto comercial ({num(p.desconto_comercial_perc)}%)</dt><dd>− {brl(bruto - n(p.valor_total))}</dd></>)}
        </dl>
        <div className="pdf-total"><span>Investimento total</span><strong>{brl(p.valor_total)}</strong></div>
        <dl className="lista-dl">
          <dt>Economia mensal estimada</dt><dd>{brl(p.economia_mensal_estimada)}</dd>
          <dt>Retorno do investimento (payback)</dt><dd>{payback}</dd>
          <dt>ROI em 25 anos</dt><dd>{num(p.roi_percentual, 0)}%</dd>
          <dt>Condição de pagamento</dt><dd>{String(p.condicao_pagamento ?? '—')}</dd>
        </dl>
        <p className="contagem" style={{ marginTop: 24 }}>
          Valores estimados com base no consumo informado, na irradiação da localidade e nas tarifas vigentes. Proposta válida até {data(validade)}.
        </p>
      </section>
    </div>
  );
}
