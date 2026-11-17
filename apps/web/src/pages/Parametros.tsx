import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';

import { api, ErroApi } from '../api';
import { Aviso, Carregando, Topo, toast, useDados } from '../components/comum';
import { dataHora } from '../formato';
import type { Parametros as Dados } from '../tipos';

// SCRUM-433 (RF29) — parâmetros comerciais da empresa. O app baixa estes valores
// no login (GET /sync/parametros) e usa na precificação (RN03) e no limite de
// ajuste de preço do técnico (RN06). Cada mudança vai para o Log de Auditoria.

type Campo = Exclude<keyof Dados, 'atualizadoEm' | 'atualizadoPor'>;

const CAMPOS: Array<{ campo: Campo; rotulo: string; ajuda: string; sufixo: string; inteiro?: boolean }> = [
  { campo: 'limiteAjustePrecoPerc', rotulo: 'Limite de ajuste de preço do técnico', ajuda: 'Quanto o técnico pode subir ou baixar o preço de um item na proposta (RN06).', sufixo: '%' },
  { campo: 'margemPadraoPerc', rotulo: 'Margem sobre serviços e materiais', ajuda: 'Aplicada sobre materiais, mão de obra, ART e frete. O preço do equipamento já tem a margem do catálogo (RN03).', sufixo: '%' },
  { campo: 'materiaisEletricosPorKwp', rotulo: 'Materiais elétricos por kWp', ajuda: 'Cabos, proteções e conectores, por kWp instalado.', sufixo: 'R$' },
  { campo: 'maoDeObraPorKwp', rotulo: 'Mão de obra por kWp', ajuda: 'Instalação, por kWp instalado.', sufixo: 'R$' },
  { campo: 'artHomologacaoPadrao', rotulo: 'Projeto, ART e homologação', ajuda: 'Valor fixo por proposta.', sufixo: 'R$' },
  { campo: 'fretePadrao', rotulo: 'Logística e frete', ajuda: 'Valor fixo por proposta.', sufixo: 'R$' },
  { campo: 'validadePadraoDias', rotulo: 'Validade padrão da proposta', ajuda: 'Dias estampados no PDF ("válida até").', sufixo: 'dias', inteiro: true },
];

export function Parametros() {
  const { dados, erro, carregando, setDados } = useDados(() => api.get<Dados>('/admin/parametros'));
  const [form, setForm] = useState<Record<Campo, string> | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (dados) setForm(Object.fromEntries(CAMPOS.map(({ campo }) => [campo, String(dados[campo]).replace('.', ',')])) as Record<Campo, string>);
  }, [dados]);

  if (carregando && !dados) return (<><Topo titulo="Parâmetros comerciais" /><Carregando /></>);
  if (erro || !dados || !form) return (<><Topo titulo="Parâmetros comerciais" /><div className="conteudo"><Aviso tipo="erro">{erro}</Aviso></div></>);

  const numero = (v: string) => Number(v.replace(/\./g, '').replace(',', '.'));
  const mudou = CAMPOS.some(({ campo }) => numero(form[campo]) !== dados[campo]);

  async function salvar() {
    setSalvando(true);
    try {
      const corpo = Object.fromEntries(CAMPOS.map(({ campo }) => [campo, numero(form![campo])]));
      setDados(await api.put<Dados>('/admin/parametros', corpo));
      toast('Parâmetros salvos. Os técnicos recebem no próximo login.');
    } catch (e) {
      toast(e instanceof ErroApi ? e.message : 'Não foi possível salvar.', true);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Topo titulo="Parâmetros comerciais">
        <button className="botao primario" onClick={salvar} disabled={!mudou || salvando}><Save size={16} /> Salvar</button>
      </Topo>
      <div className="conteudo">
        <Aviso>Valores usados pelo app para precificar as propostas novas. Propostas já geradas não mudam; para alterar uma delas, use o editor de proposta.</Aviso>
        <section className="cartao">
          <div className="grade" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {CAMPOS.map(({ campo, rotulo, ajuda, sufixo, inteiro }) => (
              <div key={campo} className="campo">
                <label htmlFor={campo}>{rotulo} <small>{sufixo}</small></label>
                <input id={campo} className="entrada num" inputMode={inteiro ? 'numeric' : 'decimal'} value={form[campo]}
                  onChange={(e) => setForm({ ...form, [campo]: e.target.value })} />
                <span className="contagem">{ajuda}</span>
              </div>
            ))}
          </div>
          {dados.atualizadoEm && <div className="sub" style={{ marginTop: 18 }}>Última alteração em {dataHora(dados.atualizadoEm)}.</div>}
        </section>
      </div>
    </>
  );
}
