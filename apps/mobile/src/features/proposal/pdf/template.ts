import type { Proposal } from '@/domain/entities';
import { categoryLabels, connectionTypeLabels, describePaymentCondition, orientationLabels, roofTypeLabels } from '@/domain/labels';
import { unitPrice } from '@/domain/services/pricing';
import { addDays, formatCurrency, formatDate, formatNumber } from '@/utils/format';

// SCRUM-23 — template da proposta comercial em PDF (RF12 / RNF13), no modelo de
// 3 páginas do protótipo (01_Desing/Telas/02_Proposta):
//   1. capa: empresa, cliente, investimento e validade;
//   2. resumo técnico e equipamentos;
//   3. investimento, retorno (payback, ROI, economia em 25 anos) e CO₂ evitado.
// Função pura: gera o HTML que o expo-print transforma em PDF (pdf.ts).
// Testada em template.test.ts (SCRUM-91).

export interface PdfExtras {
  companyName: string;
  technicianName: string;
  technicianPhone?: string;
}

/** Escapa texto digitado pelo usuário antes de entrar no HTML. */
export function escapeHtml(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const e = escapeHtml;

function paybackText(years: number): string {
  if (!Number.isFinite(years) || years <= 0) return 'acima de 25 anos';
  const total = Math.round(years * 12);
  const a = Math.floor(total / 12);
  const m = total % 12;
  const anos = a === 1 ? '1 ano' : `${a} anos`;
  const meses = m === 1 ? '1 mês' : `${m} meses`;
  return a === 0 ? meses : m === 0 ? anos : `${anos} e ${meses}`;
}

/** Barras da economia acumulada (anos 1, 5, 10, 15, 20, 25) em SVG. */
function savingsChart(proposal: Proposal): string {
  const points = [1, 5, 10, 15, 20, 25].map((year) => ({ year, value: proposal.viability.cumulativeSavings[year - 1] ?? 0 }));
  const max = Math.max(proposal.pricing.total, ...points.map((p) => p.value), 1);
  const w = 480;
  const h = 150;
  const bw = 52;
  const gap = (w - bw * points.length) / (points.length + 1);
  const investY = h - (proposal.pricing.total / max) * (h - 20);
  const bars = points
    .map((p, i) => {
      const bh = (p.value / max) * (h - 20);
      const x = gap + i * (bw + gap);
      const color = p.value >= proposal.pricing.total ? '#16A34A' : '#94A3B8';
      return `<rect x="${x.toFixed(1)}" y="${(h - bh).toFixed(1)}" width="${bw}" height="${bh.toFixed(1)}" rx="4" fill="${color}"/>` +
        `<text x="${(x + bw / 2).toFixed(1)}" y="${h + 14}" text-anchor="middle" font-size="10" fill="#475569">ano ${p.year}</text>`;
    })
    .join('');
  return `<svg width="${w}" height="${h + 20}" viewBox="0 0 ${w} ${h + 20}" xmlns="http://www.w3.org/2000/svg">${bars}` +
    `<line x1="0" x2="${w}" y1="${investY.toFixed(1)}" y2="${investY.toFixed(1)}" stroke="#F97316" stroke-dasharray="5 4" stroke-width="1.5"/>` +
    `<text x="${w}" y="${(investY - 5).toFixed(1)}" text-anchor="end" font-size="10" fill="#C2410C">investimento</text></svg>`;
}

const STYLE = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A; font-size: 11pt; }
  .pagina { width: 210mm; height: 297mm; padding: 18mm 16mm; position: relative; overflow: hidden; page-break-after: always; break-after: page; }
  .pagina:last-child { page-break-after: auto; break-after: auto; }
  .topo { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #F97316; padding-bottom: 8px; margin-bottom: 18px; }
  .marca { font-weight: 800; font-size: 15pt; }
  .marca small { display: block; font-weight: 500; font-size: 9pt; color: #64748B; }
  .num-doc { text-align: right; font-size: 9pt; color: #475569; }
  h1 { font-size: 26pt; margin: 6px 0 4px; line-height: 1.15; word-break: break-word; }
  h2 { font-size: 14pt; margin: 22px 0 10px; }
  .rotulo { color: #C2410C; font-weight: 700; font-size: 9pt; letter-spacing: 0.06em; text-transform: uppercase; }
  .capa-cliente { margin-top: 70mm; }
  .sub { color: #475569; font-size: 10.5pt; word-break: break-word; }
  .destaque { background: #0F172A; color: #fff; border-radius: 10px; padding: 18px 22px; display: flex; justify-content: space-between; align-items: center; margin: 22px 0; }
  .destaque strong { font-size: 22pt; }
  .grade { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .kpi { border: 1px solid #E2E8F0; border-radius: 10px; padding: 10px 12px; }
  .kpi span { display: block; font-size: 8.5pt; color: #64748B; }
  .kpi b { font-size: 13pt; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; table-layout: fixed; }
  th { text-align: left; background: #F1F5F9; padding: 7px 8px; font-size: 8.5pt; color: #334155; }
  td { padding: 7px 8px; border-bottom: 1px solid #E2E8F0; vertical-align: top; word-break: break-word; }
  .dir { text-align: right; white-space: nowrap; }
  .total td { font-weight: 800; font-size: 11pt; border-bottom: none; }
  .verde { background: #F0FDF4; border: 1px solid #BBF7D0; color: #166534; border-radius: 10px; padding: 12px 14px; font-weight: 600; }
  .rodape { position: absolute; left: 16mm; right: 16mm; bottom: 10mm; font-size: 8pt; color: #94A3B8; display: flex; justify-content: space-between; border-top: 1px solid #E2E8F0; padding-top: 6px; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; margin: 0; }
  dt { color: #64748B; }
  dd { margin: 0; text-align: right; font-weight: 600; word-break: break-word; }
`;

export function buildProposalHtml(proposal: Proposal, extras: PdfExtras): string {
  const p = proposal;
  const issued = p.generatedAt ?? p.updatedAt;
  const validUntil = formatDate(addDays(issued, p.validityDays));
  const address = [p.installation.address, p.installation.number].filter(Boolean).join(', ');
  const place = `${p.installation.district ? `${p.installation.district}, ` : ''}${p.installation.city}/${p.installation.state}`;
  const area = p.measurement.sections.reduce((t, s) => t + s.areaM2, 0);
  const pr = p.pricing;
  const v = p.viability;
  const header = `<div class="topo"><div class="marca">${e(extras.companyName)}<small>Proposta comercial de energia solar</small></div>` +
    `<div class="num-doc">${e(p.number)} · versão ${p.version}<br/>Emitida em ${formatDate(new Date(issued))}</div></div>`;
  const footer = (page: number) =>
    `<div class="rodape"><span>${e(extras.companyName)} · Responsável técnico: ${e(extras.technicianName)}${extras.technicianPhone ? ` · ${e(extras.technicianPhone)}` : ''}</span><span>Página ${page} de 3</span></div>`;

  const items = p.items
    .map((item) => {
      const unit = unitPrice(item);
      return `<tr><td>${e(item.name)}<br/><span class="sub">${e(categoryLabels[item.category])}${item.supplier ? ` · ${e(item.supplier)}` : ''}</span></td>` +
        `<td class="dir">${item.quantity}</td><td class="dir">${formatCurrency(unit)}</td><td class="dir">${formatCurrency(unit * item.quantity)}</td></tr>`;
    })
    .join('');
  const sections = p.measurement.sections
    .map((s, i) => `<tr><td>Seção ${i + 1}</td><td class="dir">${formatNumber(s.areaM2, 1)} m²</td><td class="dir">${formatNumber(s.inclinationDeg, 0)}°</td><td>${e(orientationLabels[s.orientation] ?? s.orientation)}</td></tr>`)
    .join('');

  const capa = `<section class="pagina">${header}
    <div class="capa-cliente">
      <div class="rotulo">Preparada para</div>
      <h1>${e(p.client.name)}</h1>
      <div class="sub">${e(address)}${address ? ' — ' : ''}${e(place)}</div>
    </div>
    <div class="destaque"><span>Investimento total</span><strong>${formatCurrency(pr.total)}</strong></div>
    <div class="grade">
      <div class="kpi"><span>Potência do sistema</span><b>${formatNumber(p.systemKwp, 2)} kWp</b></div>
      <div class="kpi"><span>Geração estimada</span><b>${formatNumber(p.monthlyGenerationKwh, 0)} kWh/mês</b></div>
      <div class="kpi"><span>Economia mensal estimada</span><b>${formatCurrency(v.monthlySavings)}</b></div>
      <div class="kpi"><span>Retorno do investimento</span><b>${paybackText(v.paybackYears)}</b></div>
    </div>
    <p class="sub" style="margin-top:18px">Proposta válida até <b>${validUntil}</b> (${p.validityDays} dias).</p>
    ${footer(1)}</section>`;

  const tecnica = `<section class="pagina">${header}
    <h2>Resumo técnico</h2>
    <dl>
      <dt>Consumo médio do cliente</dt><dd>${formatNumber(p.installation.monthlyConsumptionKwh, 0)} kWh/mês</dd>
      <dt>Tarifa considerada</dt><dd>${formatCurrency(p.installation.tariffPerKwh)}/kWh</dd>
      <dt>Potência instalada</dt><dd>${formatNumber(p.systemKwp, 2)} kWp${p.sizing.moduleCount ? ` (${p.sizing.moduleCount} módulos)` : ''}</dd>
      <dt>Geração estimada</dt><dd>${formatNumber(p.monthlyGenerationKwh, 0)} kWh/mês</dd>
      <dt>Perdas consideradas</dt><dd>${formatNumber(p.sizing.losses.totalPct, 1)}% (temperatura, sujeira, cabeamento e sombreamento de ${formatNumber(p.shadingPct, 1)}%)</dd>
      <dt>Ligação / telhado</dt><dd>${e(connectionTypeLabels[p.installation.connectionType])} · ${e(roofTypeLabels[p.installation.roofType])}</dd>
      <dt>Medição do telhado</dt><dd>${p.measurement.source === 'RA' ? 'Realidade Aumentada' : 'Manual'} · ${formatNumber(area, 1)} m²</dd>
    </dl>
    ${sections ? `<h2>Seções do telhado</h2><table><thead><tr><th>Seção</th><th class="dir">Área</th><th class="dir">Inclinação</th><th>Orientação</th></tr></thead><tbody>${sections}</tbody></table>` : ''}
    <h2>Equipamentos</h2>
    <table><thead><tr><th style="width:52%">Item</th><th class="dir">Qtd</th><th class="dir">Preço unit.</th><th class="dir">Subtotal</th></tr></thead>
    <tbody>${items}<tr class="total"><td colspan="3">Total em equipamentos</td><td class="dir">${formatCurrency(pr.equipment)}</td></tr></tbody></table>
    ${footer(2)}</section>`;

  const financeira = `<section class="pagina">${header}
    <h2>Investimento</h2>
    <table><tbody>
      <tr><td>Equipamentos</td><td class="dir">${formatCurrency(pr.equipment)}</td></tr>
      <tr><td>Materiais elétricos</td><td class="dir">${formatCurrency(pr.electricalMaterials)}</td></tr>
      <tr><td>Mão de obra</td><td class="dir">${formatCurrency(pr.labor)}</td></tr>
      <tr><td>Projeto, ART e homologação</td><td class="dir">${formatCurrency(pr.projectAndApproval)}</td></tr>
      <tr><td>Logística e frete</td><td class="dir">${formatCurrency(pr.freight)}</td></tr>
      <tr><td>Margem</td><td class="dir">${formatCurrency(pr.margin)}</td></tr>
      ${pr.commercialDiscount > 0 ? `<tr><td>Desconto comercial</td><td class="dir">− ${formatCurrency(pr.commercialDiscount)}</td></tr>` : ''}
      <tr class="total"><td>Investimento total</td><td class="dir">${formatCurrency(pr.total)}</td></tr>
    </tbody></table>
    <p class="sub">Condição de pagamento: <b>${e(describePaymentCondition(p.paymentCondition, pr.total, formatCurrency))}</b></p>
    <h2>Retorno do investimento</h2>
    <div class="grade">
      <div class="kpi"><span>Payback</span><b>${paybackText(v.paybackYears)}</b></div>
      <div class="kpi"><span>ROI em 25 anos</span><b>${formatNumber(v.roiPct, 0)}%</b></div>
      <div class="kpi"><span>Economia acumulada em 25 anos</span><b>${formatCurrency(v.savings25y, 0)}</b></div>
      <div class="kpi"><span>CO₂ evitado</span><b>${formatNumber(v.co2AvoidedTon, 1)} t em 25 anos</b></div>
    </div>
    <h2>Economia acumulada</h2>
    ${savingsChart(p)}
    <p class="verde" style="margin-top:14px">Economia estimada de ${formatCurrency(v.monthlySavings)} por mês na conta de energia.</p>
    <p class="sub" style="font-size:8.5pt">Valores estimados a partir do consumo informado, da irradiação solar da localidade e da tarifa vigente. Proposta válida até ${validUntil}.</p>
    ${footer(3)}</section>`;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><title>${e(p.number)}</title><style>${STYLE}</style></head><body>${capa}${tecnica}${financeira}</body></html>`;
}
