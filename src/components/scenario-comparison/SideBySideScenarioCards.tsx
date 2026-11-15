import React from 'react';
import {
  Copy,
  Trash2,
  MapPin,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import { useScenarioStore } from '../../stores/scenarioStore';
import { ScenarioComparisonResult } from '../../types/scenario';

export const SideBySideScenarioCards: React.FC = () => {
  const comparisonResult = useScenarioStore((state) => state.comparisonResult);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const setActiveScenarioId = useScenarioStore((state) => state.setActiveScenarioId);
  const copyScenario = useScenarioStore((state) => state.copyScenario);
  const removeScenario = useScenarioStore((state) => state.removeScenario);

  const scenarios = comparisonResult?.scenarios ?? [];

  if (scenarios.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 font-mono text-xs">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scenarios.map((scRes: ScenarioComparisonResult) => {
          const sc = scRes.scenario;
          const t = scRes.terrain;
          const s = scRes.solar;
          const e = scRes.earth;
          const c = scRes.combined;
          const isActive = activeScenarioId === sc.id;

          const rankItem = comparisonResult?.ranking_summary.find((r) => r.scenario_id === sc.id);
          const isPrime = rankItem?.rank === 1;
          const isBackup = rankItem?.rank === 2;
          const isDisqualified = scRes.failed_constraints_count > 0;

          // Compliance score display
          const scoreVal = rankItem?.compliance_score_pct !== undefined
            ? rankItem.compliance_score_pct
            : scRes.constraints.length > 0
              ? (scRes.passed_constraints_count / scRes.constraints.length) * 100
              : 100.0;

          // Tilt margin
          const slopeVal = t.local_slope_deg ?? 5.0;
          const tiltMargin = Math.max(0, 10.0 - slopeVal);

          // Sunlight and Earth percentages
          const sunPct = (s.illumination_fraction * 100).toFixed(0);
          const earthPct = (e.earth_visibility_fraction * 100).toFixed(0);

          // Trade-off text
          const tradeoffText = rankItem?.dominant_tradeoff ||
            `Slope: ${slopeVal.toFixed(1)}° • Sun: ${sunPct}% (${s.total_sun_visible_hours.toFixed(0)}h) • Earth LOS: ${earthPct}% (${e.total_earth_visible_hours.toFixed(0)}h)`;

          return (
            <div
              key={sc.id}
              onClick={() => setActiveScenarioId(sc.id)}
              className={`bg-[#0e1013] rounded-xl border flex flex-col justify-between shadow-xl transition-all cursor-pointer overflow-hidden ${
                isActive
                  ? 'border-[#ffe3b0] ring-1 ring-[#ffe3b0]/50 shadow-[#ffe3b0]/10'
                  : 'border-[#2b2d32] hover:border-slate-600'
              }`}
            >
              <div>
                {/* Header Container */}
                <div className={`p-3.5 bg-gradient-to-b ${
                  isDisqualified
                    ? 'from-rose-950/20 via-[#141619] to-transparent'
                    : isPrime
                      ? 'from-[#ffe3b0]/10 via-[#141619] to-transparent'
                      : 'from-[#191b20] via-[#141619] to-transparent'
                } border-b border-[#202228]`}>
                  {/* Status & Rank Badges */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    {isDisqualified ? (
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 font-bold text-[10px] border border-rose-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                        MANDATORY REQUIREMENT FAILED
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold text-[10px] border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        ALL MANDATORY LIMITS PASSED
                      </div>
                    )}

                    {isPrime ? (
                      <span className="font-bold text-[#ffe3b0] px-2 py-0.5 rounded bg-[#ffe3b0]/10 border border-[#ffe3b0]/30 text-[10px]">
                        #1 PRIME CANDIDATE
                      </span>
                    ) : isBackup ? (
                      <span className="font-bold text-[#7bd0ff] px-2 py-0.5 rounded bg-[#7bd0ff]/10 border border-[#7bd0ff]/30 text-[10px]">
                        #2 VIABLE BACKUP
                      </span>
                    ) : (
                      <span className="font-bold text-slate-400 px-2 py-0.5 rounded bg-slate-800 text-[10px]">
                        {isDisqualified ? 'DISQUALIFIED' : `#${rankItem?.rank ?? 3} CANDIDATE`}
                      </span>
                    )}
                  </div>

                  {/* Title & Site */}
                  <h3 className="text-sm font-bold text-slate-100 truncate" title={sc.name}>
                    {sc.name}
                  </h3>

                  {/* Big Compliance Score Display */}
                  <div className="flex items-baseline gap-2 mt-1.5">
                    <span className={`text-2xl font-bold tracking-tight ${
                      isDisqualified ? 'text-rose-400' : 'text-slate-100'
                    }`}>
                      {scoreVal.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                      Overall Compliance Score
                    </span>
                  </div>

                  {/* Dominant Trade-off Box */}
                  <div className="mt-2.5 p-2 rounded-lg bg-[#08090b] border border-[#202228] text-[11px] leading-relaxed">
                    <p className="text-slate-300">
                      <span className="text-[#ffe3b0] font-bold">Dominant trade-off: </span>
                      <span className="text-slate-400">{tradeoffText}</span>
                    </p>
                  </div>
                </div>

                {/* Synthetic Visual Profile & Coordinate Thumbnail */}
                <div className="px-3.5 pt-3">
                  <div className="relative w-full h-24 rounded-lg overflow-hidden bg-gradient-to-br from-[#141619] via-[#0e1013] to-[#08090b] border border-[#202228]">
                    {/* Simulated Elevation / Gradient Mesh Contour */}
                    <div
                      className="absolute inset-0 opacity-40 bg-cover bg-center"
                      style={{
                        backgroundImage:
                          'radial-gradient(ellipse at 50% 30%, #303238 0%, #191b20 50%, #08090b 100%)',
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#08090b] via-transparent to-transparent" />

                    {/* Coordinates Overlay */}
                    <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded bg-[#141619]/90 border border-[#2b2d32] text-[10px] text-slate-300">
                      <MapPin className="w-3 h-3 text-[#ffe3b0]" />
                      <span>LAT {sc.latitude.toFixed(4)}° / LON {sc.longitude.toFixed(4)}°</span>
                    </div>

                    {/* Tilt Margin Badge */}
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold font-mono border"
                      style={{
                        backgroundColor: isDisqualified ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: isDisqualified ? '#f87171' : '#34d399',
                        borderColor: isDisqualified ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)',
                      }}
                    >
                      {slopeVal > 10.0 ? `SLOPE EXCESS: +${(slopeVal - 10.0).toFixed(1)}°` : `TILT MARGIN: +${tiltMargin.toFixed(1)}°`}
                    </div>
                  </div>
                </div>

                {/* 14-Day Timeline Gantt Strip */}
                <div className="px-3.5 py-2.5">
                  <div className="flex items-center justify-between mb-1.5 text-[10px]">
                    <span className="text-slate-400 uppercase font-semibold">
                      Illumination &amp; Comm Timeline
                    </span>
                    <span className="text-[#ffe3b0] font-bold">
                      {s.total_sun_visible_hours.toFixed(0)}h Sun / {s.total_darkness_hours.toFixed(0)}h Dark
                    </span>
                  </div>

                  {/* Dual Bars: Solar & Earth */}
                  <div className="space-y-1.5">
                    {/* Solar Illumination Bar */}
                    <div className="w-full bg-[#08090b] h-2.5 rounded overflow-hidden flex border border-[#202228]">
                      <div
                        className="bg-[#ffe3b0] h-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, s.illumination_fraction * 100))}%` }}
                        title={`Sunlight: ${s.total_sun_visible_hours.toFixed(1)}h (${sunPct}%)`}
                      />
                      <div
                        className="bg-[#202228] h-full flex-1"
                        title={`Shadow: ${s.total_darkness_hours.toFixed(1)}h`}
                      />
                    </div>

                    {/* Earth Line-of-Sight Bar */}
                    <div className="w-full bg-[#08090b] h-2 rounded overflow-hidden flex border border-[#202228]">
                      <div
                        className="bg-[#7bd0ff] h-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, e.earth_visibility_fraction * 100))}%` }}
                        title={`Earth Direct LOS: ${e.total_earth_visible_hours.toFixed(1)}h (${earthPct}%)`}
                      />
                      <div
                        className="bg-[#202228] h-full flex-1"
                        title={`Earth Blackout: ${e.total_earth_blackout_hours.toFixed(1)}h`}
                      />
                    </div>
                  </div>

                  {/* Day Axis Ticks */}
                  <div className="flex items-center justify-between text-[9px] text-slate-500 mt-1 font-mono">
                    <span>DAY 00</span>
                    <span>DAY 04</span>
                    <span>DAY 08</span>
                    <span>DAY 12</span>
                    <span>DAY 14</span>
                  </div>
                </div>

                {/* Critical Metrics & Limits Table */}
                <div className="px-3.5 pb-2">
                  <div className="rounded-lg bg-[#08090b] border border-[#202228] overflow-hidden text-[10px]">
                    <div className="px-2.5 py-1.5 bg-[#141619] flex justify-between text-slate-400 uppercase font-semibold border-b border-[#202228]">
                      <span>Critical Metric</span>
                      <span>Recorded</span>
                      <span>Limit Margin</span>
                    </div>

                    <div className="divide-y divide-[#202228]">
                      {/* Slope */}
                      <div className="px-2.5 py-1.5 flex items-center justify-between">
                        <span className="text-slate-300">Mean Landing Slope</span>
                        <span className="text-slate-100 font-semibold">{slopeVal.toFixed(1)}°</span>
                        {slopeVal <= 10.0 ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> PASS (≤10°)
                          </span>
                        ) : (
                          <span className="text-rose-400 font-semibold flex items-center gap-1">
                            <XCircle className="w-3 h-3 text-rose-400" /> FAIL (&gt;10°)
                          </span>
                        )}
                      </div>

                      {/* Max Darkness */}
                      <div className="px-2.5 py-1.5 flex items-center justify-between">
                        <span className="text-slate-300">Max Darkness Run</span>
                        <span className="text-slate-100 font-semibold">{s.longest_darkness_hours.toFixed(1)} h</span>
                        {s.longest_darkness_hours <= 48.0 ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> PASS (≤48h)
                          </span>
                        ) : (
                          <span className="text-rose-400 font-semibold flex items-center gap-1">
                            <XCircle className="w-3 h-3 text-rose-400" /> FAIL (&gt;48h)
                          </span>
                        )}
                      </div>

                      {/* Earth LOS */}
                      <div className="px-2.5 py-1.5 flex items-center justify-between">
                        <span className="text-slate-300">Earth LOS Coverage</span>
                        <span className="text-slate-100 font-semibold">{earthPct}%</span>
                        {e.earth_visibility_fraction >= 0.8 ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> PASS (≥80%)
                          </span>
                        ) : (
                          <span className="text-rose-400 font-semibold flex items-center gap-1">
                            <XCircle className="w-3 h-3 text-rose-400" /> MARGINAL
                          </span>
                        )}
                      </div>

                      {/* Combined Sun & Earth */}
                      <div className="px-2.5 py-1.5 flex items-center justify-between">
                        <span className="text-slate-300">Both Sun &amp; Earth</span>
                        <span className="text-emerald-400 font-semibold">{c.both_visible_hours.toFixed(1)} h</span>
                        <span className="text-slate-400 font-mono">
                          {((c.both_visible_hours / (s.total_sun_visible_hours + s.total_darkness_hours || 1)) * 100).toFixed(0)}% Sortie
                        </span>
                      </div>

                      {/* Elevation Datum */}
                      <div className="px-2.5 py-1.5 flex items-center justify-between">
                        <span className="text-slate-300">Elevation Datum</span>
                        <span className="text-slate-200 font-semibold">
                          {t.observer_surface_elevation_m >= 0 ? '+' : ''}{t.observer_surface_elevation_m.toFixed(0)} m
                        </span>
                        <span className="text-slate-500">LOLA grid {t.dem_nominal_spacing_m}m</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-3 bg-[#08090b] border-t border-[#202228] space-y-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveScenarioId(sc.id);
                  }}
                  className={`w-full py-1.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-all text-xs ${
                    isActive
                      ? 'bg-[#ffe3b0] text-[#1a1408] shadow-md shadow-[#e5c68d]/20'
                      : 'bg-[#141619] hover:bg-[#191b20] text-slate-200 border border-[#2b2d32]'
                  }`}
                >
                  <span>{isActive ? 'Active Candidate Selected' : 'Inspect Flight Corridor'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center justify-between pt-1 text-[10px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyScenario(sc.id);
                    }}
                    className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors"
                    title="Duplicate Scenario"
                  >
                    <Copy className="w-3 h-3 text-[#7bd0ff]" />
                    <span>Duplicate</span>
                  </button>

                  {sc.id.startsWith('scenario-') && !sc.id.startsWith('scenario-cr-') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeScenario(sc.id);
                      }}
                      className="flex items-center gap-1 text-rose-400 hover:text-rose-300 transition-colors"
                      title="Delete Custom Scenario"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
