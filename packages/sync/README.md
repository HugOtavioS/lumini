# Lumini — `packages/sync`

Sincronização offline do Lumini (Épico 4): a fila que guarda e envia o que é feito sem internet, a regra de conflito aplicada no servidor e a política de armazenamento local. As decisões e os valores estão explicados em [`docs/arquitetura/Sincronizacao_Offline_v1.0.md`](../../docs/arquitetura/Sincronizacao_Offline_v1.0.md).

- TypeScript puro, sem APIs do Node nem do React Native: roda no app (Hermes), na web e na API.
- O banco e a rede vêm de fora: `BancoSql` (com adaptadores para o `expo-sqlite` e para SQLite síncrono, como o `node:sqlite`) e `TransporteSync` (com um transporte HTTP pronto).
- Inclui um servidor de referência, em memória, com as regras que a API precisa seguir.

## Como usar

```bash
npm ci                                  # na raiz do monorepo (Node.js 22.13 ou mais recente)
npm test                                # typecheck + testes de todos os pacotes
npm test -w @lumini/sync                # só este pacote
npm run test:detalhado -w @lumini/sync  # um teste por linha
npm run demo:sync                       # demonstração das 4 tasks, na raiz
```

No PowerShell do Windows, use `npm.cmd`.

## O que tem aqui

| Item do backlog | Módulo | O que faz |
|---|---|---|
| SCRUM-82 | `src/fila/fila.ts`, `src/fila/backoff.ts`, `src/transporte.ts` | Fila na tabela `fila_sincronizacao` (sobrevive ao fechamento do app), uma linha por registro, ordem de dependência, RN07, retentativa automática com backoff exponencial e jitter, envio imediato ao reconectar, log de sincronização (RNF11) |
| SCRUM-83 | `src/conflito/resolverConflito.ts`, `src/conflito/diferencas.ts` | Last-write-wins por `updated_at` só entre edições concorrentes (detectadas pela versão-base e pelo aparelho que gravou a versão atual), correção de relógio adiantado, Log de Auditoria campo a campo (itens da proposta incluídos) e aviso para quem perdeu a alteração |
| SCRUM-87 | `src/armazenamento/politica.ts` | Limite de 500 MB sem bloquear trabalho (RNF14), avisos por nível, plano de limpeza só com propostas sincronizadas antigas, remoção apenas com confirmação, checagem de espaço antes de gravar o PDF |
| SCRUM-86 | `src/servidor/servidorReferencia.ts`, `src/integracao.test.ts`, `src/testes/ambiente.ts` | Servidor de referência (com o reenvio reconhecido por aparelho quando a resposta se perde) e testes de ponta a ponta: offline → reconexão → sincronização, com dois aparelhos e o cenário de conflito |

## Exemplo

```ts
import { FilaSincronizacao, adaptarExpoSqlite, criarTransporteHttp } from '@lumini/sync';

const fila = await FilaSincronizacao.abrir({
  banco: adaptarExpoSqlite(db),
  transporte: criarTransporteHttp({ urlBase: API_URL, obterToken: () => sessao.token }),
  idDispositivo,
  idUsuario: sessao.idUsuario,
  conectividade: { estaOnline: async () => (await NetInfo.fetch()).isConnected === true },
  aoResultado: (evento) => repositorios.aplicarResultadoDaFila(evento),
});
await fila.iniciar();

await fila.enfileirar({ entidade: 'Proposta', versao, baseUpdatedAt });
const { pendentes, comErro, falhaPersistente } = await fila.resumo(); // RF16
```

## Pendências

- O contrato (`src/contrato.ts`) é uma versão inicial; o SCRUM-67 deve levá-lo para `packages/contracts`.
- A API (SCRUM-30) ainda não existe: os testes de integração rodam contra o servidor de referência.
- O adaptador do `expo-sqlite` foi testado com um banco simulado; falta testar no aparelho, quando o app existir.
