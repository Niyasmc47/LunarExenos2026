import React, { useState } from 'react';
import { useTradeOffStore } from '../../stores/tradeOffStore';
import { PreferenceModelConfig } from '../../types/tradeOff';
import { SlidersHorizontal, RotateCcw, Check, TrendingUp, TrendingDown, Target } from 'lucide-react';

export const PreferenceConfigPanel: React.FC = () => {
  const activeStudy = useTradeOffStore((state) => state.activeStudy);
  const updatePreferences = useTradeOffStore((state) => state.updatePreferences);
  const isLoading = useTradeOffStore((state) => state.isLoading);

  if (!activeStudy) return null;

  const [localModel, setLocalModel] = useState<PreferenceModelConfig>(
    JSON.parse(JSON.stringify(activeStudy.preference_model))
  );
  const [hasChanges, setHasChanges] = useState(false);

  const handleWeightChange = (id: string, weight: number) => {
    const updated = localModel.criteria.map((c) =>
      c.id === id ? { ...c, weight: Math.max(0, weight) } : c
    );
    setLocalModel({ ...localModel, criteria: updated });
    setHasChanges(true);
  };

  const handleToggle = (id: string) => {
    const updated = localModel.criteria.map((c) =>
      c.id === id ? { ...c, enabled: !c.enabled } : c
    );
    setLocalModel({ ...localModel, criteria: updated });
    setHasChanges(true);
  };

  const handleRangeChange = (id: string, field: 'reference_min' | 'reference_max', val: number) => {
    const updated = localModel.criteria.map((c) =>
      c.id === id ? { ...c, [field]: val } : c
    );
    setLocalModel({ ...localModel, criteria: updated });
    setHasChanges(true);
  };

  const handleApply = async () => {
    await updatePreferences(localModel);
    setHasChanges(false);
  };

  const handleRestoreDefaults = () => {
    const durationHours = activeStudy.nominal_duration_days * 24.0;
    // Default weights
    const defaults: Record<string, { weight: number; enabled: boolean; min: number; max: number }> = {
      'pref-total-sunlight': { weight: 1.0, enabled: true, min: 0.0, max: durationHours },
      'pref-full-sunlight': { weight: 0.8, enabled: true, min: 0.0, max: durationHours },
      'pref-longest-darkness': { weight: 1.0, enabled: true, min: 0.0, max: durationHours },
      'pref-earth-visibility': { weight: 0.8, enabled: true, min: 0.0, max: durationHours },
      'pref-longest-earth-blackout': { weight: 0.6, enabled: true, min: 0.0, max: durationHours },
      'pref-local-slope': { weight: 1.0, enabled: true, min: 0.0, max: 25.0 },
      'pref-surface-elevation': { weight: 0.4, enabled: false, min: -4000.0, max: -1500.0 },
    };

    const resetCriteria = localModel.criteria.map((c) => {
      const def = defaults[c.id];
      if (def) {
        return {
          ...c,
          weight: def.weight,
          enabled: def.enabled,
          reference_min: def.min,
          reference_max: def.max,
        };
      }
      return c;
    });

    setLocalModel({ ...localModel, criteria: resetCriteria });
    setHasChanges(true);
  };

  // Calculate current normalized weights
  const enabledCriteria = localModel.criteria.filter((c) => c.enabled);
  const totalRawWeight = enabledCriteria.reduce((sum, c) => sum + c.weight, 0);

  return (
    <div className="bg-[#141619] border border-[#2b2d32] rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#2b2d32]">
        <div>
          <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
            <span>PREFERENCE MODEL & WEIGHT NORMALIZATION</span>
          </h3>
          <p className="text-[11px] font-mono text-slate-400 mt-0.5">
            Configure multi-criteria relative weights and normalization reference bounds. Weights are automatically normalized to sum to 1.0.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRestoreDefaults}
            className="px-3 py-1.5 rounded-lg border border-[#303238] hover:border-slate-600 bg-slate-900 text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Restore Defaults</span>
          </button>

          <button
            onClick={handleApply}
            disabled={!hasChanges || isLoading || totalRawWeight <= 0}
            className={`px-4 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
              hasChanges && totalRawWeight > 0
                ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isLoading ? 'Applying...' : 'Apply & Re-Score'}</span>
          </button>
        </div>
      </div>

      {/* Normalized Weight Distribution Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>Relative Weight Distribution (Sum: 100%)</span>
          <span>{enabledCriteria.length} criteria active</span>
        </div>
        <div className="w-full bg-[#08090b] h-3 rounded-full overflow-hidden flex border border-[#2b2d32]">
          {enabledCriteria.map((c, idx) => {
            const pct = totalRawWeight > 0 ? (c.weight / totalRawWeight) * 100 : 0;
            const colors = [
              'bg-emerald-500',
              'bg-teal-400',
              'bg-sky-400',
              'bg-indigo-400',
              'bg-purple-400',
              'bg-amber-400',
              'bg-rose-400',
            ];
            const color = colors[idx % colors.length];

            return (
              <div
                key={c.id}
                className={`${color} h-full transition-all`}
                style={{ width: `${pct}%` }}
                title={`${c.name}: ${pct.toFixed(1)}%`}
              />
            );
          })}
        </div>
      </div>

      {/* Criteria Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {localModel.criteria.map((c) => {
          const normWeight = totalRawWeight > 0 && c.enabled ? (c.weight / totalRawWeight) * 100 : 0;

          return (
            <div
              key={c.id}
              className={`p-4 rounded-xl border transition-all ${
                c.enabled
                  ? 'bg-slate-900/60 border-[#303238]/80 shadow-md'
                  : 'bg-[#08090b] border-[#202228] opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={c.enabled}
                    onChange={() => handleToggle(c.id)}
                    className="w-4 h-4 rounded border-[#303238] text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900 bg-slate-800"
                  />
                  <div>
                    <h4 className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                      <span>{c.name}</span>
                      <span className="text-[10px] text-slate-500 font-normal">({c.unit})</span>
                    </h4>
                    <span className="text-[10px] font-mono text-slate-500 block">
                      Category: {c.category.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {c.direction === 'HIGHER_IS_BETTER' && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 text-emerald-300 text-[9px] font-mono flex items-center gap-1">
                      <TrendingUp className="w-2.5 h-2.5" />
                      <span>Benefit (Higher)</span>
                    </span>
                  )}
                  {c.direction === 'LOWER_IS_BETTER' && (
                    <span className="px-1.5 py-0.5 rounded bg-sky-950/60 border border-sky-800/40 text-sky-300 text-[9px] font-mono flex items-center gap-1">
                      <TrendingDown className="w-2.5 h-2.5" />
                      <span>Cost (Lower)</span>
                    </span>
                  )}
                  {c.direction === 'TARGET_RANGE' && (
                    <span className="px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-800/40 text-purple-300 text-[9px] font-mono flex items-center gap-1">
                      <Target className="w-2.5 h-2.5" />
                      <span>Target Range</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Slider & Normalized Weight */}
              {c.enabled && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Weight: <strong>{c.weight.toFixed(1)}</strong></span>
                    <span className="text-emerald-400 font-bold">
                      Normalized: {normWeight.toFixed(1)}%
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0.1"
                    max="3.0"
                    step="0.1"
                    value={c.weight}
                    onChange={(e) => handleWeightChange(c.id, parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />

                  {/* Reference Bounds Editor */}
                  <div className="pt-2 grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div>
                      <span className="text-slate-500 block uppercase">Reference Min ({c.unit})</span>
                      <input
                        type="number"
                        value={c.reference_min ?? 0}
                        onChange={(e) => handleRangeChange(c.id, 'reference_min', parseFloat(e.target.value))}
                        className="w-full mt-0.5 px-2 py-1 rounded bg-[#08090b] border border-[#2b2d32] text-slate-200 text-xs font-mono focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <span className="text-slate-500 block uppercase">Reference Max ({c.unit})</span>
                      <input
                        type="number"
                        value={c.reference_max ?? 100}
                        onChange={(e) => handleRangeChange(c.id, 'reference_max', parseFloat(e.target.value))}
                        className="w-full mt-0.5 px-2 py-1 rounded bg-[#08090b] border border-[#2b2d32] text-slate-200 text-xs font-mono focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <p className="text-[10px] font-mono text-slate-500 pt-1 leading-relaxed">
                    {c.description}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
