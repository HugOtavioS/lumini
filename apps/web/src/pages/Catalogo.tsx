import { useMemo, useState } from 'react';
import { Eye, EyeOff, Info, Pencil, Plus, Search } from 'lucide-react';
import { calcularPrecoVenda, validarEquipamento, type CategoriaEquipamento, type Equipamento } from '@lumini/domain';

import { api, ErroApi } from '../api';
import { Aviso, Carregando, Modal, Topo, toast, useDados } from '../components/comum';
import { brl, data, num } from '../formato';

const FILTROS: Array<{ rotulo: string; categorias: CategoriaEquipamento[] | null }> = [
  { rotulo: 'Todos', categorias: null },
  { rotulo: 'Módulos', categorias: ['Módulo'] },
  { rotulo: 'Inversores', categorias: ['Inversor'] },
  { rotulo: 'Estruturas', categorias: ['Estrutura'] },
  { rotulo: 'String box, cabos e conectores', categorias: ['String Box', 'Cabos', 'Conectores'] },
];

function especificacao(e: Equipamento): string {
  if (e.categoria === 'Módulo') return [`${num(e.potenciaW, 0)} Wp`, e.eficienciaPerc ? `eficiência ${num(e.eficienciaPerc, 1)}%` : null].filter(Boolean).join(' · ');
  if (e.categoria === 'Inversor') return [`${num((e.potenciaW ?? 0) / 1000, 1)} kW`, e.qtdMppt ? `${e.qtdMppt} MPPT` : null, e.fases].filter(Boolean).join(' · ');
  const esp = e.especificacoes ? Object.entries(e.especificacoes).slice(0, 2).map(([k, v]) => `${k}: ${v}`) : [];
  return esp.join(' · ') || `vendido por ${e.unidadeVenda}`;
}

/** Preço de venda editável com duplo clique (protótipo "Web Catálogo"): ajusta a margem, mantendo o custo. */
function PrecoEditavel({ item, aoSalvar }: { item: Equipamento; aoSalvar: (venda: number) => Promise<void> }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState('');
  async function concluir() {
    const venda = Number(valor.replace(/\./g, '').replace(',', '.'));
    setEditando(false);
    if (Number.isFinite(venda) && venda > 0 && Math.abs(venda - item.precoVenda) > 0.004) await aoSalvar(venda);
  }
  if (!editando) {
    return (
      <span className="preco-editavel num" title="Clique duas vezes para editar" onDoubleClick={() => { setValor(item.precoVenda.toFixed(2).replace('.', ',')); setEditando(true); }}>
        {brl(item.precoVenda)}
      </span>
    );
  }
  return (
    <span className="preco-editavel editando">
      R$ <input autoFocus value={valor} onChange={(e) => setValor(e.target.value)} onBlur={concluir} onKeyDown={(e) => { if (e.key === 'Enter') void concluir(); if (e.key === 'Escape') setEditando(false); }} aria-label="Preço de venda" />
    </span>
  );
}

export function Catalogo() {
  const { dados, erro, carregando, recarregar } = useDados(() => api.get<Equipamento[]>('/admin/equipamentos'));
  const [filtro, setFiltro] = useState(0);
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<Partial<Equipamento> | null>(null);

  const itens = useMemo(() => {
    const cats = FILTROS[filtro]!.categorias;
    const termo = busca.trim().toLowerCase();
    return (dados ?? []).filter((e) => !cats || cats.includes(e.categoria)).filter((e) => !termo || `${e.fabricante} ${e.modelo} ${e.fornecedor}`.toLowerCase().includes(termo));
  }, [dados, filtro, busca]);

  async function salvar(id: string, mudanca: Partial<Equipamento>, mensagem: string) {
    try {
      await api.put(`/admin/equipamentos/${id}`, mudanca);
      toast(mensagem);
      await recarregar();
    } catch (e) {
      toast(e instanceof ErroApi ? e.message : 'Não foi possível salvar.', true);
    }
  }

  return (
    <>
      <Topo titulo="Catálogo de equipamentos">
        <button className="botao primario" onClick={() => setEditando({ categoria: 'Módulo', unidadeVenda: 'un', margemPercentual: 20, status: 'Ativo' })}>
          <Plus size={18} /> Adicionar item
        </button>
      </Topo>
      <div className="conteudo">
        <div className="filtros">
          {FILTROS.map((f, i) => (
            <button key={f.rotulo} className={`chip ${i === filtro ? 'ativo' : ''}`} onClick={() => setFiltro(i)}>{f.rotulo}</button>
          ))}
          <label className="busca" style={{ marginLeft: 'auto' }}>
            <Search size={17} />
            <input className="entrada" placeholder="Buscar equipamento…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </label>
          <span className="contagem">{dados?.length ?? 0} itens cadastrados</span>
        </div>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {carregando && !dados ? <Carregando /> : (
          <div className="tabela-caixa">
            <table>
              <thead>
                <tr><th>Tipo</th><th>Equipamento</th><th>Fornecedor</th><th>Especificação</th><th className="direita">Custo · margem</th><th>Preço de venda (editável)</th><th>Atualizado</th><th /></tr>
              </thead>
              <tbody>
                {itens.map((e) => (
                  <tr key={e.idEquipamento} style={e.status === 'Oculto' ? { opacity: 0.55 } : undefined}>
                    <td><span className={`selo cat ${e.categoria}`} style={!['Módulo', 'Inversor'].includes(e.categoria) ? { background: 'var(--azul-100)', color: 'var(--azul-600)' } : undefined}>{e.categoria}</span></td>
                    <td className="forte">{e.fabricante} {e.modelo}</td>
                    <td>{e.fornecedor}</td>
                    <td className="contagem">{especificacao(e)}</td>
                    <td className="direita num contagem">{brl(e.precoCusto)} · {num(e.margemPercentual, 1)}%</td>
                    <td><PrecoEditavel item={e} aoSalvar={(venda) => salvar(e.idEquipamento, { margemPercentual: Math.round(((venda / e.precoCusto - 1) * 100) * 100) / 100 }, 'Preço atualizado. Os técnicos recebem na próxima sincronização.')} /></td>
                    <td className="mono contagem">{data(e.updatedAt)}</td>
                    <td className="direita" style={{ whiteSpace: 'nowrap' }}>
                      <button className="botao pequeno" title={e.status === 'Ativo' ? 'Ocultar dos técnicos' : 'Mostrar aos técnicos'} onClick={() => salvar(e.idEquipamento, { status: e.status === 'Ativo' ? 'Oculto' : 'Ativo' }, e.status === 'Ativo' ? 'Item oculto para os técnicos.' : 'Item visível para os técnicos.')}>
                        {e.status === 'Ativo' ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>{' '}
                      <button className="botao pequeno" title="Editar" onClick={() => setEditando(e)}><Pencil size={16} /></button>
                    </td>
                  </tr>
                ))}
                {itens.length === 0 && <tr><td colSpan={8} className="vazio">Nenhum equipamento encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <div className="aviso"><Info size={18} style={{ flex: 'none', marginTop: 2 }} /><div>Dica: clique duas vezes no preço para editar. O custo fica, e a margem é recalculada. Itens ocultos não aparecem para os técnicos.</div></div>
      </div>
      {editando && <FormEquipamento inicial={editando} aoFechar={() => setEditando(null)} aoSalvar={async () => { setEditando(null); await recarregar(); }} />}
    </>
  );
}

type CampoNum = { chave: keyof Equipamento; rotulo: string };
const CAMPOS_MODULO: CampoNum[] = [
  { chave: 'potenciaW', rotulo: 'Potência (W)' }, { chave: 'eficienciaPerc', rotulo: 'Eficiência (%)' },
  { chave: 'vocV', rotulo: 'Tensão Voc (V)' }, { chave: 'vmpV', rotulo: 'Tensão Vmp (V)' },
  { chave: 'iscA', rotulo: 'Corrente Isc (A)' }, { chave: 'impA', rotulo: 'Corrente Imp (A)' },
  { chave: 'coefTempVocPercC', rotulo: 'Coef. temp. Voc (%/°C)' }, { chave: 'comprimentoMm', rotulo: 'Comprimento (mm)' },
  { chave: 'larguraMm', rotulo: 'Largura (mm)' },
];
const CAMPOS_INVERSOR: CampoNum[] = [
  { chave: 'potenciaW', rotulo: 'Potência CA (W)' }, { chave: 'tensaoMaxEntradaV', rotulo: 'Tensão máx. de entrada (V)' },
  { chave: 'faixaMpptMinV', rotulo: 'MPPT mínimo (V)' }, { chave: 'faixaMpptMaxV', rotulo: 'MPPT máximo (V)' },
  { chave: 'qtdMppt', rotulo: 'Quantidade de MPPT' }, { chave: 'stringsPorMppt', rotulo: 'Strings por MPPT' },
  { chave: 'correnteMaxEntradaA', rotulo: 'Corrente máx. por MPPT (A)' },
];

function FormEquipamento({ inicial, aoFechar, aoSalvar }: { inicial: Partial<Equipamento>; aoFechar: () => void; aoSalvar: () => Promise<void> }) {
  const [f, setF] = useState<Partial<Equipamento>>(inicial);
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const novo = !inicial.idEquipamento;
  const custo = Number(f.precoCusto);
  const margem = Number(f.margemPercentual ?? 0);
  const venda = custo > 0 ? calcularPrecoVenda(custo, margem) : null;
  const campos = f.categoria === 'Módulo' ? CAMPOS_MODULO : f.categoria === 'Inversor' ? CAMPOS_INVERSOR : [];
  const definir = (chave: keyof Equipamento, valor: unknown) => setF((atual) => ({ ...atual, [chave]: valor }));
  const numero = (texto: string) => (texto.trim() === '' ? null : Number(texto.replace(',', '.')));

  async function enviar() {
    // Mesma validação da API (@lumini/domain), para avisar antes de enviar.
    const completo = { ...f, idEquipamento: f.idEquipamento ?? 'novo', idEmpresa: '-', precoVenda: venda ?? NaN, garantiaAnos: f.garantiaAnos ?? null, potenciaW: f.potenciaW ?? null, createdAt: '', updatedAt: '', updatedBy: '' } as Equipamento;
    const problemas = validarEquipamento(completo).map((e) => e.mensagem);
    setErros(problemas);
    if (problemas.length > 0) return;
    setSalvando(true);
    try {
      if (novo) await api.post('/admin/equipamentos', f);
      else await api.put(`/admin/equipamentos/${inicial.idEquipamento}`, f);
      toast(novo ? 'Equipamento adicionado ao catálogo.' : 'Equipamento atualizado.');
      await aoSalvar();
    } catch (e) {
      setErros([e instanceof ErroApi ? e.message : 'Não foi possível salvar.']);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={novo ? 'Adicionar equipamento' : `Editar ${inicial.fabricante} ${inicial.modelo}`} aoFechar={aoFechar}>
      <div className="secao-titulo">Identificação do produto</div>
      <div className="formulario" style={{ marginTop: 0 }}>
        <div className="campo inteiro">
          <label>Categoria</label>
          <select className="entrada" value={f.categoria} onChange={(e) => definir('categoria', e.target.value)} disabled={!novo}>
            {['Módulo', 'Inversor', 'Estrutura', 'String Box', 'Cabos', 'Conectores'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="campo"><label>Fabricante / marca</label><input className="entrada" value={f.fabricante ?? ''} onChange={(e) => definir('fabricante', e.target.value)} /></div>
        <div className="campo"><label>Modelo</label><input className="entrada" value={f.modelo ?? ''} onChange={(e) => definir('modelo', e.target.value)} /></div>
        <div className="campo"><label>Fornecedor</label><input className="entrada" value={f.fornecedor ?? ''} onChange={(e) => definir('fornecedor', e.target.value)} /></div>
        <div className="campo">
          <label>Unidade de venda</label>
          <select className="entrada" value={f.unidadeVenda ?? 'un'} onChange={(e) => definir('unidadeVenda', e.target.value)}>
            {['un', 'm', 'par', 'kit'].map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>
      {campos.length > 0 && (
        <>
          <div className="secao-titulo">Especificações técnicas — {f.categoria}</div>
          <div className="formulario" style={{ marginTop: 0 }}>
            {campos.map((c) => (
              <div className="campo" key={c.chave}><label>{c.rotulo}</label><input className="entrada" inputMode="decimal" value={f[c.chave] === null || f[c.chave] === undefined ? '' : String(f[c.chave])} onChange={(e) => definir(c.chave, numero(e.target.value))} /></div>
            ))}
            {f.categoria === 'Inversor' && (
              <div className="campo">
                <label>Fases</label>
                <select className="entrada" value={f.fases ?? ''} onChange={(e) => definir('fases', e.target.value || null)}>
                  <option value="">Selecione</option>{['Monofásico', 'Bifásico', 'Trifásico'].map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
            )}
          </div>
        </>
      )}
      <div className="secao-titulo">Dados comerciais</div>
      <div className="formulario" style={{ marginTop: 0 }}>
        <div className="campo"><label>Preço de custo (R$) <small>só o gestor vê</small></label><input className="entrada" inputMode="decimal" value={f.precoCusto ?? ''} onChange={(e) => definir('precoCusto', numero(e.target.value))} /></div>
        <div className="campo"><label>Margem (%)</label><input className="entrada" inputMode="decimal" value={f.margemPercentual ?? ''} onChange={(e) => definir('margemPercentual', numero(e.target.value))} /></div>
        <div className="campo"><label>Garantia (anos)</label><input className="entrada" inputMode="numeric" value={f.garantiaAnos ?? ''} onChange={(e) => definir('garantiaAnos', numero(e.target.value))} /></div>
        <div className="campo inteiro">
          <label>Preço de venda</label>
          <div className="caixa-verde"><span style={{ fontSize: 22, fontWeight: 800 }}>{venda ? brl(venda) : '—'}</span><div style={{ fontWeight: 500, fontSize: 13 }}>Calculado automaticamente · é o preço que o técnico vê no app</div></div>
        </div>
        <label className="interruptor inteiro">
          <span><strong>Disponível para os técnicos</strong><br /><small className="contagem">Aparece na seleção de equipamentos do app</small></span>
          <input type="checkbox" checked={f.status !== 'Oculto'} onChange={(e) => definir('status', e.target.checked ? 'Ativo' : 'Oculto')} />
        </label>
      </div>
      {erros.length > 0 && <div className="aviso erro"><ul style={{ margin: 0, paddingLeft: 18 }}>{erros.map((e) => <li key={e}>{e}</li>)}</ul></div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="botao" onClick={aoFechar}>Cancelar</button>
        <button className="botao primario" onClick={enviar} disabled={salvando}>{novo ? 'Salvar e adicionar' : 'Salvar'}</button>
      </div>
    </Modal>
  );
}
