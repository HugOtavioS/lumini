**LUMINI** — **SINCRONIZAÇÃO OFFLINE: FILA, CONFLITOS E ARMAZENAMENTO LOCAL**

Versão 1.0 — Outubro de 2026

# 1. Objetivo

Este documento registra como o app guarda e envia o que é feito sem internet, como o servidor resolve edições concorrentes e quanto espaço o app pode ocupar no celular. Ele detalha a Seção 4 da DAS v1.2 e cobre as tarefas SCRUM-82, SCRUM-83, SCRUM-86 e SCRUM-87. O código está no pacote `packages/sync` (`@lumini/sync`).

O app (Expo) e a API (NestJS) ainda não têm código no repositório. Por isso o pacote não depende de nenhum dos dois: ele recebe o banco (SQLite) e a rede de fora e traz um servidor de referência, em memória, que aplica as mesmas regras que a API vai aplicar. Os testes de integração rodam contra ele.

# 2. Fila de sincronização (SCRUM-82)

## 2.1 Como funciona

Quando o técnico salva um registro que precisa subir, o app grava o registro no SQLite com `sync_status = Pendente` e coloca uma linha na tabela `fila_sincronizacao` (Dicionário de Dados v1.4, seção 8.3). Como a fila é uma tabela do próprio banco, ela continua lá depois que o app é fechado, que o celular reinicia ou que o sistema encerra o processo.

Cada registro tem no máximo uma linha na fila. Se o técnico editar de novo algo que ainda não subiu, a linha recebe a versão nova, porque só a última interessa ao servidor. A linha também guarda a versão-base: o `updated_at` da última versão confirmada pelo servidor antes da primeira edição offline. É com ela que o servidor percebe uma edição concorrente (Seção 3).

O envio segue a ordem de dependência da DAS 4.1: cliente, instalação, medição, simulação de sombreamento, proposta (com os itens dentro) e solicitação de upgrade. A API recebe os registros em lotes de até 50.

Pela RN07, propostas "Em elaboração" não entram na fila. As propostas "Reaberta" também ficam de fora, porque nesse status o técnico está editando de novo; a proposta volta a subir quando passa para "Gerada". Se a equipe entender a RN07 de outro jeito, a lista fica em `STATUS_QUE_SINCRONIZAM`.

## 2.2 Quando a fila envia

| Momento | O que acontece |
|---|---|
| App aberto ou voltando do segundo plano | `iniciar()` envia o que estiver pendente |
| Técnico salva um registro | envio 1,5 s depois, para juntar várias gravações num lote só |
| Conexão volta (NetInfo) | `aoMudarConexao(true)` envia na hora, sem esperar o backoff |
| Depois de uma falha | nova tentativa automática, na hora marcada pelo backoff |
| "Forçar sincronização agora" (NOVO-76, RF16) | `retentarAgora()` tenta tudo, inclusive o que aguardava ação |

## 2.3 Falhas e backoff

| Tipo de falha | Exemplo | O que a fila faz |
|---|---|---|
| Sem conexão | modo avião, sem sinal | não tenta e espera a conexão voltar |
| Falha de rede ou da API | tempo esgotado (20 s), HTTP 5xx ou 429 | `sync_status = Erro` e nova tentativa automática com backoff |
| Registro pai ainda não chegou | proposta antes da instalação | igual à anterior: tenta de novo depois |
| Recusa do servidor | dados inválidos, registro de outra empresa | `sync_status = Erro` e aguarda ação do técnico (editar ou forçar) |

A cada falha seguida, a espera dobra: cerca de 2 s, 4 s, 8 s, 16 s, 32 s, até no máximo 10 minutos. O valor é sorteado entre 50 % e 100 % disso (jitter), para que vários celulares que perderam a conexão juntos não voltem todos no mesmo segundo. Se a API mandar o cabeçalho `Retry-After`, a fila espera pelo menos esse tempo, até 1 hora. Numa falha de rede, o resto da fila espera junto, em vez de cada item ser tentado em seguida. Depois de 5 falhas seguidas, o resumo da fila marca "falha persistente", para o alerta destacado do RF16 (1a).

O backoff só vale quando o celular acha que está online e o envio falha. Se a conexão cai e volta, o envio é imediato.

Um HTTP 401 (sessão expirada) também entra nas novas tentativas. O transporte pede o token a cada envio, então a próxima tentativa passa assim que o app renovar a sessão com o refresh token.

## 2.4 Outros cuidados

- Se o técnico editar um registro enquanto o lote dele está a caminho, a edição nova não se perde: a fila compara a `revisao` da linha antes e depois da resposta.
- Toda tentativa grava uma linha no Log de Sincronização (RNF11), com data, tipo, status e quantidade de registros.
- A fila avisa o app por eventos (`sincronizado`, `substituido` e `erro`), e o app atualiza o `sync_status` e os dados dos registros.

# 3. Conflito de edição (SCRUM-83)

A regra de quem edita em cada status (DAS 4.3) evita a maior parte dos conflitos. Sobram casos como o da tarefa: o mesmo registro editado offline em dois aparelhos. A regra é last-write-wins por `updated_at`, aplicada no servidor a cada operação do push:

1. Registro que não existe no servidor: grava.
2. Reenvio, quando a resposta do envio anterior se perdeu: se o conteúdo é o mesmo que já está lá, nada muda. Se aquela versão já tinha sido decidida (descartada, ou gravada e depois alterada por outra pessoa), o aparelho recebe a versão atual, sem nova linha no log de auditoria e sem novo aviso.
3. Edição feita sobre a versão que está no servidor: aplica. Isso vale quando a versão-base é igual ao `updated_at` atual e também quando a versão atual foi gravada pelo mesmo aparelho. O segundo caso é o da resposta perdida seguida de uma nova edição antes do reenvio: a versão-base ficou para trás, mas as edições de um aparelho acontecem em sequência. Não há conflito, porque a ordem dos fatos é conhecida.
4. O registro mudou no servidor depois que o aparelho o baixou: é edição concorrente, e vence o `updated_at` mais recente. No empate, fica a versão do servidor.

Para os passos 2 e 3, o servidor guarda qual aparelho gravou a versão atual de cada registro e qual foi o último envio de cada aparelho para cada registro. Sem isso, uma conexão que cai no meio do envio faria o técnico "perder" um conflito para ele mesmo.

Em todo conflito, cada campo sobrescrito vira uma linha do Log de Auditoria, com o motivo na coluna nova `motivo` (Dicionário v1.4). Quando quem perde é a alteração que acabou de chegar, o log guarda os valores dela, então nada desaparece sem registro. Na proposta, os itens são comparados um a um: campo alterado, item incluído e item removido.

Quem perdeu a alteração recebe um aviso. Se foi quem enviou, o aviso vem na própria resposta do push; se foi outra pessoa, ele fica no servidor e chega no próximo pull dela.

O aparelho nunca decide conflito sozinho. No pull, se um registro ainda tem alteração na fila, a versão local fica como está e sobe no próximo push, quando o servidor decide e devolve quem venceu. Assim, todos os aparelhos terminam com a mesma versão.

**Relógio dos celulares.** O `updated_at` vem do relógio de cada aparelho, que pode estar errado. Por isso:

- a comparação de horário só acontece entre edições concorrentes (passo 4); na edição normal, vale a ordem dos fatos;
- um `updated_at` mais de 2 minutos à frente da hora do servidor é trocado pela hora do servidor. Sem isso, um celular com a data adiantada venceria todos os conflitos daquele registro.

Um celular atrasado ainda pode perder um conflito que deveria ganhar. Se isso aparecer nos testes de campo, dá para corrigir o horário pelo desvio medido em cada sincronização.

**RN11 antes do conflito (SCRUM-406 / NOVO-106).** Antes desta regra, o servidor confere se o papel podia editar a proposta (`verificarGravacaoRN11`, em `packages/sync/src/regras/rn11.ts`). Uma alteração que o usuário não podia fazer é recusada com o código `RN11` (não retentável) e não passa pelo last-write-wins nem gera log de auditoria:

- "Aprovada" e "Recusada" no servidor: ninguém altera;
- técnico com a proposta "Em negociação" no servidor: recusa (uma edição atrasada não tira a proposta da negociação);
- nos outros casos, a permissão é avaliada no status da **versão-base** (o que o usuário via quando começou a editar). O servidor guarda o status de cada versão gravada da proposta para isso. Assim, dois técnicos que editam a mesma proposta "Reaberta" passam pela RN11 e o conflito entre eles é decidido aqui, pelo last-write-wins;
- o técnico só leva a proposta para "Gerada"; o gestor não cria propostas e, a partir de "Gerada" ou "Em negociação", pode negociar, gerar nova versão, reabrir, aprovar ou recusar;
- o reenvio da mesma versão (resposta perdida) não é edição e passa direto.

# 4. Armazenamento local (SCRUM-87)

## 4.1 Quanto o app pode ocupar

O RNF14 diz que o trabalho offline não pode ter limite imposto pelo app. Por isso o limite abaixo não bloqueia nada: ele marca o ponto em que o app começa a avisar e a sugerir uma limpeza.

| Parâmetro | Valor |
|---|---|
| Limite do Lumini (banco, PDFs e imagens) | 500 MB |
| Aviso discreto | a partir de 80 % do limite (400 MB) |
| Aviso destacado | a partir de 500 MB, ou com menos de 300 MB livres no celular |
| Folga exigida antes de gravar um PDF | tamanho do arquivo + 50 MB |
| Propostas que podem ter os arquivos removidos | sincronizadas, sem nada na fila, fora de "Em elaboração" e "Reaberta" e sem alteração há mais de 90 dias (30 dias se aprovadas ou recusadas) |

De onde vêm os números: uma proposta deve ocupar perto de 2 MB no celular (PDF de 3 páginas com imagens, mais as capturas da medição), e os dados dela no banco somam poucos KB. No plano gratuito, a empresa toda gera até 25 propostas por mês; se um técnico fizer todas, o aparelho dele acumula cerca de 50 MB por mês, e 500 MB guardam uns 10 meses de histórico. Num celular de 64 GB, isso é menos de 1 % do espaço. Num plano pago, com mais propostas, o aviso só chega antes, e a limpeza das antigas resolve. São estimativas: quando o app gerar PDFs de verdade, vale medir e ajustar. Os valores ficam em `POLITICA_ARMAZENAMENTO_PADRAO`.

## 4.2 Como o técnico é avisado

O app chama `avaliarArmazenamento` ao abrir e depois de gerar cada PDF:

- "ok": nada a mostrar;
- "atenção": aviso discreto no Histórico e no Perfil, dizendo quanto dá para liberar;
- "limite" ou "crítico": aviso destacado ao abrir o app e antes de gerar PDF.

A mensagem já diz o que fazer. Por exemplo: "O Lumini está usando 460 MB de 500 MB (92%). Dá para liberar 400 MB removendo os arquivos de 200 propostas antigas que já estão no servidor. Elas continuam no histórico, e o PDF pode ser gerado de novo." Quando não há o que liberar porque há propostas pendentes, a mensagem explica que elas precisam subir primeiro.

## 4.3 Liberação manual

A limpeza remove só os arquivos (PDF e imagens) das propostas escolhidas. Os dados continuam no aparelho e no servidor, a proposta continua no histórico, e o PDF pode ser gerado de novo pelo RF13 (4a).

1. `planejarLimpeza` monta a lista, da proposta mais antiga para a mais recente, e o texto da confirmação. Ela não apaga nada.
2. O técnico vê a lista e confirma; o app chama `confirmarPlano`.
3. `executarLimpeza` só roda com a confirmação daquela lista. Antes de apagar os arquivos de cada proposta, confere de novo: se ela mudou depois da confirmação (foi editada, reaberta ou voltou para a fila), fica de fora.

Nada é apagado automaticamente.

## 4.4 Celular sem espaço

Antes de gravar um PDF, o app chama `verificarEspacoParaGravar`. Sem espaço livre suficiente, a gravação nem começa, e o técnico vê que a proposta já está salva e que o PDF pode ser gerado depois. É o "tratamento controlado" do RNF14: o banco não corrompe e nada se perde.

# 5. Testes de integração (SCRUM-86)

Os testes de `packages/sync/src/integracao.test.ts` rodam o fluxo inteiro com aparelhos simulados, cada um com um SQLite de verdade em arquivo, uma rede que cai e volta e o servidor de referência:

- orçamento completo feito offline (cliente, instalação, medição, simulação e proposta), app fechado e reaberto, reconexão com envio automático e conferência de que o backend ficou com exatamente os dados do aparelho;
- API fora do ar, com novas tentativas depois de 2 s, 4 s e 8 s, e envio quando ela volta;
- conexão caindo depois de o servidor gravar: o reenvio não duplica nada e não vira conflito falso, nem quando a técnica edita de novo antes do reenvio, nem quando outra pessoa altera o registro nesse meio-tempo;
- RN07: proposta em elaboração fica só no aparelho;
- registro pai faltando: a proposta espera e sobe quando a instalação é corrigida;
- conflito: a mesma proposta editada offline em dois aparelhos, nas duas ordens de chegada, com o log de auditoria, o aviso e os dois aparelhos terminando iguais ao servidor, inclusive quando a resposta do descarte se perde.

O servidor de referência (`ServidorSincronizacaoMemoria`) funciona como especificação executável da API para o SCRUM-30. Quando a API existir, os mesmos cenários devem rodar contra ela, trocando o servidor em memória por chamadas HTTP.

Para ver os cenários na tela: `npm run demo:sync`.

# 6. Como o app usa o pacote

```ts
import * as SQLite from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { FilaSincronizacao, adaptarExpoSqlite, criarTransporteHttp } from '@lumini/sync';

const db = await SQLite.openDatabaseAsync('lumini.db');
await db.execAsync(`PRAGMA key = '${chaveGuardadaNoKeystore}'`); // SQLCipher (RNF05)

const fila = await FilaSincronizacao.abrir({
  banco: adaptarExpoSqlite(db),
  transporte: criarTransporteHttp({ urlBase: API_URL, obterToken: () => sessao.token }),
  idDispositivo,
  idUsuario: sessao.idUsuario,
  conectividade: { estaOnline: async () => (await NetInfo.fetch()).isConnected === true },
  aoResultado: (evento) => repositorios.aplicarResultadoDaFila(evento),
});
await fila.iniciar();

NetInfo.addEventListener((estado) => void fila.aoMudarConexao(estado.isConnected === true));
AppState.addEventListener('change', (estado) => (estado === 'active' ? void fila.iniciar() : fila.parar()));
```

Ao salvar um registro, os repositórios do app gravam no SQLite e chamam `fila.enfileirar({ entidade, versao, baseUpdatedAt })`, passando como base o `updated_at` do registro quando ele estava "Sincronizado". No pull, `aplicarPull` grava o que veio do servidor, menos o que ainda está na fila.

# 7. O que fica para outras tarefas

- SCRUM-67: formalizar o contrato (`packages/sync/src/contrato.ts`) em `packages/contracts`.
- SCRUM-30: API NestJS seguindo o servidor de referência, inclusive o controle de reenvio por aparelho da Seção 3; endpoints sugeridos `POST /sync/push` e `POST /sync/pull`.
- SCRUM-18: ligar NetInfo e AppState à fila no app (a lógica de quando enviar já está pronta).
- SCRUM-84: indicador visual, com `syncStatusDe` e `resumo()`.
- NOVO-76: botão "Forçar sincronização agora", com `retentarAgora()`.
- ~~NOVO-106: RN11 na API, antes da regra de conflito.~~ Feito no SCRUM-406 (`src/regras/rn11.ts` e servidor de referência); a API NestJS chama `verificarGravacaoRN11` no mesmo ponto.
- SCRUM-90: versionamento de proposta, se a equipe decidir criar uma versão nova em vez de sobrescrever.
- SCRUM-105: os testes unitários da sincronização e do conflito já estão no pacote.
