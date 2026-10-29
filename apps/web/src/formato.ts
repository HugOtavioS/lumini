const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const moedaCurta = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export const brl = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? moeda.format(v) : '—');
export const brlCurto = (v: number) =>
  v >= 1_000_000 ? `R$ ${numero.format(v / 1_000_000)} mi` : v >= 10_000 ? `R$ ${numero.format(Math.round(v / 1000))} mil` : moedaCurta.format(v);
export const num = (v: unknown, casas = 2) =>
  typeof v === 'number' && Number.isFinite(v) ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: casas }).format(v) : '—';
export const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${num(v * 100, 0)}%`);

export const data = (iso: unknown) => (typeof iso === 'string' && iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
export const dataHora = (iso: unknown) =>
  typeof iso === 'string' && iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export function haQuanto(iso: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

export const mesCurto = (chave: string) => {
  const [a, m] = chave.split('-').map(Number);
  return new Date(a!, (m ?? 1) - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
};

export const telefone = (digitos: unknown) => {
  const d = String(digitos ?? '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d || '—';
};

export const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
