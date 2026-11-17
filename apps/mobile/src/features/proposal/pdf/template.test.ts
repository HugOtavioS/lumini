import { describe, expect, it } from 'vitest';

import { seedProposals } from '@/data/mock/proposals';
import { unitPrice } from '@/domain/services/pricing';
import { formatCurrency } from '@/utils/format';
import { buildProposalHtml, escapeHtml } from './template';

// SCRUM-91 — o PDF mostra os valores certos e não estoura o layout.

const extras = { companyName: 'Solar Vale Energia', technicianName: 'Carlos Campos', technicianPhone: '(12) 99999-0000' };
const base = seedProposals.find((p) => p.items.length > 0 && p.generatedAt)!;

describe('template do PDF da proposta', () => {
  it('tem exatamente 3 páginas A4, cada uma com quebra de página', () => {
    const html = buildProposalHtml(base, extras);
    expect(html.match(/<section class="pagina">/g)).toHaveLength(3);
    expect(html).toContain('@page { size: A4');
    expect(html).toContain('page-break-after: always');
    expect(html).toContain('Página 3 de 3');
  });

  it('mostra os valores calculados da proposta (total, itens, payback, validade)', () => {
    const html = buildProposalHtml(base, extras);
    expect(html).toContain(formatCurrency(base.pricing.total));
    expect(html).toContain(formatCurrency(base.pricing.equipment));
    for (const item of base.items) {
      expect(html).toContain(formatCurrency(unitPrice(item) * item.quantity));
    }
    expect(html).toContain('Proposta válida até');
    expect(html).toContain(`versão ${base.version}`);
    expect(html).toContain('Solar Vale Energia');
    expect(html).toContain('Carlos Campos');
  });

  it('desconto comercial só aparece quando existe', () => {
    expect(buildProposalHtml(base, extras)).not.toContain('Desconto comercial');
    const comDesconto = { ...base, pricing: { ...base.pricing, commercialDiscount: 500, total: base.pricing.total - 500 } };
    expect(buildProposalHtml(comDesconto, extras)).toContain(`− ${formatCurrency(500)}`);
  });

  it('escapa o texto digitado (nome do cliente com HTML não vira código)', () => {
    const malicioso = { ...base, client: { ...base.client, name: '<script>alert(1)</script> & Cia' } };
    const html = buildProposalHtml(malicioso, extras);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; Cia');
    expect(escapeHtml(`"aspas" e 'apóstrofo'`)).toBe('&quot;aspas&quot; e &#39;apóstrofo&#39;');
  });

  it('textos longos quebram linha em vez de estourar a página', () => {
    const longo = { ...base, client: { ...base.client, name: 'Condomínio Residencial '.repeat(12) } };
    const html = buildProposalHtml(longo, extras);
    // Página com altura fixa, conteúdo cortado e quebra de palavras longas.
    expect(html).toMatch(/\.pagina \{[^}]*height: 297mm;[^}]*overflow: hidden;/);
    expect(html).toMatch(/h1 \{[^}]*word-break: break-word;/);
    expect(html).toMatch(/td \{[^}]*word-break: break-word;/);
  });

  it('payback fora do horizonte aparece por extenso', () => {
    const semRetorno = { ...base, viability: { ...base.viability, paybackYears: Infinity } };
    expect(buildProposalHtml(semRetorno, extras)).toContain('acima de 25 anos');
  });
});
