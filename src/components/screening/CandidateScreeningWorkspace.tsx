import { ResultIntro } from '../ui/MissionSetup';
import React, { useEffect, useState } from 'react';
import { useScreeningStore } from '../../stores/screeningStore';
import { ScreeningControls } from './ScreeningControls';
import { CandidateSummaryCard } from './CandidateSummaryCard';
import { HardConstraintsMatrix } from './HardConstraintsMatrix';
import { SoftPreferencesSection } from './SoftPreferencesSection';
import { InformationalMetricsPanel } from './InformationalMetricsPanel';
import { DataCompletenessProvenance } from './DataCompletenessProvenance';
import { ExportModal } from './ExportModal';
import {
  Download,
  Trash2,
  Clock,
  Sparkles,
  Inbox,
} from 'lucide-react';

export const CandidateScreeningWorkspace: React.FC = () => {
  const runs = useScreeningStore((state) => state.runs);
  const activeRun = useScreeningStore((state) => state.activeRun);
  const selectedCandidateId = useScreeningStore((state) => state.selectedCandidateId);
  const selectRun = useScreeningStore((state) => state.selectRun);
  const deleteRun = useScreeningStore((state) => state.deleteRun);
  const selectCandidate = useScreeningStore((state) => state.selectCandidate);
  const init = useScreeningStore((state) => state.init);
  const loading = useScreeningStore((state) => state.loading);

  const [isExportOpen, setIsExportOpen] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  const selectedCandidate = activeRun?.candidates.find(
    (c) => c.candidate_id === selectedCandidateId
  ) || activeRun?.candidates[0] || null;

  return (
    <div className="analysis-page flex-1 flex flex-col h-full bg-[#0e1013] overflow-y-auto">
      {/* Top Configuration & Execution Controls */}
      <ScreeningControls />

      {/* Main Content Area */}
      <div className="analysis-results p-6 space-y-6">
        <ResultIntro title="Which sites meet your requirements?" description="Select a candidate to inspect passed checks, failed limits, and missing evidence." />
        {/* Screening Run Header / History Selector */}
        {runs.length > 0 && activeRun && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#141619] border border-[#2b2d32] p-4 rounded-xl shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-slate-100">
                    Active Run:
                  </span>
                  <select
                    aria-label="Saved screenings" value={activeRun.id}
                    onChange={(e) => selectRun(e.target.value)}
                    className="bg-[#08090b] border border-[#2b2d32] text-slate-200 text-xs font-mono px-2.5 py-1 rounded focus:outline-none focus:border-[#ffe3b0]"
                  >
                    {runs.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({new Date(r.created_at_iso).toLocaleTimeString()})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[#ffe3b0]">
                    <Clock className="w-3 h-3 text-[#ffe3b0]" />
                    {activeRun.start_timestamp_iso} to {activeRun.end_timestamp_iso} ({activeRun.duration_days.toFixed(1)}d)
                  </span>
                  <span className="text-slate-600">•</span>
                  <span>Mast: {activeRun.observer_height_m}m</span>
                </div>
              </div>
            </div>

            {/* Run Actions: Export & Delete */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsExportOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#191b20] hover:bg-[#202228] text-[#7bd0ff] border border-[#2b2d32] text-xs font-mono font-semibold transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Run</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete screening run "${activeRun.name}"?`)) {
                    deleteRun(activeRun.id);
                  }
                }}
                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 transition-all"
                title="Delete run"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Screening Results Body */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20 text-slate-400 font-mono text-sm">
            Loading saved screenings…
          </div>
        ) : !activeRun ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3 bg-[#141619] border border-[#2b2d32] rounded-2xl p-8 shadow-md">
            <div className="p-3 bg-[#191b20] border border-[#2b2d32] rounded-full text-[#ffe3b0]">
              <Inbox className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-slate-200 font-mono">
              Your shortlist starts here
            </h3>
            <p className="text-xs text-slate-400 font-sans max-w-md leading-relaxed">
              Select a mission profile and one or more candidate scenarios above, then click{' '}
              <strong className="text-[#ffe3b0]">Screen selected sites</strong> to see which requirements each site meets.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Executive Overview Banner */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="bg-[#0c1220] border border-slate-800 p-4 rounded-xl flex flex-col justify-between shadow-lg">
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                  Locations Evaluated
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono text-slate-100">
                    {activeRun.overall_summary.total_candidates}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">sites</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 font-sans">
                  Total candidate landing spots tested
                </span>
              </div>

              <div className="bg-[#0a1818] border border-emerald-900/40 p-4 rounded-xl flex flex-col justify-between shadow-lg">
                <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider font-semibold">
                  Meets All Requirements
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono text-emerald-400">
                    {activeRun.overall_summary.compliant_candidates}
                  </span>
                  <span className="text-xs text-emerald-500/80 font-mono">passed</span>
                </div>
                <span className="text-[10px] text-emerald-400/60 mt-1 font-sans">
                  Zero mandatory constraint violations
                </span>
              </div>

              <div className="bg-[#1c0f16] border border-rose-900/40 p-4 rounded-xl flex flex-col justify-between shadow-lg">
                <span className="text-[11px] font-mono text-rose-400 uppercase tracking-wider font-semibold">
                  Fails Requirements
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono text-rose-400">
                    {activeRun.overall_summary.non_compliant_candidates}
                  </span>
                  <span className="text-xs text-rose-500/80 font-mono">failed</span>
                </div>
                <span className="text-[10px] text-rose-400/60 mt-1 font-sans">
                  Violates terrain slope or resource limits
                </span>
              </div>

              <div className="bg-[#1c160c] border border-amber-900/40 p-4 rounded-xl flex flex-col justify-between shadow-lg">
                <span className="text-[11px] font-mono text-amber-400 uppercase tracking-wider font-semibold">
                  Cannot Be Fully Evaluated
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono text-amber-400">
                    {activeRun.overall_summary.indeterminate_candidates}
                  </span>
                  <span className="text-xs text-amber-500/80 font-mono">unverified</span>
                </div>
                <span className="text-[10px] text-amber-400/60 mt-1 font-sans">
                  Incomplete DEM coverage or horizon data
                </span>
              </div>
            </div>

            {/* Candidate Cards Grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#ffe3b0]" />
                  <h2 className="text-xs font-bold text-slate-100 font-mono tracking-wider">
                    Candidate summaries ({activeRun.candidates.length} candidates across regions)
                  </h2>
                </div>
                <div className="text-xs font-mono text-slate-400">
                  Click a card to inspect full requirements matrix
                </div>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeRun.candidates.map((cand) => (
                  <CandidateSummaryCard
                    key={cand.candidate_id}
                    candidate={cand}
                    isSelected={selectedCandidate?.candidate_id === cand.candidate_id}
                    onSelect={() => selectCandidate(cand.candidate_id)}
                  />
                ))}
              </div>
            </div>

            {/* Detailed Inspection for Selected Candidate */}
            {selectedCandidate && (
              <div className="space-y-6 pt-4 border-t border-[#202228]">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-100 font-mono tracking-wide">
                    Requirement details: {selectedCandidate.candidate_name}
                  </h2>
                  <span className="text-xs font-mono text-slate-400">
                    Profile: {activeRun.profile_name} (v{activeRun.profile_version})
                  </span>
                </div>

                {/* 1. Hard Constraints Matrix */}
                <HardConstraintsMatrix results={selectedCandidate.hard_constraint_results} />

                {/* 2. Soft Preferences Section */}
                <SoftPreferencesSection preferences={selectedCandidate.soft_preference_results} />

                {/* 3. Informational Metrics */}
                <InformationalMetricsPanel metrics={selectedCandidate.informational_metrics} />

                {/* 4. Data Completeness & Scientific Provenance */}
                <DataCompletenessProvenance candidate={selectedCandidate} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Export Modal */}
      {activeRun && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          run={activeRun}
        />
      )}
    </div>
  );
};
