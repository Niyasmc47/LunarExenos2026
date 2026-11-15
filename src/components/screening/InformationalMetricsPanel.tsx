import React from 'react';
import { InformationalMetricItem } from '../../types/screening';
import { BarChart3 } from 'lucide-react';

interface InformationalMetricsPanelProps {
  metrics: InformationalMetricItem[];
}

export const InformationalMetricsPanel: React.FC<InformationalMetricsPanelProps> = ({ metrics }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-[#202228]">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#7bd0ff]" />
          <h3 className="text-xs font-bold text-slate-100 font-mono tracking-wider">
            INFORMATIONAL METRICS &amp; TELEMETRY
          </h3>
        </div>
        <span className="text-[10px] font-mono text-[#7bd0ff] bg-[#7bd0ff]/10 border border-[#7bd0ff]/25 px-2 py-0.5 rounded">
          Does not impact hard constraint pass/fail
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {metrics.map((m) => (
          <div
            key={m.id}
            className="p-3 rounded-lg bg-[#141619] border border-[#2b2d32] flex flex-col justify-between hover:border-slate-600 transition-colors"
          >
            <div>
              <span className="text-[10px] font-mono text-slate-400 block truncate">
                {m.name}
              </span>
              <span className="text-xs font-mono font-bold text-slate-100 mt-0.5 block truncate">
                {m.value_str}
              </span>
            </div>
            <span className="text-[9px] font-mono text-slate-500 block truncate mt-1.5 pt-1 border-t border-[#202228]">
              {m.source}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
