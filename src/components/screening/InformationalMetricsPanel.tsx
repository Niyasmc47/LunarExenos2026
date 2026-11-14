import React from 'react';
import { InformationalMetricItem } from '../../types/screening';
import { BarChart3 } from 'lucide-react';

interface InformationalMetricsPanelProps {
  metrics: InformationalMetricItem[];
}

export const InformationalMetricsPanel: React.FC<InformationalMetricsPanelProps> = ({ metrics }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-bold text-slate-100 font-mono tracking-wider">
            INFORMATIONAL METRICS & TELEMETRY
          </h3>
        </div>
        <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
          Does not impact hard constraint pass/fail
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {metrics.map((m) => (
          <div
            key={m.id}
            className="p-3 rounded-lg bg-[#0b101c] border border-slate-800 flex flex-col justify-between"
          >
            <div>
              <span className="text-[10px] font-mono text-slate-400 block truncate">
                {m.name}
              </span>
              <span className="text-xs font-mono font-bold text-slate-200 mt-0.5 block truncate">
                {m.value_str}
              </span>
            </div>
            <span className="text-[9px] font-mono text-slate-400 block truncate mt-1.5 pt-1 border-t border-slate-800/60">
              {m.source}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
