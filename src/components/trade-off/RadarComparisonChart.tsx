import React, { useState } from 'react';
import { useTradeOffStore } from '../../stores/tradeOffStore';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import { Compass, HelpCircle } from 'lucide-react';

const COLORS = [
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#ec4899', // pink
  '#3b82f6', // blue
  '#14b8a6', // teal
  '#f97316', // orange
];

export const RadarComparisonChart: React.FC = () => {
  const activeStudy = useTradeOffStore((state) => state.activeStudy);
  const [selectedAltIds, setSelectedAltIds] = useState<string[]>([]);

  if (!activeStudy || activeStudy.alternatives.length === 0) return null;

  const { alternatives, scores, preference_model } = activeStudy;
  const enabledCriteria = preference_model.criteria.filter((c) => c.enabled);

  // Default to selecting all alternatives (up to 5 for clarity)
  const activeAltIds =
    selectedAltIds.length > 0
      ? selectedAltIds
      : alternatives.slice(0, 5).map((a) => a.id);

  // Transform data for Recharts Radar
  // Each row in data: { subject: CriterionName, [alt_id]: normalized_value * 100 }
  const radarData = enabledCriteria.map((c) => {
    const row: Record<string, any> = {
      subject: c.name,
      criterion_id: c.id,
      unit: c.unit,
    };

    alternatives.forEach((alt) => {
      const altScore = scores[alt.id];
      if (altScore) {
        const metric = altScore.normalized_metrics.find((m) => m.criterion_id === c.id);
        if (metric && typeof metric.normalized_value === 'number') {
          row[alt.id] = Math.round(metric.normalized_value * 100);
        } else {
          row[alt.id] = 0; // fallback for radar rendering
        }
      }
    });

    return row;
  });

  const toggleAlternative = (id: string) => {
    if (activeAltIds.includes(id)) {
      if (activeAltIds.length > 1) {
        setSelectedAltIds(activeAltIds.filter((x) => x !== id));
      }
    } else {
      setSelectedAltIds([...activeAltIds, id]);
    }
  };

  return (
    <div className="bg-[#141619] border border-[#2b2d32] rounded-2xl p-6 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#2b2d32]">
        <div>
          <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
            <Compass className="w-4 h-4 text-cyan-400" />
            <span>NORMALIZED PERFORMANCE RADAR PROFILE</span>
          </h3>
          <p className="text-[11px] font-mono text-slate-400 mt-0.5">
            Compares alternatives across normalized scales (0–100%). Physical units are not mixed. Higher points represent greater preference fulfillment.
          </p>
        </div>

        {/* Alternative Selectors */}
        <div className="flex flex-wrap items-center gap-1.5">
          {alternatives.map((alt, idx) => {
            const isChecked = activeAltIds.includes(alt.id);
            const color = COLORS[idx % COLORS.length];

            return (
              <button
                key={alt.id}
                onClick={() => toggleAlternative(alt.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition-all flex items-center gap-1.5 ${
                  isChecked
                    ? 'bg-slate-900 border-[#303238] text-white shadow'
                    : 'bg-[#08090b] border-[#2b2d32] text-slate-500 opacity-60 hover:opacity-100'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span>{alt.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Radar Chart */}
      <div className="w-full h-[420px] flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
            <PolarGrid stroke="#1e293b" />
            <PolarAngleAxis
              dataKey="subject"
              stroke="#94a3b8"
              tick={{ fill: '#cbd5e1', fontSize: 11, fontFamily: 'monospace' }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              stroke="#475569"
              tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }}
            />

            {alternatives
              .filter((alt) => activeAltIds.includes(alt.id))
              .map((alt, idx) => {
                const color = COLORS[idx % COLORS.length];
                return (
                  <Radar
                    key={alt.id}
                    name={alt.name}
                    dataKey={alt.id}
                    stroke={color}
                    fill={color}
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                );
              })}

            <Tooltip
              content={({ payload, label }) => {
                if (!payload || payload.length === 0) return null;
                return (
                  <div className="p-3 bg-[#08090b]/95 border border-[#2b2d32] rounded-xl shadow-2xl font-mono text-xs space-y-1 z-50">
                    <p className="font-bold text-white pb-1 border-b border-[#2b2d32]">{label}</p>
                    {payload.map((entry: any, i: number) => (
                      <div key={i} className="flex items-center justify-between gap-4 text-[11px]">
                        <span style={{ color: entry.stroke }}>{entry.name}:</span>
                        <span className="text-white font-bold">{entry.value} / 100</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontFamily: 'monospace', fontSize: '11px', paddingTop: '10px' }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="p-3 bg-[#08090b] rounded-xl border border-[#202228] text-[10px] font-mono text-slate-400 flex items-start gap-2">
        <HelpCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <span>
          <strong>Interpretation:</strong> A larger enclosed polygon area indicates superior all-around performance across active preference metrics. Notice that cost criteria (slope, continuous darkness, blackout) have inverted directions so that 100% represents the best performance (lowest cost).
        </span>
      </div>
    </div>
  );
};
