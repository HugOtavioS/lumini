import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type {
  Client,
  Equipment,
  Installation,
  Proposal,
  ProposalItem,
  ProposalStatus,
  RoofMeasurement,
} from '@/domain/entities';
import { commercialParameters, technicalParameters } from '@/domain/parameters';
import { calculateProposal, type ProposalCalculation } from '@/domain/services/proposalCalculator';
import { proposalNumber } from '@/domain/services/proposalRules';
import { generateId } from '@/utils/format';

// Rascunho da instalação em andamento (RF02 → RF12). Criado ao tocar em
// "Nova Instalação" e descartado ao voltar para o início.

interface DraftState {
  id: string;
  client: Client | null;
  installation: Installation | null;
  measurement: RoofMeasurement | null;
  shadingPct: number | null;
  items: ProposalItem[];
  validityDays: number;
  /** Status da proposta de origem ao editar; null para uma instalação nova. */
  sourceStatus: ProposalStatus | null;
}

interface DraftContextValue extends DraftState {
  calculation: ProposalCalculation | null;
  start: () => void;
  /** Carrega uma proposta para edição (RN11) ou como base de uma nova (duplicar). */
  load: (proposal: Proposal, mode: 'edit' | 'duplicate') => void;
  setClientData: (client: Client, installation: Installation) => void;
  setMeasurement: (measurement: RoofMeasurement) => void;
  setShading: (pct: number) => void;
  addEquipment: (selection: { equipment: Equipment; quantity: number }[]) => void;
  updateItem: (equipmentId: string, patch: Partial<ProposalItem>) => void;
  removeItem: (equipmentId: string) => void;
  setValidityDays: (days: number) => void;
  toProposal: (technicianId: string, sequence: number, status: ProposalStatus) => Proposal | null;
}

const emptyDraft = (): DraftState => ({
  id: generateId(),
  client: null,
  installation: null,
  measurement: null,
  shadingPct: null,
  items: [],
  validityDays: commercialParameters.defaultValidityDays,
  sourceStatus: null,
});

const DraftContext = createContext<DraftContextValue | null>(null);

export function DraftStoreProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<DraftState>(emptyDraft);

  const calculation = useMemo(() => {
    if (!draft.installation || !draft.measurement) return null;
    return calculateProposal({
      installation: draft.installation,
      measurement: draft.measurement,
      shadingPct: draft.shadingPct ?? technicalParameters.defaultShadingPct,
      items: draft.items,
    });
  }, [draft.installation, draft.measurement, draft.shadingPct, draft.items]);

  const addEquipment = useCallback((selection: { equipment: Equipment; quantity: number }[]) => {
    setDraft((current) => {
      const items = [...current.items];
      for (const { equipment, quantity } of selection) {
        const index = items.findIndex((i) => i.equipmentId === equipment.id);
        if (index >= 0) {
          items[index] = { ...items[index], quantity: items[index].quantity + quantity };
        } else {
          items.push({
            equipmentId: equipment.id,
            category: equipment.category,
            name: equipment.name,
            quantity,
            catalogPrice: equipment.price,
            discountPct: 0,
            markupPct: 0,
            supplier: equipment.suppliers[0] ?? '',
            notes: '',
            powerW: equipment.powerW,
            phases: equipment.phases,
          });
        }
      }
      return { ...current, items };
    });
  }, []);

  const toProposal = useCallback(
    (technicianId: string, sequence: number, status: ProposalStatus): Proposal | null => {
      const { client, installation, measurement } = draft;
      if (!client || !installation || !measurement || !calculation) return null;
      const now = new Date().toISOString();
      return {
        id: draft.id,
        number: proposalNumber(new Date().getFullYear(), sequence),
        technicianId,
        client,
        installation,
        measurement,
        shadingPct: draft.shadingPct ?? technicalParameters.defaultShadingPct,
        items: draft.items,
        ...calculation,
        validityDays: draft.validityDays,
        status,
        syncStatus: 'pendente',
        version: 1,
        createdAt: now,
        generatedAt: status === 'gerada' ? now : undefined,
        updatedAt: now,
      };
    },
    [draft, calculation],
  );

  const value = useMemo<DraftContextValue>(
    () => ({
      ...draft,
      calculation,
      start: () => setDraft(emptyDraft()),
      load: (proposal, mode) =>
        setDraft({
          id: mode === 'edit' ? proposal.id : generateId(),
          client: proposal.client,
          installation: proposal.installation,
          measurement: proposal.measurement,
          shadingPct: proposal.shadingPct,
          items: proposal.items,
          validityDays: proposal.validityDays,
          sourceStatus: mode === 'edit' ? proposal.status : null,
        }),
      setClientData: (client, installation) => setDraft((d) => ({ ...d, client, installation })),
      setMeasurement: (measurement) => setDraft((d) => ({ ...d, measurement, shadingPct: null })),
      setShading: (shadingPct) => setDraft((d) => ({ ...d, shadingPct })),
      addEquipment,
      updateItem: (equipmentId, patch) =>
        setDraft((d) => ({
          ...d,
          items: d.items.map((i) => (i.equipmentId === equipmentId ? { ...i, ...patch } : i)),
        })),
      removeItem: (equipmentId) =>
        setDraft((d) => ({ ...d, items: d.items.filter((i) => i.equipmentId !== equipmentId) })),
      setValidityDays: (validityDays) => setDraft((d) => ({ ...d, validityDays })),
      toProposal,
    }),
    [draft, calculation, addEquipment, toProposal],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft(): DraftContextValue {
  const context = useContext(DraftContext);
  if (!context) throw new Error('useDraft deve ser usado dentro de DraftStoreProvider');
  return context;
}
