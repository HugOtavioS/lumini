import { useNetInfo } from '@react-native-community/netinfo';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { ApiError, baixarCatalogo, baixarRegistros, entrar, renovar, sair, type SessaoApi } from '@/data/api/luminiApi';
import { config } from '@/data/config';
import { replaceCatalog } from '@/data/mock/catalog';
import { propostasDoServidor } from '@/data/sync/doServidor';
import { getActiveContingencyBase, setActiveContingencyBase } from '@/data/contingency/contingencyBase';
import {
  ContingencyUpdater,
  httpContingencySource,
  type ContingencyCheckResult,
} from '@/data/contingency/contingencyUpdater';
import { inicializarContingencia, salvarBaseContingencia } from '@/data/contingency/contingencyStore';
import { cancelarTarefaSync, registrarTarefaSync } from '@/data/sync/backgroundSync';
import { definirServicoEmPrimeiroPlano, salvarContextoSync } from '@/data/sync/backgroundSyncRunner';
import { openLocalDatabase } from '@/data/sync/openDatabase';
import { seedCompanyProposalsThisMonth, seedProposals } from '@/data/mock/proposals';
import { mockTechnician } from '@/data/mock/user';
import { createSyncService, type SyncOutcome, type SyncService, type SyncSummary, type SyncUpdate } from '@/data/sync/syncService';
import type { AppNotification, AppNotificationKind, AppPreferences, Proposal, Technician, UpgradeRequest } from '@/domain/entities';
import { FREE_PLAN_MONTHLY_LIMIT } from '@/domain/parameters';
import { isSyncable } from '@/domain/services/proposalRules';
import { generateId, isValidEmail } from '@/utils/format';

// Estado global do app. Com a API configurada (EXPO_PUBLIC_API_URL), o login é
// real (RF01) e, ao entrar, o app baixa o catálogo da empresa (RF17) e o
// histórico do técnico gravado no banco central (pull); a fila do @lumini/sync
// envia o que for gerado no aparelho. Sem API, roda o modo de demonstração.
// A gravação das propostas no SQLite do aparelho (RF15 / D16) vem depois.

export type { SyncOutcome } from '@/data/sync/syncService';

export interface ContingencyStatus {
  version: string;
  lastCheckAt: string | null;
  lastResult: ContingencyCheckResult | null;
  checking: boolean;
}

interface AppState {
  hasSeenOnboarding: boolean;
  technician: Technician | null;
  isOnline: boolean;
  proposals: Proposal[];
  planUsed: number;
  planLimit: number;
  upgradeRequest: UpgradeRequest | null;
  lastSyncAt: string;
  isSyncing: boolean;
  /** "simulado" sem API configurada; "api" com a fila real (SCRUM-84/404). */
  syncMode: 'simulado' | 'api';
  /** Resumo da fila para os indicadores (RF16 / SCRUM-84). */
  syncSummary: SyncSummary;
  notifications: AppNotification[];
  unreadNotifications: number;
  preferences: AppPreferences;
  contingency: ContingencyStatus;
  /** Modo Leve: desativa a RA e usa a medição manual (RF19). */
  lightMode: boolean;
  setLightMode: (enabled: boolean) => void;
  setPreference: <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => void;
  completeOnboarding: () => void;
  /** Mostra o onboarding de novo (acessível pelas Preferências). */
  replayOnboarding: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** RF14 / SCRUM-378: o técnico edita telefone e foto. Lança erro com a mensagem de validação. */
  updateProfile: (patch: Pick<Technician, 'phone' | 'photoUri'>) => void;
  saveProposal: (proposal: Proposal, countsTowardPlan: boolean) => void;
  getProposal: (id: string) => Proposal | undefined;
  /** Registra a solicitação de upgrade (RF28); não duplica se houver uma pendente. */
  requestUpgrade: () => { alreadyPending: boolean };
  /** "Forçar sincronização agora" (SCRUM-404). */
  syncNow: (proposalId?: string) => Promise<SyncOutcome>;
  markNotificationsRead: () => void;
  checkContingencyNow: () => Promise<ContingencyCheckResult>;
}

const AppContext = createContext<AppState | null>(null);

const EMPTY_SUMMARY: SyncSummary = { pending: 0, withError: 0, persistentFailure: false, lastAttemptAt: null, lastError: null };

const DEFAULT_PREFERENCES: AppPreferences = {
  lightMode: false,
  notifySyncFailures: true,
  notifyManagerUpdates: true,
  autoUpdateContingency: true,
};

function isThisMonth(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function seedNotifications(): AppNotification[] {
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
  return [
    {
      id: 'n-seed-1',
      kind: 'proposta',
      title: 'Proposta aprovada',
      message: 'O gestor marcou a proposta de Aline de Souza como aprovada.',
      createdAt: hoursAgo(1),
      read: false,
      proposalId: 'seed-47',
    },
    {
      id: 'n-seed-2',
      kind: 'sincronizacao',
      title: 'Falha ao sincronizar',
      message: 'A proposta de Claudio Ramos não subiu: tempo de resposta da API excedido. Toque em "Forçar sincronização agora" no Perfil.',
      createdAt: hoursAgo(20),
      read: true,
      proposalId: 'seed-41',
    },
  ];
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const netInfo = useNetInfo();
  const isOnline = netInfo.isConnected !== false;

  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>(config.hasApi ? [] : seedProposals);
  const [planUsed, setPlanUsed] = useState(() =>
    config.hasApi ? 0 : seedCompanyProposalsThisMonth + seedProposals.filter((p) => p.generatedAt && isThisMonth(p.generatedAt)).length,
  );
  const [upgradeRequest, setUpgradeRequest] = useState<UpgradeRequest | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState(() => new Date(Date.now() - 15 * 60 * 1000).toISOString());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState<SyncSummary>(EMPTY_SUMMARY);
  const [syncMode, setSyncMode] = useState<'simulado' | 'api'>('simulado');
  const [notifications, setNotifications] = useState<AppNotification[]>(config.hasApi ? [] : seedNotifications);
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const [contingency, setContingency] = useState<ContingencyStatus>(() => ({
    version: getActiveContingencyBase().version,
    lastCheckAt: null,
    lastResult: null,
    checking: false,
  }));

  const proposalsRef = useRef(proposals);
  proposalsRef.current = proposals;
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;
  const syncServiceRef = useRef<SyncService | null>(null);
  /** Sessão da API (JWT + refresh token), só em memória. */
  const sessionRef = useRef<SessaoApi | null>(null);
  const updaterRef = useRef<ContingencyUpdater | null>(null);

  const addNotification = useCallback((kind: AppNotificationKind, title: string, message: string, proposalId?: string) => {
    setNotifications((current) => [
      { id: generateId(), kind, title, message, createdAt: new Date().toISOString(), read: false, proposalId },
      ...current,
    ]);
  }, []);

  const refreshSummary = useCallback(async () => {
    const service = syncServiceRef.current;
    if (service) setSyncSummary(await service.summary());
  }, []);

  // Eventos da fila → status das propostas (RF16 / SCRUM-84).
  const handleSyncUpdate = useCallback(
    (update: SyncUpdate) => {
      const now = new Date().toISOString();
      if (update.kind === 'upgradeSynced') {
        setUpgradeRequest((request) => (request ? { ...request, syncStatus: 'sincronizado' } : request));
        return;
      }
      const { proposalId } = update;
      const name = proposalsRef.current.find((p) => p.id === proposalId)?.client.name ?? 'proposta';
      if (proposalId) {
        setProposals((current) =>
          current.map((p) => {
            if (p.id !== proposalId) return p;
            switch (update.kind) {
              case 'synced':
                return {
                  ...p,
                  syncBase: { ...p.syncBase, [update.idOperacao]: update.serverUpdatedAt },
                  syncStatus: update.isProposal && !update.stillPending ? 'sincronizado' : p.syncStatus,
                  lastSyncAttemptAt: now,
                  syncError: update.isProposal ? undefined : p.syncError,
                };
              case 'replaced':
                return {
                  ...p,
                  syncBase: { ...p.syncBase, [update.idOperacao]: update.serverUpdatedAt },
                  syncStatus: 'sincronizado',
                  lastSyncAttemptAt: now,
                  syncError: undefined,
                };
              case 'error':
                return { ...p, syncStatus: 'erro', lastSyncAttemptAt: now, syncError: update.message };
            }
          }),
        );
      }
      if (update.kind === 'synced') {
        setLastSyncAt(now);
        if (update.conflict && preferencesRef.current.notifySyncFailures) {
          addNotification('sincronizacao', 'Conflito resolvido', `A versão deste aparelho prevaleceu na proposta de ${name}.`, proposalId ?? undefined);
        }
      }
      if (update.kind === 'replaced' && preferencesRef.current.notifyManagerUpdates) {
        addNotification('proposta', 'Proposta atualizada no servidor', update.message, proposalId ?? undefined);
      }
      if (update.kind === 'error' && !update.retryable && preferencesRef.current.notifySyncFailures) {
        addNotification('sincronizacao', 'Falha ao sincronizar', `${name}: ${update.message}`, proposalId ?? undefined);
      }
      void refreshSummary();
    },
    [addNotification, refreshSummary],
  );

  // Cria o serviço de sincronização quando o técnico entra.
  useEffect(() => {
    if (!technician) return;
    let cancelled = false;
    let created: SyncService | null = null;
    void createSyncService({
      ctx: { idEmpresa: technician.companyId, idUsuario: technician.id },
      onUpdate: handleSyncUpdate,
      getToken: () => sessionRef.current?.tokenAcesso ?? null,
      isOnline: isOnlineRef.current,
    }).then(async (service) => {
      if (cancelled) {
        service.stop();
        return;
      }
      created = service;
      syncServiceRef.current = service;
      definirServicoEmPrimeiroPlano(service);
      setSyncMode(service.mode);
      if (service.mode === 'api') {
        // SCRUM-18: guarda a sessão e agenda a tarefa que sincroniza com o app fechado.
        void openLocalDatabase()
          .then((banco) => salvarContextoSync(banco, { idEmpresa: technician.companyId, idUsuario: technician.id }))
          .then(registrarTarefaSync)
          .catch((erro) => console.warn('[sync] Tarefa em segundo plano não registrada.', erro));
      }
      // O que já estava pendente no aparelho entra na fila (RN07 filtra).
      for (const proposal of proposalsRef.current) {
        if (proposal.syncStatus !== 'sincronizado' && isSyncable(proposal.status)) await service.enqueueProposal(proposal);
      }
      await refreshSummary();
    });
    return () => {
      cancelled = true;
      created?.stop();
      syncServiceRef.current = null;
      definirServicoEmPrimeiroPlano(null);
    };
  }, [technician?.id, technician?.companyId, handleSyncUpdate, refreshSummary]);

  // Base de contingência gravada no SQLite (SCRUM-17): na abertura, usa a do
  // banco se for mais nova que a embutida. No preview web não há banco.
  useEffect(() => {
    void openLocalDatabase()
      .then(inicializarContingencia)
      .then((base) => setContingency((current) => ({ ...current, version: base.version })))
      .catch(() => {});
  }, []);

  // Job da base de contingência (SCRUM-85).
  useEffect(() => {
    const updater = new ContingencyUpdater({
      source: config.hasApi ? httpContingencySource(config.apiUrl) : null,
      getCurrent: getActiveContingencyBase,
      apply: (base) => {
        setActiveContingencyBase(base);
        void openLocalDatabase()
          .then((banco) => salvarBaseContingencia(banco, base))
          .catch(() => {});
      },
      isOnline: () => isOnlineRef.current,
      onResult: (result, checkedAt) => {
        setContingency({ version: getActiveContingencyBase().version, lastCheckAt: checkedAt, lastResult: result, checking: false });
        if (result.status === 'instalada') {
          addNotification('sistema', 'Base de contingência atualizada', `Nova versão ${result.version} instalada (antes: ${result.previousVersion}).`);
        }
      },
    });
    updaterRef.current = updater;
    if (preferences.autoUpdateContingency) updater.start();
    return () => {
      updater.stop();
      updaterRef.current = null;
    };
  }, [preferences.autoUpdateContingency, addNotification]);

  // Conectividade → fila e job de contingência (RF15: ao reconectar, envia).
  useEffect(() => {
    syncServiceRef.current?.setOnline(isOnline);
    updaterRef.current?.onConnectivityChange(isOnline);
  }, [isOnline]);

  // Renova o token de acesso antes de expirar (a API dá 1 h).
  useEffect(() => {
    if (!technician || !config.hasApi) return;
    const timer = setInterval(() => {
      const atual = sessionRef.current;
      if (!atual) return;
      void renovar(atual.refreshToken)
        .then((nova) => { sessionRef.current = nova; })
        .catch(() => {});
    }, 45 * 60 * 1000);
    return () => clearInterval(timer);
  }, [technician?.id]);

  const login = useCallback(async (email: string, password: string) => {
    if (config.hasApi) {
      // RF01: login real na API.
      const sessao = await entrar(email, password);
      if (sessao.usuario.papel !== 'Tecnico') {
        await sair(sessao.refreshToken);
        throw new ApiError('Esta conta é de gestor. Use o painel web.', 403);
      }
      sessionRef.current = sessao;
      // Dados reais da empresa: catálogo (RF17) e histórico do técnico (banco central).
      const [catalogo, registros] = await Promise.all([
        baixarCatalogo(sessao.tokenAcesso).catch(() => []),
        baixarRegistros(sessao.tokenAcesso, `login-${sessao.usuario.id}`).catch(() => null),
      ]);
      replaceCatalog(catalogo);
      if (registros) {
        const doServidor = propostasDoServidor(registros);
        setProposals(doServidor);
        setPlanUsed(doServidor.filter((p) => p.generatedAt && isThisMonth(p.generatedAt)).length);
        setLastSyncAt(new Date().toISOString());
      }
      const u = sessao.usuario;
      setTechnician({ id: u.id, name: u.nome, email: u.email, role: 'tecnico', companyId: u.idEmpresa, companyName: u.nomeEmpresa, phone: u.telefone ?? '', photoUri: null });
      return;
    }
    // Modo demonstração (sem API configurada).
    await new Promise((resolve) => setTimeout(resolve, 600));
    if (!isValidEmail(email) || password.length < 4) {
      throw new Error('E-mail ou senha incorretos.');
    }
    setTechnician({ ...mockTechnician, email: email.trim().toLowerCase() });
  }, []);

  const updateProfile = useCallback((patch: Pick<Technician, 'phone' | 'photoUri'>) => {
    const digits = patch.phone.replace(/\D/g, '');
    if (digits.length > 0 && (digits.length < 10 || digits.length > 11)) {
      throw new Error('Telefone incompleto. Use DDD + número.');
    }
    setTechnician((current) => (current ? { ...current, phone: patch.phone, photoUri: patch.photoUri } : current));
  }, []);

  const saveProposal = useCallback((proposal: Proposal, countsTowardPlan: boolean) => {
    setProposals((current) => [proposal, ...current.filter((p) => p.id !== proposal.id)]);
    if (countsTowardPlan) setPlanUsed((used) => used + 1);
    const service = syncServiceRef.current;
    if (service && isSyncable(proposal.status)) {
      void service.enqueueProposal(proposal).then(refreshSummary);
    }
  }, [refreshSummary]);

  const requestUpgrade = useCallback(() => {
    if (upgradeRequest?.status === 'pendente') return { alreadyPending: true };
    const request: UpgradeRequest = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      status: 'pendente',
      syncStatus: 'pendente',
    };
    setUpgradeRequest(request);
    void syncServiceRef.current?.enqueueUpgrade(request).then(refreshSummary);
    return { alreadyPending: false };
  }, [upgradeRequest, refreshSummary]);

  const syncNow = useCallback(async (): Promise<SyncOutcome> => {
    const service = syncServiceRef.current;
    if (!service) return 'nada_pendente';
    setIsSyncing(true);
    try {
      const outcome = await service.syncNow();
      if (outcome === 'sincronizado') setLastSyncAt(new Date().toISOString());
      return outcome;
    } finally {
      setIsSyncing(false);
      await refreshSummary();
    }
  }, [refreshSummary]);

  const checkContingencyNow = useCallback(async (): Promise<ContingencyCheckResult> => {
    const updater = updaterRef.current;
    if (!updater) return { status: 'sem_servidor' };
    setContingency((c) => ({ ...c, checking: true }));
    return updater.checkNow();
  }, []);

  const setPreference = useCallback(<K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  }, []);

  const unreadNotifications = notifications.filter((n) => !n.read).length;

  const value = useMemo<AppState>(
    () => ({
      hasSeenOnboarding,
      technician,
      isOnline,
      proposals,
      planUsed,
      planLimit: FREE_PLAN_MONTHLY_LIMIT,
      upgradeRequest,
      lastSyncAt,
      isSyncing,
      syncMode,
      syncSummary,
      notifications,
      unreadNotifications,
      preferences,
      contingency,
      lightMode: preferences.lightMode,
      setLightMode: (enabled) => setPreference('lightMode', enabled),
      setPreference,
      completeOnboarding: () => setHasSeenOnboarding(true),
      replayOnboarding: () => setHasSeenOnboarding(false),
      login,
      logout: () => {
        const sessao = sessionRef.current;
        sessionRef.current = null;
        if (sessao) void sair(sessao.refreshToken);
        if (config.hasApi) setProposals([]);
        setTechnician(null);
        // Sem sessão, a tarefa em segundo plano não tem em nome de quem enviar.
        void openLocalDatabase()
          .then((banco) => salvarContextoSync(banco, null))
          .then(cancelarTarefaSync)
          .catch(() => {});
      },
      updateProfile,
      saveProposal,
      getProposal: (id) => proposals.find((p) => p.id === id),
      requestUpgrade,
      syncNow,
      markNotificationsRead: () => setNotifications((current) => current.map((n) => (n.read ? n : { ...n, read: true }))),
      checkContingencyNow,
    }),
    [
      hasSeenOnboarding, technician, isOnline, proposals, planUsed, upgradeRequest, lastSyncAt, isSyncing, syncMode,
      syncSummary, notifications, unreadNotifications, preferences, contingency, setPreference, login, updateProfile,
      saveProposal, requestUpgrade, syncNow, checkContingencyNow,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppStore(): AppState {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppStore deve ser usado dentro de AppStoreProvider');
  return context;
}
