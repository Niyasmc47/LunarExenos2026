import { create } from 'zustand';
import {
  MissionWindowSearchRecord,
  EvaluatedMissionWindow,
  WindowClassification,
  WindowComparisonResponse,
  MissionWindowSearchRequest,
} from '../types/windowPlanner';
import {
  fetchWindowSearches,
  executeWindowSearch,
  deleteWindowSearch,
  compareWindows,
} from '../services/windowPlannerApi';

interface WindowPlannerState {
  searches: MissionWindowSearchRecord[];
  activeSearch: MissionWindowSearchRecord | null;
  selectedWindow: EvaluatedMissionWindow | null;
  selectedForComparison: string[];
  comparisonResult: WindowComparisonResponse | null;

  // Search form configuration
  selectedProfileId: string;
  selectedScenarioId: string;
  searchStartIso: string;
  searchEndIso: string;
  missionDurationDays: number;
  searchStepHours: number;
  analysisStepHours: number;
  overrideObserverHeight: number | null;
  customSearchName: string;

  // Filters & Sorting
  filterClassification: 'ALL' | WindowClassification;
  sortBy: 'chronological' | 'sunlight' | 'darkness' | 'earth';
  sortOrder: 'asc' | 'desc';

  // Modals
  isDetailOpen: boolean;
  isComparisonOpen: boolean;
  isExportOpen: boolean;

  loading: boolean;
  executing: boolean;
  comparing: boolean;
  error: string | null;

  // Actions
  init: () => Promise<void>;
  setSelectedProfileId: (id: string) => void;
  setSelectedScenarioId: (id: string) => void;
  setFormField: (field: string, value: any) => void;
  runSearch: () => Promise<void>;
  selectSearch: (searchId: string) => void;
  deleteSearch: (searchId: string) => Promise<void>;
  openDetailDrawer: (window: EvaluatedMissionWindow) => void;
  closeDetailDrawer: () => void;
  toggleComparisonSelection: (windowId: string) => void;
  clearComparisonSelection: () => void;
  runComparison: () => Promise<void>;
  closeComparisonModal: () => void;
  openExportModal: () => void;
  closeExportModal: () => void;
  setFilterClassification: (filter: 'ALL' | WindowClassification) => void;
  setSortBy: (sortBy: 'chronological' | 'sunlight' | 'darkness' | 'earth') => void;
  toggleSortOrder: () => void;
  clearError: () => void;
}

export const useWindowPlannerStore = create<WindowPlannerState>((set, get) => ({
  searches: [],
  activeSearch: null,
  selectedWindow: null,
  selectedForComparison: [],
  comparisonResult: null,

  selectedProfileId: 'template-robotic-rover',
  selectedScenarioId: 'scenario-cr-crest',
  searchStartIso: '2026-10-04T00:00:00Z',
  searchEndIso: '2026-10-14T00:00:00Z',
  missionDurationDays: 3.0,
  searchStepHours: 12.0,
  analysisStepHours: 2.0,
  overrideObserverHeight: null,
  customSearchName: '',

  filterClassification: 'ALL',
  sortBy: 'chronological',
  sortOrder: 'asc',

  isDetailOpen: false,
  isComparisonOpen: false,
  isExportOpen: false,

  loading: false,
  executing: false,
  comparing: false,
  error: null,

  init: async () => {
    set({ loading: true, error: null });
    try {
      const searches = await fetchWindowSearches();
      set({
        searches,
        activeSearch: searches.length > 0 ? searches[0] : null,
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to initialize window searches', loading: false });
    }
  },

  setSelectedProfileId: (id: string) => set({ selectedProfileId: id }),
  setSelectedScenarioId: (id: string) => set({ selectedScenarioId: id }),
  setFormField: (field: string, value: any) => set({ [field]: value }),

  runSearch: async () => {
    const s = get();
    set({ executing: true, error: null });
    try {
      const payload: MissionWindowSearchRequest = {
        profile_id: s.selectedProfileId,
        scenario_id: s.selectedScenarioId,
        search_start_iso: s.searchStartIso,
        search_end_iso: s.searchEndIso,
        mission_duration_days: s.missionDurationDays,
        search_step_hours: s.searchStepHours,
        analysis_step_hours: s.analysisStepHours,
        override_observer_height_m: s.overrideObserverHeight,
        name: s.customSearchName.trim() || undefined,
      };

      const newRecord = await executeWindowSearch(payload);
      const updatedList = [newRecord, ...s.searches.filter(r => r.id !== newRecord.id)];
      set({
        searches: updatedList,
        activeSearch: newRecord,
        selectedForComparison: [],
        comparisonResult: null,
        executing: false,
      });
    } catch (err: any) {
      set({ error: err.message || 'Window search failed', executing: false });
    }
  },

  selectSearch: (searchId: string) => {
    const s = get();
    const record = s.searches.find(r => r.id === searchId);
    if (record) {
      set({
        activeSearch: record,
        selectedForComparison: [],
        comparisonResult: null,
        selectedWindow: null,
      });
    }
  },

  deleteSearch: async (searchId: string) => {
    const s = get();
    try {
      await deleteWindowSearch(searchId);
      const remaining = s.searches.filter(r => r.id !== searchId);
      set({
        searches: remaining,
        activeSearch: s.activeSearch?.id === searchId ? (remaining.length > 0 ? remaining[0] : null) : s.activeSearch,
        selectedForComparison: [],
        comparisonResult: null,
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete search' });
    }
  },

  openDetailDrawer: (window: EvaluatedMissionWindow) => {
    set({ selectedWindow: window, isDetailOpen: true });
  },

  closeDetailDrawer: () => {
    set({ isDetailOpen: false });
  },

  toggleComparisonSelection: (windowId: string) => {
    const s = get();
    const current = s.selectedForComparison;
    if (current.includes(windowId)) {
      set({ selectedForComparison: current.filter(id => id !== windowId) });
    } else {
      if (current.length >= 4) {
        set({ error: 'Maximum 4 windows can be compared simultaneously.' });
        return;
      }
      set({ selectedForComparison: [...current, windowId], error: null });
    }
  },

  clearComparisonSelection: () => {
    set({ selectedForComparison: [], comparisonResult: null });
  },

  runComparison: async () => {
    const s = get();
    if (!s.activeSearch || s.selectedForComparison.length < 2) {
      set({ error: 'Please select at least 2 windows to compare.' });
      return;
    }
    set({ comparing: true, error: null });
    try {
      const result = await compareWindows(s.activeSearch.id, s.selectedForComparison);
      set({
        comparisonResult: result,
        comparing: false,
        isComparisonOpen: true,
      });
    } catch (err: any) {
      set({ error: err.message || 'Comparison failed', comparing: false });
    }
  },

  closeComparisonModal: () => {
    set({ isComparisonOpen: false });
  },

  openExportModal: () => {
    set({ isExportOpen: true });
  },

  closeExportModal: () => {
    set({ isExportOpen: false });
  },

  setFilterClassification: (filter: 'ALL' | WindowClassification) => {
    set({ filterClassification: filter });
  },

  setSortBy: (sortBy: 'chronological' | 'sunlight' | 'darkness' | 'earth') => {
    set({ sortBy });
  },

  toggleSortOrder: () => {
    const current = get().sortOrder;
    set({ sortOrder: current === 'asc' ? 'desc' : 'asc' });
  },

  clearError: () => set({ error: null }),
}));
