import React, { useState } from 'react';
import { CandidateScreeningSummary } from '../../types/screening';
import { PlainLanguageExplainer } from '../ui/PlainLanguageExplainer';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Mountain,
  Layers,
  MapPin,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Sun,
  Radio,
} from 'lucide-react';

interface CandidateSummaryCardProps {
  candidate: CandidateScreeningSummary;
  isSelected: boolean;
  onSelect: () => void;
}

const SITE_NAMES: Record<string, string> = {
  site01: 'Connecting Ridge',
  site04: 'Shackleton Rim',
  site11: 'de Gerlache Rim',
};

export const CandidateSummaryCard: React.FC<CandidateSummaryCardProps> = ({
  candidate,
  isSelected,
  onSelect,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const siteDisplayName =
    SITE_NAMES[candidate.site_id] || candidate.site_id?.toUpperCase() || 'Lunar Site';

  // Find the primary failure or indeterminate reason
  const failedRequirements = candidate.hard_constraint_results.filter((r) => r.verdict === 'FAIL');
  const indeterminateRequirements = candidate.hard_constraint_results.filter(
    (r) => r.verdict === 'INDETERMINATE'
  );

  const getStatusBadge = () => {
    switch (candidate.overall_status) {
      case 'COMPLIANT':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            PASSED
          </span>
        );
      case 'NON_COMPLIANT':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 text-xs font-mono font-bold">
            <XCircle className="w-3.5 h-3.5" />
            FAILED
          </span>
        );
      case 'INDETERMINATE':
      default:
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-mono font-bold">
            <HelpCircle className="w-3.5 h-3.5" />
            UNVERIFIED
          </span>
        );
    }
  };

  const getCoverageBadge = () => {
    switch (candidate.coverage_certainty) {
      case 'COMPLETE_DEM':
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            100% DEM coverage
          </span>
        );
      case 'PARTIAL_DEM':
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
            Partial DEM coverage
          </span>
        );
      case 'INDETERMINATE_PARTIAL_DEM':
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
            Incomplete data
          </span>
        );
      case 'OUT_OF_BOUNDS':
      default:
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            Outside DEM bounds
          </span>
        );
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`rounded-xl border transition-all p-4 cursor-pointer flex flex-col justify-between ${
        isSelected
          ? 'bg-[#101726] border-emerald-500 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30'
          : 'bg-[#0a0f1c] border-slate-800 hover:border-slate-700 hover:bg-[#0d1424]'
      }`}
    >
      <div>
        {/* Header: Location & Plain-Language Status */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="text-[11px] font-mono text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1 mb-0.5">
              <Layers className="w-3 h-3" />
              <span>{siteDisplayName}</span>
            </div>
            <h3 className="text-sm font-bold font-mono text-slate-100">
              {candidate.candidate_name}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                {candidate.latitude.toFixed(4)}°, {candidate.longitude.toFixed(4)}°
              </span>
            </div>
          </div>
          <div className="shrink-0">{getStatusBadge()}</div>
        </div>

        {/* Plain-Language Status Summary: "X passed, Y failed, Z unverified" */}
        <div className="bg-[#060911] border border-slate-800/80 rounded-lg p-2.5 my-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400 font-semibold">Evaluation:</span>
            <span className="font-bold">
              <span className="text-emerald-400">{candidate.hard_constraints_passed} passed</span>
              <span className="text-slate-500">, </span>
              <span className={candidate.hard_constraints_failed > 0 ? 'text-rose-400' : 'text-slate-400'}>
                {candidate.hard_constraints_failed} failed
              </span>
              <span className="text-slate-500">, </span>
              <span className={candidate.hard_constraints_indeterminate > 0 ? 'text-amber-400' : 'text-slate-400'}>
                {candidate.hard_constraints_indeterminate} unverified
              </span>
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
            <div
              style={{
                width: `${(candidate.hard_constraints_passed / Math.max(1, candidate.total_hard_constraints)) * 100}%`,
              }}
              className="bg-emerald-500 h-full"
            />
            <div
              style={{
                width: `${(candidate.hard_constraints_failed / Math.max(1, candidate.total_hard_constraints)) * 100}%`,
              }}
              className="bg-rose-500 h-full"
            />
            <div
              style={{
                width: `${(candidate.hard_constraints_indeterminate / Math.max(1, candidate.total_hard_constraints)) * 100}%`,
              }}
              className="bg-amber-500 h-full"
            />
          </div>

          {/* Exact Reason Highlight Box */}
          {failedRequirements.length > 0 ? (
            <div className="mt-2 text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded p-2 leading-relaxed flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <span className="font-bold font-mono">Reason for rejection: </span>
                <span>{failedRequirements[0].explanation}</span>
              </div>
            </div>
          ) : indeterminateRequirements.length > 0 ? (
            <div className="mt-2 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded p-2 leading-relaxed flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <span className="font-bold font-mono">Incomplete data: </span>
                <span>{indeterminateRequirements[0].explanation}</span>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded p-2 leading-relaxed flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400 mt-0.5" />
              <span>All mandatory mission requirements passed without restriction.</span>
            </div>
          )}
        </div>

        {/* Quick scientific measurements with PlainLanguageExplainer */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono py-1">
          <div className="flex items-center justify-between bg-slate-900/60 px-2 py-1.5 rounded border border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-1">
              <Mountain className="w-3 h-3 text-emerald-400" />
              <span>Elev:</span>
              <PlainLanguageExplainer topic="elevation" compact />
            </span>
            <span className="font-bold text-slate-200">
              {candidate.surface_elevation_m !== null && candidate.surface_elevation_m !== undefined
                ? `${candidate.surface_elevation_m.toFixed(0)} m`
                : 'N/A'}
            </span>
          </div>

          <div className="flex items-center justify-between bg-slate-900/60 px-2 py-1.5 rounded border border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-1">
              <span>Slope:</span>
              <PlainLanguageExplainer topic="slope" compact />
            </span>
            <span className="font-bold text-slate-200">
              {candidate.local_slope_deg !== null && candidate.local_slope_deg !== undefined
                ? `${candidate.local_slope_deg.toFixed(1)}°`
                : 'N/A'}
            </span>
          </div>
        </div>

        {/* Expandable Technical Evidence Section */}
        {showDetails && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="mt-3 pt-3 border-t border-slate-800 space-y-2 text-xs font-mono animate-in fade-in"
          >
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Technical Requirement Evidence
            </div>
            {candidate.hard_constraint_results.map((res) => (
              <div
                key={res.requirement_id}
                className="bg-[#05080e] p-2 rounded border border-slate-800 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold flex items-center gap-1">
                    {res.category === 'solar' ? (
                      <Sun className="w-3 h-3 text-amber-400" />
                    ) : res.category === 'earth' ? (
                      <Radio className="w-3 h-3 text-cyan-400" />
                    ) : (
                      <Mountain className="w-3 h-3 text-emerald-400" />
                    )}
                    {res.requirement_name}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      res.verdict === 'PASS'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : res.verdict === 'FAIL'
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {res.verdict}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex justify-between">
                  <span>Req: {res.threshold_str}</span>
                  <span className="text-slate-200 font-semibold">Actual: {res.actual_value_str}</span>
                </div>
                <div className="text-[10px] text-slate-500 leading-tight">
                  {res.explanation}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-800/80 text-[11px] font-mono">
        <div>{getCoverageBadge()}</div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowDetails(!showDetails);
          }}
          className="flex items-center gap-1 text-slate-400 hover:text-emerald-400 transition-colors"
        >
          <span>{showDetails ? 'Hide evidence' : 'Expand evidence'}</span>
          {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
