import { DialogSurface } from '../ui/DialogSurface';
import React, { useState, useEffect } from 'react';
import { useDecisionReportStore } from '../../stores/decisionReportStore';
import { fetchMissionProfiles } from '../../services/missionProfileApi';
import { fetchTradeOffStudies } from '../../services/tradeOffApi';
import { fetchScreeningRuns } from '../../services/screeningApi';
import { fetchWindowSearches } from '../../services/windowPlannerApi';
import { fetchTerrainAssessments } from '../../services/terrainAssessmentApi';
import { MissionProfile } from '../../types/missionProfile';
import { TradeOffStudyRecord } from '../../types/tradeOff';
import { DecisionReportCreateRequest } from '../../types/decisionReport';
import { X, FileText, Sparkles, AlertCircle } from 'lucide-react';

export const CreateReportModal: React.FC = () => {
  const isCreateModalOpen = useDecisionReportStore((state) => state.isCreateModalOpen);
  const closeCreateModal = useDecisionReportStore((state) => state.closeCreateModal);
  const generateReport = useDecisionReportStore((state) => state.generateReport);
  const isLoading = useDecisionReportStore((state) => state.isLoading);

  const [title, setTitle] = useState('');
  const [missionName, setMissionName] = useState('Artemis Polar Scout-1');
  const [description, setDescription] = useState(
    'Comprehensive multi-criteria lunar landing site decision synthesis report.'
  );
  const [authorOrg, setAuthorOrg] = useState('LUNAVISTA Mission Planning Directorate');
  const [executiveNotes, setExecutiveNotes] = useState('');

  const [profiles, setProfiles] = useState<MissionProfile[]>([]);
  const [studies, setStudies] = useState<TradeOffStudyRecord[]>([]);
  const [screenings, setScreenings] = useState<any[]>([]);
  const [windows, setWindows] = useState<any[]>([]);
  const [terrains, setTerrains] = useState<any[]>([]);

  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [selectedStudyId, setSelectedStudyId] = useState('');
  const [selectedScreeningId, setSelectedScreeningId] = useState('');
  const [selectedWindowId, setSelectedWindowId] = useState('');
  const [selectedTerrainId, setSelectedTerrainId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isCreateModalOpen) return;

    async function loadData() {
      try {
        const [profs, stds, scrs, wins, trns] = await Promise.all([
          fetchMissionProfiles().catch(() => []),
          fetchTradeOffStudies().catch(() => []),
          fetchScreeningRuns().catch(() => []),
          fetchWindowSearches().catch(() => []),
          fetchTerrainAssessments().catch(() => []),
        ]);

        setProfiles(profs);
        setStudies(stds);
        setScreenings(scrs);
        setWindows(wins);
        setTerrains(trns);

        if (profs.length > 0) {
          setSelectedProfileId(profs[0].id);
          setTitle(`Mission Decision Report: ${profs[0].name}`);
        }
        if (stds.length > 0) {
          setSelectedStudyId(stds[0].id);
        }
        if (scrs.length > 0) setSelectedScreeningId(scrs[0].id);
        if (wins.length > 0) setSelectedWindowId(wins[0].id);
        if (trns.length > 0) setSelectedTerrainId(trns[0].id);
      } catch (err: any) {
        setError(err.message || 'Failed to load source analysis records');
      }
    }

    loadData();
  }, [isCreateModalOpen]);

  if (!isCreateModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !missionName.trim()) {
      setError('Please provide both report title and mission name.');
      return;
    }
    if (!selectedProfileId) {
      setError('Please select a target mission profile.');
      return;
    }

    const req: DecisionReportCreateRequest = {
      title: title.trim(),
      mission_name: missionName.trim(),
      description: description.trim() || null,
      author_organization: authorOrg.trim() || 'LUNAVISTA Mission Planning Directorate',
      profile_id: selectedProfileId,
      trade_off_study_id: selectedStudyId || null,
      screening_run_id: selectedScreeningId || null,
      window_search_id: selectedWindowId || null,
      terrain_assessment_id: selectedTerrainId || null,
      executive_summary_notes: executiveNotes.trim() || null,
    };

    try {
      await generateReport(req);
    } catch (err: any) {
      setError(err.message || 'Failed to generate report');
    }
  };

  return (
    <DialogSurface label="Create a decision report" onClose={closeCreateModal} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#141619] border border-[#2b2d32] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl font-mono text-xs">
        {/* Header */}
        <div className="p-5 border-b border-[#2b2d32] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Generate Mission Decision Report</h2>
              <p className="text-[11px] text-slate-400">
                Compiles 12 canonical technical sections from frozen analysis snapshots
              </p>
            </div>
          </div>
          <button
            aria-label="Close dialog" onClick={closeCreateModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-400 font-bold block mb-1">Report Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-[#303238] text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                placeholder="e.g. Artemis Polar Landing Decision Synthesis"
                required
              />
            </div>

            <div>
              <label className="text-slate-400 font-bold block mb-1">Mission Designation *</label>
              <input
                type="text"
                value={missionName}
                onChange={(e) => setMissionName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-[#303238] text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                placeholder="e.g. Artemis Polar Scout-1"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-400 font-bold block mb-1">Author / Organization</label>
              <input
                type="text"
                value={authorOrg}
                onChange={(e) => setAuthorOrg(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-[#303238] text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                placeholder="e.g. LUNAVISTA Mission Planning Directorate"
              />
            </div>

            <div>
              <label className="text-slate-400 font-bold block mb-1">Target Mission Profile *</label>
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-[#303238] text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                required
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (v{p.version} • {p.duration_days}d)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-slate-400 font-bold block mb-1">Executive Mission Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-[#303238] text-white font-mono text-xs focus:outline-none focus:border-purple-500"
              placeholder="Brief summary of mission goals..."
            />
          </div>

          {/* Source Analysis Integrations */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-[#2b2d32] space-y-3">
            <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider block">
              Integrate Analysis Snapshots (Reuses Stored Results)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">Trade-off Study</label>
                <select
                  value={selectedStudyId}
                  onChange={(e) => setSelectedStudyId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#08090b] border border-[#2b2d32] text-slate-300 font-mono text-xs"
                >
                  <option value="">None / Manual Candidate Set</option>
                  {studies.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.alternatives.length} alts)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">Candidate Screening</label>
                <select
                  value={selectedScreeningId}
                  onChange={(e) => setSelectedScreeningId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#08090b] border border-[#2b2d32] text-slate-300 font-mono text-xs"
                >
                  <option value="">None</option>
                  {screenings.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.profile_name} ({s.candidates?.length || 0} candidates)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">Mission Window Search</label>
                <select
                  value={selectedWindowId}
                  onChange={(e) => setSelectedWindowId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#08090b] border border-[#2b2d32] text-slate-300 font-mono text-xs"
                >
                  <option value="">None</option>
                  {windows.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.scenario_name} ({w.total_windows_evaluated || 0} windows)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">Terrain Assessment</label>
                <select
                  value={selectedTerrainId}
                  onChange={(e) => setSelectedTerrainId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#08090b] border border-[#2b2d32] text-slate-300 font-mono text-xs"
                >
                  <option value="">None</option>
                  {terrains.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.profile_name} ({t.candidates?.length || 0} footprints)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="text-slate-400 font-bold block mb-1">Executive Summary Notes</label>
            <textarea
              rows={3}
              value={executiveNotes}
              onChange={(e) => setExecutiveNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-[#303238] text-white font-mono text-xs focus:outline-none focus:border-purple-500"
              placeholder="Custom executive observations, programmatic context, or special mission considerations..."
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[#2b2d32] flex items-center justify-end gap-3">
            <button
              type="button"
              aria-label="Close dialog" onClick={closeCreateModal}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold flex items-center gap-2 transition-all shadow-lg shadow-purple-900/40"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isLoading ? 'Synthesizing Report...' : 'Compile & Publish Report'}</span>
            </button>
          </div>
        </form>
      </div>
    </DialogSurface>
  );
};
