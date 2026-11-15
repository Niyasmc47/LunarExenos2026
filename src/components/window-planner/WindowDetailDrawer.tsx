import { DialogSurface } from '../ui/DialogSurface';
import React from 'react';
import { useWindowPlannerStore } from '../../stores/windowPlannerStore';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  FileText,
  Clock,
  Info,
} from 'lucide-react';

export const WindowDetailDrawer: React.FC = () => {
  const isDetailOpen = useWindowPlannerStore((state) => state.isDetailOpen);
  const selectedWindow = useWindowPlannerStore((state) => state.selectedWindow);
  const activeSearch = useWindowPlannerStore((state) => state.activeSearch);
  const closeDetailDrawer = useWindowPlannerStore((state) => state.closeDetailDrawer);

  if (!isDetailOpen || !selectedWindow) return null;

  const w = selectedWindow;

  return (
    <DialogSurface label="Mission window details" onClose={closeDetailDrawer} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0b101c] border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-[#0b101c]/95 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-base font-mono font-bold text-white tracking-wide">
                {w.window_id}
              </span>
              <span className="text-xs font-mono text-slate-400">
                (Window #{w.window_index + 1})
              </span>
            </div>

            {w.classification === 'COMPLIANT' && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>COMPLIANT</span>
              </span>
            )}
            {w.classification === 'NON_COMPLIANT' && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono font-semibold">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>NON-COMPLIANT</span>
              </span>
            )}
            {w.classification === 'INDETERMINATE' && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>INDETERMINATE</span>
              </span>
            )}
          </div>

          <button
            aria-label="Close dialog" onClick={closeDetailDrawer}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Timing & Candidate Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                Mission Interval (UTC)
              </span>
              <span className="text-xs font-mono text-slate-200 mt-1 block">
                {w.start_timestamp_iso}
              </span>
              <span className="text-xs font-mono text-slate-400 block">to</span>
              <span className="text-xs font-mono text-slate-200 block">
                {w.end_timestamp_iso}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                Mission Duration
              </span>
              <span className="text-sm font-mono font-semibold text-indigo-300 mt-1 block">
                {w.duration_days.toFixed(2)} Earth days ({w.duration_hours.toFixed(1)} hours)
              </span>
              <span className="text-[10px] font-mono text-slate-500 mt-1 block">
                Profile: {activeSearch?.profile_name} (v{activeSearch?.profile_version})
              </span>
            </div>

            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                Candidate Location
              </span>
              <span className="text-xs font-mono text-slate-200 mt-1 block">
                {activeSearch?.scenario_name}
              </span>
              <span className="text-[10px] font-mono text-slate-400 block">
                Lat: {activeSearch?.latitude.toFixed(4)}° • Lon: {activeSearch?.longitude.toFixed(4)}°
              </span>
              <span className="text-[10px] font-mono text-slate-500 block">
                DEM: {activeSearch?.site_id} (Certainty: {w.coverage_certainty})
              </span>
            </div>
          </div>

          {/* Hard Constraints Evaluation Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold text-white tracking-wide flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>HARD CONSTRAINTS EVALUATION MATRIX</span>
              </h3>
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="text-emerald-400">{w.hard_constraints_passed} Passed</span>
                <span className="text-slate-600">•</span>
                <span className="text-rose-400">{w.hard_constraints_failed} Failed</span>
                <span className="text-slate-600">•</span>
                <span className="text-amber-400">{w.hard_constraints_indeterminate} Indeterminate</span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                    <th className="py-2.5 px-3">Requirement</th>
                    <th className="py-2.5 px-3">Condition</th>
                    <th className="py-2.5 px-3">Actual Value</th>
                    <th className="py-2.5 px-3 text-center">Verdict</th>
                    <th className="py-2.5 px-3">Evaluation Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                  {w.hard_constraint_results.map((hc, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 text-slate-200 font-medium">
                        {hc.requirement_name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {hc.operator} {hc.threshold_str}
                      </td>
                      <td className="py-2.5 px-3 text-slate-200 font-semibold">
                        {hc.actual_value_str}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {hc.verdict === 'PASS' && (
                          <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold">
                            PASS
                          </span>
                        )}
                        {hc.verdict === 'FAIL' && (
                          <span className="inline-block px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-semibold">
                            FAIL
                          </span>
                        )}
                        {hc.verdict === 'INDETERMINATE' && (
                          <span className="inline-block px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-semibold">
                            INDETERMINATE
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                        {hc.explanation}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Soft Preferences & Informational Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Soft Preferences */}
            <div className="space-y-2">
              <h4 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-sky-400" />
                <span>Soft Preferences (No Synthetic Weighting)</span>
              </h4>
              <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-800 space-y-2">
                {w.soft_preference_results.length === 0 ? (
                  <span className="text-[11px] font-mono text-slate-500">
                    No soft preferences configured in this profile.
                  </span>
                ) : (
                  w.soft_preference_results.map((sp, idx) => (
                    <div key={idx} className="text-xs font-mono pb-2 border-b border-slate-800/40 last:border-none last:pb-0">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">{sp.requirement_name}</span>
                        <span className="text-sky-300 font-semibold">{sp.actual_value_str}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Preference: {sp.operator} {sp.threshold_str} • {sp.notes}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Daily & Transition Metrics */}
            <div className="space-y-2">
              <h4 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>24.0h Earth Day Breakdown & Transitions</span>
              </h4>
              <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/40">
                  <span className="text-slate-400">Min 24h Daily Sunlight:</span>
                  <span className="text-amber-300 font-semibold">
                    {w.solar_summary.min_daily_sunlight_hours.toFixed(1)} h / 24h
                  </span>
                </div>
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/40">
                  <span className="text-slate-400">Min 24h Daily Earth Visibility:</span>
                  <span className="text-sky-300 font-semibold">
                    {w.earth_summary.min_daily_earth_visible_hours.toFixed(1)} h / 24h
                  </span>
                </div>
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/40">
                  <span className="text-slate-400">Solar Transitions:</span>
                  <span className="text-slate-200">
                    {w.solar_summary.sunrise_transitions} Sunrise / {w.solar_summary.sunset_transitions} Sunset
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Earth Transitions:</span>
                  <span className="text-slate-200">
                    {w.earth_summary.earthrise_transitions} Earthrise / {w.earth_summary.earthset_transitions} Earthset
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Scientific Disclaimers */}
          <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-mono font-semibold">
              <Info className="w-4 h-4 shrink-0" />
              <span>MANDATORY SCIENTIFIC ACCURACY DISCLAIMERS</span>
            </div>
            <ul className="text-[11px] font-mono text-amber-300/80 space-y-1 list-disc list-inside">
              <li>
                Solar visibility and actual electrical power generation are different measurements. Terrain obstruction and solar-panel system parameters have not yet been evaluated.
              </li>
              <li>
                Geometric Earth visibility does not guarantee an operational radio link. Terrain obstruction and RF link-budget analysis have not yet been evaluated.
              </li>
              <li>
                Surface slope and elevation alone do not determine lunar landing safety or rover navigability.
              </li>
              <li>
                Daily metrics are evaluated across non-overlapping 24.0h Earth day increments from mission start epoch.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </DialogSurface>
  );
};
