import { describe, expect, it } from 'vitest';

import { seedProposals } from '@/data/mock/proposals';
import { propostasDoServidor } from './doServidor';
import { registrosDaProposta } from './registros';

const ctx = { idEmpresa: 'emp-001', idUsuario: 'tec-001' };

describe('propostasDoServidor (pull → histórico do app)', () => {
  it('reconstrói a proposta a partir dos registros que o app envia', () => {
    const original = seedProposals.find((p) => p.items.length > 0 && p.measurement.sections.length > 0)!;
    const registros = registrosDaProposta(original, ctx).map((e) => ({ entidade: e.entidade, versao: e.versao }));
    const [volta] = propostasDoServidor(registros);
    expect(volta.id).toBe(original.id);
    expect(volta.number).toBe(original.number);
    expect(volta.status).toBe(original.status);
    expect(volta.client.name).toBe(original.client.name);
    expect(volta.installation.city).toBe(original.installation.city);
    expect(volta.installation.connectionType).toBe(original.installation.connectionType);
    expect(volta.measurement.sections).toHaveLength(original.measurement.sections.length);
    expect(volta.items).toHaveLength(original.items.length);
    expect(volta.items[0].equipmentId).toBe(original.items[0].equipmentId);
    expect(volta.pricing.total).toBeCloseTo(original.pricing.total, 1);
    expect(volta.systemKwp).toBeCloseTo(original.systemKwp, 2);
    expect(volta.syncStatus).toBe('sincronizado');
  });

  it('ignora registros soltos e devolve lista vazia sem propostas', () => {
    expect(propostasDoServidor([])).toEqual([]);
  });
});
