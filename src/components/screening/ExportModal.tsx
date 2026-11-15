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
      <div className="relative w-full max-w-md bg-[#191b20] border border-[#2b2d32] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#202228] flex items-center justify-between bg-[#141619]">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-[#ffe3b0]" />
            <h3 className="text-sm font-bold text-slate-100 font-mono">
              Export Candidate Screening Results
            </h3>
          </div>
          <button
            aria-label="Close dialog" onClick={onClose}
            className="p-1 rounded-lg hover:bg-[#202228] text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="text-xs text-slate-300 font-sans leading-relaxed">
            Export the complete, evidence-backed evaluation data for{' '}
            <strong className="text-[#ffe3b0] font-mono">{run.name}</strong> ({run.candidates.length} candidates).
            All underlying measured quantities, criteria, and provenance metadata are included.
          </div>

          <div className="space-y-3 pt-2">
            {/* JSON Export */}
            <a
              href={getScreeningExportJsonUrl(run.id)}
              download={`lunavista_screening_${run.id}.json`}
              className="flex items-center justify-between p-3.5 rounded-xl border border-[#2b2d32] bg-[#141619] hover:border-[#ffe3b0]/50 hover:bg-[#202228] transition-all group"
            >
              <div className="flex items-center gap-3">
                <FileJson className="w-5 h-5 text-[#ffe3b0]" />
                <div>
                  <div className="text-xs font-mono font-bold text-slate-100 group-hover:text-[#ffe3b0]">
                    Structured JSON Export
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans">
                    Complete machine-readable schema with nested metrics & snapshot
                  </div>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-500 group-hover:text-[#ffe3b0]" />
            </a>

            {/* CSV Export */}
            <a
              href={getScreeningExportCsvUrl(run.id)}
              download={`lunavista_screening_${run.id}.csv`}
              className="flex items-center justify-between p-3.5 rounded-xl border border-[#2b2d32] bg-[#141619] hover:border-[#7bd0ff]/50 hover:bg-[#202228] transition-all group"
            >
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-[#7bd0ff]" />
                <div>
                  <div className="text-xs font-mono font-bold text-slate-100 group-hover:text-[#7bd0ff]">
                    Tabular CSV Export
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans">
                    Formatted tables for spreadsheet & mission trade studies
                  </div>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-500 group-hover:text-[#7bd0ff]" />
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#202228] bg-[#141619] text-[11px] text-slate-400 font-mono text-center">
          Run ID: {run.id}
        </div>
      </div>
    </DialogSurface>
  );
};
