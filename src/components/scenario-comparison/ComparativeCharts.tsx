import React, { useState } from 'react';
import { BarChart3, Clock } from 'lucide-react';
import { useScenarioStore } from '../../stores/scenarioStore';
import { ScenarioComparisonResult } from '../../types/scenario';

export const ComparativeCharts: React.FC = () => {
  const comparisonResult = useScenarioStore((state) => state.comparisonResult);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const setActiveScenarioId = useScenarioStore((state) => state.setActiveScenarioId);

  const [hoveredEpochIndex, setHoveredEpochIndex] = useState<number | null>(null);

  const scenarios = comparisonResult?.scenarios ?? [];

  if (scenarios.length === 0) return null;

  // Find max duration for bar normalization
  const totalDuration = scenarios[0]?.combined.total_interval_hours || 72.0;

  return (
    <div className="space-y-3 font-mono text-xs">
      {/* Chart 1: Grouped Opportunity Bars */}
      <div className="bg-[#141619] border border-[#2b2d32] rounded-xl p-3 shadow-lg space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#2b2d32]">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-slate-200">
              MISSION DURATION OPPORTUNITY BREAKDOWN
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
              Total Window: {totalDuration.toFixed(1)} h
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block"></span>
              <span>Sunlight</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400 inline-block"></span>
              <span>Earth Line-of-Sight</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block"></span>
              <span>Both Visible</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block"></span>
              <span>Darkness</span>
            </span>
          </div>
        </div>

        <div className="space-y-2.5">
          {scenarios.map((scRes: ScenarioComparisonResult) => {
            const sc = scRes.scenario;
            const s = scRes.solar;
            const e = scRes.earth;
            const c = scRes.combined;
            const isActive = activeScenarioId === sc.id;

            const sunPct = (s.total_sun_visible_hours / totalDuration) * 100;
            const earthPct = (e.total_earth_visible_hours / totalDuration) * 100;
            const bothPct = (c.both_visible_hours / totalDuration) * 100;
            const darkPct = (s.total_darkness_hours / totalDuration) * 100;

            return (
              <div
                key={sc.id}
                onClick={() => setActiveScenarioId(sc.id)}
                className={`p-2 rounded-lg border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0e1013] border-cyan-500/80 shadow-md'
                    : 'bg-[#0e1013]/50 border-[#2b2d32] hover:border-[#303238]'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className={`font-bold ${isActive ? 'text-cyan-300' : 'text-slate-200'}`}>
                    {sc.name}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Sun: <b className="text-amber-400">{s.total_sun_visible_hours.toFixed(1)}h</b> | Earth: <b className="text-cyan-400">{e.total_earth_visible_hours.toFixed(1)}h</b> | Both: <b className="text-emerald-400">{c.both_visible_hours.toFixed(1)}h</b>
                  </span>
                </div>

                {/* Progress multi-bars */}
                <div className="space-y-1">
                  {/* Sun Bar */}
                  <div className="flex items-center gap-2">
                    <span className="w-14 text-[9px] text-amber-400">Sunlight</span>
                    <div className="flex-1 h-3 rounded bg-slate-900 overflow-hidden flex border border-[#2b2d32]">
                      <div
                        style={{ width: `${sunPct}%` }}
                        className="bg-amber-400 h-full transition-all duration-500"
                        title={`Sunlight: ${s.total_sun_visible_hours.toFixed(1)}h (${sunPct.toFixed(1)}%)`}
                      />
                      <div
                        style={{ width: `${darkPct}%` }}
                        className="bg-rose-950/80 h-full transition-all duration-500"
                        title={`Darkness: ${s.total_darkness_hours.toFixed(1)}h (${darkPct.toFixed(1)}%)`}
                      />
                    </div>
                    <span className="w-12 text-right text-[10px] text-slate-300 font-bold">{sunPct.toFixed(0)}%</span>
                  </div>

                  {/* Earth Bar */}
                  <div className="flex items-center gap-2">
                    <span className="w-14 text-[9px] text-cyan-400">Earth LOS</span>
                    <div className="flex-1 h-3 rounded bg-slate-900 overflow-hidden flex border border-[#2b2d32]">
                      <div
                        style={{ width: `${earthPct}%` }}
                        className="bg-cyan-400 h-full transition-all duration-500"
                        title={`Earth Line-of-Sight: ${e.total_earth_visible_hours.toFixed(1)}h (${earthPct.toFixed(1)}%)`}
                      />
                    </div>
                    <span className="w-12 text-right text-[10px] text-slate-300 font-bold">{earthPct.toFixed(0)}%</span>
                  </div>

                  {/* Both Bar */}
                  <div className="flex items-center gap-2">
                    <span className="w-14 text-[9px] text-emerald-400">Dual Visible</span>
                    <div className="flex-1 h-3 rounded bg-slate-900 overflow-hidden flex border border-[#2b2d32]">
                      <div
                        style={{ width: `${bothPct}%` }}
                        className="bg-emerald-400 h-full transition-all duration-500"
                        title={`Simultaneous Sun & Earth: ${c.both_visible_hours.toFixed(1)}h (${bothPct.toFixed(1)}%)`}
                      />
                    </div>
                    <span className="w-12 text-right text-[10px] text-slate-300 font-bold">{bothPct.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart 2: Synchronized Comparative Illumination Timelines */}
      <div className="bg-[#141619] border border-[#2b2d32] rounded-xl p-3 shadow-lg space-y-2.5">
        <div className="flex items-center justify-between pb-2 border-b border-[#2b2d32]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-slate-200">
              SYNCHRONIZED ILLUMINATION TIMELINES (SIDE-BY-SIDE SHADOW DYNAMICS)
            </span>
          </div>
          <div className="text-[10px] text-slate-400">
            Hover over any epoch to compare simultaneous visibility across all candidate sites
          </div>
        </div>

        <div className="space-y-3">
          {scenarios.map((scRes: ScenarioComparisonResult) => {
            const sc = scRes.scenario;
            const timeline = scRes.timeline;

            return (
              <div key={sc.id} className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-slate-300">{sc.name}</span>
                  <span className="text-slate-400">
                    Sunlight: {(scRes.solar.illumination_fraction * 100).toFixed(0)}%
                  </span>
                </div>

                <div className="h-5 w-full flex rounded overflow-hidden border border-[#2b2d32] bg-[#0e1013]">
                  {timeline.map((pt, idx) => {
                    const isHovered = hoveredEpochIndex === idx;
                    let bg = '#090d16'; // Obstructed
                    if (pt.sun_visibility_state === 'FULLY_VISIBLE') bg = '#fbbf24';
                    else if (pt.sun_visibility_state === 'PARTIALLY_VISIBLE') bg = '#f59e0b';

                    return (
                      <div
                        key={idx}
                        onMouseEnter={() => setHoveredEpochIndex(idx)}
                        onMouseLeave={() => setHoveredEpochIndex(null)}
                        style={{
                          flex: 1,
                          backgroundColor: bg,
                          opacity: pt.sun_visibility_state === 'FULLY_OBSTRUCTED' ? 0.3 : 1,
                        }}
                        className={`transition-all ${isHovered ? 'brightness-150 ring-1 ring-white' : ''}`}
                        title={`${pt.timestamp_iso}\n${sc.name}\nSun: ${pt.sun_visibility_state} (${(pt.sun_visible_fraction * 100).toFixed(0)}%)\nEarth: ${pt.earth_visibility_state}`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Time boundaries */}
          <div className="flex justify-between text-[9px] text-slate-500 pt-1">
            <span>START: {scenarios[0]?.timeline[0]?.timestamp_iso.replace('T', ' ').slice(0, 16)}</span>
            <span>END: {scenarios[0]?.timeline[scenarios[0].timeline.length - 1]?.timestamp_iso.replace('T', ' ').slice(0, 16)}</span>
          </div>

          {/* Hovered Epoch Telemetry Across All Scenarios */}
          {hoveredEpochIndex !== null && scenarios[0]?.timeline[hoveredEpochIndex] && (
            <div className="bg-[#0e1013] p-2 rounded-lg border border-[#2b2d32] text-[10px] space-y-1">
              <div className="text-cyan-400 font-bold">
                SIMULTANEOUS EPOCH: {scenarios[0].timeline[hoveredEpochIndex].timestamp_iso}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-slate-300">
                {scenarios.map((scRes) => {
                  const pt = scRes.timeline[hoveredEpochIndex];
                  if (!pt) return null;
                  return (
                    <div key={scRes.scenario.id} className="border-l border-[#2b2d32] pl-2">
                      <div className="font-bold text-slate-400 truncate">{scRes.scenario.name.split('—')[1]?.trim()}</div>
                      <div className={pt.sun_visibility_state === 'FULLY_VISIBLE' ? 'text-amber-400' : 'text-slate-500'}>
                        Sun: {(pt.sun_visible_fraction * 100).toFixed(0)}%
                      </div>
                      <div className={pt.earth_visibility_state === 'FULLY_VISIBLE' ? 'text-cyan-400' : 'text-slate-500'}>
                        Earth: {(pt.earth_visible_fraction * 100).toFixed(0)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
