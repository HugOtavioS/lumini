import { fileURLToPath } from 'node:url';
import { createSyncFn } from 'synckit';

import { BancoBase, type ValorSql } from './banco';

// PostgreSQL (Amazon RDS). As regras de sincronização do @lumini/sync são
// síncronas; para não reescrevê-las, as consultas rodam numa worker thread com
// uma única conexão `pg` e a chamada espera a resposta (synckit / Atomics.wait).
// Uma conexão só garante que BEGIN/COMMIT valem para os comandos entre eles.
//
// O SQL da API foi escrito para o SQLite; `traduzir` converte o pouco que muda:
// `?`/`?1` → `$n`, json_extract(x, '$.campo') → (x->>'campo') e apelidos em
// camelCase entre aspas (o PostgreSQL deixaria em minúsculas).

interface RespostaWorker {
  rows: Record<string, unknown>[];
  rowCount: number;
}

type ChamadaWorker = (pedido: { acao: 'conectar'; url: string; ssl: boolean } | { acao: 'query'; sql: string; params?: ValorSql[] } | { acao: 'fechar' }) => RespostaWorker;

export function traduzir(sql: string): string {
  let n = 0;
  return sql
    .replace(/json_extract\(\s*([\w.]+)\s*,\s*'\$\.(\w+)'\s*\)/g, "($1->>'$2')")
    .replace(/\?(\d+)/g, (_m, d: string) => `$${d}`)
    .replace(/\?/g, () => `$${++n}`)
    .replace(/\bAS\s+([a-z]+[A-Z]\w*)/g, 'AS "$1"');
}

export class BancoPostgres extends BancoBase {
  readonly tipo = 'postgres' as const;
  protected comandoInicio = 'BEGIN';
  private readonly chamar: ChamadaWorker;

  constructor(url: string, ssl = true) {
    super();
    const worker = fileURLToPath(new URL('./postgres/worker.mjs', import.meta.url));
    this.chamar = createSyncFn(worker, { timeout: 30_000 }) as unknown as ChamadaWorker;
    this.chamar({ acao: 'conectar', url, ssl });
  }

  executar(sql: string, ...params: ValorSql[]): number {
    return this.chamar({ acao: 'query', sql: traduzir(sql), params }).rowCount;
  }

  todos<T>(sql: string, ...params: ValorSql[]): T[] {
    return this.chamar({ acao: 'query', sql: traduzir(sql), params }).rows as T[];
  }

  um<T>(sql: string, ...params: ValorSql[]): T | undefined {
    return this.todos<T>(sql, ...params)[0];
  }

  exec(sql: string): void {
    this.chamar({ acao: 'query', sql });
  }

  fechar(): void {
    try {
      this.chamar({ acao: 'fechar' });
    } catch {
      // conexão já encerrada
    }
  }
}
