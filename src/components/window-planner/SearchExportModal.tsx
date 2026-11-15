import { DialogSurface } from '../ui/DialogSurface';
import React from 'react';
import { useWindowPlannerStore } from '../../stores/windowPlannerStore';
import {
  getWindowExportJsonUrl,
  getWindowExportCsvUrl,
} from '../../services/windowPlannerApi';
import {
  X,
  Download,
  FileJson,
  FileSpreadsheet,
  CheckCircle,
} from 'lucide-react';

export const SearchExportModal: React.FC = () => {
  const isExportOpen = useWindowPlannerStore((state) => state.isExportOpen);
  const activeSearch = useWindowPlannerStore((state) => state.activeSearch);
  const closeExportModal = useWindowPlannerStore((state) => state.closeExportModal);

  if (!isExportOpen || !activeSearch) return null;

  const jsonUrl = getWindowExportJsonUrl(activeSearch.id);
  const csvUrl = getWindowExportCsvUrl(activeSearch.id);

  return (
    <DialogSurface label="Export mission windows" onClose={closeExportModal} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#141619] border border-[#303238]/80 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#2b2d32]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-mono font-bold text-white tracking-wide">
                EXPORT MISSION WINDOW SEARCH DATA
              </h2>
              <span className="text-[11px] font-mono text-slate-400">
                Search ID: {activeSearch.id}
              </span>
            </div>
          </div>

          <button
            aria-label="Close dialog" onClick={closeExportModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs font-mono text-slate-300">
            Select preferred scientific export format for{' '}
            <span className="text-white font-semibold">{activeSearch.name}</span> (
            {activeSearch.windows.length} evaluated windows).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* JSON Export */}
            <a
              href={jsonUrl}
              download={`lunavista_window_search_${activeSearch.id}.json`}
              className="flex flex-col p-4 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-[#2b2d32] hover:border-indigo-500/50 transition-all group"
            >
              <div className="flex items-center justify-between">
                <FileJson className="w-6 h-6 text-indigo-400 group-hover:scale-110 transition-transform" />
                <Download className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </div>
              <span className="text-xs font-mono font-bold text-white mt-3 block">
                Structured JSON
              </span>
              <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                Includes full profile & scenario snapshots, horizon profiles, and SPICE provenance.
              </span>
            </a>

            {/* CSV Export */}
            <a
              href={csvUrl}
              download={`lunavista_windows_${activeSearch.id}.csv`}
              className="flex flex-col p-4 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-[#2b2d32] hover:border-emerald-500/50 transition-all group"
            >
              <div className="flex items-center justify-between">
                <FileSpreadsheet className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
                <Download className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </div>
              <span className="text-xs font-mono font-bold text-white mt-3 block">
                Tabular CSV
              </span>
              <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                Flat table of window start/end, classification, solar/Earth metrics for spreadsheets.
              </span>
            </a>
          </div>

          <div className="p-3 bg-slate-900/40 rounded-lg border border-[#2b2d32] text-[10px] font-mono text-slate-400 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              All exports preserve scientific disclaimers and coordinate/epoch provenance.
            </span>
          </div>
        </div>
      </div>
    </DialogSurface>
  );
};
