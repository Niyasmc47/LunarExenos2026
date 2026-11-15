import React, { useState } from 'react';
import { Sliders, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useScenarioStore } from '../../stores/scenarioStore';

export const MissionConstraintsPanel: React.FC = () => {
  const constraints = useScenarioStore((state) => state.constraints);
  const setConstraints = useScenarioStore((state) => state.setConstraints);
  const runComparison = useScenarioStore((state) => state.runComparison);

  const [expanded, setExpanded] = useState(false);

  const handleChange = (key: string, val: string) => {
    const num = val === '' ? undefined : parseFloat(val);
    setConstraints({ [key]: num });
  };

  const handleApply = () => {
    runComparison();
  };

  return (
    <div className="bg-[#141619] border border-[#2b2d32] rounded-xl px-3 py-2 font-mono text-xs shadow-lg">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-slate-200 hover:text-emerald-300 font-bold transition-colors"
        >
          <Sliders className="w-3.5 h-3.5 text-emerald-400" />
          <span>USER MISSION CONSTRAINTS & ACCEPTANCE CRITERIA</span>
          <span className="text-[10px] text-slate-500 font-normal">
            (Rule-based evaluation • Zero arbitrary AI rankings)
          </span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {expanded && (
          <button
            onClick={handleApply}
            className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 font-bold transition-all"
          >
            RE-EVALUATE CONSTRAINTS
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-2.5 pt-2 border-t border-[#202228] space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* 1. Min Sunlight Hours */}
            <div className="bg-[#0e1013] p-2 rounded-lg border border-[#2b2d32] space-y-1">
              <label className="text-[10px] text-amber-400 uppercase font-bold block">
                MIN SUNLIGHT DURATION
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={constraints.min_sunlight_hours ?? ''}
                  onChange={(e) => handleChange('min_sunlight_hours', e.target.value)}
                  placeholder="e.g. 24"
                  className="w-full bg-slate-900 border border-[#303238] rounded px-2 py-1 text-slate-200 font-bold focus:outline-none focus:border-amber-500"
                />
                <span className="text-slate-400 text-[10px]">hours</span>
              </div>
            </div>

            {/* 2. Max Darkness Hours */}
            <div className="bg-[#0e1013] p-2 rounded-lg border border-[#2b2d32] space-y-1">
              <label className="text-[10px] text-rose-400 uppercase font-bold block">
                MAX CONTINUOUS DARKNESS
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={constraints.max_darkness_hours ?? ''}
                  onChange={(e) => handleChange('max_darkness_hours', e.target.value)}
                  placeholder="e.g. 24"
                  className="w-full bg-slate-900 border border-[#303238] rounded px-2 py-1 text-slate-200 font-bold focus:outline-none focus:border-rose-500"
                />
                <span className="text-slate-400 text-[10px]">hours</span>
              </div>
            </div>

            {/* 3. Min Earth Visibility Hours */}
            <div className="bg-[#0e1013] p-2 rounded-lg border border-[#2b2d32] space-y-1">
              <label className="text-[10px] text-cyan-400 uppercase font-bold block">
                MIN EARTH LINE-OF-SIGHT
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={constraints.min_earth_visible_hours ?? ''}
                  onChange={(e) => handleChange('min_earth_visible_hours', e.target.value)}
                  placeholder="e.g. 24"
                  className="w-full bg-slate-900 border border-[#303238] rounded px-2 py-1 text-slate-200 font-bold focus:outline-none focus:border-cyan-500"
                />
                <span className="text-slate-400 text-[10px]">hours</span>
              </div>
            </div>

            {/* 4. Max Allowable Slope */}
            <div className="bg-[#0e1013] p-2 rounded-lg border border-[#2b2d32] space-y-1">
              <label className="text-[10px] text-emerald-400 uppercase font-bold block">
                MAX ALLOWABLE SLOPE
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  max="45"
                  step="0.5"
                  value={constraints.max_allowable_slope_deg ?? ''}
                  onChange={(e) => handleChange('max_allowable_slope_deg', e.target.value)}
                  placeholder="e.g. 15"
                  className="w-full bg-slate-900 border border-[#303238] rounded px-2 py-1 text-slate-200 font-bold focus:outline-none focus:border-emerald-500"
                />
                <span className="text-slate-400 text-[10px]">deg (°)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-slate-400 bg-[#0e1013] p-2 rounded border border-[#202228]">
            <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>
              All candidates are evaluated strictly against user requirements. Ranking compliance scores represent the percentage of criteria passed.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
