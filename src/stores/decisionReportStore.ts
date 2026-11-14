import { create } from 'zustand';
import {
  DecisionReportRecord,
  DecisionReportSummary,
  DecisionReportCreateRequest,
} from '../types/decisionReport';
import {
  fetchDecisionReports,
  fetchDecisionReport,
  createDecisionReport,
  deleteDecisionReport,
} from '../services/decisionReportApi';

interface DecisionReportState {
  reports: DecisionReportSummary[];
  activeReport: DecisionReportRecord | null;
  isCreateModalOpen: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadReports: () => Promise<void>;
  selectReport: (reportId: string) => Promise<void>;
  generateReport: (req: DecisionReportCreateRequest) => Promise<DecisionReportRecord>;
  removeReport: (reportId: string) => Promise<void>;
  openCreateModal: () => void;
  closeCreateModal: () => void;
  clearActiveReport: () => void;
}

export const useDecisionReportStore = create<DecisionReportState>((set, get) => ({
  reports: [],
  activeReport: null,
  isCreateModalOpen: false,
  isLoading: false,
  error: null,

  loadReports: async () => {
    set({ isLoading: true, error: null });
    try {
      const reps = await fetchDecisionReports();
      set({ reports: reps, isLoading: false });

      // If active report is not set and reports exist, select the first
      if (!get().activeReport && reps.length > 0) {
        get().selectReport(reps[0].id);
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to load decision reports', isLoading: false });
    }
  },

  selectReport: async (reportId: string) => {
    set({ isLoading: true, error: null });
    try {
      const rep = await fetchDecisionReport(reportId);
      set({ activeReport: rep, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch report details', isLoading: false });
    }
  },

  generateReport: async (req: DecisionReportCreateRequest) => {
    set({ isLoading: true, error: null });
    try {
      const rep = await createDecisionReport(req);
      const updatedList = await fetchDecisionReports();
      set({
        reports: updatedList,
        activeReport: rep,
        isCreateModalOpen: false,
        isLoading: false,
      });
      return rep;
    } catch (err: any) {
      set({ error: err.message || 'Failed to generate report', isLoading: false });
      throw err;
    }
  },

  removeReport: async (reportId: string) => {
    set({ isLoading: true, error: null });
    try {
      await deleteDecisionReport(reportId);
      const remaining = get().reports.filter((r) => r.id !== reportId);
      const newActive =
        get().activeReport?.id === reportId
          ? remaining.length > 0
            ? await fetchDecisionReport(remaining[0].id)
            : null
          : get().activeReport;

      set({ reports: remaining, activeReport: newActive, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete report', isLoading: false });
    }
  },

  openCreateModal: () => set({ isCreateModalOpen: true }),
  closeCreateModal: () => set({ isCreateModalOpen: false }),
  clearActiveReport: () => set({ activeReport: null }),
}));
