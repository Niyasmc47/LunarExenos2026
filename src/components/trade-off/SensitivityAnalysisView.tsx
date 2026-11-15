import React from 'react';
import { useTradeOffStore } from '../../stores/tradeOffStore';
import { Play, TrendingUp } from 'lucide-react';

export const SensitivityAnalysisView: React.FC = () => {
  const activeStudy = useTradeOffStore((state) => state.activeStudy);
  const runSensitivityAnalysis = useTradeOffStore((state) => state.runSensitivityAnalysis);
  const isLoading = useTradeOffStore((state) => state.isLoading);

  if (!activeStudy) return null;

  const sens = activeStudy.sensitivity_summary;
  const alternatives = activeStudy.alternatives;

  return (
    <div className="bg-[#141619] border border-[#2b2d32] rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#2b2d32]">
        <div>
          <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <span>WEIGHT SENSITIVITY & OPERATIONAL STABILITY</span>
          </h3>
          <p className="text-[11px] font-mono text-slate-400 mt-0.5">
            Evaluates ranking volatility under alternative mission operational priorities (Solar, Comm, Terrain safety, Equal).
          </p>
        </div>

        <button
          onClick={runSensitivityAnalysis}
          disabled={isLoading}
          className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-semibold flex items-center gap-1.5 transition-all shadow-lg shadow-purple-900/30"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{isLoading ? 'Evaluating Scenarios...' : 'Re-Run Sensitivity'}</span>
        </button>
      </div>

      {sens ? (
        <div className="space-y-6">
          {/* Stability Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-[#2b2d32] space-y-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                Leading Eligible Alternative
              </span>
              <span className="text-base font-mono font-bold text-white block">
                {sens.has_eligible_leader && sens.current_leader_id
                  ? alternatives.find((a) => a.id === sens.current_leader_id)?.name || sens.current_leader_id
                  : 'None (No Complete Eligible Candidate)'}
              </span>
              <span className="text-[11px] font-mono text-purple-400 block">
                {sens.has_eligible_leader && sens.current_leader_id
                  ? `Stability: ${sens.leader_stability[sens.current_leader_id] || 0}% across priority suites`
                  : 'Requires 100% hard constraint pass & complete score'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-[#2b2d32] space-y-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                Robust Eligible Alternatives (Top-2 in ≥ 60%)
              </span>
              <span className="text-base font-mono font-bold text-emerald-400 block">
                {sens.robust_alternatives.length > 0
                  ? sens.robust_alternatives
                      .map((id) => alternatives.find((a) => a.id === id)?.name || id)
                      .join(', ')
                  : 'None'}
              </span>
              <span className="text-[10px] font-mono text-slate-500 block">
                Consistently competitive under weight variations
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-[#2b2d32] space-y-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                Tested Scenarios
              </span>
              <span className="text-base font-mono font-bold text-slate-200 block">
                {sens.tested_scenarios.filter((s) => s.is_available).length} of {sens.tested_scenarios.length} Available
              </span>
              <span className="text-[10px] font-mono text-slate-500 block">
                70% priority / 30% remainder allocation
              </span>
            </div>
          </div>

          {/* Scenarios Table */}
          <div className="overflow-x-auto rounded-xl border border-[#2b2d32] bg-[#08090b]">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-slate-900/90 text-slate-400 border-b border-[#2b2d32] text-[11px]">
                  <th className="py-2.5 px-3">Sensitivity Scenario</th>
                  <th className="py-2.5 px-3">Priority Focus</th>
                  <th className="py-2.5 px-3 text-center">Leading Alternative</th>
                  {alternatives.map((alt) => (
                    <th key={alt.id} className="py-2.5 px-3 text-right">
                      {alt.name} (Score / Rank)
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sens.tested_scenarios.map((scen) => (
                  <tr key={scen.scenario_id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-semibold text-white">
                      <div>{scen.scenario_name}</div>
                      {!scen.is_available && (
                        <span className="text-[10px] text-amber-400 font-normal">
                          (Unavailable: {scen.warning})
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                      {scen.scenario_description}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded font-bold text-[10px] ${
                        scen.leading_alternative_id
                          ? 'bg-purple-500/15 border border-purple-500/40 text-purple-300'
                          : 'bg-slate-800 border border-[#303238] text-slate-400'
                      }`}>
                        {scen.leading_alternative_name || 'No eligible leader'}
                      </span>
                    </td>
                    {alternatives.map((alt) => {
                      if (!scen.is_available) {
                        return (
                          <td key={alt.id} className="py-2.5 px-3 text-right text-slate-600">
                            N/A
                          </td>
                        );
                      }

                      const score = scen.scores[alt.id] ?? 0;
                      const eligibleRank = scen.eligible_rankings?.[alt.id];
                      const ineligReason = scen.ineligibility_reasons?.[alt.id];
                      const isLeader = scen.leading_alternative_id === alt.id;

                      return (
                        <td key={alt.id} className="py-2.5 px-3 text-right">
                          <span className={isLeader ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                            {score.toFixed(1)}
                          </span>
                          {eligibleRank !== undefined && eligibleRank !== null ? (
                            <span className="text-[10px] text-emerald-400 ml-1 font-semibold">
                              (#{eligibleRank})
                            </span>
                          ) : (
                            <span
                              className="text-[9px] text-rose-400 ml-1 cursor-help"
                              title={ineligReason || 'Ineligible for ranking'}
                            >
                              (Ineligible)
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Notes */}
          <div className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-xl space-y-1 text-[11px] font-mono text-purple-300/80">
            {sens.summary_notes.map((note, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-purple-400">•</span>
                <span>{note}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-slate-500 font-mono text-xs">
          Sensitivity analysis not yet run for this study. Click "Re-Run Sensitivity" above.
        </div>
      )}
    </div>
  );
};
