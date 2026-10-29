/**
 * formatadores.ts
 *
 * SCRUM-24 / SCRUM-88 — Formatação pt-BR de valores exibidos na proposta.
 */

export function formatarMoeda(valor: number, casas = 0): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

export function formatarNumero(valor: number, casas = 0): string {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

export function formatarPercentual(valor: number, casas = 0): string {
  return `${formatarNumero(valor, casas)}%`;
}
