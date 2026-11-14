import React from 'react';
import { useDecisionReportStore } from '../../stores/decisionReportStore';
import { FileText, Plus, Trash2, Calendar, ShieldCheck, RefreshCw } from 'lucide-react';

export const ReportHistoryList: React.FC = () => {
  const reports = useDecisionReportStore((state) => state.reports);
  const activeReport = useDecisionReportStore((state) => state.activeReport);
  const selectReport = useDecisionReportStore((state) => state.selectReport);
  const removeReport = useDecisionReportStore((state) => state.removeReport);
  const openCreateModal = useDecisionReportStore((state) => state.openCreateModal);
  const loadReports = useDecisionReportStore((state) => state.loadReports);
  const isLoading = useDecisionReportStore((state) => state.isLoading);

  return (
    <div className="w-80 border-r border-slate-800 bg-[#090e1b] flex flex-col h-full shrink-0 text-xs font-mono">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400" />
            <span>Mission Reports</span>
          </h3>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {reports.length} Generated Technical Reports
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => loadReports()}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Refresh reports"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={openCreateModal}
            className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold flex items-center gap-1 transition-all shadow-md shadow-purple-950/40 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Report</span>
          </button>
        </div>
      </div>

      {/* Reports List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {reports.length === 0 ? (
          <div className="text-center p-8 text-slate-500 space-y-2">
            <FileText className="w-8 h-8 mx-auto opacity-30 text-purple-400" />
            <p className="text-xs">No mission decision reports generated yet.</p>
            <button
              onClick={openCreateModal}
              className="text-purple-400 hover:text-purple-300 underline text-xs"
            >
              Generate your first report
            </button>
          </div>
        ) : (
          reports.map((r) => {
            const isSelected = activeReport?.id === r.id;

            return (
              <div
                key={r.id}
                onClick={() => selectReport(r.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 relative group ${
                  isSelected
                    ? 'bg-purple-950/30 border-purple-500/50 shadow-md shadow-purple-950/30'
                    : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-white text-xs leading-snug line-clamp-1">
                    {r.title}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete mission decision report '${r.title}'?`)) {
                        removeReport(r.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded transition-all"
                    title="Delete report"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="text-[11px] text-slate-400 truncate">
                  Mission: {r.mission_name}
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{r.created_at_iso.slice(0, 10)}</span>
                  </span>

                  <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                    <ShieldCheck className="w-3 h-3" />
                    <span>{r.compliant_count}/{r.total_candidates} Compliant</span>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
