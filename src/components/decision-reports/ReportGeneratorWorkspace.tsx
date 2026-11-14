import React, { useEffect } from 'react';
import { useDecisionReportStore } from '../../stores/decisionReportStore';
import { ReportHistoryList } from './ReportHistoryList';
import { ReportViewer } from './ReportViewer';
import { CreateReportModal } from './CreateReportModal';
import { FileText, Plus } from 'lucide-react';

export const ReportGeneratorWorkspace: React.FC = () => {
  const loadReports = useDecisionReportStore((state) => state.loadReports);
  const activeReport = useDecisionReportStore((state) => state.activeReport);
  const openCreateModal = useDecisionReportStore((state) => state.openCreateModal);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  return (
    <div className="flex-1 flex overflow-hidden bg-[#070a14]">
      {/* Sidebar: Historical Reports */}
      <ReportHistoryList />

      {/* Main Area: Active Report Viewer or Empty State */}
      {activeReport ? (
        <ReportViewer report={activeReport} />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 font-mono space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-purple-400">
            <FileText className="w-12 h-12 stroke-[1.2]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">No Mission Decision Report Selected</h3>
            <p className="text-xs text-slate-400 max-w-md">
              Select an existing report from the left sidebar or generate a new technical report
              from your saved trade-off studies and analysis runs.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-lg shadow-purple-900/40"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Decision Report</span>
          </button>
        </div>
      )}

      {/* Create Report Modal */}
      <CreateReportModal />
    </div>
  );
};
