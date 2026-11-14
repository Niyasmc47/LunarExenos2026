import { create } from 'zustand';
import {
  TerrainAssessmentRecord,
  TerrainSuitabilityStatus,
  CandidateTerrainAssessment,
  TerrainAssessmentRequest,
} from '../types/terrainAssessment';
import {
  fetchTerrainAssessments,
  runTerrainAssessment,
  deleteTerrainAssessment,
} from '../services/terrainAssessmentApi';

interface TerrainAssessmentState {
  assessments: TerrainAssessmentRecord[];
  activeAssessment: TerrainAssessmentRecord | null;
  selectedCandidateId: string | null;

  // Form controls
  selectedProfileId: string;
  selectedScenarioIds: string[];
  assessmentRadiusM: number;
  customName: string;

  filterStatus: 'ALL' | TerrainSuitabilityStatus;

  isDetailOpen: boolean;
  isExportOpen: boolean;

  loading: boolean;
  executing: boolean;
  error: string | null;

  // Actions
  init: () => Promise<void>;
  setSelectedProfileId: (id: string) => void;
  toggleScenarioSelection: (scenarioId: string) => void;
  selectAllScenarios: (scenarioIds: string[]) => void;
  clearScenarioSelection: () => void;
  setAssessmentRadius: (radiusM: number) => void;
  setCustomName: (name: string) => void;
  executeAssessment: () => Promise<void>;
  selectAssessment: (id: string) => void;
  deleteAssessment: (id: string) => Promise<void>;
  selectCandidate: (candidateId: string) => void;
  openDetailDrawer: (candidate: CandidateTerrainAssessment) => void;
  closeDetailDrawer: () => void;
  openExportModal: () => void;
  closeExportModal: () => void;
  setFilterStatus: (status: 'ALL' | TerrainSuitabilityStatus) => void;
  clearError: () => void;
}

export const useTerrainAssessmentStore = create<TerrainAssessmentState>((set, get) => ({
  assessments: [],
  activeAssessment: null,
  selectedCandidateId: null,

  selectedProfileId: 'template-robotic-rover',
  selectedScenarioIds: ['scenario-cr-crest', 'scenario-cr-alpha', 'scenario-cr-south'],
  assessmentRadiusM: 50.0,
  customName: '',

  filterStatus: 'ALL',

  isDetailOpen: false,
  isExportOpen: false,

  loading: false,
  executing: false,
  error: null,

  init: async () => {
    set({ loading: true, error: null });
    try {
      const records = await fetchTerrainAssessments();
      set({
        assessments: records,
        activeAssessment: records.length > 0 ? records[0] : null,
        selectedCandidateId: records.length > 0 && records[0].candidates.length > 0 ? records[0].candidates[0].candidate_id : null,
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch terrain assessments', loading: false });
    }
  },

  setSelectedProfileId: (id: string) => set({ selectedProfileId: id }),

  toggleScenarioSelection: (scenarioId: string) => {
    const current = get().selectedScenarioIds;
    if (current.includes(scenarioId)) {
      set({ selectedScenarioIds: current.filter((id) => id !== scenarioId) });
    } else {
      set({ selectedScenarioIds: [...current, scenarioId] });
    }
  },

  selectAllScenarios: (scenarioIds: string[]) => set({ selectedScenarioIds: scenarioIds }),

  clearScenarioSelection: () => set({ selectedScenarioIds: [] }),

  setAssessmentRadius: (radiusM: number) => set({ assessmentRadiusM: radiusM }),

  setCustomName: (name: string) => set({ customName: name }),

  executeAssessment: async () => {
    const s = get();
    if (s.selectedScenarioIds.length === 0) {
      set({ error: 'Please select at least one candidate scenario.' });
      return;
    }

    set({ executing: true, error: null });
    try {
      const payload: TerrainAssessmentRequest = {
        profile_id: s.selectedProfileId,
        scenario_ids: s.selectedScenarioIds,
        assessment_radius_m: s.assessmentRadiusM,
        name: s.customName.trim() || undefined,
      };

      const record = await runTerrainAssessment(payload);
      const updatedList = [record, ...s.assessments.filter((r) => r.id !== record.id)];
      set({
        assessments: updatedList,
        activeAssessment: record,
        selectedCandidateId: record.candidates.length > 0 ? record.candidates[0].candidate_id : null,
        executing: false,
      });
    } catch (err: any) {
      set({ error: err.message || 'Terrain assessment execution failed', executing: false });
    }
  },

  selectAssessment: (id: string) => {
    const record = get().assessments.find((r) => r.id === id);
    if (record) {
      set({
        activeAssessment: record,
        selectedCandidateId: record.candidates.length > 0 ? record.candidates[0].candidate_id : null,
      });
    }
  },

  deleteAssessment: async (id: string) => {
    const s = get();
    try {
      await deleteTerrainAssessment(id);
      const remaining = s.assessments.filter((r) => r.id !== id);
      set({
        assessments: remaining,
        activeAssessment: s.activeAssessment?.id === id ? (remaining.length > 0 ? remaining[0] : null) : s.activeAssessment,
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete assessment' });
    }
  },

  selectCandidate: (candidateId: string) => set({ selectedCandidateId: candidateId }),

  openDetailDrawer: (candidate: CandidateTerrainAssessment) => {
    set({ selectedCandidateId: candidate.candidate_id, isDetailOpen: true });
  },

  closeDetailDrawer: () => set({ isDetailOpen: false }),

  openExportModal: () => set({ isExportOpen: true }),

  closeExportModal: () => set({ isExportOpen: false }),

  setFilterStatus: (status: 'ALL' | TerrainSuitabilityStatus) => set({ filterStatus: status }),

  clearError: () => set({ error: null }),
}));
