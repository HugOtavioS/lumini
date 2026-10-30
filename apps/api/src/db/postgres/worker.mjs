// Worker do BancoPostgres: mantém UMA conexão com o RDS e executa as consultas
// pedidas pela thread principal (ver bancoPostgres.ts).
import pg from 'pg';
import { runAsWorker } from 'synckit';

// Devolve os tipos no mesmo formato que o SQLite devolvia, para a API não mudar:
// JSON como texto, datas como ISO 8601, números como number.
const iso = (v) => {
  let s = v.replace(' ', 'T');
  if (/[+-]\d\d$/.test(s)) s += ':00';
  return new Date(s).toISOString();
};
pg.types.setTypeParser(114, (v) => v); // json
pg.types.setTypeParser(3802, (v) => v); // jsonb
pg.types.setTypeParser(1184, iso); // timestamptz
pg.types.setTypeParser(1114, (v) => iso(v + '+00')); // timestamp
pg.types.setTypeParser(1700, (v) => Number(v)); // numeric
pg.types.setTypeParser(20, (v) => Number(v)); // bigint (COUNT, seq)

let cliente = null;

runAsWorker(async (pedido) => {
  if (pedido.acao === 'conectar') {
    cliente = new pg.Client({
      connectionString: pedido.url,
      ssl: pedido.ssl ? { rejectUnauthorized: false } : false,
    });
    await cliente.connect();
    await cliente.query("SET TIME ZONE 'UTC'");
    return { rows: [], rowCount: 0 };
  }
  if (pedido.acao === 'fechar') {
    await cliente?.end();
    cliente = null;
    return { rows: [], rowCount: 0 };
  }
  const r = await cliente.query(pedido.sql, pedido.params);
  const ultimo = Array.isArray(r) ? r[r.length - 1] : r;
  return { rows: ultimo?.rows ?? [], rowCount: ultimo?.rowCount ?? 0 };
});
