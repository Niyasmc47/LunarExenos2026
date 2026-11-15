import React from 'react';
import { EvaluatedMissionWindow } from '../../types/windowPlanner';
import { useWindowPlannerStore } from '../../stores/windowPlannerStore';
import {
  Sun,
  Radio,
  Clock,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ChevronRight,
  CheckSquare,
  Square,
  Moon,
} from 'lucide-react';

interface Props {
  window: EvaluatedMissionWindow;
}

export const WindowTimelineCard: React.FC<Props> = ({ window: win }) => {
  const selectedWindow = useWindowPlannerStore((state) => state.selectedWindow);
  const openDetailDrawer = useWindowPlannerStore((state) => state.openDetailDrawer);
  const selectedForComparison = useWindowPlannerStore((state) => state.selectedForComparison);
  const toggleComparisonSelection = useWindowPlannerStore((state) => state.toggleComparisonSelection);

  const isSelectedForComp = selectedForComparison.includes(win.window_id);
  const isActive = selectedWindow?.window_id === win.window_id;

  const solarPercent = Math.min(100, Math.max(0, win.solar_summary.illumination_percentage));
  const earthPercent = Math.min(100, Math.max(0, win.earth_summary.earth_visibility_percentage));

  return (
    <div
      className={`border rounded-xl p-4 transition-all ${
        isActive
          ? 'bg-slate-900/95 border-indigo-500/80 shadow-lg shadow-indigo-950/30'
          : 'bg-[#141619] hover:bg-[#191b20] border-[#2b2d32]'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#202228]">
        <div className="flex items-center gap-3">
          {/* Comparison Checkbox */}
          <button
            onClick={() => toggleComparisonSelection(win.window_id)}
            title="Select window for side-by-side comparison (2 to 4 windows)"
            className="text-slate-400 hover:text-indigo-400 transition-colors"
          >
            {isSelectedForComp ? (
              <CheckSquare className="w-4 h-4 text-indigo-400" />
            ) : (
              <Square className="w-4 h-4 text-slate-600" />
            )}
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-white tracking-wide">
                {win.window_id}
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                (Window #{win.window_index + 1})
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5 mt-0.5">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>{win.start_timestamp_iso.replace('T', ' ').replace('Z', '')}</span>
              <span className="text-slate-600">→</span>
              <span>{win.end_timestamp_iso.replace('T', ' ').replace('Z', '')}</span>
              <span className="text-indigo-400 font-semibold ml-1">
                ({win.duration_hours.toFixed(1)} h)
              </span>
            </div>
          </div>
        </div>

        {/* Classification Badge & Breakdown */}
        <div className="flex items-center gap-2">
          {win.classification === 'COMPLIANT' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>COMPLIANT</span>
            </div>
          )}
          {win.classification === 'NON_COMPLIANT' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono font-semibold">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>NON-COMPLIANT</span>
            </div>
          )}
          {win.classification === 'INDETERMINATE' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>INDETERMINATE</span>
            </div>
          )}

          <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono">
            <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 text-emerald-300">
              {win.hard_constraints_passed} Pass
            </span>
            {win.hard_constraints_failed > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-800/40 text-rose-300">
                {win.hard_constraints_failed} Fail
              </span>
            )}
            {win.hard_constraints_indeterminate > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/40 text-amber-300">
                {win.hard_constraints_indeterminate} Indet
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
        {/* Solar Summary */}
        <div className="space-y-1.5 bg-slate-900/40 rounded-lg p-2.5 border border-[#202228]">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <Sun className="w-3.5 h-3.5" />
              <span>Sunlight</span>
            </span>
            <span className="text-slate-200">
              {win.solar_summary.total_sunlight_hours.toFixed(1)} h ({solarPercent.toFixed(1)}%)
            </span>
          </div>
          {/* Mini Illumination Bar */}
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden flex">
            <div
              className="bg-amber-400 h-full"
              style={{ width: `${solarPercent}%` }}
              title={`Sunlight: ${win.solar_summary.total_sunlight_hours.toFixed(1)}h`}
            />
            <div
              className="bg-slate-700 h-full"
              style={{ width: `${100 - solarPercent}%` }}
              title={`Darkness: ${win.solar_summary.darkness_hours.toFixed(1)}h`}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-0.5">
            <span>Full: {win.solar_summary.full_sunlight_hours.toFixed(1)} h</span>
            <span className="flex items-center gap-1">
              <Moon className="w-3 h-3 text-slate-500" />
              <span>Max Dark: {win.solar_summary.longest_darkness_hours.toFixed(1)} h</span>
            </span>
            <span>Min Daily: {win.solar_summary.min_daily_sunlight_hours.toFixed(1)} h</span>
          </div>
        </div>

        {/* Earth Summary */}
        <div className="space-y-1.5 bg-slate-900/40 rounded-lg p-2.5 border border-[#202228]">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="flex items-center gap-1.5 text-sky-400 font-semibold">
              <Radio className="w-3.5 h-3.5" />
              <span>Earth Visibility</span>
            </span>
            <span className="text-slate-200">
              {win.earth_summary.total_earth_visible_hours.toFixed(1)} h ({earthPercent.toFixed(1)}%)
            </span>
          </div>
          {/* Mini Visibility Bar */}
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden flex">
            <div
              className="bg-sky-400 h-full"
              style={{ width: `${earthPercent}%` }}
              title={`Earth Visible: ${win.earth_summary.total_earth_visible_hours.toFixed(1)}h`}
            />
            <div
              className="bg-slate-700 h-full"
              style={{ width: `${100 - earthPercent}%` }}
              title={`Blackout: ${win.earth_summary.earth_blackout_hours.toFixed(1)}h`}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-0.5">
            <span>Full Disk: {win.earth_summary.full_disk_earth_visible_hours.toFixed(1)} h</span>
            <span>Max Blackout: {win.earth_summary.longest_earth_blackout_hours.toFixed(1)} h</span>
            <span>Min Daily: {win.earth_summary.min_daily_earth_visible_hours.toFixed(1)} h</span>
          </div>
        </div>
      </div>

      {/* Footer / Inspect Button */}
      <div className="flex items-center justify-between mt-3 pt-2 text-[11px] font-mono">
        <span className="text-slate-500">
          Coverage: <span className="text-slate-400">{win.coverage_certainty}</span>
        </span>
        <button
          onClick={() => openDetailDrawer(win)}
          className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
        >
          <span>Inspect Constraints Matrix</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
