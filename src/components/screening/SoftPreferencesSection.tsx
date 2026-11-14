import React from 'react';
import { SoftPreferenceItem } from '../../types/screening';
import { Sliders, Info, Check, AlertCircle } from 'lucide-react';

interface SoftPreferencesSectionProps {
  preferences: SoftPreferenceItem[];
}

export const SoftPreferencesSection: React.FC<SoftPreferencesSectionProps> = ({ preferences }) => {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-800 gap-1.5">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-bold text-slate-100 font-mono tracking-wider">
            SOFT PREFERENCES (TRADE-OFF METRICS)
          </h3>
        </div>
        <div className="text-[10px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
          No hidden weights • No arbitrary ranking scores
        </div>
      </div>

      <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-800/80 text-xs text-slate-400 font-sans leading-relaxed flex items-start gap-2">
        <Info className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
        <span>
          Soft preferences reflect desirable operational trade-offs. Measured values are presented transparently alongside configured thresholds. As established in the system architecture, multi-criteria ranking requires explicit user weighting in MVP 7.5.
        </span>
      </div>

      {preferences.length === 0 ? (
        <div className="p-4 bg-[#0b101c] border border-slate-800 rounded-xl text-center text-slate-400 font-mono text-xs">
          No soft preferences configured for this mission profile.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {preferences.map((pref) => (
            <div
              key={pref.requirement_id}
              className="bg-[#0b101c] border border-slate-800 p-3.5 rounded-xl space-y-2 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-slate-200">
                  {pref.requirement_name}
                </span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  Preference
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                <div>
                  <span className="text-slate-400 text-[10px] block">Threshold:</span>
                  <span className="font-semibold text-slate-300">{pref.threshold_str}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Observed:</span>
                  <span
                    className={`font-semibold ${
                      pref.is_available ? 'text-cyan-300' : 'text-slate-500'
                    }`}
                  >
                    {pref.actual_value_str}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 font-sans flex items-start gap-1.5">
                {pref.is_available ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                )}
                <span>{pref.notes}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
