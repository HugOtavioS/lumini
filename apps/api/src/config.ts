// Configuração da API, lida das variáveis de ambiente (arquivo .env, opcional).
//
//   PORT=3000
//   LUMINI_DB=./dados/lumini.db       (SQLite local; ":memory:" nos testes)
//   JWT_SECRET=troque-isto            (obrigatório fora do desenvolvimento)
//   LUMINI_SEED=sim                    (cria a empresa de demonstração se o banco estiver vazio)
//   CORS_ORIGENS=http://localhost:5173,http://localhost:8081
//   DATABASE_URL=postgres://usuario:senha@endpoint.rds.amazonaws.com:5432/lumini
//                                      (com ela, usa o PostgreSQL/RDS no lugar do SQLite)
//   DB_SSL=sim                         ("nao" para um PostgreSQL local sem TLS)

export interface ConfigApi {
  porta: number;
  caminhoBanco: string;
  /** PostgreSQL (RDS). Vazio = SQLite em `caminhoBanco`. */
  urlBanco: string | null;
  sslBanco: boolean;
  segredoJwt: string;
  semear: boolean;
  origensCors: string[] | true;
  /** Validade do token de acesso e do refresh token, em segundos. */
  validadeAcessoS: number;
  validadeRefreshS: number;
}

export const CONFIG = Symbol('CONFIG');

const SEGREDO_DESENVOLVIMENTO = 'lumini-dev-segredo-nao-usar-em-producao';

export function lerConfig(env: NodeJS.ProcessEnv = process.env): ConfigApi {
  const segredoJwt = env.JWT_SECRET?.trim() || SEGREDO_DESENVOLVIMENTO;
  if (segredoJwt === SEGREDO_DESENVOLVIMENTO && env.NODE_ENV === 'production') {
    throw new Error('Defina JWT_SECRET para rodar em produção.');
  }
  const origens = env.CORS_ORIGENS?.split(',').map((o) => o.trim()).filter(Boolean);
  return {
    porta: Number(env.PORT) || 3000,
    caminhoBanco: env.LUMINI_DB?.trim() || './dados/lumini.db',
    urlBanco: env.DATABASE_URL?.trim() || null,
    sslBanco: (env.DB_SSL ?? 'sim').toLowerCase() !== 'nao',
    segredoJwt,
    semear: (env.LUMINI_SEED ?? 'sim').toLowerCase() !== 'nao',
    origensCors: origens && origens.length > 0 ? origens : true,
    validadeAcessoS: 60 * 60,
    validadeRefreshS: 30 * 24 * 60 * 60,
  };
}
