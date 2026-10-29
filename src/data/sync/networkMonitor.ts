/**
 * networkMonitor.ts
 *
 * SCRUM-18 — Monitor de conectividade.
 *
 * Não importa a biblioteca de rede diretamente: recebe uma fonte com a mesma
 * forma do `@react-native-community/netinfo` (fetch + addEventListener).
 * A camada app injeta o NetInfo real; os testes injetam um fake.
 */

export interface EstadoRede {
  isConnected: boolean | null;
  isInternetReachable?: boolean | null;
}

export interface FonteEstadoRede {
  fetch(): Promise<EstadoRede>;
  addEventListener(listener: (estado: EstadoRede) => void): () => void;
}

export interface MonitorRede {
  estaOnline(): Promise<boolean>;
  /**
   * Chama `callback` sempre que a rede passa a estar disponível
   * (inclusive na primeira leitura, se já estiver online). Retorna o unsubscribe.
   */
  aoReconectar(callback: () => void): () => void;
}

/**
 * Conectado = interface de rede ativa e internet não confirmada como inacessível.
 * `isInternetReachable` começa como null (ainda não testado) e é tratado como acessível.
 */
export function estaConectado(estado: EstadoRede): boolean {
  return estado.isConnected === true && estado.isInternetReachable !== false;
}

export function criarMonitorRede(fonte: FonteEstadoRede): MonitorRede {
  return {
    async estaOnline() {
      try {
        return estaConectado(await fonte.fetch());
      } catch {
        return false;
      }
    },
    aoReconectar(callback) {
      let estavaOnline: boolean | null = null;
      return fonte.addEventListener((estado) => {
        const online = estaConectado(estado);
        if (online && estavaOnline !== true) callback();
        estavaOnline = online;
      });
    },
  };
}
