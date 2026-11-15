import { DialogSurface } from '../ui/DialogSurface';
import React, { useState, useEffect } from 'react';
import { useTradeOffStore } from '../../stores/tradeOffStore';
import { fetchMissionProfiles } from '../../services/missionProfileApi';
import { fetchScenarios } from '../../services/scenarioApi';
import { fetchWindowSearches } from '../../services/windowPlannerApi';
import { fetchTerrainAssessments } from '../../services/terrainAssessmentApi';
import { MissionProfile } from '../../types/missionProfile';
import { ScenarioRecord } from '../../types/scenario';
import { MissionAlternativeInput } from '../../types/tradeOff';
import { X, Plus, Trash2, AlertCircle, Sparkles } from 'lucide-react';

export const CreateStudyModal: React.FC = () => {
  const isCreateModalOpen = useTradeOffStore((state) => state.isCreateModalOpen);
  const closeCreateModal = useTradeOffStore((state) => state.closeCreateModal);
  const createStudy = useTradeOffStore((state) => state.createStudy);
  const isLoading = useTradeOffStore((state) => state.isLoading);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [profiles, setProfiles] = useState<MissionProfile[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioRecord[]>([]);
  const [windowSearches, setWindowSearches] = useState<any[]>([]);
  const [terrainAssessments, setTerrainAssessments] = useState<any[]>([]);

  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [nominalDurationDays, setNominalDurationDays] = useState(3.0);
  const [alternatives, setAlternatives] = useState<MissionAlternativeInput[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isCreateModalOpen) return;

    async function loadData() {
      try {
        const [profs, scens, wins, trns] = await Promise.all([
          fetchMissionProfiles(),
          fetchScenarios(),
          fetchWindowSearches().catch(() => []),
          fetchTerrainAssessments().catch(() => []),
        ]);

        setProfiles(profs);
        setScenarios(scens);
        setWindowSearches(wins);
        setTerrainAssessments(trns);

        if (profs.length > 0) {
          const p = profs[0];
          setSelectedProfileId(p.id);
          setNominalDurationDays(p.duration_days);
          setName(`Trade-off Analysis: ${p.name}`);
        }

        // Initialize with 2 default alternatives from available scenarios
        if (scens.length >= 2) {
          setAlternatives([
            {
              name: `${scens[0].name} (Baseline)`,
              scenario_id: scens[0].id,
              notes: 'Primary candidate scenario',
            },
            {
              name: `${scens[1].name} (Alternative)`,
              scenario_id: scens[1].id,
              notes: 'Secondary comparison scenario',
            },
          ]);
        } else if (scens.length === 1) {
          setAlternatives([
            { name: `${scens[0].name} (A)`, scenario_id: scens[0].id },
            { name: `${scens[0].name} (B)`, scenario_id: scens[0].id },
          ]);
        }
      } catch (err: any) {
        console.error('Failed to load modal fixtures:', err);
      }
    }

    loadData();
  }, [isCreateModalOpen]);

  if (!isCreateModalOpen) return null;

  const handleProfileChange = (pId: string) => {
    setSelectedProfileId(pId);
    const p = profiles.find((x) => x.id === pId);
    if (p) {
      setNominalDurationDays(p.duration_days);
      setName(`Trade-off Analysis: ${p.name}`);
    }
  };

  const handleAltChange = (index: number, field: keyof MissionAlternativeInput, value: any) => {
    const updated = [...alternatives];
    updated[index] = { ...updated[index], [field]: value };
    setAlternatives(updated);
  };

  const addAlternative = () => {
    if (alternatives.length >= 10) return;
    const scen = scenarios[alternatives.length % scenarios.length];
    setAlternatives([
      ...alternatives,
      {
        name: `Alternative ${alternatives.length + 1}: ${scen ? scen.name : 'Candidate'}`,
        scenario_id: scen ? scen.id : (scenarios[0]?.id || ''),
        notes: '',
      },
    ]);
  };

  const removeAlt = (index: number) => {
    if (alternatives.length <= 2) return;
    setAlternatives(alternatives.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!name.trim()) {
      setValidationError('Study title is required.');
      return;
    }
    if (!selectedProfileId) {
      setValidationError('Please select a target mission profile.');
      return;
    }
    if (alternatives.length < 2 || alternatives.length > 10) {
      setValidationError('Trade-off study must contain between 2 and 10 alternatives.');
      return;
    }

    for (let i = 0; i < alternatives.length; i++) {
      if (!alternatives[i].name.trim()) {
        setValidationError(`Alternative #${i + 1} must have a name.`);
        return;
      }
      if (!alternatives[i].scenario_id) {
        setValidationError(`Alternative #${i + 1} must select a candidate scenario.`);
        return;
      }
    }

    try {
      await createStudy({
        name: name.trim(),
        description: description.trim() || undefined,
        profile_id: selectedProfileId,
        nominal_duration_days: nominalDurationDays,
        alternatives,
      });
    } catch (err: any) {
      setValidationError(err.message || 'Failed to create study.');
    }
  };

  return (
    <DialogSurface label="Create a trade-off study" onClose={closeCreateModal} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#141619] border border-[#303238]/80 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#2b2d32] sticky top-0 bg-[#141619]/95 backdrop-blur z-10">
          <div>
            <h2 className="text-base font-mono font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Create a trade-off study</span>
            </h2>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">
              Select 2–10 mission alternatives to compare across multi-criteria solar, earth comm, and terrain preferences.
            </p>
          </div>
          <button
            aria-label="Close dialog" onClick={closeCreateModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {validationError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Study Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-semibold text-slate-300 block">
                Study Title *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Connecting Ridge vs Shackleton Trade-off"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-[#303238] text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-semibold text-slate-300 block">
                Target Mission Profile *
              </label>
              <select
                value={selectedProfileId}
                onChange={(e) => handleProfileChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-[#303238] text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.duration_days}d / {p.mission_type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono font-semibold text-slate-300 block">
              Study Description & Purpose (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Document the landing site rationale, competing trade-off objectives, and constraints..."
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-[#303238] text-white font-mono text-xs focus:outline-none focus:border-emerald-500 h-16"
            />
          </div>

          {/* Alternatives Builder */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold text-white tracking-wide flex items-center gap-1.5">
                <span>Candidates to compare ({alternatives.length}/10)</span>
              </h3>
              <button
                type="button"
                onClick={addAlternative}
                disabled={alternatives.length >= 10}
                className="px-2.5 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-mono flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Alternative</span>
              </button>
            </div>

            <div className="space-y-3">
              {alternatives.map((alt, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-900/60 border border-[#2b2d32] space-y-3 relative group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-bold text-emerald-400">
                      Alternative #{idx + 1}
                    </span>
                    {alternatives.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeAlt(idx)}
                        className="text-slate-500 hover:text-rose-400 transition-colors"
                        title="Remove alternative"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-mono text-slate-400 block mb-1">
                        Alternative Name *
                      </label>
                      <input
                        type="text"
                        value={alt.name}
                        onChange={(e) => handleAltChange(idx, 'name', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#08090b] border border-[#303238] text-slate-100 font-mono text-xs focus:border-emerald-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono text-slate-400 block mb-1">
                        Candidate Scenario (Location) *
                      </label>
                      <select
                        value={alt.scenario_id}
                        onChange={(e) => handleAltChange(idx, 'scenario_id', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#08090b] border border-[#303238] text-slate-100 font-mono text-xs focus:border-emerald-500"
                      >
                        {scenarios.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.site_id} • {s.latitude.toFixed(2)}°, {s.longitude.toFixed(2)}°)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-mono text-slate-400 block mb-1">
                        Associate Window Search (Optional)
                      </label>
                      <select
                        value={alt.window_search_id || ''}
                        onChange={(e) => handleAltChange(idx, 'window_search_id', e.target.value || null)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#08090b] border border-[#303238] text-slate-100 font-mono text-xs focus:border-emerald-500"
                      >
                        <option value="">None (Use default scenario epochs)</option>
                        {windowSearches.map((ws: any) => (
                          <option key={ws.search_id} value={ws.search_id}>
                            {ws.name || ws.search_id} ({ws.total_windows_evaluated} windows)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-mono text-slate-400 block mb-1">
                        Associate Terrain Assessment (Optional)
                      </label>
                      <select
                        value={alt.terrain_assessment_id || ''}
                        onChange={(e) => handleAltChange(idx, 'terrain_assessment_id', e.target.value || null)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#08090b] border border-[#303238] text-slate-100 font-mono text-xs focus:border-emerald-500"
                      >
                        <option value="">None (Use point DEM elevation/slope)</option>
                        {terrainAssessments.map((ta: any) => (
                          <option key={ta.id} value={ta.id}>
                            {ta.name} (Radius: {ta.assessment_radius_m}m)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      value={alt.notes || ''}
                      onChange={(e) => handleAltChange(idx, 'notes', e.target.value)}
                      placeholder="Optional engineering notes for this alternative..."
                      className="w-full px-2.5 py-1 rounded bg-[#08090b]/80 border border-[#2b2d32] text-slate-300 font-mono text-[11px] focus:border-slate-600"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2b2d32]">
            <button
              type="button"
              aria-label="Close dialog" onClick={closeCreateModal}
              className="px-4 py-2 rounded-xl border border-[#303238] hover:border-slate-600 bg-slate-900 text-slate-300 text-xs font-mono font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
            >
              {isLoading ? 'Creating & Analyzing...' : 'Create & Run Trade-off Study'}
            </button>
          </div>
        </form>
      </div>
    </DialogSurface>
  );
};
