/** Apoio aos testes: SQLite de verdade (node:sqlite), em arquivo, como o app usa no aparelho. */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { adaptarSqliteSincrono, type BancoSql } from '../sql';

export interface BancoDeTeste {
  banco: BancoSql;
  db: DatabaseSync;
  fechar(): void;
}

export function abrirBanco(caminho: string): BancoDeTeste {
  const db = new DatabaseSync(caminho);
  return { banco: adaptarSqliteSincrono(db), db, fechar: () => db.close() };
}

export interface PastaTemporaria {
  arquivo(nome: string): string;
  apagar(): void;
}

export function criarPastaTemporaria(): PastaTemporaria {
  const pasta = mkdtempSync(join(tmpdir(), 'lumini-sync-'));
  return {
    arquivo: (nome) => join(pasta, nome),
    apagar: () => rmSync(pasta, { recursive: true, force: true }),
  };
}
