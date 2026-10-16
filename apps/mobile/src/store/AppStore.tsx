import { useNetInfo } from '@react-native-community/netinfo';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import { seedCompanyProposalsThisMonth, seedProposals } from '@/data/mock/proposals';
import { mockTechnician } from '@/data/mock/user';
import type { Proposal, Technician, UpgradeRequest } from '@/domain/entities';
import { FREE_PLAN_MONTHLY_LIMIT } from '@/domain/parameters';
import { isSyncable } from '@/domain/services/proposalRules';
import { generateId, isValidEmail } from '@/utils/format';

// Estado global do app. As propostas ficam em memória nesta etapa; a
// persistência em SQLite/SQLCipher (RF15 / D16) substitui este store depois.

const SIMULATED_LATENCY_MS = 1200;

export type SyncOutcome = 'sincronizado' | 'offline' | 'nada_pendente';

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
  /** Modo Leve: desativa a RA e usa a medição manual (RF19). */
  lightMode: boolean;
  setLightMode: (enabled: boolean) => void;
  completeOnboarding: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  saveProposal: (proposal: Proposal, countsTowardPlan: boolean) => void;
  getProposal: (id: string) => Proposal | undefined;
  /** Registra a solicitação de upgrade (RF28); não duplica se houver uma pendente. */
  requestUpgrade: () => { alreadyPending: boolean };
  syncNow: (proposalId?: string) => Promise<SyncOutcome>;
}

const AppContext = createContext<AppState | null>(null);

function isThisMonth(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const netInfo = useNetInfo();
  const isOnline = netInfo.isConnected !== false;

  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>(seedProposals);
  const [planUsed, setPlanUsed] = useState(
    () => seedCompanyProposalsThisMonth + seedProposals.filter((p) => p.generatedAt && isThisMonth(p.generatedAt)).length,
  );
  const [upgradeRequest, setUpgradeRequest] = useState<UpgradeRequest | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState(() => new Date(Date.now() - 15 * 60 * 1000).toISOString());
  const [isSyncing, setIsSyncing] = useState(false);
  const [lightMode, setLightMode] = useState(false);

  const proposalsRef = useRef(proposals);
  proposalsRef.current = proposals;

  const login = useCallback(async (email: string, password: string) => {
    // RF01: validação pela API (online) ou pela sessão em cache (offline).
    await wait(600);
    if (!isValidEmail(email) || password.length < 4) {
      throw new Error('E-mail ou senha incorretos.');
    }
    setTechnician({ ...mockTechnician, email: email.trim().toLowerCase() });
  }, []);

  const saveProposal = useCallback((proposal: Proposal, countsTowardPlan: boolean) => {
    setProposals((current) => [proposal, ...current.filter((p) => p.id !== proposal.id)]);
    if (countsTowardPlan) setPlanUsed((used) => used + 1);
  }, []);

  const requestUpgrade = useCallback(() => {
    if (upgradeRequest?.status === 'pendente') return { alreadyPending: true };
    setUpgradeRequest({
      id: generateId(),
      createdAt: new Date().toISOString(),
      status: 'pendente',
      syncStatus: 'pendente',
    });
    return { alreadyPending: false };
  }, [upgradeRequest]);

  const syncNow = useCallback(
    async (proposalId?: string): Promise<SyncOutcome> => {
      const pending = proposalsRef.current.filter(
        (p) => p.syncStatus !== 'sincronizado' && isSyncable(p.status) && (!proposalId || p.id === proposalId),
      );
      if (pending.length === 0 && upgradeRequest?.syncStatus !== 'pendente') return 'nada_pendente';
      if (!isOnline) return 'offline';

      setIsSyncing(true);
      await wait(SIMULATED_LATENCY_MS);
      const now = new Date().toISOString();
      const pendingIds = new Set(pending.map((p) => p.id));
      setProposals((current) =>
        current.map((p) =>
          pendingIds.has(p.id)
            ? { ...p, syncStatus: 'sincronizado', lastSyncAttemptAt: now, syncError: undefined }
            : p,
        ),
      );
      setUpgradeRequest((request) => (request ? { ...request, syncStatus: 'sincronizado' } : request));
      setLastSyncAt(now);
      setIsSyncing(false);
      return 'sincronizado';
    },
    [isOnline, upgradeRequest],
  );

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
      lightMode,
      setLightMode,
      completeOnboarding: () => setHasSeenOnboarding(true),
      login,
      logout: () => setTechnician(null),
      saveProposal,
      getProposal: (id) => proposals.find((p) => p.id === id),
      requestUpgrade,
      syncNow,
    }),
    [hasSeenOnboarding, technician, isOnline, proposals, planUsed, upgradeRequest, lastSyncAt, isSyncing, lightMode, login, saveProposal, requestUpgrade, syncNow],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppStore(): AppState {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppStore deve ser usado dentro de AppStoreProvider');
  return context;
}
