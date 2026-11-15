import React, { useState } from 'react';
import {
  GitCompare,
  Plus,
  Download,
  CheckSquare,
  Square,
  ChevronDown,
  Sparkles,
  Cpu,
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

  const getCandidateBadge = (scenarioId: string, idx: number) => {
    if (comparisonResult) {
      const rankItem = comparisonResult.ranking_summary.find((r) => r.scenario_id === scenarioId);
      const scRes = comparisonResult.scenarios.find((s) => s.scenario.id === scenarioId);
      if (scRes && scRes.failed_constraints_count > 0) {
        return (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-rose-500/15 text-rose-400 font-bold border border-rose-500/30">
            DISQUALIFIED
          </span>
        );
      }
      if (rankItem?.rank === 1) {
        return (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
            PRIME
          </span>
        );
      }
      if (rankItem?.rank === 2) {
        return (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-[#ffe3b0]/15 text-[#ffe3b0] font-bold border border-[#ffe3b0]/30">
            BACKUP
          </span>
        );
      }
    }
    // Fallback based on index
    if (idx === 0) {
      return (
        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
          PRIME
        </span>
      );
    }
    if (idx === 1) {
      return (
        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-500/30">
          BACKUP
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-800 text-slate-400 font-bold">
        CANDIDATE
      </span>
    );
  };

  return (
    <div className="bg-[#0e1013] border border-[#2b2d32] rounded-xl p-3.5 space-y-3 font-mono text-xs shadow-xl shrink-0">
      {/* Top Aerospace Context Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#202228]">
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="text-[#ffe3b0] font-bold">02 PLAN</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-300 font-semibold uppercase tracking-wider">COMPARE SCENARIOS</span>
          <span className="text-slate-600">/</span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-bold text-[10px]">
            ENGINE V4.2
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span className="flex items-center gap-1 bg-[#141619] px-2 py-0.5 rounded border border-[#2b2d32]">
            <Cpu className="w-3 h-3 text-[#7bd0ff]" />
            <span className="text-slate-300">SPICE DE440</span>
          </span>
          <span className="hidden md:inline text-slate-600">•</span>
          <span className="hidden md:inline text-slate-400">1.5m observer height</span>
          <span className="hidden md:inline text-slate-600">•</span>
          <span className="hidden md:inline text-slate-400">{overrideStepHours}h step</span>
          <span className="hidden md:inline text-slate-600">•</span>
          <span className="text-[#ffe3b0] font-semibold">{overrideDurationDays.toFixed(1)}d sortie</span>
        </div>
      </div>

      {/* Main Action Bar: Header, Scenario count, Compare & Add actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-[#ffe3b0]" />
          <span className="font-bold text-slate-100 uppercase tracking-wide">
            Candidate Landing Stack
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-[#191b20] text-[#7bd0ff] border border-[#2b2d32] font-semibold">
            {selectedScenarioIds.length} / {scenarios.length} SELECTED (MIN 2)
          </span>
        </div>

        {/* Buttons: Run, New, Export */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold bg-[#141619] hover:bg-[#191b20] text-slate-300 hover:text-emerald-300 border border-[#2b2d32] transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Add scenario</span>
          </button>

          <button
            onClick={handleRun}
            disabled={isComparing || selectedScenarioIds.length < 2}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-bold transition-all ${
              isComparing || selectedScenarioIds.length < 2
                ? 'bg-[#191b20] text-slate-500 border border-[#2b2d32] cursor-not-allowed'
                : 'bg-[#ffe3b0] hover:bg-[#ffdea3] text-[#1a1408] shadow-md shadow-[#e5c68d]/20 font-semibold'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#1a1408]" />
            <span>{isComparing ? 'Harmonizing & Comparing…' : 'Compare selected'}</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              disabled={isExporting || !comparisonResult}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold border transition-colors ${
                !comparisonResult
                  ? 'bg-[#141619] text-slate-600 border-[#2b2d32] cursor-not-allowed opacity-50'
                  : 'bg-[#141619] hover:bg-[#191b20] text-slate-300 hover:text-[#7bd0ff] border-[#2b2d32]'
              }`}
            >
              <Download className="w-3.5 h-3.5 text-[#7bd0ff]" />
              <span>Export bundle</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {exportDropdownOpen && (
              <div className="absolute right-0 mt-1 w-44 bg-[#0e1013] border border-[#2b2d32] rounded-lg shadow-2xl py-1 z-50">
                <button
                  onClick={() => {
                    setExportDropdownOpen(false);
                    downloadExport('csv');
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#191b20] text-slate-200 text-xs flex items-center justify-between"
                >
                  <span>Export CSV Bundle</span>
                  <span className="text-[9px] text-[#ffe3b0]">.csv</span>
                </button>
                <button
                  onClick={() => {
                    setExportDropdownOpen(false);
                    downloadExport('json');
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#191b20] text-slate-200 text-xs flex items-center justify-between"
                >
                  <span>Export JSON Telemetry</span>
                  <span className="text-[9px] text-[#7bd0ff]">.json</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Candidate Scenario Selection Pills with Stitch Status Badges */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#202228]">
        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mr-1">
          Stack:
        </span>
        {scenarios.map((sc, idx) => {
          const isSelected = selectedScenarioIds.includes(sc.id);
          return (
            <button
              key={sc.id}
              onClick={() => toggleScenarioSelection(sc.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-mono transition-all ${
                isSelected
                  ? 'bg-[#191b20] text-slate-100 border-[#ffe3b0]/50 shadow-sm'
                  : 'bg-[#0e1013] text-slate-400 border-[#2b2d32] hover:border-slate-600 hover:text-slate-300'
              }`}
              title={`${sc.name}\nLat: ${sc.latitude.toFixed(4)}°, Lon: ${sc.longitude.toFixed(4)}°\nSite: ${sc.site_id}`}
            >
              {isSelected ? (
                <CheckSquare className="w-3.5 h-3.5 text-[#ffe3b0] shrink-0" />
              ) : (
                <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              )}
              <span className="truncate max-w-[190px] font-semibold">
                {sc.name.split('—')[1]?.trim() || sc.name}
              </span>
              {getCandidateBadge(sc.id, idx)}
            </button>
          );
        })}
      </div>

      {/* Harmonization & Scientific Fairness Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#202228] text-[11px]">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-slate-100 select-none">
            <input
              type="checkbox"
              checked={enforceHarmonizedTime}
              onChange={(e) => setEnforceHarmonizedTime(e.target.checked)}
              className="rounded bg-[#141619] border-[#2b2d32] text-[#ffe3b0] focus:ring-0 cursor-pointer"
            />
            <span className="font-bold text-[#ffe3b0]">
              Enforce Harmonized Window
            </span>
            <span className="text-[10px] text-slate-500 hidden sm:inline">(Fair Multi-Candidate Baseline)</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Sortie Span:</span>
          {[
            { label: '14d Sortie', days: 14.0, step: 1.0 },
            { label: '28d Extended', days: 28.0, step: 2.0 },
            { label: '7d', days: 7.0, step: 1.0 },
            { label: '24h', days: 1.0, step: 0.5 },
          ].map((w) => (
            <button
              key={w.label}
              onClick={() => {
                setOverrideDurationDays(w.days);
                setOverrideStepHours(w.step);
              }}
              className={`px-2.5 py-1 rounded font-bold transition-all text-xs ${
                overrideDurationDays === w.days
                  ? 'bg-[#ffe3b0] text-[#1a1408] shadow-sm font-semibold'
                  : 'bg-[#141619] text-slate-400 hover:text-slate-200 border border-[#2b2d32]'
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
