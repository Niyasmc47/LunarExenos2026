import { create } from 'zustand';
import {
  ScreeningRunRecord,
  CandidateScreeningRequest,
} from '../types/screening';
import {
  fetchScreeningRuns,
  runCandidateScreening,
  deleteScreeningRun,
} from '../services/screeningApi';

interface ScreeningState {
  runs: ScreeningRunRecord[];
  activeRun: ScreeningRunRecord | null;
  selectedCandidateId: string | null;

  // Configuration controls for new screening
  selectedProfileId: string;
  selectedScenarioIds: string[];
  overrideStartIso: string;
  overrideEndIso: string;
  overrideDurationDays: number;
  overrideObserverHeight: number;
  stepIntervalHours: number;
  azimuthResolutionDeg: number;
  maxSearchDistanceM: number;
  customRunName: string;

  loading: boolean;
  executing: boolean;
  error: string | null;

  // Actions
  init: () => Promise<void>;
  setSelectedProfileId: (id: string) => void;
  toggleScenarioSelection: (scenarioId: string) => void;
  selectAllScenarios: (scenarioIds: string[]) => void;
  clearScenarioSelection: () => void;
  setOverrideField: (field: string, value: any) => void;
  executeScreening: () => Promise<void>;
  selectRun: (runId: string) => void;
  deleteRun: (runId: string) => Promise<void>;
  selectCandidate: (candidateId: string) => void;
  clearError: () => void;
}

export const useScreeningStore = create<ScreeningState>((set, get) => ({
  runs: [],
  activeRun: null,
  selectedCandidateId: null,

  selectedProfileId: 'template-robotic-rover',
  selectedScenarioIds: ['scenario-cr-crest', 'scenario-cr-alpha', 'scenario-cr-south'],
  overrideStartIso: '2026-10-04T12:00:00Z',
  overrideEndIso: '2026-10-07T12:00:00Z',
  overrideDurationDays: 3.0,
  overrideObserverHeight: 2.0,
  stepIntervalHours: 2.0,
  azimuthResolutionDeg: 2.0,
  maxSearchDistanceM: 5000.0,
  customRunName: '',

  loading: false,
  executing: false,
  error: null,

  init: async () => {
    set({ loading: true, error: null });
    try {
      const runs = await fetchScreeningRuns();
      set({
        runs,
        activeRun: runs.length > 0 ? runs[0] : null,
        selectedCandidateId: runs.length > 0 && runs[0].candidates.length > 0 ? runs[0].candidates[0].candidate_id : null,
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  setSelectedProfileId: (id: string) => {
    set({ selectedProfileId: id });
  },

  toggleScenarioSelection: (scenarioId: string) => {
    const { selectedScenarioIds } = get();
    if (selectedScenarioIds.includes(scenarioId)) {
      set({ selectedScenarioIds: selectedScenarioIds.filter((id) => id !== scenarioId) });
    } else {
      set({ selectedScenarioIds: [...selectedScenarioIds, scenarioId] });
    }
  },

  selectAllScenarios: (scenarioIds: string[]) => {
    set({ selectedScenarioIds: scenarioIds });
  },

  clearScenarioSelection: () => {
    set({ selectedScenarioIds: [] });
  },

  setOverrideField: (field: string, value: any) => {
    set({ [field]: value } as any);
  },

  executeScreening: async () => {
    const state = get();
    if (!state.selectedProfileId) {
      set({ error: 'Please select a mission profile before running candidate screening.' });
      return;
    }
    if (state.selectedScenarioIds.length === 0) {
      set({ error: 'Please select at least one candidate scenario to screen.' });
      return;
    }

    set({ executing: true, error: null });
    try {
      const req: CandidateScreeningRequest = {
        profile_id: state.selectedProfileId,
        scenario_ids: state.selectedScenarioIds,
        override_start_iso: state.overrideStartIso || undefined,
        override_end_iso: state.overrideEndIso || undefined,
        override_duration_days: state.overrideDurationDays || undefined,
        override_observer_height_m: state.overrideObserverHeight || undefined,
        step_interval_hours: state.stepIntervalHours,
        azimuth_resolution_deg: state.azimuthResolutionDeg,
        max_search_distance_m: state.maxSearchDistanceM,
        name: state.customRunName.trim() || undefined,
      };

      const newRun = await runCandidateScreening(req);
      const updatedRuns = [newRun, ...state.runs.filter((r) => r.id !== newRun.id)];
      set({
        runs: updatedRuns,
        activeRun: newRun,
        selectedCandidateId: newRun.candidates.length > 0 ? newRun.candidates[0].candidate_id : null,
        executing: false,
      });
    } catch (err: any) {
      set({ error: err.message, executing: false });
    }
  },

  selectRun: (runId: string) => {
    const { runs } = get();
    const run = runs.find((r) => r.id === runId) || null;
    set({
      activeRun: run,
      selectedCandidateId: run && run.candidates.length > 0 ? run.candidates[0].candidate_id : null,
    });
  },

  deleteRun: async (runId: string) => {
    try {
      await deleteScreeningRun(runId);
      const { runs, activeRun } = get();
      const updated = runs.filter((r) => r.id !== runId);
      const newActive = activeRun?.id === runId ? (updated.length > 0 ? updated[0] : null) : activeRun;
      set({
        runs: updated,
        activeRun: newActive,
        selectedCandidateId: newActive && newActive.candidates.length > 0 ? newActive.candidates[0].candidate_id : null,
      });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  selectCandidate: (candidateId: string) => {
    set({ selectedCandidateId: candidateId });
  },

  clearError: () => {
    set({ error: null });
  },
}));
