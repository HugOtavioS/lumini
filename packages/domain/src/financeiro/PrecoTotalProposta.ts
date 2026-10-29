/**
 * PrecoTotalProposta.ts
 *
 * SCRUM-24 — Contrato de entrada do preço total da proposta (dependência REV-1).
 *
 * ⚠️ PENDÊNCIA REV-1: a precificação ainda não está implementada nesta base.
 *    Esta interface é o ponto de integração; no merge, a saída da REV-1 deve
 *    implementá-la (ou ser mapeada para ela). Os testes usam um mock.
 */

export interface PrecoTotalProposta {
  /** Valor total do sistema instalado, em R$ (investimento do cliente). */
  valorTotal: number;
}
