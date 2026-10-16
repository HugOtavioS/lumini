import type { ConnectionType, DomainAlert, ProposalItem } from '../entities';
import { technicalParameters } from '../parameters';
import { formatNumber } from '@/utils/format';

export interface CompatibilityResult {
  selectedKwp: number;
  inverterKw: number;
  moduleCount: number;
  alerts: DomainAlert[];
  /** Há erro que bloqueia a confirmação (RF09, 4a). */
  blocking: boolean;
  /** Potência muito diferente da dimensionada: exige confirmação explícita (RF09, 4b). */
  needsConfirmation: boolean;
}

/**
 * Validação da seleção feita pelo técnico (RF09 / D09). O app não sugere kit:
 * apenas compara a potência selecionada com a dimensionada e alerta sobre
 * incompatibilidades elétricas.
 */
export function checkCompatibility(
  items: ProposalItem[],
  requiredKwp: number,
  connectionType: ConnectionType,
): CompatibilityResult {
  const { maxDcAcRatio, minDcAcRatio, selectedPowerTolerancePct } = technicalParameters;
  const modules = items.filter((item) => item.category === 'modulo');
  const inverters = items.filter((item) => item.category === 'inversor');
  const structures = items.filter((item) => item.category === 'estrutura');

  const moduleCount = sum(modules.map((m) => m.quantity));
  const selectedKwp = sum(modules.map((m) => ((m.powerW ?? 0) * m.quantity) / 1000));
  const inverterKw = sum(inverters.map((i) => ((i.powerW ?? 0) * i.quantity) / 1000));
  const alerts: DomainAlert[] = [];

  if (modules.length === 0) {
    alerts.push({ level: 'error', code: 'sem_modulo', message: 'Adicione ao menos um módulo solar.' });
  }
  if (inverters.length === 0) {
    alerts.push({ level: 'error', code: 'sem_inversor', message: 'Adicione ao menos um inversor.' });
  }

  if (connectionType !== 'trifasica' && inverters.some((i) => i.phases === 3)) {
    alerts.push({
      level: 'error',
      code: 'fases_incompativeis',
      message: 'Inversor trifásico incompatível com a ligação do cliente. Escolha um inversor monofásico ou altere o tipo de ligação.',
    });
  }

  if (selectedKwp > 0 && inverterKw > 0) {
    const ratio = selectedKwp / inverterKw;
    if (ratio > maxDcAcRatio) {
      alerts.push({
        level: 'warning',
        code: 'inversor_subdimensionado',
        message: `Atenção: o inversor selecionado (${formatNumber(inverterKw, 1)} kW) pode ser insuficiente para a potência do sistema (${formatNumber(selectedKwp, 2)} kWp). Considere um inversor de maior capacidade para garantir eficiência e segurança.`,
      });
    } else if (ratio < minDcAcRatio) {
      alerts.push({
        level: 'warning',
        code: 'inversor_superdimensionado',
        message: `O inversor (${formatNumber(inverterKw, 1)} kW) está superdimensionado para ${formatNumber(selectedKwp, 2)} kWp de módulos.`,
      });
    }
  }

  const structureCount = sum(structures.map((s) => s.quantity));
  if (structures.length > 0 && structureCount < moduleCount) {
    alerts.push({
      level: 'warning',
      code: 'estrutura_insuficiente',
      message: `Quantidade de estruturas (${structureCount}) menor que a de módulos (${moduleCount}).`,
    });
  }

  let needsConfirmation = false;
  if (selectedKwp > 0 && requiredKwp > 0) {
    const deviationPct = (selectedKwp / requiredKwp - 1) * 100;
    if (Math.abs(deviationPct) > selectedPowerTolerancePct) {
      needsConfirmation = true;
      alerts.push({
        level: 'warning',
        code: 'potencia_divergente',
        message: `A potência selecionada (${formatNumber(selectedKwp, 2)} kWp) está ${formatNumber(Math.abs(deviationPct), 0)}% ${deviationPct > 0 ? 'acima' : 'abaixo'} da dimensionada (${formatNumber(requiredKwp, 2)} kWp).`,
      });
    }
  }

  return {
    selectedKwp,
    inverterKw,
    moduleCount,
    alerts,
    blocking: alerts.some((a) => a.level === 'error'),
    needsConfirmation,
  };
}

function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}
