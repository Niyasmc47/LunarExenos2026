import { ResultIntro } from '../ui/MissionSetup';
import React, { useEffect, useMemo } from 'react';
import { useTerrainAssessmentStore } from '../../stores/terrainAssessmentStore';
import { AssessmentControls } from './AssessmentControls';
import { CandidateTerrainCard } from './CandidateTerrainCard';
import { TerrainDetailDrawer } from './TerrainDetailDrawer';
import { AssessmentExportModal } from './AssessmentExportModal';
import {
  Download,
  Trash2,
  Inbox,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';

export const TerrainAssessmentWorkspace: React.FC = () => {
  const assessments = useTerrainAssessmentStore((state) => state.assessments);
  const activeAssessment = useTerrainAssessmentStore((state) => state.activeAssessment);
  const selectAssessment = useTerrainAssessmentStore((state) => state.selectAssessment);
  const deleteAssessment = useTerrainAssessmentStore((state) => state.deleteAssessment);
  const filterStatus = useTerrainAssessmentStore((state) => state.filterStatus);
  const setFilterStatus = useTerrainAssessmentStore((state) => state.setFilterStatus);
  const openExportModal = useTerrainAssessmentStore((state) => state.openExportModal);
  const init = useTerrainAssessmentStore((state) => state.init);
  const loading = useTerrainAssessmentStore((state) => state.loading);

  useEffect(() => {
    init();
  }, [init]);

  const displayedCandidates = useMemo(() => {
    if (!activeAssessment) return [];
    if (filterStatus === 'ALL') return activeAssessment.candidates;
    return activeAssessment.candidates.filter((c) => c.overall_status === filterStatus);
  }, [activeAssessment, filterStatus]);

  return (
    <div className="analysis-page flex-1 flex flex-col h-full bg-[#0e1013] overflow-y-auto">
      {/* Top Configuration Controls */}
      <AssessmentControls />

      {/* Main Content Area */}
      <div className="analysis-results p-6 space-y-5">
        <ResultIntro title="Review landing terrain" description="Filter candidates by status and open a site to inspect its terrain evidence." />
        {/* Active Assessment Run Header */}
        {assessments.length > 0 && activeAssessment && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#141619] border border-[#2b2d32] p-4 rounded-xl">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-mono font-bold text-slate-300">
                Assessment Run:
              </span>
              <select
                aria-label="Saved terrain assessments" value={activeAssessment.id}
                onChange={(e) => selectAssessment(e.target.value)}
                className="bg-[#08090b] border border-[#303238] text-slate-200 text-xs font-mono px-3 py-1.5 rounded-lg focus:outline-none focus:border-[#ffe3b0] max-w-xs truncate"
              >
                {assessments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                <span>Profile: <strong className="text-white">{activeAssessment.profile_name}</strong></span>
                <span>•</span>
                <span>Radius: <strong className="text-[#ffe3b0]">{activeAssessment.assessment_radius_m} m</strong></span>
                <span>•</span>
                <span>Candidates: <strong className="text-white">{activeAssessment.candidates.length}</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto">
              <button
                onClick={openExportModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#191b20] hover:bg-[#202228] text-[#7bd0ff] text-xs font-mono rounded-lg transition-colors border border-[#2b2d32]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Assessment</span>
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete terrain assessment '${activeAssessment.name}'?`)) {
                    deleteAssessment(activeAssessment.id);
                  }
                }}
                className="p-1.5 bg-[#191b20] hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-[#2b2d32] rounded-lg transition-colors"
                title="Delete Assessment Run"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Candidate Cards Section */}
        {activeAssessment && (
          <div className="space-y-4">
            {/* Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 bg-[#0e1013] p-2.5 rounded-xl border border-[#2b2d32]">
              <button
                aria-pressed={filterStatus === 'ALL'} onClick={() => setFilterStatus('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition-all shrink-0 ${
                  filterStatus === 'ALL'
                    ? 'bg-[#ffe3b0] text-[#141619] font-bold shadow-sm'
                    : 'bg-[#141619] text-slate-400 hover:text-white border border-[#2b2d32]'
                }`}
              >
                All Candidates ({activeAssessment.candidates.length})
              </button>

              <button
                aria-pressed={filterStatus === 'COMPLIANT'} onClick={() => setFilterStatus('COMPLIANT')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono transition-all shrink-0 ${
                  filterStatus === 'COMPLIANT'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 font-bold shadow-sm'
                    : 'bg-[#141619] text-emerald-400 hover:bg-[#191b20] border border-[#2b2d32]'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Compliant ({activeAssessment.compliant_candidates_count})</span>
              </button>

              <button
                aria-pressed={filterStatus === 'NON_COMPLIANT'} onClick={() => setFilterStatus('NON_COMPLIANT')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono transition-all shrink-0 ${
                  filterStatus === 'NON_COMPLIANT'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 font-bold shadow-sm'
                    : 'bg-[#141619] text-rose-400 hover:bg-[#191b20] border border-[#2b2d32]'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Non-Compliant ({activeAssessment.non_compliant_candidates_count})</span>
              </button>

              <button
                aria-pressed={filterStatus === 'INDETERMINATE'} onClick={() => setFilterStatus('INDETERMINATE')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono transition-all shrink-0 ${
                  filterStatus === 'INDETERMINATE'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold shadow-sm'
                    : 'bg-[#141619] text-amber-400 hover:bg-[#191b20] border border-[#2b2d32]'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Indeterminate ({activeAssessment.indeterminate_candidates_count})</span>
              </button>
            </div>

            {/* List of Candidate Cards */}
            {displayedCandidates.length === 0 ? (
              <div className="text-center py-12 bg-slate-900/20 border border-[#202228] rounded-xl space-y-2">
                <Inbox className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs font-mono text-slate-400">
                  No candidates match status filter '{filterStatus}'.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayedCandidates.map((c) => (
                  <CandidateTerrainCard key={c.candidate_id} candidate={c} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {assessments.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-4">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
              <Sparkles className="w-8 h-8" />
            </div>
            <div className="max-w-md space-y-1.5">
              <h3 className="text-base font-mono font-bold text-slate-200">
                Ready to inspect your landing sites?
              </h3>
              <p className="text-xs font-mono text-slate-400">
                Configure a mission profile, select candidate lunar landing locations, and specify the assessment footprint radius above to evaluate elevation, slope, and data coverage.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modals & Drawers */}
      <TerrainDetailDrawer />
      <AssessmentExportModal />
    </div>
  );
};
