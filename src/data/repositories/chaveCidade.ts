/**
 * chaveCidade.ts
 *
 * SCRUM-17 — Normaliza o nome da cidade para busca (sem acentos, minúsculas,
 * espaços colapsados). Ex.: '  São   Paulo ' → 'sao paulo'.
 */

export function chaveCidade(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
