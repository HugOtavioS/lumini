// Configuração da API, lida das variáveis de ambiente (arquivo .env, opcional).
//
//   PORT=3000
//   LUMINI_DB=./dados/lumini.db       (SQLite local; ":memory:" nos testes)
//   JWT_SECRET=troque-isto            (obrigatório fora do desenvolvimento)
//   LUMINI_SEED=sim                    (cria a empresa de demonstração se o banco estiver vazio)
//   CORS_ORIGENS=http://localhost:5173,http://localhost:8081
//   LIMITE_REQ_MINUTO=300              (SCRUM-32; 0 desliga)
//   LIMITE_TENTATIVAS_LOGIN=5          (senhas erradas por e-mail + IP em 15 min)
//   LIMITE_CORPO=2mb                   (tamanho máximo do corpo das requisições)
//   CONFIAR_PROXY=sim                  (atrás de Nginx/ALB na EC2: usa o IP do X-Forwarded-For)

export interface ConfigApi {
  porta: number;
  caminhoBanco: string;
  segredoJwt: string;
  semear: boolean;
  origensCors: string[] | true;
  /** Validade do token de acesso e do refresh token, em segundos. */
  validadeAcessoS: number;
  validadeRefreshS: number;
  /** SCRUM-32 — limitação de uso. */
  limites: { requisicoesPorMinuto: number; tentativasLogin: number; janelaLoginS: number; corpoMaximo: string; confiarProxy: boolean };
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
    segredoJwt,
    semear: (env.LUMINI_SEED ?? 'sim').toLowerCase() !== 'nao',
    origensCors: origens && origens.length > 0 ? origens : true,
    validadeAcessoS: 60 * 60,
    validadeRefreshS: 30 * 24 * 60 * 60,
    limites: {
      requisicoesPorMinuto: inteiro(env.LIMITE_REQ_MINUTO, 300),
      tentativasLogin: Math.max(1, inteiro(env.LIMITE_TENTATIVAS_LOGIN, 5)),
      janelaLoginS: 15 * 60,
      corpoMaximo: env.LIMITE_CORPO?.trim() || '2mb',
      confiarProxy: (env.CONFIAR_PROXY ?? 'nao').toLowerCase() === 'sim',
    },
  };
}

function inteiro(valor: string | undefined, padrao: number): number {
  const n = Number(valor);
  return valor !== undefined && valor.trim() !== '' && Number.isInteger(n) && n >= 0 ? n : padrao;
}
