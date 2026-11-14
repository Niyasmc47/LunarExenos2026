import { create } from 'zustand';
import {
  ScenarioRecord,
  ScenarioCreateRequest,
  ScenarioUpdateRequest,
  MissionConstraints,
  MultiScenarioComparisonResponse,
} from '../types/scenario';
import {
  fetchScenarios,
  createScenario,
  updateScenario,
  deleteScenario,
  duplicateScenario,
  compareScenarios,
  exportComparison,
} from '../services/scenarioApi';

interface ScenarioState {
  scenarios: ScenarioRecord[];
  selectedScenarioIds: string[];
  activeScenarioId: string | null;

  comparisonResult: MultiScenarioComparisonResponse | null;
  constraints: MissionConstraints;

  enforceHarmonizedTime: boolean;
  overrideDurationDays: number;
  overrideStepHours: number;

  isLoadingScenarios: boolean;
  isComparing: boolean;
  isExporting: boolean;
  error: string | null;

  // Actions
  loadScenarios: () => Promise<void>;
  toggleScenarioSelection: (id: string) => void;
  setActiveScenarioId: (id: string | null) => void;
  setConstraints: (constraints: Partial<MissionConstraints>) => void;
  setEnforceHarmonizedTime: (enforce: boolean) => void;
  setOverrideDurationDays: (days: number) => void;
  setOverrideStepHours: (step: number) => void;

  runComparison: () => Promise<void>;
  addScenario: (req: ScenarioCreateRequest) => Promise<boolean>;
  editScenario: (id: string, req: ScenarioUpdateRequest) => Promise<boolean>;
  copyScenario: (id: string) => Promise<boolean>;
  removeScenario: (id: string) => Promise<boolean>;
  downloadExport: (format: 'json' | 'csv') => Promise<void>;
}

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  scenarios: [],
  selectedScenarioIds: ['scenario-cr-crest', 'scenario-cr-alpha'],
  activeScenarioId: 'scenario-cr-crest',

  comparisonResult: null,
  constraints: {
    min_sunlight_hours: 24.0,
    max_darkness_hours: 24.0,
    min_earth_visible_hours: 24.0,
    max_allowable_slope_deg: 15.0,
  },

  enforceHarmonizedTime: true,
  overrideDurationDays: 3.0,
  overrideStepHours: 2.0,

  isLoadingScenarios: false,
  isComparing: false,
  isExporting: false,
  error: null,

  loadScenarios: async () => {
    set({ isLoadingScenarios: true, error: null });
    try {
      const list = await fetchScenarios();
      set({ scenarios: list, isLoadingScenarios: false });
      // If none selected, default select up to 2
      const current = get().selectedScenarioIds;
      if (current.length === 0 && list.length >= 2) {
        set({
          selectedScenarioIds: [list[0].id, list[1].id],
          activeScenarioId: list[0].id,
        });
      }
    } catch (err: any) {
      set({
        isLoadingScenarios: false,
        error: err?.message || 'Failed to load scenarios',
      });
    }
  },

  toggleScenarioSelection: (id: string) => {
    const { selectedScenarioIds } = get();
    if (selectedScenarioIds.includes(id)) {
      if (selectedScenarioIds.length <= 2) {
        // Minimum 2 required
        return;
      }
      set({
        selectedScenarioIds: selectedScenarioIds.filter((sid) => sid !== id),
      });
    } else {
      if (selectedScenarioIds.length >= 4) {
        // Maximum 4 allowed
        return;
      }
      set({ selectedScenarioIds: [...selectedScenarioIds, id] });
    }
  },

  setActiveScenarioId: (id) => set({ activeScenarioId: id }),

  setConstraints: (newConstraints) => {
    set({ constraints: { ...get().constraints, ...newConstraints } });
  },

  setEnforceHarmonizedTime: (enforce) => set({ enforceHarmonizedTime: enforce }),
  setOverrideDurationDays: (days) => set({ overrideDurationDays: days }),
  setOverrideStepHours: (step) => set({ overrideStepHours: step }),

  runComparison: async () => {
    const {
      selectedScenarioIds,
      enforceHarmonizedTime,
      overrideDurationDays,
      overrideStepHours,
      constraints,
    } = get();

    if (selectedScenarioIds.length < 2 || selectedScenarioIds.length > 4) {
      set({ error: 'Please select between 2 and 4 scenarios for comparison.' });
      return;
    }

    set({ isComparing: true, error: null });

    try {
      const resp = await compareScenarios({
        scenario_ids: selectedScenarioIds,
        enforce_harmonized_time: enforceHarmonizedTime,
        override_duration_days: overrideDurationDays,
        override_step_hours: overrideStepHours,
        constraints,
      });

      if (!resp) {
        set({ isComparing: false, error: 'Comparison returned no data.' });
        return;
      }

      set({ comparisonResult: resp, isComparing: false, error: null });
    } catch (err: any) {
      set({
        isComparing: false,
        error: err?.message || 'Multi-scenario comparison failed',
      });
    }
  },

  addScenario: async (req) => {
    try {
      const created = await createScenario(req);
      if (created) {
        await get().loadScenarios();
        // If room, select it
        const cur = get().selectedScenarioIds;
        if (cur.length < 4) {
          set({ selectedScenarioIds: [...cur, created.id] });
        }
        return true;
      }
      return false;
    } catch (err: any) {
      set({ error: err?.message || 'Failed to create scenario' });
      return false;
    }
  },

  editScenario: async (id, req) => {
    try {
      const updated = await updateScenario(id, req);
      if (updated) {
        await get().loadScenarios();
        await get().runComparison();
        return true;
      }
      return false;
    } catch (err: any) {
      set({ error: err?.message || 'Failed to update scenario' });
      return false;
    }
  },

  copyScenario: async (id) => {
    try {
      const cloned = await duplicateScenario(id);
      if (cloned) {
        await get().loadScenarios();
        return true;
      }
      return false;
    } catch (err: any) {
      set({ error: err?.message || 'Failed to duplicate scenario' });
      return false;
    }
  },

  removeScenario: async (id) => {
    try {
      const ok = await deleteScenario(id);
      if (ok) {
        const cur = get().selectedScenarioIds.filter((sid) => sid !== id);
        set({ selectedScenarioIds: cur });
        await get().loadScenarios();
        if (cur.length >= 2) {
          await get().runComparison();
        }
        return true;
      }
      return false;
    } catch (err: any) {
      set({ error: err?.message || 'Failed to delete scenario' });
      return false;
    }
  },

  downloadExport: async (format) => {
    const { comparisonResult } = get();
    if (!comparisonResult) return;

    set({ isExporting: true });
    try {
      const content = await exportComparison({
        comparison_response: comparisonResult,
        format,
      });

      const mimeType = format === 'csv' ? 'text/csv' : 'application/json';
      const ext = format === 'csv' ? 'csv' : 'json';
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lunavista_scenario_comparison_${comparisonResult.comparison_id}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      set({ isExporting: false });
    } catch (err: any) {
      set({
        isExporting: false,
        error: err?.message || 'Failed to export comparison data',
      });
    }
  },
}));
