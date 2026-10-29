/**
 * SyncApiHttp.ts
 *
 * SCRUM-18 — Upload de propostas para a API Node.js.
 *
 * - POST JSON com o payload do contrato SCRUM-67.
 * - Header `Idempotency-Key` = ID da proposta: o servidor deve tratar reenvios
 *   da mesma chave como upsert, nunca como novo registro.
 * - Classificação de erro: rede/timeout/408/425/429/5xx → retentável;
 *   demais 4xx → definitivo.
 *
 * ⚠️ Sem URL fixa: `urlUpload` vem da configuração por ambiente (src/app/config/env.ts)
 *    + rota do contrato SCRUM-67, montadas na camada app.
 */

import type { ApiSync } from '../../sync/SyncService';
import { ErroEnvioSync } from '../../sync/ErroEnvioSync';

/**
 * Tempo máximo de uma requisição de upload. Decisão operacional: precisa caber,
 * junto com o backoff, na janela de execução em background do iOS.
 */
export const TIMEOUT_UPLOAD_PADRAO_MS = 15_000;

const STATUS_RETENTAVEIS = new Set([408, 425, 429]);

export interface ConfigSyncApiHttp {
  urlUpload: string;
  /** PENDÊNCIA: esquema de autenticação da API não definido nesta entrega. */
  obterTokenAcesso?: () => Promise<string | null>;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export class SyncApiHttp<TPayload> implements ApiSync<TPayload> {
  constructor(private readonly config: ConfigSyncApiHttp) {}

  async enviarProposta(payload: TPayload, chaveIdempotencia: string): Promise<void> {
    const fetchFn = this.config.fetch ?? fetch;
    const timeoutMs = this.config.timeoutMs ?? TIMEOUT_UPLOAD_PADRAO_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Idempotency-Key': chaveIdempotencia,
    };
    const token = await this.config.obterTokenAcesso?.();
    if (token) headers.Authorization = `Bearer ${token}`;

    let resposta: Response;
    try {
      resposta = await fetchFn(this.config.urlUpload, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (erro) {
      const mensagem = controller.signal.aborted
        ? `Upload excedeu ${timeoutMs} ms.`
        : `Falha de rede no upload: ${erro instanceof Error ? erro.message : String(erro)}`;
      throw new ErroEnvioSync(mensagem, true);
    } finally {
      clearTimeout(timer);
    }

    if (resposta.ok) return;

    const retentavel = resposta.status >= 500 || STATUS_RETENTAVEIS.has(resposta.status);
    throw new ErroEnvioSync(
      `Upload recusado pela API (HTTP ${resposta.status}).`,
      retentavel,
      resposta.status,
    );
  }
}
