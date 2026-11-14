import React, { useState } from 'react';
import { useTradeOffStore } from '../../stores/tradeOffStore';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Award } from 'lucide-react';

export const ParetoAnalysisView: React.FC = () => {
  const activeStudy = useTradeOffStore((state) => state.activeStudy);
  const openDetailDrawer = useTradeOffStore((state) => state.openDetailDrawer);

  if (!activeStudy || activeStudy.alternatives.length === 0) return null;

  const { alternatives, scores, pareto_results, preference_model } = activeStudy;
  const enabledCriteria = preference_model.criteria.filter((c) => c.enabled);

  // Default axes for 2D trade-off
  const [xAxisKey, setXAxisKey] = useState<string>(
    enabledCriteria[0] ? enabledCriteria[0].id : 'pref-total-sunlight'
  );
  const [yAxisKey, setYAxisKey] = useState<string>(
    enabledCriteria[1] ? enabledCriteria[1].id : 'pref-local-slope'
  );

  const critX = enabledCriteria.find((c) => c.id === xAxisKey) || enabledCriteria[0];
  const critY = enabledCriteria.find((c) => c.id === yAxisKey) || enabledCriteria[1] || enabledCriteria[0];

  // Prepare scatter data
  const scatterData = alternatives.map((alt) => {
    const s = scores[alt.id];
    const p = pareto_results[alt.id];

    let normX = 0;
    let normY = 0;
    let rawX: number | null = null;
    let rawY: number | null = null;

    if (s) {
      const mx = s.normalized_metrics.find((m) => m.criterion_id === critX?.id);
      const my = s.normalized_metrics.find((m) => m.criterion_id === critY?.id);

      if (mx && typeof mx.normalized_value === 'number') {
        normX = Math.round(mx.normalized_value * 100);
        rawX = mx.raw_value ?? null;
      }
      if (my && typeof my.normalized_value === 'number') {
        normY = Math.round(my.normalized_value * 100);
        rawY = my.raw_value ?? null;
      }
    }

    return {
      id: alt.id,
      name: alt.name,
      x: normX,
      y: normY,
      rawX,
      rawY,
      status: p?.status || 'DOMINATED',
      score: s?.composite_score || 0,
      hardStatus: alt.hard_constraint_status,
      dominatedBy: p?.dominated_by || [],
    };
  });

  const frontierAlternatives = alternatives.filter(
    (a) => pareto_results[a.id]?.status === 'PARETO_OPTIMAL'
  );
  const dominatedAlternatives = alternatives.filter(
    (a) => pareto_results[a.id]?.status === 'DOMINATED'
  );

  return (
    <div className="bg-[#0b101c] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-400" />
            <span>PARETO DOMINANCE & FRONTIER ANALYSIS</span>
          </h3>
          <p className="text-[11px] font-mono text-slate-400 mt-0.5">
            Identifies non-dominated alternatives where improving one metric strictly requires compromising another.
          </p>
        </div>

        {/* 2D Axis Selectors */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">X-Axis:</span>
            <select
              value={xAxisKey}
              onChange={(e) => setXAxisKey(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:border-emerald-500"
            >
              {enabledCriteria.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Y-Axis:</span>
            <select
              value={yAxisKey}
              onChange={(e) => setYAxisKey(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:border-emerald-500"
            >
              {enabledCriteria.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2D Scatter Chart */}
      <div className="w-full h-[360px] bg-slate-950/40 rounded-xl p-4 border border-slate-800/60">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              type="number"
              dataKey="x"
              name={critX?.name}
              unit="%"
              domain={[0, 100]}
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
              label={{
                value: `${critX?.name} (Normalized Score %)`,
                position: 'insideBottom',
                offset: -10,
                fill: '#94a3b8',
                fontSize: 11,
                fontFamily: 'monospace',
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={critY?.name}
              unit="%"
              domain={[0, 100]}
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
              label={{
                value: `${critY?.name} (Normalized Score %)`,
                angle: -90,
                position: 'insideLeft',
                offset: 0,
                fill: '#94a3b8',
                fontSize: 11,
                fontFamily: 'monospace',
              }}
            />
            <ZAxis range={[100, 100]} />
            <Tooltip
              content={({ payload }) => {
                if (!payload || payload.length === 0) return null;
                const d = payload[0].payload;
                return (
                  <div className="p-3 bg-slate-950/95 border border-slate-700 rounded-xl shadow-2xl font-mono text-xs space-y-1 z-50">
                    <p className="font-bold text-white pb-1 border-b border-slate-800">{d.name}</p>
                    <div className="text-[11px] text-slate-300">
                      <span>Status: </span>
                      <strong className={d.status === 'PARETO_OPTIMAL' ? 'text-emerald-400' : 'text-slate-400'}>
                        {d.status}
                      </strong>
                    </div>
                    <div className="text-[11px] text-slate-300">
                      <span>Composite Score: </span>
                      <strong className="text-white">{d.score} / 100</strong>
                    </div>
                    <div className="text-[10px] text-slate-400 pt-1">
                      <div>{critX?.name}: {d.rawX !== null ? `${d.rawX} ${critX?.unit}` : 'N/A'} ({d.x}%)</div>
                      <div>{critY?.name}: {d.rawY !== null ? `${d.rawY} ${critY?.unit}` : 'N/A'} ({d.y}%)</div>
                    </div>
                    {d.dominatedBy.length > 0 && (
                      <p className="text-[10px] text-rose-400 pt-1">
                        Dominated by: {d.dominatedBy.join(', ')}
                      </p>
                    )}
                  </div>
                );
              }}
            />
            <Scatter data={scatterData} cursor="pointer" onClick={(entry: any) => openDetailDrawer(entry?.id || entry?.payload?.id)}>
              {scatterData.map((entry, index) => {
                const color =
                  entry.status === 'PARETO_OPTIMAL'
                    ? '#10b981' // emerald for optimal
                    : entry.status === 'INCOMPARABLE_INCOMPLETE'
                    ? '#f59e0b' // amber
                    : '#64748b'; // slate for dominated

                return <Cell key={`cell-${index}`} fill={color} stroke="#0f172a" strokeWidth={2} r={7} />;
              })}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Pareto Results Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Frontier Alternatives */}
        <div className="p-4 bg-slate-900/60 rounded-xl border border-emerald-500/30 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-emerald-400">
            <span className="flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              <span>PARETO FRONTIER ({frontierAlternatives.length})</span>
            </span>
            <span className="text-[10px] text-slate-400">Non-Dominated</span>
          </div>
          <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
            These alternatives represent optimal trade-offs. No other candidate is strictly superior across all enabled criteria.
          </p>
          <div className="space-y-1.5 pt-1">
            {frontierAlternatives.map((alt) => (
              <div
                key={alt.id}
                onClick={() => openDetailDrawer(alt.id)}
                className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between hover:border-emerald-500/50 cursor-pointer transition-all"
              >
                <div>
                  <span className="text-xs font-mono font-bold text-white">{alt.name}</span>
                  <span className="text-[10px] font-mono text-slate-500 block">
                    Score: {scores[alt.id]?.composite_score.toFixed(1)}/100 • Dominates {pareto_results[alt.id]?.dominates.length}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40">
                  OPTIMAL
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Dominated Alternatives */}
        <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-300">
            <span>DOMINATED ALTERNATIVES ({dominatedAlternatives.length})</span>
            <span className="text-[10px] text-slate-500">Sub-optimal</span>
          </div>
          <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
            These alternatives are strictly superseded by at least one other candidate across all evaluated preference dimensions.
          </p>
          <div className="space-y-1.5 pt-1">
            {dominatedAlternatives.map((alt) => {
              const domBy = pareto_results[alt.id]?.dominated_by || [];
              return (
                <div
                  key={alt.id}
                  onClick={() => openDetailDrawer(alt.id)}
                  className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between hover:border-slate-700 cursor-pointer transition-all"
                >
                  <div>
                    <span className="text-xs font-mono font-medium text-slate-300">{alt.name}</span>
                    <span className="text-[10px] font-mono text-slate-500 block">
                      Score: {scores[alt.id]?.composite_score.toFixed(1)}/100
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-rose-400 text-right">
                    Dominated by {domBy.join(', ')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
