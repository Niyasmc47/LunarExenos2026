import React from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Trophy,
  AlertTriangle,
} from 'lucide-react';
import { useScenarioStore } from '../../stores/scenarioStore';
import { ScenarioRankingItem } from '../../types/scenario';

export const ConstraintEvaluationResults: React.FC = () => {
  const comparisonResult = useScenarioStore((state) => state.comparisonResult);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const setActiveScenarioId = useScenarioStore((state) => state.setActiveScenarioId);

  const scenarios = comparisonResult?.scenarios ?? [];
  const rankings = comparisonResult?.ranking_summary ?? [];
  const caveats = comparisonResult?.scientific_caveats ?? [];

  if (scenarios.length === 0) return null;

  // Collect all unique constraint names from first scenario with constraints
  const constraintList = scenarios[0]?.constraints ?? [];

  return (
    <div className="space-y-3 font-mono text-xs">
      {/* 1. Transparent Ranking & Trade-Off Summary */}
      <div className="bg-[#141619] border border-[#2b2d32] rounded-xl p-3 shadow-lg space-y-2.5">
        <div className="flex items-center justify-between pb-2 border-b border-[#2b2d32]">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-slate-100">
              USER CONSTRAINT COMPLIANCE & MULTI-CRITERIA TRADE-OFF ANALYSIS
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            Deterministic evaluation against user thresholds • Zero arbitrary AI rankings
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {rankings.map((rk: ScenarioRankingItem) => {
            const isTop = rk.rank === 1;
            const isSelected = activeScenarioId === rk.scenario_id;

            return (
              <div
                key={rk.scenario_id}
                onClick={() => setActiveScenarioId(rk.scenario_id)}
                className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#0e1013] border-cyan-500 shadow-lg'
                    : 'bg-[#0e1013]/60 border-[#2b2d32] hover:border-[#303238]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isTop
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-slate-800 text-slate-300 border border-[#303238]'
                    }`}
                  >
                    COMPLIANCE #{rk.rank}
                  </span>
                  <span className="text-emerald-400 font-bold text-[11px]">
                    {rk.passed_count} / {rk.total_count} Passed
                  </span>
                </div>

                <div className="font-bold text-slate-200 mt-1.5 truncate text-[11px]">
                  {rk.scenario_name}
                </div>

                <div className="mt-2 text-[10px] text-slate-400 border-t border-[#202228] pt-1.5 space-y-0.5">
                  <div className="text-slate-500 font-bold uppercase text-[9px]">Dominant Mission Trade-Off:</div>
                  <div className="text-slate-300 text-[10px] leading-tight">
                    {rk.dominant_tradeoff}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Detailed Constraint Evaluation Matrix */}
      {constraintList.length > 0 && (
        <div className="bg-[#141619] border border-[#2b2d32] rounded-xl p-3 shadow-lg space-y-2.5 overflow-x-auto">
          <div className="flex items-center gap-2 pb-2 border-b border-[#2b2d32]">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-slate-100">
              USER MISSION CONSTRAINTS VERIFICATION MATRIX
            </span>
          </div>

          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-[#2b2d32] text-slate-400 text-[10px] uppercase">
                <th className="py-2 pr-3">Constraint Criterion</th>
                <th className="py-2 px-3">Required Target</th>
                {scenarios.map((scRes) => (
                  <th key={scRes.scenario.id} className="py-2 px-3 truncate max-w-[150px]">
                    {scRes.scenario.name.split('—')[1]?.trim() || scRes.scenario.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-[11px]">
              {constraintList.map((conTemplate, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2 pr-3 font-bold text-slate-300">
                    {conTemplate.constraint_name}
                  </td>
                  <td className="py-2 px-3 text-cyan-300 font-bold">
                    {conTemplate.required_criterion}
                  </td>
                  {scenarios.map((scRes) => {
                    const c = scRes.constraints.find(
                      (item) => item.constraint_id === conTemplate.constraint_id
                    );
                    if (!c) return <td key={scRes.scenario.id} className="py-2 px-3 text-slate-500">N/A</td>;

                    const isPass = c.status === 'PASSED';
                    const isFail = c.status === 'FAILED';

                    return (
                      <td key={scRes.scenario.id} className="py-2 px-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-bold">
                            {isPass ? (
                              <span className="flex items-center gap-1 text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>PASSED ({c.actual_value_str})</span>
                              </span>
                            ) : isFail ? (
                              <span className="flex items-center gap-1 text-rose-400">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>FAILED ({c.actual_value_str})</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-amber-400">
                                <HelpCircle className="w-3.5 h-3.5" />
                                <span>INDETERMINATE</span>
                              </span>
                            )}
                          </div>
                          <div className="text-[9px] text-slate-500 line-clamp-2" title={c.explanation}>
                            {c.explanation}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. Mandatory Scientific Caveats */}
      {caveats.length > 0 && (
        <div className="bg-[#141619] border border-[#2b2d32] rounded-xl p-3 shadow-lg space-y-1.5 text-[10px]">
          <div className="flex items-center gap-1.5 text-amber-400 font-bold uppercase">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>MANDATORY SCIENTIFIC CAVEATS & TRACEABILITY</span>
          </div>
          <div className="space-y-1 text-slate-400">
            {caveats.map((cav, idx) => (
              <div key={idx} className="flex items-start gap-1.5">
                <span className="text-amber-500/80">•</span>
                <span>{cav}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
