import React, { useEffect, useMemo } from 'react';
import { useWindowPlannerStore } from '../../stores/windowPlannerStore';
import { useMissionProfileStore } from '../../stores/missionProfileStore';
import { useScenarioStore } from '../../stores/scenarioStore';
import {
  Search,
  Calendar,
  Clock,
  MapPin,
  Layers,
  AlertCircle,
} from 'lucide-react';

export const SearchControls: React.FC = () => {
  const profiles = useMissionProfileStore((state) => state.profiles);
  const loadProfiles = useMissionProfileStore((state) => state.loadProfiles);
  const scenarios = useScenarioStore((state) => state.scenarios);
  const loadScenarios = useScenarioStore((state) => state.loadScenarios);

  const selectedProfileId = useWindowPlannerStore((state) => state.selectedProfileId);
  const setSelectedProfileId = useWindowPlannerStore((state) => state.setSelectedProfileId);
  const selectedScenarioId = useWindowPlannerStore((state) => state.selectedScenarioId);
  const setSelectedScenarioId = useWindowPlannerStore((state) => state.setSelectedScenarioId);

  const searchStartIso = useWindowPlannerStore((state) => state.searchStartIso);
  const searchEndIso = useWindowPlannerStore((state) => state.searchEndIso);
  const missionDurationDays = useWindowPlannerStore((state) => state.missionDurationDays);
  const searchStepHours = useWindowPlannerStore((state) => state.searchStepHours);
  const analysisStepHours = useWindowPlannerStore((state) => state.analysisStepHours);
  const overrideObserverHeight = useWindowPlannerStore((state) => state.overrideObserverHeight);
  const customSearchName = useWindowPlannerStore((state) => state.customSearchName);
  const setFormField = useWindowPlannerStore((state) => state.setFormField);

  const executing = useWindowPlannerStore((state) => state.executing);
  const runSearch = useWindowPlannerStore((state) => state.runSearch);
  const error = useWindowPlannerStore((state) => state.error);

  useEffect(() => {
    loadProfiles();
    loadScenarios();
  }, [loadProfiles, loadScenarios]);

  // Estimate number of candidate windows
  const estimatedWindows = useMemo(() => {
    try {
      const st = new Date(searchStartIso).getTime();
      const et = new Date(searchEndIso).getTime();
      if (isNaN(st) || isNaN(et) || et <= st) return 0;
      const spanHours = (et - st) / (1000 * 3600);
      const durHours = missionDurationDays * 24.0;
      if (durHours > spanHours) return 0;
      return Math.floor((spanHours - durHours) / searchStepHours) + 1;
    } catch {
      return 0;
    }
  }, [searchStartIso, searchEndIso, missionDurationDays, searchStepHours]);

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);
  const selectedScenario = scenarios.find((s) => s.id === selectedScenarioId);

  return (
    <div className="bg-[#0b101c] border-b border-slate-800 p-5 space-y-4">
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-mono flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-start">
        {/* Step 1: Mission Profile */}
        <div className="lg:col-span-3 space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-300">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>1. MISSION PROFILE</span>
          </label>
          <select
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
            className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (v{p.version})
              </option>
            ))}
          </select>
          {selectedProfile && (
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span className="truncate">Type: {selectedProfile.mission_type.replace('_', ' ')}</span>
              <div className="flex items-center gap-1 shrink-0">
                <span>Obs:</span>
                <input
                  type="number"
                  min={0.5}
                  max={50}
                  step={0.5}
                  placeholder={selectedProfile.observer_height_m.toString()}
                  value={overrideObserverHeight ?? ''}
                  onChange={(e) =>
                    setFormField(
                      'overrideObserverHeight',
                      e.target.value === '' ? null : parseFloat(e.target.value)
                    )
                  }
                  className="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-[10px] text-slate-200 text-center"
                  title="Override Observer Mast Height (m)"
                />
                <span>m</span>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Target Candidate Site */}
        <div className="lg:col-span-3 space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-300">
            <MapPin className="w-3.5 h-3.5 text-sky-400" />
            <span>2. CANDIDATE SITE</span>
          </label>
          <select
            value={selectedScenarioId}
            onChange={(e) => setSelectedScenarioId(e.target.value)}
            className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.site_id})
              </option>
            ))}
          </select>
          {selectedScenario && (
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span className="truncate">Coord: {selectedScenario.latitude.toFixed(3)}°, {selectedScenario.longitude.toFixed(3)}°</span>
              <input
                type="text"
                placeholder="Custom Label"
                value={customSearchName}
                onChange={(e) => setFormField('customSearchName', e.target.value)}
                className="w-24 bg-slate-900 border border-slate-700 rounded px-1.5 text-[10px] text-slate-200 placeholder:text-slate-600 truncate"
                title="Optional custom title for search record"
              />
            </div>
          )}
        </div>

        {/* Step 3: Search Dates & Mission Duration */}
        <div className="lg:col-span-3 space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <span>3. DATES & DURATION</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-500 font-mono block">Search Start</span>
              <input
                type="text"
                value={searchStartIso}
                onChange={(e) => setFormField('searchStartIso', e.target.value)}
                placeholder="YYYY-MM-DDTHH:MM:SSZ"
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-mono block">Search End</span>
              <input
                type="text"
                value={searchEndIso}
                onChange={(e) => setFormField('searchEndIso', e.target.value)}
                placeholder="YYYY-MM-DDTHH:MM:SSZ"
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-[10px] text-slate-400 font-mono shrink-0">Duration:</span>
            <input
              type="number"
              min={0.1}
              max={60}
              step={0.5}
              value={missionDurationDays}
              onChange={(e) => setFormField('missionDurationDays', parseFloat(e.target.value) || 1.0)}
              className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-[11px] font-mono text-slate-200 text-center"
            />
            <span className="text-[10px] text-slate-400 font-mono">
              days ({(missionDurationDays * 24).toFixed(0)} h)
            </span>
          </div>
        </div>

        {/* Step 4: Step Intervals & Search Action */}
        <div className="lg:col-span-3 space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-300">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>4. STEP INTERVALS</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-500 font-mono block">Search Step (Δt)</span>
              <select
                value={searchStepHours}
                onChange={(e) => setFormField('searchStepHours', parseFloat(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value={4}>4 hours</option>
                <option value={6}>6 hours</option>
                <option value={12}>12 hours</option>
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
              </select>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-mono block">Analysis Step</span>
              <select
                value={analysisStepHours}
                onChange={(e) => setFormField('analysisStepHours', parseFloat(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value={1}>1 hour</option>
                <option value={2}>2 hours</option>
                <option value={4}>4 hours</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] font-mono text-slate-400">
              Est: <span className={estimatedWindows > 200 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>{estimatedWindows}</span> windows
            </span>
            <button
              onClick={() => runSearch()}
              disabled={executing || estimatedWindows <= 0 || estimatedWindows > 200}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                executing || estimatedWindows <= 0 || estimatedWindows > 200
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40'
              }`}
            >
              {executing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Search Windows</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
