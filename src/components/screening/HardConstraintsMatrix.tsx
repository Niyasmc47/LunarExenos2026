import React from 'react';
import { RequirementEvaluationResult, ScreeningVerdict } from '../../types/screening';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sun,
  Radio,
  Mountain,
  ShieldAlert,
} from 'lucide-react';

interface HardConstraintsMatrixProps {
  results: RequirementEvaluationResult[];
}

export const HardConstraintsMatrix: React.FC<HardConstraintsMatrixProps> = ({ results }) => {
  const getVerdictBadge = (verdict: ScreeningVerdict) => {
    switch (verdict) {
      case 'PASS':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            PASS
          </span>
        );
      case 'FAIL':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/15 text-rose-400 border border-rose-500/30 text-xs font-mono font-bold">
            <XCircle className="w-3.5 h-3.5" />
            FAIL
          </span>
        );
      case 'INDETERMINATE':
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-mono font-bold">
            <HelpCircle className="w-3.5 h-3.5" />
            INDETERMINATE
          </span>
        );
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'solar':
        return <Sun className="w-4 h-4 text-amber-400" />;
      case 'earth':
        return <Radio className="w-4 h-4 text-cyan-400" />;
      case 'terrain':
      default:
        return <Mountain className="w-4 h-4 text-emerald-400" />;
    }
  };

  if (results.length === 0) {
    return (
      <div className="p-6 bg-[#141619] border border-[#2b2d32] rounded-xl text-center text-slate-400 font-mono text-xs">
        No active hard constraints configured for this mission profile.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-[#202228]">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#ffe3b0]" />
          <h3 className="text-xs font-bold text-slate-100 font-mono tracking-wider">
            HARD CONSTRAINT EVALUATION MATRIX
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          Mandatory Criteria ({results.length})
        </span>
      </div>

      <div className="space-y-2.5">
        {results.map((res) => (
          <div
            key={res.requirement_id}
            className={`p-3.5 rounded-xl border transition-all ${
              res.verdict === 'PASS'
                ? 'bg-[#141619] border-[#2b2d32] hover:border-emerald-500/40'
                : res.verdict === 'FAIL'
                ? 'bg-[#141619] border-rose-900/40 hover:border-rose-500/40'
                : 'bg-[#141619] border-amber-900/40 hover:border-amber-500/40'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                {getCategoryIcon(res.category)}
                <span className="font-mono text-xs font-bold text-slate-100">
                  {res.requirement_name}
                </span>
                <span
                  className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded font-semibold border"
                  style={{
                    backgroundColor:
                      res.category === 'solar'
                        ? 'rgba(255, 227, 176, 0.1)'
                        : res.category === 'earth'
                        ? 'rgba(123, 208, 255, 0.1)'
                        : 'rgba(16, 185, 129, 0.1)',
                    color:
                      res.category === 'solar'
                        ? '#ffe3b0'
                        : res.category === 'earth'
                        ? '#7bd0ff'
                        : '#34d399',
                    borderColor:
                      res.category === 'solar'
                        ? 'rgba(255, 227, 176, 0.25)'
                        : res.category === 'earth'
                        ? 'rgba(123, 208, 255, 0.25)'
                        : 'rgba(16, 185, 129, 0.25)',
                  }}
                >
                  {res.category}
                </span>
              </div>
              <div>{getVerdictBadge(res.verdict)}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono bg-[#08090b] p-2.5 rounded-lg border border-[#202228] mb-2">
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">Required Criterion:</span>
                <span className="font-semibold text-slate-200">{res.threshold_str}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">Actual Measured:</span>
                <span
                  className={`font-semibold ${
                    res.verdict === 'PASS'
                      ? 'text-emerald-400'
                      : res.verdict === 'FAIL'
                      ? 'text-rose-400'
                      : 'text-amber-400'
                  }`}
                >
                  {res.actual_value_str}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 font-sans leading-relaxed mb-2">
              {res.explanation}
            </p>

            <div className="flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-400 pt-1.5 border-t border-[#202228] gap-1">
              <span>Source: {res.supporting_data_source}</span>
              <span>Horizon: {res.analysis_period}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
