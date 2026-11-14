import React from 'react';
import { CandidateScreeningSummary } from '../../types/screening';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Mountain,
  Layers,
  MapPin,
  ChevronRight,
} from 'lucide-react';

interface CandidateSummaryCardProps {
  candidate: CandidateScreeningSummary;
  isSelected: boolean;
  onSelect: () => void;
}

export const CandidateSummaryCard: React.FC<CandidateSummaryCardProps> = ({
  candidate,
  isSelected,
  onSelect,
}) => {
  const getStatusBadge = () => {
    switch (candidate.overall_status) {
      case 'COMPLIANT':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            COMPLIANT
          </span>
        );
      case 'NON_COMPLIANT':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 text-xs font-mono font-bold">
            <XCircle className="w-3.5 h-3.5" />
            NON-COMPLIANT
          </span>
        );
      case 'INDETERMINATE':
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-mono font-bold">
            <HelpCircle className="w-3.5 h-3.5" />
            INDETERMINATE
          </span>
        );
    }
  };

  const getCoverageBadge = () => {
    switch (candidate.coverage_certainty) {
      case 'COMPLETE_DEM':
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            Complete DEM
          </span>
        );
      case 'PARTIAL_DEM':
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
            Partial DEM
          </span>
        );
      case 'INDETERMINATE_PARTIAL_DEM':
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
            Partial DEM (Indeterminate)
          </span>
        );
      case 'OUT_OF_BOUNDS':
      default:
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            Out of Bounds
          </span>
        );
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-xl border cursor-pointer transition-all ${
        isSelected
          ? 'bg-[#121a2d] border-emerald-500 shadow-md shadow-emerald-500/10'
          : 'bg-[#0b101c] border-slate-800 hover:border-slate-700 hover:bg-[#0e1526]'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-bold font-mono text-slate-100 flex items-center gap-1.5">
            <span>{candidate.candidate_name}</span>
          </h3>
          <div className="flex items-center gap-2 mt-1 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400" />
              {candidate.latitude.toFixed(4)}°, {candidate.longitude.toFixed(4)}°
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3 text-slate-400" />
              {candidate.site_id}
            </span>
          </div>
        </div>
        {getStatusBadge()}
      </div>

      {/* Constraints Tally Bar */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-slate-400">Hard Constraints:</span>
          <span className="font-semibold text-slate-200">
            <span className="text-emerald-400">{candidate.hard_constraints_passed} Pass</span>
            {' • '}
            <span className="text-rose-400">{candidate.hard_constraints_failed} Fail</span>
            {' • '}
            <span className="text-amber-400">{candidate.hard_constraints_indeterminate} Indet</span>
          </span>
        </div>

        {/* Progress Bar */}
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
      </div>

      {/* Quick stats footer */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] font-mono">
        <div className="flex items-center gap-3 text-slate-400">
          <span className="flex items-center gap-1">
            <Mountain className="w-3 h-3 text-slate-400" />
            {candidate.surface_elevation_m !== null && candidate.surface_elevation_m !== undefined
              ? `${candidate.surface_elevation_m.toFixed(0)} m`
              : 'N/A'}
          </span>
          <span>
            Slope:{' '}
            {candidate.local_slope_deg !== null && candidate.local_slope_deg !== undefined
              ? `${candidate.local_slope_deg.toFixed(1)}°`
              : 'N/A'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {getCoverageBadge()}
          <ChevronRight
            className={`w-4 h-4 transition-transform ${
              isSelected ? 'text-emerald-400 translate-x-0.5' : 'text-slate-600'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
