import React from 'react';
import { useTradeOffStore } from '../../stores/tradeOffStore';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Info,
  Calculator,
} from 'lucide-react';

export const AlternativeDetailDrawer: React.FC = () => {
  const isDetailOpen = useTradeOffStore((state) => state.isDetailOpen);
  const activeStudy = useTradeOffStore((state) => state.activeStudy);
  const selectedAlternativeId = useTradeOffStore((state) => state.selectedAlternativeId);
  const closeDetailDrawer = useTradeOffStore((state) => state.closeDetailDrawer);

  if (!isDetailOpen || !activeStudy || !selectedAlternativeId) return null;

  const alt = activeStudy.alternatives.find((a) => a.id === selectedAlternativeId);
  if (!alt) return null;

  const score = activeStudy.scores[alt.id];
  const pareto = activeStudy.pareto_results[alt.id];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0b101c] border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-[#0b101c]/95 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-mono font-bold text-white tracking-wide">
                  {alt.name}
                </h2>
                <span className="text-xs font-mono text-slate-400">({alt.id})</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {alt.candidate_name} ({alt.site_id}) • Lat: {alt.latitude.toFixed(4)}° Lon: {alt.longitude.toFixed(4)}°
              </span>
            </div>

            {/* Compliance Badge */}
            {alt.hard_constraint_status === 'COMPLIANT' && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>COMPLIANT</span>
              </span>
            )}
            {alt.hard_constraint_status === 'NON_COMPLIANT' && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono font-semibold">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>NON-COMPLIANT</span>
              </span>
            )}
            {alt.hard_constraint_status === 'INDETERMINATE' && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>INDETERMINATE</span>
              </span>
            )}
          </div>

          <button
            onClick={closeDetailDrawer}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-xs font-mono">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Composite Score</span>
              <span className="text-xl font-bold text-white mt-0.5 block">
                {score ? `${score.composite_score.toFixed(1)} / 100` : 'N/A'}
              </span>
              <span className="text-[10px] text-slate-400">
                {score?.score_status === 'COMPLETE' ? '100% Weight Evaluated' : `${((score?.available_weight_fraction || 0) * 100).toFixed(0)}% Weight Evaluated`}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Ranking Eligibility</span>
              {score?.ranking_eligibility === 'ELIGIBLE' ? (
                <span className="text-sm font-bold text-emerald-400 mt-1 block">
                  Eligible (Rank #{score.eligible_rank})
                </span>
              ) : (
                <span className="text-xs font-bold text-rose-400 mt-1 block" title={score?.ineligibility_reason || ''}>
                  Ineligible for Ranking
                </span>
              )}
              <span className="text-[10px] text-slate-400 block truncate" title={score?.ineligibility_reason || 'Compliant & Complete'}>
                {score?.ineligibility_reason || 'Meets all hard constraints'}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Pareto Frontier</span>
              <span className="text-sm font-bold text-cyan-300 mt-1 block">
                {pareto?.status || 'N/A'}
              </span>
              <span className="text-[10px] text-slate-400">
                Dominates {pareto?.dominates.length || 0} • Dominated by {pareto?.dominated_by.length || 0}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Hard Constraints</span>
              <span className="text-sm font-bold text-slate-200 mt-1 block">
                {alt.hard_constraints_passed} / {alt.total_hard_constraints} Passed
              </span>
              <span className="text-[10px] text-slate-400">
                {alt.hard_constraints_failed} Failed • {alt.hard_constraints_indeterminate} Indet
              </span>
            </div>
          </div>

          {/* Explainability Breakdown Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono font-bold text-white tracking-wide flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-400" />
              <span>PREFERENCE SCORE CALCULATION BREAKDOWN</span>
            </h3>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 text-[11px]">
                    <th className="py-2.5 px-3">Criterion</th>
                    <th className="py-2.5 px-3 text-right">Measured Value</th>
                    <th className="py-2.5 px-3 text-center">Reference Bounds</th>
                    <th className="py-2.5 px-3 text-right">Normalized (0–1)</th>
                    <th className="py-2.5 px-3 text-right">Weight (w'ᵢ)</th>
                    <th className="py-2.5 px-3 text-right font-bold text-emerald-400">Contribution (Cᵢ)</th>
                    <th className="py-2.5 px-3">Formula / Explanation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                  {score?.normalized_metrics.map((nm) => (
                    <tr key={nm.criterion_id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 text-slate-200 font-medium">
                        {nm.criterion_name}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {nm.raw_value !== null && nm.raw_value !== undefined
                          ? `${nm.raw_value.toFixed(1)} ${nm.unit}`
                          : <span className="text-amber-400">UNAVAILABLE</span>}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-400 text-[11px]">
                        [{nm.reference_min.toFixed(0)}, {nm.reference_max.toFixed(0)}] {nm.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-200">
                        {nm.normalized_value !== null && nm.normalized_value !== undefined
                          ? nm.normalized_value.toFixed(4)
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-300">
                        {(nm.normalized_weight * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                        {nm.score_contribution !== null && nm.score_contribution !== undefined
                          ? `+${nm.score_contribution.toFixed(2)}`
                          : '0.00 (Missing)'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[10px]">
                        {nm.formula_str}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900/95 font-bold text-white border-t border-slate-700">
                    <td colSpan={4} className="py-2.5 px-3 text-right text-slate-400">
                      Total Normalized Score:
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      100.0%
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-400 text-sm">
                      {score?.composite_score.toFixed(2)} / 100.0
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[10px]">
                      {score?.score_status}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Hard Constraints Matrix */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono font-bold text-white tracking-wide flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>HARD CONSTRAINTS EVALUATION MATRIX</span>
            </h3>

            {alt.hard_constraint_verdicts.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 text-[11px]">
                      <th className="py-2.5 px-3">Requirement</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Threshold Condition</th>
                      <th className="py-2.5 px-3">Measured Value</th>
                      <th className="py-2.5 px-3 text-center">Verdict</th>
                      <th className="py-2.5 px-3">Scientific Explanation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                    {alt.hard_constraint_verdicts.map((h, i) => (
                      <tr key={i} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 text-slate-200">{h.requirement_name}</td>
                        <td className="py-2.5 px-3 text-slate-400 uppercase text-[10px]">{h.category}</td>
                        <td className="py-2.5 px-3 text-slate-300">{h.threshold_str}</td>
                        <td className="py-2.5 px-3 text-white font-semibold">{h.actual_value_str}</td>
                        <td className="py-2.5 px-3 text-center">
                          {h.verdict === 'PASS' && (
                            <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold">
                              PASS
                            </span>
                          )}
                          {h.verdict === 'FAIL' && (
                            <span className="inline-block px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-semibold">
                              FAIL
                            </span>
                          )}
                          {h.verdict === 'INDETERMINATE' && (
                            <span className="inline-block px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-semibold">
                              INDETERMINATE
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">{h.explanation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs font-mono text-slate-500">
                No active hard constraints evaluated for this alternative.
              </p>
            )}
          </div>

          {/* Provenance & Limitations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            {/* Calculation Provenance */}
            <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800 space-y-2">
              <span className="font-bold text-slate-300 block">DATA SOURCES & PROVENANCE</span>
              <ul className="text-[11px] text-slate-400 space-y-1">
                <li>Scenario ID: <span className="text-slate-200">{alt.provenance.scenario_id}</span></li>
                <li>Site Identifier: <span className="text-slate-200">{alt.site_id}</span></li>
                <li>Window Search ID: <span className="text-slate-200">{alt.provenance.window_search_id || 'None (Using default scenario epochs)'}</span></li>
                <li>Screening Run ID: <span className="text-slate-200">{alt.provenance.screening_run_id || 'None'}</span></li>
                <li>Terrain Assessment ID: <span className="text-slate-200">{alt.provenance.terrain_assessment_id || 'None (Point DEM sample)'}</span></li>
              </ul>
            </div>

            {/* Scientific Disclaimers */}
            <div className="p-4 bg-amber-500/5 rounded-xl border border-amber-500/20 space-y-2">
              <span className="font-bold text-amber-400 block flex items-center gap-1.5">
                <Info className="w-4 h-4" />
                <span>DECISION-MAKING LIMITATIONS</span>
              </span>
              <p className="text-[11px] text-amber-300/80 leading-relaxed">
                {score?.explanation} {score?.limitations.join(' ')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
