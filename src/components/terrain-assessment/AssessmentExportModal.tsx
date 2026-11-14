import React from 'react';
import { useTerrainAssessmentStore } from '../../stores/terrainAssessmentStore';
import {
  getTerrainExportJsonUrl,
  getTerrainExportCsvUrl,
} from '../../services/terrainAssessmentApi';
import {
  X,
  Download,
  FileJson,
  FileSpreadsheet,
  CheckCircle,
} from 'lucide-react';

export const AssessmentExportModal: React.FC = () => {
  const isExportOpen = useTerrainAssessmentStore((state) => state.isExportOpen);
  const activeAssessment = useTerrainAssessmentStore((state) => state.activeAssessment);
  const closeExportModal = useTerrainAssessmentStore((state) => state.closeExportModal);

  if (!isExportOpen || !activeAssessment) return null;

  const jsonUrl = getTerrainExportJsonUrl(activeAssessment.id);
  const csvUrl = getTerrainExportCsvUrl(activeAssessment.id);

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
                EXPORT TERRAIN ASSESSMENT
              </h2>
              <span className="text-[11px] font-mono text-slate-400">
                Run ID: {activeAssessment.id}
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
            Export evidence-backed terrain suitability evaluation for{' '}
            <span className="text-white font-semibold">{activeAssessment.name}</span> (
            {activeAssessment.candidates.length} candidate sites).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* JSON Export */}
            <a
              href={jsonUrl}
              download={`lunavista_terrain_${activeAssessment.id}.json`}
              className="flex flex-col p-4 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 transition-all group"
            >
              <div className="flex items-center justify-between">
                <FileJson className="w-6 h-6 text-indigo-400 group-hover:scale-110 transition-transform" />
                <Download className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </div>
              <span className="text-xs font-mono font-bold text-white mt-3 block">
                Structured JSON
              </span>
              <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                Full snapshot of profile, scenario coordinates, slope distribution, and data quality.
              </span>
            </a>

            {/* CSV Export */}
            <a
              href={csvUrl}
              download={`lunavista_terrain_${activeAssessment.id}.csv`}
              className="flex flex-col p-4 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 transition-all group"
            >
              <div className="flex items-center justify-between">
                <FileSpreadsheet className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
                <Download className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </div>
              <span className="text-xs font-mono font-bold text-white mt-3 block">
                Tabular CSV
              </span>
              <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                Flat table of elevation, slope, coverage, and requirements matrix for spreadsheets.
              </span>
            </a>
          </div>

          <div className="p-3 bg-slate-900/40 rounded-lg border border-slate-800 text-[10px] font-mono text-slate-400 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              All exports preserve scientific disclaimers and coordinate/datum provenance.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
