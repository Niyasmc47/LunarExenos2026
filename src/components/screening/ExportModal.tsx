import { DialogSurface } from '../ui/DialogSurface';
import React from 'react';
import { ScreeningRunRecord } from '../../types/screening';
import { getScreeningExportJsonUrl, getScreeningExportCsvUrl } from '../../services/screeningApi';
import { Download, FileJson, FileSpreadsheet, X } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  run: ScreeningRunRecord;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, run }) => {
  if (!isOpen) return null;

  return (
    <DialogSurface label="Export screening results" onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-[#0b101c] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-100 font-mono">
              Export Candidate Screening Results
            </h3>
          </div>
          <button
            aria-label="Close dialog" onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="text-xs text-slate-300 font-sans leading-relaxed">
            Export the complete, evidence-backed evaluation data for{' '}
            <strong className="text-slate-100 font-mono">{run.name}</strong> ({run.candidates.length} candidates).
            All underlying measured quantities, criteria, and provenance metadata are included.
          </div>

          <div className="space-y-3 pt-2">
            {/* JSON Export */}
            <a
              href={getScreeningExportJsonUrl(run.id)}
              download={`lunavista_screening_${run.id}.json`}
              className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-[#0e1628] hover:border-emerald-500/50 hover:bg-[#121d36] transition-all group"
            >
              <div className="flex items-center gap-3">
                <FileJson className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="text-xs font-mono font-bold text-slate-100 group-hover:text-emerald-300">
                    Structured JSON Export
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans">
                    Complete machine-readable schema with nested metrics & snapshot
                  </div>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-500 group-hover:text-emerald-400" />
            </a>

            {/* CSV Export */}
            <a
              href={getScreeningExportCsvUrl(run.id)}
              download={`lunavista_screening_${run.id}.csv`}
              className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-[#0e1628] hover:border-cyan-500/50 hover:bg-[#121d36] transition-all group"
            >
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
                <div>
                  <div className="text-xs font-mono font-bold text-slate-100 group-hover:text-cyan-300">
                    Tabular CSV Export
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans">
                    Formatted tables for spreadsheet & mission trade studies
                  </div>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-500 group-hover:text-cyan-400" />
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/40 text-[11px] text-slate-400 font-mono text-center">
          Run ID: {run.id}
        </div>
      </div>
    </DialogSurface>
  );
};
