import React, { useEffect } from 'react';
import { useTerrainAssessmentStore } from '../../stores/terrainAssessmentStore';
import { useMissionProfileStore } from '../../stores/missionProfileStore';
import { useScenarioStore } from '../../stores/scenarioStore';
import {
  FileText,
  MapPin,
  CheckSquare,
  Square,
  AlertCircle,
  Play,
  Compass,
} from 'lucide-react';

export const AssessmentControls: React.FC = () => {
  const profiles = useMissionProfileStore((state) => state.profiles);
  const loadProfiles = useMissionProfileStore((state) => state.loadProfiles);
  const scenarios = useScenarioStore((state) => state.scenarios);
  const loadScenarios = useScenarioStore((state) => state.loadScenarios);

  const selectedProfileId = useTerrainAssessmentStore((state) => state.selectedProfileId);
  const setSelectedProfileId = useTerrainAssessmentStore((state) => state.setSelectedProfileId);
  const selectedScenarioIds = useTerrainAssessmentStore((state) => state.selectedScenarioIds);
  const toggleScenarioSelection = useTerrainAssessmentStore((state) => state.toggleScenarioSelection);
  const selectAllScenarios = useTerrainAssessmentStore((state) => state.selectAllScenarios);
  const clearScenarioSelection = useTerrainAssessmentStore((state) => state.clearScenarioSelection);
  const assessmentRadiusM = useTerrainAssessmentStore((state) => state.assessmentRadiusM);
  const setAssessmentRadius = useTerrainAssessmentStore((state) => state.setAssessmentRadius);
  const customName = useTerrainAssessmentStore((state) => state.customName);
  const setCustomName = useTerrainAssessmentStore((state) => state.setCustomName);

  const executing = useTerrainAssessmentStore((state) => state.executing);
  const executeAssessment = useTerrainAssessmentStore((state) => state.executeAssessment);
  const error = useTerrainAssessmentStore((state) => state.error);

  useEffect(() => {
    loadProfiles();
    loadScenarios();
  }, [loadProfiles, loadScenarios]);

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);

  return (
    <div className="bg-[#0b101c] border-b border-slate-800 p-5 space-y-4">
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-mono flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 items-start">
        {/* Step 1: Mission Profile */}
        <div className="lg:col-span-4 space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-300">
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            <span>1. MISSION PROFILE</span>
          </label>
          <select
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (v{p.version})
              </option>
            ))}
          </select>
          {selectedProfile && (
            <div className="text-[10px] font-mono text-slate-400 truncate">
              Type: {selectedProfile.mission_type.replace('_', ' ')} • Obs: {selectedProfile.observer_height_m}m
            </div>
          )}
        </div>

        {/* Step 2: Candidate Scenarios */}
        <div className="lg:col-span-4 space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-300">
              <MapPin className="w-3.5 h-3.5 text-sky-400" />
              <span>2. CANDIDATES ({selectedScenarioIds.length} SELECTED)</span>
            </label>
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <button
                type="button"
                onClick={() => selectAllScenarios(scenarios.map((s) => s.id))}
                className="text-sky-400 hover:text-sky-300"
              >
                All
              </button>
              <span className="text-slate-600">•</span>
              <button
                type="button"
                onClick={clearScenarioSelection}
                className="text-slate-400 hover:text-slate-300"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-1.5 max-h-28 overflow-y-auto bg-slate-950/80 border border-slate-800 rounded-lg p-2">
            {scenarios.map((scen) => {
              const isSelected = selectedScenarioIds.includes(scen.id);
              return (
                <button
                  key={scen.id}
                  type="button"
                  onClick={() => toggleScenarioSelection(scen.id)}
                  className={`flex items-center gap-2 p-1.5 rounded text-left transition-colors text-xs font-mono ${
                    isSelected ? 'bg-sky-500/10 text-sky-200' : 'text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  {isSelected ? (
                    <CheckSquare className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  )}
                  <span className="truncate">{scen.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 3: Footprint Radius & Run Action */}
        <div className="lg:col-span-4 space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-300">
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            <span>3. ASSESSMENT FOOTPRINT RADIUS</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={assessmentRadiusM}
              onChange={(e) => setAssessmentRadius(parseFloat(e.target.value))}
              className="col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value={0}>0 m (Point Sample)</option>
              <option value={25}>25 m (Robotic Lander)</option>
              <option value={50}>50 m (Standard Lunar Lander)</option>
              <option value={100}>100 m (Crewed Lander / HLS)</option>
              <option value={250}>250 m (Regional Zone)</option>
            </select>
            <input
              type="text"
              placeholder="Run Title"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 truncate"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] font-mono text-slate-400">
              Radius: <strong className="text-white">{assessmentRadiusM} m</strong> (NASA LOLA 5m/px)
            </span>

            <button
              onClick={() => executeAssessment()}
              disabled={executing || selectedScenarioIds.length === 0}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono font-medium transition-all ${
                executing || selectedScenarioIds.length === 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40'
              }`}
            >
              {executing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Evaluating...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Assess Terrain</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
