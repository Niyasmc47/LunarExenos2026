import React from 'react';
import { SingleRequirement, RequirementClassification } from '../../types/missionProfile';
import { AlertCircle, ShieldAlert, Sparkles, Info } from 'lucide-react';

interface RequirementCardProps {
  category: 'solar' | 'earth' | 'terrain';
  requirement: SingleRequirement;
  isEditing: boolean;
  onUpdate: (updates: Partial<SingleRequirement>) => void;
  fieldError?: string;
}

export const RequirementCard: React.FC<RequirementCardProps> = ({
  category: _category,
  requirement,
  isEditing,
  onUpdate,
  fieldError,
}) => {
  const getClassificationBadge = (cls: RequirementClassification) => {
    switch (cls) {
      case 'HARD_CONSTRAINT':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <ShieldAlert className="w-3 h-3 text-rose-400" />
            HARD CONSTRAINT
          </span>
        );
      case 'SOFT_PREFERENCE':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Sparkles className="w-3 h-3 text-amber-400" />
            SOFT PREFERENCE
          </span>
        );
      case 'INFORMATIONAL_METRIC':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">
            <Info className="w-3 h-3 text-sky-400" />
            INFORMATIONAL
          </span>
        );
    }
  };

  const operatorSymbol = requirement.operator === 'ge' ? '≥' : requirement.operator === 'le' ? '≤' : '=';

  return (
    <div
      className={`p-3.5 rounded-xl border transition-all ${
        !requirement.enabled
          ? 'bg-slate-900/30 border-slate-800/50 opacity-60'
          : fieldError
          ? 'bg-rose-950/20 border-rose-500/50 shadow-md shadow-rose-950/20'
          : 'bg-[#0d1424] border-slate-800 hover:border-slate-700 shadow-sm'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
        {/* Toggle & Name */}
        <div className="flex items-center gap-2.5">
          {isEditing && (
            <input
              type="checkbox"
              checked={requirement.enabled}
              onChange={(e) => onUpdate({ enabled: e.target.checked })}
              className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
            />
          )}
          <span
            className={`text-xs font-semibold tracking-wide ${
              requirement.enabled ? 'text-slate-100' : 'text-slate-400 line-through'
            }`}
          >
            {requirement.name}
          </span>
        </div>

        {/* Classification Selector / Badge */}
        <div className="flex items-center gap-2">
          {isEditing && requirement.enabled ? (
            <select
              value={requirement.classification}
              onChange={(e) =>
                onUpdate({
                  classification: e.target.value as RequirementClassification,
                })
              }
              className="text-[10px] font-mono bg-slate-950 border border-slate-700 text-slate-200 px-2 py-1 rounded focus:outline-none focus:border-emerald-500"
            >
              <option value="HARD_CONSTRAINT">HARD CONSTRAINT (Mandatory)</option>
              <option value="SOFT_PREFERENCE">SOFT PREFERENCE (Trade-off)</option>
              <option value="INFORMATIONAL_METRIC">INFORMATIONAL (Metrics)</option>
            </select>
          ) : (
            getClassificationBadge(requirement.classification)
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
        {requirement.description}
      </p>

      {/* Threshold Value Row */}
      <div className="flex items-center justify-between bg-slate-950/60 border border-slate-800/80 px-3 py-2 rounded-lg">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
          <span className="text-slate-400 font-semibold">{operatorSymbol}</span>
          {isEditing && requirement.enabled ? (
            <input
              type="number"
              step="any"
              value={requirement.value ?? ''}
              onChange={(e) => {
                const val = e.target.value === '' ? null : parseFloat(e.target.value);
                onUpdate({ value: val });
              }}
              className="w-24 bg-slate-900 border border-slate-700 text-emerald-400 px-2 py-0.5 rounded text-xs font-mono focus:outline-none focus:border-emerald-500"
            />
          ) : (
            <span className="text-emerald-400 font-semibold text-sm">
              {requirement.value !== null ? requirement.value : 'N/A'}
            </span>
          )}
          <span className="text-slate-400 font-mono text-xs">
            {requirement.unit}
          </span>
        </div>

        {/* Status indicator */}
        <span className="text-[10px] font-mono uppercase text-slate-400">
          {requirement.enabled ? 'Active Threshold' : 'Inactive'}
        </span>
      </div>

      {/* Field Error Message */}
      {fieldError && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{fieldError}</span>
        </div>
      )}

      {/* Scientific Disclaimer */}
      {requirement.scientific_disclaimer && (
        <div className="mt-2 text-[10px] text-slate-400 font-sans italic bg-slate-900/40 p-2 rounded border border-slate-800/50">
          <span className="font-semibold text-slate-300">Scientific Note: </span>
          {requirement.scientific_disclaimer}
        </div>
      )}
    </div>
  );
};
