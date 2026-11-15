import { DialogSurface } from '../ui/DialogSurface';
import React from 'react';
import { useWindowPlannerStore } from '../../stores/windowPlannerStore';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  GitCompare,
  Sun,
  Radio,
  CheckCircle,
} from 'lucide-react';

export const WindowComparisonModal: React.FC = () => {
  const isComparisonOpen = useWindowPlannerStore((state) => state.isComparisonOpen);
  const comparisonResult = useWindowPlannerStore((state) => state.comparisonResult);
  const closeComparisonModal = useWindowPlannerStore((state) => state.closeComparisonModal);

  if (!isComparisonOpen || !comparisonResult) return null;

  const res = comparisonResult;

  return (
    <DialogSurface label="Compare mission windows" onClose={closeComparisonModal} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0b101c] border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-[#0b101c]/95 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-mono font-bold text-white tracking-wide">
                SIDE-BY-SIDE WINDOW COMPARISON ({res.compared_windows.length} WINDOWS)
              </h2>
              <span className="text-[11px] font-mono text-slate-400">
                Reference Window: <span className="text-indigo-400 font-bold">{res.reference_window_id}</span>
              </span>
            </div>
          </div>

          <button
            aria-label="Close dialog" onClick={closeComparisonModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Consistency Provenance */}
          <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1.5">
            <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Harmonized Scientific Baseline</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono text-slate-300">
              {res.consistency_notes.map((note, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                  <span>{note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Comparison Grid */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                  <th className="py-3 px-4 font-semibold">Metric / Attribute</th>
                  {res.compared_windows.map((w) => (
                    <th
                      key={w.window_id}
                      className={`py-3 px-4 font-semibold ${
                        w.window_id === res.reference_window_id ? 'bg-indigo-950/20 text-indigo-300' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{w.window_id}</span>
                        {w.window_id === res.reference_window_id && (
                          <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-[9px] text-indigo-300 border border-indigo-500/30">
                            REF
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                {/* Classification */}
                <tr className="hover:bg-slate-800/30">
                  <td className="py-2.5 px-4 text-slate-400 font-medium">Classification</td>
                  {res.compared_windows.map((w) => (
                    <td key={w.window_id} className="py-2.5 px-4">
                      {w.classification === 'COMPLIANT' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold">
                          <ShieldCheck className="w-3 h-3" />
                          <span>COMPLIANT</span>
                        </span>
                      )}
                      {w.classification === 'NON_COMPLIANT' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-semibold">
                          <ShieldAlert className="w-3 h-3" />
                          <span>NON-COMPLIANT</span>
                        </span>
                      )}
                      {w.classification === 'INDETERMINATE' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-semibold">
                          <AlertTriangle className="w-3 h-3" />
                          <span>INDETERMINATE</span>
                        </span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Start Epoch */}
                <tr className="hover:bg-slate-800/30">
                  <td className="py-2.5 px-4 text-slate-400 font-medium">Start Epoch (UTC)</td>
                  {res.compared_windows.map((w) => (
                    <td key={w.window_id} className="py-2.5 px-4 text-slate-200">
                      {w.start_timestamp_iso.replace('T', ' ').replace('Z', '')}
                    </td>
                  ))}
                </tr>

                {/* Total Sunlight */}
                <tr className="hover:bg-slate-800/30">
                  <td className="py-2.5 px-4 text-slate-400 font-medium flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span>Total Sunlight</span>
                  </td>
                  {res.compared_windows.map((w) => (
                    <td key={w.window_id} className="py-2.5 px-4 text-amber-300 font-semibold">
                      {w.total_sunlight_hours.toFixed(1)} h ({w.illumination_percentage.toFixed(1)}%)
                    </td>
                  ))}
                </tr>

                {/* Full Sunlight */}
                <tr className="hover:bg-slate-800/30">
                  <td className="py-2.5 px-4 text-slate-400 font-medium">Full Sunlight</td>
                  {res.compared_windows.map((w) => (
                    <td key={w.window_id} className="py-2.5 px-4 text-slate-200">
                      {w.full_sunlight_hours.toFixed(1)} h
                    </td>
                  ))}
                </tr>

                {/* Longest Darkness */}
                <tr className="hover:bg-slate-800/30">
                  <td className="py-2.5 px-4 text-slate-400 font-medium">Max Continuous Darkness</td>
                  {res.compared_windows.map((w) => (
                    <td key={w.window_id} className="py-2.5 px-4 text-slate-200">
                      {w.longest_darkness_hours.toFixed(1)} h
                    </td>
                  ))}
                </tr>

                {/* Total Earth Visibility */}
                <tr className="hover:bg-slate-800/30">
                  <td className="py-2.5 px-4 text-slate-400 font-medium flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-sky-400" />
                    <span>Total Earth Visibility</span>
                  </td>
                  {res.compared_windows.map((w) => (
                    <td key={w.window_id} className="py-2.5 px-4 text-sky-300 font-semibold">
                      {w.total_earth_visible_hours.toFixed(1)} h
                    </td>
                  ))}
                </tr>

                {/* Longest Blackout */}
                <tr className="hover:bg-slate-800/30">
                  <td className="py-2.5 px-4 text-slate-400 font-medium">Max Earth Blackout</td>
                  {res.compared_windows.map((w) => (
                    <td key={w.window_id} className="py-2.5 px-4 text-slate-200">
                      {w.longest_earth_blackout_hours.toFixed(1)} h
                    </td>
                  ))}
                </tr>

                {/* Hard Constraints */}
                <tr className="hover:bg-slate-800/30">
                  <td className="py-2.5 px-4 text-slate-400 font-medium">Hard Constraints (P / F / I)</td>
                  {res.compared_windows.map((w) => (
                    <td key={w.window_id} className="py-2.5 px-4 text-slate-300">
                      <span className="text-emerald-400">{w.hard_constraints_passed}</span> /{' '}
                      <span className="text-rose-400">{w.hard_constraints_failed}</span> /{' '}
                      <span className="text-amber-400">{w.hard_constraints_indeterminate}</span>
                    </td>
                  ))}
                </tr>

                {/* Relative Differences */}
                <tr className="hover:bg-slate-800/30 bg-slate-900/60">
                  <td className="py-2.5 px-4 text-indigo-300 font-medium">Deltas from Reference</td>
                  {res.compared_windows.map((w) => (
                    <td key={w.window_id} className="py-2.5 px-4 text-[11px] text-slate-300">
                      {w.window_id === res.reference_window_id ? (
                        <span className="text-slate-500 italic">Baseline Reference</span>
                      ) : (
                        <div className="space-y-1">
                          {w.differences_from_reference.map((diff, dIdx) => (
                            <div key={dIdx} className="text-indigo-300">
                              • {diff}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DialogSurface>
  );
};
