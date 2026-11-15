import React, { useState } from 'react';
import {
  GitCompare,
  Plus,
  Download,
  CheckSquare,
  Square,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { useScenarioStore } from '../../stores/scenarioStore';

interface Props {
  onOpenCreateModal: () => void;
}

export const ScenarioManagementBar: React.FC<Props> = ({ onOpenCreateModal }) => {
  const scenarios = useScenarioStore((state) => state.scenarios);
  const selectedScenarioIds = useScenarioStore((state) => state.selectedScenarioIds);
  const toggleScenarioSelection = useScenarioStore((state) => state.toggleScenarioSelection);
  const runComparison = useScenarioStore((state) => state.runComparison);
  const isComparing = useScenarioStore((state) => state.isComparing);
  const downloadExport = useScenarioStore((state) => state.downloadExport);
  const isExporting = useScenarioStore((state) => state.isExporting);
  const comparisonResult = useScenarioStore((state) => state.comparisonResult);

  const enforceHarmonizedTime = useScenarioStore((state) => state.enforceHarmonizedTime);
  const setEnforceHarmonizedTime = useScenarioStore((state) => state.setEnforceHarmonizedTime);
  const overrideDurationDays = useScenarioStore((state) => state.overrideDurationDays);
  const setOverrideDurationDays = useScenarioStore((state) => state.setOverrideDurationDays);
  const overrideStepHours = useScenarioStore((state) => state.overrideStepHours);
  const setOverrideStepHours = useScenarioStore((state) => state.setOverrideStepHours);

  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  const handleRun = () => {
    runComparison();
  };

  return (
    <div className="bg-[#0c121e]/95 border border-slate-800 rounded-xl p-3 space-y-2.5 font-mono text-xs shadow-xl shrink-0">
      {/* Top Row: Title, Scenario Chips Selection, Primary Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-slate-100 uppercase tracking-wide">
            Choose scenarios to compare
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            {selectedScenarioIds.length} / 4 Selected (Min 2)
          </span>
        </div>

        {/* Buttons: Run, New, Export */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold bg-[#070b12] hover:bg-slate-800 text-slate-300 hover:text-emerald-300 border border-slate-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Add scenario</span>
          </button>

          <button
            onClick={handleRun}
            disabled={isComparing || selectedScenarioIds.length < 2}
            className={`flex items-center gap-1.5 px-3.5 py-1 rounded-lg font-bold transition-all ${
              isComparing || selectedScenarioIds.length < 2
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isComparing ? 'Comparing…' : 'Compare selected'}</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              disabled={isExporting || !comparisonResult}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-colors ${
                !comparisonResult
                  ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                  : 'bg-[#070b12] hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-700'
              }`}
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export results</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {exportDropdownOpen && (
              <div className="absolute right-0 mt-1 w-36 bg-[#0c121e] border border-slate-700 rounded-lg shadow-2xl py-1 z-50">
                <button
                  onClick={() => {
                    setExportDropdownOpen(false);
                    downloadExport('csv');
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-slate-200 text-xs flex items-center justify-between"
                >
                  <span>Export CSV</span>
                  <span className="text-[9px] text-slate-500">.csv</span>
                </button>
                <button
                  onClick={() => {
                    setExportDropdownOpen(false);
                    downloadExport('json');
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-slate-200 text-xs flex items-center justify-between"
                >
                  <span>Export JSON</span>
                  <span className="text-[9px] text-slate-500">.json</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Candidate Scenario Selection Pills */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80">
        <span className="text-[10px] text-slate-400 uppercase tracking-wider">Candidate sites</span>
        {scenarios.map((sc) => {
          const isSelected = selectedScenarioIds.includes(sc.id);
          return (
            <button
              key={sc.id}
              onClick={() => toggleScenarioSelection(sc.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                isSelected
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                  : 'bg-[#070b12] text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300'
              }`}
              title={`${sc.name}\nLat: ${sc.latitude.toFixed(4)}°, Lon: ${sc.longitude.toFixed(4)}°\nSite: ${sc.site_id}`}
            >
              {isSelected ? (
                <CheckSquare className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              ) : (
                <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              )}
              <span className="truncate max-w-[200px]">{sc.name.split('—')[1]?.trim() || sc.name}</span>
            </button>
          );
        })}
      </div>

      {/* Harmonization & Scientific Fairness Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-slate-100 select-none">
            <input
              type="checkbox"
              checked={enforceHarmonizedTime}
              onChange={(e) => setEnforceHarmonizedTime(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
            />
            <span className="font-bold text-cyan-300">Enforce Harmonized Window (Fair Scientific Comparison)</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 uppercase">Shared time window</span>
          {[
            { label: '24h', days: 1.0, step: 0.5 },
            { label: '3d', days: 3.0, step: 1.0 },
            { label: '7d', days: 7.0, step: 2.0 },
            { label: '28d', days: 28.0, step: 4.0 },
          ].map((w) => (
            <button
              key={w.label}
              onClick={() => {
                setOverrideDurationDays(w.days);
                setOverrideStepHours(w.step);
              }}
              className={`px-2 py-0.5 rounded font-bold transition-all ${
                overrideDurationDays === w.days
                  ? 'bg-cyan-500 text-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {w.label}
            </button>
          ))}
          <span className="text-slate-500 text-[10px]">({overrideStepHours}h step)</span>
        </div>
      </div>
    </div>
  );
};
