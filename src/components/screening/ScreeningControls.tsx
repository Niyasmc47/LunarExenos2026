import React, { useEffect } from 'react';
import { useScreeningStore } from '../../stores/screeningStore';
import { useMissionProfileStore } from '../../stores/missionProfileStore';
import { useScenarioStore } from '../../stores/scenarioStore';
import {
  Play,
  Clock,
  Layers,
  Settings2,
  CheckSquare,
  Square,
  AlertCircle,
  FileText,
} from 'lucide-react';

export const ScreeningControls: React.FC = () => {
  const profiles = useMissionProfileStore((state) => state.profiles);
  const loadProfiles = useMissionProfileStore((state) => state.loadProfiles);
  const scenarios = useScenarioStore((state) => state.scenarios);
  const loadScenarios = useScenarioStore((state) => state.loadScenarios);

  const selectedProfileId = useScreeningStore((state) => state.selectedProfileId);
  const setSelectedProfileId = useScreeningStore((state) => state.setSelectedProfileId);
  const selectedScenarioIds = useScreeningStore((state) => state.selectedScenarioIds);
  const toggleScenarioSelection = useScreeningStore((state) => state.toggleScenarioSelection);
  const selectAllScenarios = useScreeningStore((state) => state.selectAllScenarios);
  const clearScenarioSelection = useScreeningStore((state) => state.clearScenarioSelection);
  const overrideStartIso = useScreeningStore((state) => state.overrideStartIso);
  const overrideDurationDays = useScreeningStore((state) => state.overrideDurationDays);
  const overrideObserverHeight = useScreeningStore((state) => state.overrideObserverHeight);
  const setOverrideField = useScreeningStore((state) => state.setOverrideField);
  const executing = useScreeningStore((state) => state.executing);
  const executeScreening = useScreeningStore((state) => state.executeScreening);
  const error = useScreeningStore((state) => state.error);

  useEffect(() => {
    loadProfiles();
    loadScenarios();
  }, [loadProfiles, loadScenarios]);

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);

  return (
    <div className="bg-[#0b101c] border-b border-slate-800 p-5 space-y-4">
      {/* Error banner if any */}
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-mono flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Step 1: Select Mission Profile */}
        <div className="lg:col-span-4 space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-300 tracking-wide">
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>1. MISSION PROFILE</span>
          </label>
          <select
            value={selectedProfileId}
            onChange={(e) => {
              setSelectedProfileId(e.target.value);
              const p = profiles.find((pr) => pr.id === e.target.value);
              if (p) {
                setOverrideField('overrideStartIso', p.start_timestamp_iso);
                setOverrideField('overrideDurationDays', p.duration_days);
                setOverrideField('overrideObserverHeight', p.observer_height_m);
              }
            }}
            className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono px-3 py-2.5 rounded-lg focus:outline-none focus:border-emerald-500"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.is_template ? '(Template)' : ''} [v{p.version}]
              </option>
            ))}
          </select>
          {selectedProfile && (
            <p className="text-[11px] text-slate-400 font-sans leading-relaxed line-clamp-2">
              {selectedProfile.description}
            </p>
          )}
        </div>

        {/* Step 2: Select Candidate Scenarios */}
        <div className="lg:col-span-5 space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-300 tracking-wide">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>2. CANDIDATE SCENARIOS ({selectedScenarioIds.length} SELECTED)</span>
            </label>
            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
              <button
                type="button"
                onClick={() => selectAllScenarios(scenarios.map((s) => s.id))}
                className="hover:text-emerald-400 transition-colors"
              >
                All
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={clearScenarioSelection}
                className="hover:text-rose-400 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-28 overflow-y-auto pr-1">
            {scenarios.map((sc) => {
              const isSelected = selectedScenarioIds.includes(sc.id);
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => toggleScenarioSelection(sc.id)}
                  className={`flex items-start gap-2 p-2 rounded-lg border text-left transition-all text-xs font-mono ${
                    isSelected
                      ? 'bg-cyan-950/30 border-cyan-500/50 text-cyan-200'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {isSelected ? (
                    <CheckSquare className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" />
                  )}
                  <div className="truncate">
                    <div className="truncate font-medium">{sc.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {sc.latitude.toFixed(2)}°, {sc.longitude.toFixed(2)}°
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 3: Calculation Parameters & Run Button */}
        <div className="lg:col-span-3 space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-300 tracking-wide">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>3. ANALYSIS HORIZON</span>
          </label>
          <div className="space-y-1.5">
            <div>
              <span className="text-[10px] text-slate-400 block mb-0.5 font-mono">Start Epoch (UTC)</span>
              <input
                type="text"
                value={overrideStartIso}
                onChange={(e) => setOverrideField('overrideStartIso', e.target.value)}
                placeholder="2026-10-04T12:00:00Z"
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-2 py-1 rounded focus:outline-none focus:border-emerald-500 text-xs font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">Duration (Days)</span>
                <input
                  type="number"
                  step="0.5"
                  min="0.1"
                  max="90"
                  value={overrideDurationDays}
                  onChange={(e) => setOverrideField('overrideDurationDays', parseFloat(e.target.value) || 1.0)}
                  className="w-full bg-slate-950 border border-slate-700 text-emerald-400 px-2 py-1.5 rounded focus:outline-none focus:border-emerald-500 text-xs"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">Mast Height (m)</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={overrideObserverHeight}
                  onChange={(e) => setOverrideField('overrideObserverHeight', parseFloat(e.target.value) || 2.0)}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-2 py-1.5 rounded focus:outline-none focus:border-emerald-500 text-xs"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={executeScreening}
            disabled={executing || selectedScenarioIds.length === 0}
            className={`w-full py-2.5 px-4 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${
              executing || selectedScenarioIds.length === 0
                ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20 active:scale-[0.98]'
            }`}
          >
            {executing ? (
              <>
                <Settings2 className="w-4 h-4 animate-spin text-black" />
                <span>Screening Candidates...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-black fill-black" />
                <span>Run Candidate Screening</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
