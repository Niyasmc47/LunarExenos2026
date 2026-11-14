import React from 'react';
import { useTradeOffStore } from '../../stores/tradeOffStore';
import { getTradeOffExportJsonUrl, getTradeOffExportCsvUrl } from '../../services/tradeOffApi';
import { X, Download, FileJson, FileSpreadsheet, CheckCircle } from 'lucide-react';

export const TradeOffExportModal: React.FC = () => {
  const isExportModalOpen = useTradeOffStore((state) => state.isExportModalOpen);
  const activeStudy = useTradeOffStore((state) => state.activeStudy);
  const closeExportModal = useTradeOffStore((state) => state.closeExportModal);

  if (!isExportModalOpen || !activeStudy) return null;

  const jsonUrl = getTradeOffExportJsonUrl(activeStudy.id);
  const csvUrl = getTradeOffExportCsvUrl(activeStudy.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0b101c] border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-mono font-bold text-white tracking-wide">
                EXPORT TRADE-OFF STUDY
              </h2>
              <span className="text-[11px] font-mono text-slate-400">
                Study ID: {activeStudy.id}
              </span>
            </div>
          </div>

          <button
            onClick={closeExportModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs font-mono text-slate-300">
            Export multi-criteria evaluation results, normalized scores, Pareto dominance, and sensitivity analysis for{' '}
            <span className="text-white font-semibold">{activeStudy.name}</span> (
            {activeStudy.alternatives.length} alternatives).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* JSON Export */}
            <a
              href={jsonUrl}
              download={`lunavista_tradeoff_${activeStudy.id}.json`}
              className="flex flex-col p-4 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 transition-all group"
            >
              <div className="flex items-center justify-between">
                <FileJson className="w-6 h-6 text-indigo-400 group-hover:scale-110 transition-transform" />
                <Download className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </div>
              <span className="text-xs font-mono font-bold text-white mt-3 block">
                Complete JSON Snapshot
              </span>
              <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                Includes full profile snapshots, provenance, calculation steps, Pareto frontier, and sensitivity matrix.
              </span>
            </a>

            {/* CSV Export */}
            <a
              href={csvUrl}
              download={`lunavista_tradeoff_${activeStudy.id}.csv`}
              className="flex flex-col p-4 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 transition-all group"
            >
              <div className="flex items-center justify-between">
                <FileSpreadsheet className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
                <Download className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </div>
              <span className="text-xs font-mono font-bold text-white mt-3 block">
                Comparison Matrix (CSV)
              </span>
              <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                Tabular matrix of alternative metrics, compliance verdicts, Pareto status, and composite scores.
              </span>
            </a>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-[10px] font-mono text-slate-400 space-y-1">
            <div className="text-slate-300 font-semibold flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-emerald-400" />
              <span>Scientific Traceability Guaranteed</span>
            </div>
            <p>
              Exported files include calculation timestamps, reference normalization bounds, criteria weights, and mandatory disclaimers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
