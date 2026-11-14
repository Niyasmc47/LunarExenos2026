import { create } from 'zustand';
import {
  TradeOffStudyRecord,
  TradeOffStudyCreateRequest,
  PreferenceModelConfig,
} from '../types/tradeOff';
import {
  createTradeOffStudy,
  fetchTradeOffStudies,
  fetchTradeOffStudy,
  updateTradeOffStudy,
  deleteTradeOffStudy,
  reanalyzeTradeOffStudy,
  runTradeOffSensitivity,
} from '../services/tradeOffApi';

export type TradeOffTab = 'comparison' | 'radar' | 'pareto' | 'sensitivity' | 'preferences';

interface TradeOffState {
  studies: TradeOffStudyRecord[];
  activeStudy: TradeOffStudyRecord | null;
  selectedAlternativeId: string | null;
  activeTab: TradeOffTab;
  isDetailOpen: boolean;
  isCreateModalOpen: boolean;
  isExportModalOpen: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadStudies: () => Promise<void>;
  selectStudy: (id: string) => Promise<void>;
  createStudy: (req: TradeOffStudyCreateRequest) => Promise<TradeOffStudyRecord>;
  updatePreferences: (model: PreferenceModelConfig) => Promise<void>;
  removeAlternative: (altId: string) => Promise<void>;
  deleteStudy: (id: string) => Promise<void>;
  reanalyzeCurrentStudy: () => Promise<void>;
  runSensitivityAnalysis: () => Promise<void>;
  setActiveTab: (tab: TradeOffTab) => void;
  openDetailDrawer: (altId: string) => void;
  closeDetailDrawer: () => void;
  openCreateModal: () => void;
  closeCreateModal: () => void;
  openExportModal: () => void;
  closeExportModal: () => void;
  clearError: () => void;
}

export const useTradeOffStore = create<TradeOffState>((set, get) => ({
  studies: [],
  activeStudy: null,
  selectedAlternativeId: null,
  activeTab: 'comparison',
  isDetailOpen: false,
  isCreateModalOpen: false,
  isExportModalOpen: false,
  isLoading: false,
  error: null,

  loadStudies: async () => {
    set({ isLoading: true, error: null });
    try {
      const list = await fetchTradeOffStudies();
      const current = get().activeStudy;
      let nextActive = current;

      if (!current && list.length > 0) {
        nextActive = list[0];
      } else if (current) {
        const found = list.find((s) => s.id === current.id);
        nextActive = found || (list.length > 0 ? list[0] : null);
      }

      set({
        studies: list,
        activeStudy: nextActive,
        selectedAlternativeId: nextActive && nextActive.alternatives.length > 0 ? nextActive.alternatives[0].id : null,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to load trade-off studies', isLoading: false });
    }
  },

  selectStudy: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const full = await fetchTradeOffStudy(id);
      set({
        activeStudy: full,
        selectedAlternativeId: full.alternatives.length > 0 ? full.alternatives[0].id : null,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message || `Failed to select study ${id}`, isLoading: false });
    }
  },

  createStudy: async (req: TradeOffStudyCreateRequest) => {
    set({ isLoading: true, error: null });
    try {
      const created = await createTradeOffStudy(req);
      const updatedList = [created, ...get().studies.filter((s) => s.id !== created.id)];
      set({
        studies: updatedList,
        activeStudy: created,
        selectedAlternativeId: created.alternatives.length > 0 ? created.alternatives[0].id : null,
        isCreateModalOpen: false,
        isLoading: false,
      });
      return created;
    } catch (err: any) {
      set({ error: err.message || 'Failed to create trade-off study', isLoading: false });
      throw err;
    }
  },

  updatePreferences: async (model: PreferenceModelConfig) => {
    const study = get().activeStudy;
    if (!study) return;

    set({ isLoading: true, error: null });
    try {
      const updated = await updateTradeOffStudy(study.id, { preference_model: model });
      const updatedList = get().studies.map((s) => (s.id === updated.id ? updated : s));
      set({
        studies: updatedList,
        activeStudy: updated,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to update preferences', isLoading: false });
    }
  },

  removeAlternative: async (altId: string) => {
    const study = get().activeStudy;
    if (!study) return;

    const remainingAlts = study.alternatives.filter((a) => a.id !== altId);
    if (remainingAlts.length < 2) {
      set({ error: 'A trade-off study must have at least 2 alternatives.' });
      return;
    }

    // Map remaining to inputs
    const inputs = remainingAlts.map((a) => ({
      name: a.name,
      description: a.description,
      notes: a.notes,
      scenario_id: a.candidate_id,
      window_search_id: a.provenance.window_search_id || null,
      window_id: a.source_window_id || null,
      terrain_assessment_id: a.source_terrain_assessment_id || null,
      screening_run_id: a.source_screening_id || null,
    }));

    set({ isLoading: true, error: null });
    try {
      const updated = await updateTradeOffStudy(study.id, { alternatives: inputs });
      const updatedList = get().studies.map((s) => (s.id === updated.id ? updated : s));
      set({
        studies: updatedList,
        activeStudy: updated,
        selectedAlternativeId: updated.alternatives.length > 0 ? updated.alternatives[0].id : null,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to remove alternative', isLoading: false });
    }
  },

  deleteStudy: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await deleteTradeOffStudy(id);
      const remaining = get().studies.filter((s) => s.id !== id);
      set({
        studies: remaining,
        activeStudy: remaining.length > 0 ? remaining[0] : null,
        selectedAlternativeId: remaining.length > 0 && remaining[0].alternatives.length > 0 ? remaining[0].alternatives[0].id : null,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message || `Failed to delete study ${id}`, isLoading: false });
    }
  },

  reanalyzeCurrentStudy: async () => {
    const study = get().activeStudy;
    if (!study) return;

    set({ isLoading: true, error: null });
    try {
      const updated = await reanalyzeTradeOffStudy(study.id);
      const updatedList = get().studies.map((s) => (s.id === updated.id ? updated : s));
      set({
        studies: updatedList,
        activeStudy: updated,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to reanalyze study', isLoading: false });
    }
  },

  runSensitivityAnalysis: async () => {
    const study = get().activeStudy;
    if (!study) return;

    set({ isLoading: true, error: null });
    try {
      const sens = await runTradeOffSensitivity(study.id);
      const updated = { ...study, sensitivity_summary: sens };
      const updatedList = get().studies.map((s) => (s.id === updated.id ? updated : s));
      set({
        studies: updatedList,
        activeStudy: updated,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to run sensitivity analysis', isLoading: false });
    }
  },

  setActiveTab: (tab: TradeOffTab) => set({ activeTab: tab }),
  openDetailDrawer: (altId: string) => set({ selectedAlternativeId: altId, isDetailOpen: true }),
  closeDetailDrawer: () => set({ isDetailOpen: false }),
  openCreateModal: () => set({ isCreateModalOpen: true }),
  closeCreateModal: () => set({ isCreateModalOpen: false }),
  openExportModal: () => set({ isExportModalOpen: true }),
  closeExportModal: () => set({ isExportModalOpen: false }),
  clearError: () => set({ error: null }),
}));
