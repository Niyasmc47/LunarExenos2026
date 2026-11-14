import React from 'react';
import { useTradeOffStore } from '../../stores/tradeOffStore';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Award,
  ChevronRight,
  Trash2,
  HelpCircle,
} from 'lucide-react';

export const AlternativeComparisonTable: React.FC = () => {
  const activeStudy = useTradeOffStore((state) => state.activeStudy);
  const openDetailDrawer = useTradeOffStore((state) => state.openDetailDrawer);
  const removeAlternative = useTradeOffStore((state) => state.removeAlternative);

  if (!activeStudy || activeStudy.alternatives.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 font-mono text-xs">
        No alternatives found in this trade-off study.
      </div>
    );
  }

  const { alternatives, scores, pareto_results } = activeStudy;

  return (
    <div className="space-y-4">
      {/* Table Container */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#090d16]/80 shadow-xl">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 text-[11px]">
              <th className="py-3 px-3 min-w-[200px]">Alternative & Location</th>
              <th className="py-3 px-3 min-w-[150px]">Mission Epochs</th>
              <th className="py-3 px-3 text-center min-w-[130px]">Hard Constraints</th>
              <th className="py-3 px-3 text-center min-w-[150px]">Preference Score</th>
              <th className="py-3 px-3 text-center min-w-[160px]">Pareto Frontier</th>
              <th className="py-3 px-3 text-right">Sunlight (Total / Full)</th>
              <th className="py-3 px-3 text-right">Max Darkness</th>
              <th className="py-3 px-3 text-right">Earth LOS</th>
              <th className="py-3 px-3 text-right">Local Slope</th>
              <th className="py-3 px-3 text-right">Elevation</th>
              <th className="py-3 px-3 text-center min-w-[100px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
            {alternatives.map((alt) => {
              const score = scores[alt.id];
              const pareto = pareto_results[alt.id];
              const ext = alt.extracted_metrics;

              return (
                <tr key={alt.id} className="hover:bg-slate-800/30 transition-colors">
                  {/* Alternative & Location */}
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-100 flex items-center gap-1.5">
                      <span>{alt.name}</span>
                      <span className="text-[10px] text-slate-500 font-normal">({alt.id})</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {alt.candidate_name} • Lat: {alt.latitude.toFixed(2)}° Lon: {alt.longitude.toFixed(2)}°
                    </div>
                  </td>

                  {/* Mission Epochs */}
                  <td className="py-3 px-3 text-[11px] text-slate-300">
                    <div>{alt.start_timestamp_iso.replace('T', ' ').replace('Z', '')}</div>
                    <div className="text-slate-500 text-[10px]">
                      Duration: {alt.duration_days.toFixed(1)} d ({alt.duration_hours.toFixed(0)} h)
                    </div>
                  </td>

                  {/* Hard Constraints Status */}
                  <td className="py-3 px-3 text-center">
                    {alt.hard_constraint_status === 'COMPLIANT' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold">
                        <ShieldCheck className="w-3 h-3" />
                        <span>COMPLIANT</span>
                      </span>
                    )}
                    {alt.hard_constraint_status === 'NON_COMPLIANT' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-semibold">
                        <ShieldAlert className="w-3 h-3" />
                        <span>NON-COMPLIANT</span>
                      </span>
                    )}
                    {alt.hard_constraint_status === 'INDETERMINATE' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-semibold">
                        <AlertTriangle className="w-3 h-3" />
                        <span>INDETERMINATE</span>
                      </span>
                    )}
                    <div className="text-[9px] text-slate-500 mt-1">
                      {alt.hard_constraints_passed}/{alt.total_hard_constraints} passed
                      {alt.hard_constraints_failed > 0 && ` • ${alt.hard_constraints_failed} fail`}
                    </div>
                  </td>

                  {/* Preference Score */}
                  <td className="py-3 px-3 text-center">
                    {score ? (
                      <div>
                        <div className="text-base font-bold text-white tracking-tight">
                          {score.composite_score.toFixed(1)}
                          <span className="text-[10px] text-slate-500 font-normal ml-0.5">/ 100</span>
                        </div>
                        <div className="mt-0.5 flex flex-col items-center justify-center gap-0.5">
                          {score.ranking_eligibility === 'ELIGIBLE' ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/80 border border-emerald-800/40 text-emerald-300 font-bold">
                              Rank #{score.eligible_rank}
                            </span>
                          ) : (
                            <span
                              className="text-[9px] px-1.5 py-0.2 rounded bg-rose-950/80 border border-rose-800/40 text-rose-300 cursor-help"
                              title={score.ineligibility_reason || 'Ineligible for ranking'}
                            >
                              Unranked (Ineligible)
                            </span>
                          )}
                          {score.score_status === 'COMPLETE' ? (
                            <span className="text-[9px] text-slate-400">
                              Complete (100%)
                            </span>
                          ) : (
                            <span
                              className="text-[9px] text-amber-400 cursor-help"
                              title={score.limitations[0] || 'Incomplete measurements'}
                            >
                              Incomplete ({(score.available_weight_fraction * 100).toFixed(0)}% Wt)
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-500 text-[11px]">N/A</span>
                    )}
                  </td>

                  {/* Pareto Frontier */}
                  <td className="py-3 px-3 text-center">
                    {pareto ? (
                      <div>
                        {pareto.status === 'PARETO_OPTIMAL' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-[10px] font-semibold">
                            <Award className="w-3 h-3" />
                            <span>PARETO OPTIMAL</span>
                          </span>
                        )}
                        {pareto.status === 'DOMINATED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-400 text-[10px]">
                            <span>Dominated ({pareto.dominated_by.length})</span>
                          </span>
                        )}
                        {pareto.status === 'INCOMPARABLE_INCOMPLETE' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px]">
                            <HelpCircle className="w-3 h-3" />
                            <span>Incomparable</span>
                          </span>
                        )}
                        {pareto.status === 'DOMINATED' && (
                          <div className="text-[9px] text-slate-500 mt-0.5">
                            by {pareto.dominated_by.join(', ')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-500 text-[10px]">N/A</span>
                    )}
                  </td>

                  {/* Raw Sunlight */}
                  <td className="py-3 px-3 text-right">
                    <div className="text-slate-200">
                      {ext.total_sunlight_hours != null ? `${ext.total_sunlight_hours.toFixed(1)} h` : '—'}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Full: {ext.full_sunlight_hours != null ? `${ext.full_sunlight_hours.toFixed(1)} h` : '—'}
                    </div>
                  </td>

                  {/* Max Darkness */}
                  <td className="py-3 px-3 text-right text-slate-300">
                    {ext.longest_darkness_hours != null ? `${ext.longest_darkness_hours.toFixed(1)} h` : '—'}
                  </td>

                  {/* Earth LOS */}
                  <td className="py-3 px-3 text-right text-slate-300">
                    <div>{ext.total_earth_visible_hours != null ? `${ext.total_earth_visible_hours.toFixed(1)} h` : '—'}</div>
                    <div className="text-[10px] text-slate-500">
                      Blk: {ext.longest_earth_blackout_hours != null ? `${ext.longest_earth_blackout_hours.toFixed(1)} h` : '—'}
                    </div>
                  </td>

                  {/* Local Slope */}
                  <td className="py-3 px-3 text-right">
                    <span className={ext.local_slope_deg && ext.local_slope_deg > 15 ? 'text-rose-400 font-semibold' : 'text-slate-200'}>
                      {ext.local_slope_deg != null ? `${ext.local_slope_deg.toFixed(1)}°` : '—'}
                    </span>
                  </td>

                  {/* Elevation */}
                  <td className="py-3 px-3 text-right text-slate-300">
                    {ext.surface_elevation_m != null ? `${ext.surface_elevation_m.toFixed(0)} m` : '—'}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => openDetailDrawer(alt.id)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 text-[10px] font-semibold flex items-center gap-0.5 transition-colors"
                        title="Inspect step-by-step calculation breakdown"
                      >
                        <span>Breakdown</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>

                      {alternatives.length > 2 && (
                        <button
                          onClick={() => removeAlternative(alt.id)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                          title="Remove alternative from study"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Disclaimers Bar */}
      <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-[11px] font-mono text-amber-300/80 flex items-start gap-2">
        <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong>Scientific Interpretation Notice:</strong> Preference scores reflect user-configured criterion weights and normalization bounds, not physical landing safety. Non-compliant alternatives fail active mission requirements regardless of soft-preference score.
        </div>
      </div>
    </div>
  );
};
