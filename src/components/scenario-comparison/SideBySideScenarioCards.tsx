import React from 'react';
import {
  Sun,
  Globe,
  Mountain,
  Layers,
  Copy,
  Trash2,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertTriangle,
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

  const getRankBadge = (scenarioId: string) => {
    const item = comparisonResult?.ranking_summary.find((r) => r.scenario_id === scenarioId);
    if (!item) return null;

    let color = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    if (item.rank === 2) color = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
    if (item.rank >= 3) color = 'bg-slate-800 text-slate-300 border-slate-700';

    return (
      <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${color}`}>
        COMPLIANCE #{item.rank} ({item.passed_count}/{item.total_count} Passed)
      </span>
    );
  };

  return (
    <div className="space-y-3 font-mono text-xs">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {scenarios.map((scRes: ScenarioComparisonResult) => {
          const sc = scRes.scenario;
          const t = scRes.terrain;
          const s = scRes.solar;
          const e = scRes.earth;
          const c = scRes.combined;
          const isActive = activeScenarioId === sc.id;

          return (
            <div
              key={sc.id}
              onClick={() => setActiveScenarioId(sc.id)}
              className={`bg-[#0c121e]/95 rounded-xl border p-3 flex flex-col justify-between shadow-xl transition-all cursor-pointer ${
                isActive
                  ? 'border-cyan-500 shadow-cyan-500/10 ring-1 ring-cyan-500'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Header Row */}
                <div className="flex items-start justify-between gap-1 pb-2 border-b border-slate-800">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <MapPin className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <h3 className="font-bold text-slate-100 truncate text-[11px]" title={sc.name}>
                        {sc.name}
                      </h3>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span>{sc.latitude.toFixed(4)}° N, {sc.longitude.toFixed(4)}° E</span>
                    </div>
                  </div>
                  <div className="shrink-0">{getRankBadge(sc.id)}</div>
                </div>

                {/* Configuration Differences Alert */}
                {scRes.configuration_differences.length > 0 && (
                  <div className="my-2 p-1.5 rounded bg-amber-500/10 border border-amber-500/30 text-[9px] text-amber-300 space-y-0.5">
                    <div className="font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      <span>Configuration Difference:</span>
                    </div>
                    {scRes.configuration_differences.map((diff, i) => (
                      <div key={i} className="pl-4 text-slate-400">• {diff}</div>
                    ))}
                  </div>
                )}

                {/* Section 1: Solar Illumination */}
                <div className="mt-2.5 space-y-1.5 bg-[#070b12] p-2 rounded-lg border border-slate-800/80">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1 font-bold text-amber-300">
                      <Sun className="w-3.5 h-3.5" />
                      <span>Average Sun Visibility</span>
                    </span>
                    <span className="text-amber-400 font-bold" title="Visible fraction of the Sun disk averaged over the analysis window; not electrical efficiency.">
                      {s.time_weighted_sunlight_percentage?.toFixed(1) ?? 'Unavailable'}{s.time_weighted_sunlight_percentage != null ? '%' : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400">
                    <div className="col-span-2">Any sunlight (full or partial): <b className="text-slate-200">{s.total_sun_visible_hours.toFixed(1)}h</b></div>
                    <div>Full Sun: <b className="text-slate-200">{s.total_sun_full_hours.toFixed(1)}h</b></div>
                    <div>Partial: <b className="text-slate-200">{s.total_sun_partial_hours.toFixed(1)}h</b></div>
                    <div>Darkness: <b className="text-rose-400">{s.total_darkness_hours.toFixed(1)}h</b></div>
                    <div>Max Dark: <b className="text-rose-400">{s.longest_darkness_hours.toFixed(1)}h</b></div>
                  </div>
                  {s.coverage_certainty === 'INDETERMINATE_PARTIAL_DEM' && (
                    <p className="text-[10px] text-amber-300">Limited terrain coverage: distant terrain may reduce visibility.</p>
                  )}
                </div>

                {/* Section 2: Earth Direct Line-of-Sight */}
                <div className="mt-2 space-y-1.5 bg-[#070b12] p-2 rounded-lg border border-slate-800/80">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1 font-bold text-cyan-300">
                      <Globe className="w-3.5 h-3.5" />
                      <span>Earth Line-of-Sight</span>
                    </span>
                    <span className="text-cyan-400 font-bold">
                      {e.total_earth_visible_hours.toFixed(1)} h ({(e.earth_visibility_fraction * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400">
                    <div>Full LOS: <b className="text-slate-200">{e.total_earth_full_hours.toFixed(1)}h</b></div>
                    <div>Partial: <b className="text-slate-200">{e.total_earth_partial_hours.toFixed(1)}h</b></div>
                    <div>Blackout: <b className="text-rose-400">{e.total_earth_blackout_hours.toFixed(1)}h</b></div>
                    <div>Max Blackout: <b className="text-rose-400">{e.longest_earth_blackout_hours.toFixed(1)}h</b></div>
                  </div>
                </div>

                {/* Section 3: Combined Opportunity */}
                <div className="mt-2 space-y-1.5 bg-[#070b12] p-2 rounded-lg border border-slate-800/80">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1 font-bold text-emerald-300">
                      <Layers className="w-3.5 h-3.5" />
                      <span>Both Sun & Earth</span>
                    </span>
                    <span className="text-emerald-400 font-bold">
                      {c.both_visible_hours.toFixed(1)} h
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400">
                    <div>Sun Only: <b className="text-amber-300">{c.sun_only_hours.toFixed(1)}h</b></div>
                    <div>Earth Only: <b className="text-cyan-300">{c.earth_only_hours.toFixed(1)}h</b></div>
                    <div className="col-span-2">Dual Occlusion: <b className="text-rose-400">{c.neither_visible_hours.toFixed(1)}h</b></div>
                  </div>
                </div>

                {/* Section 4: Terrain & LOLA Data Quality */}
                <div className="mt-2 space-y-1 bg-[#070b12] p-2 rounded-lg border border-slate-800/80 text-[10px]">
                  <div className="flex items-center gap-1 text-slate-300 font-bold">
                    <Mountain className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Terrain & LOLA DEM</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-slate-400">
                    <div>Surface Elev: <b className="text-slate-200">{t.observer_surface_elevation_m.toFixed(1)}m</b></div>
                    <div>Local Slope: <b className="text-emerald-300">{t.local_slope_deg !== undefined ? `${t.local_slope_deg.toFixed(1)}°` : 'N/A'}</b></div>
                    <div>Eye Height: <b className="text-slate-200">+{t.observer_height_m.toFixed(1)}m</b></div>
                    <div>DEM Grid: <b className="text-slate-200">{t.dem_nominal_spacing_m}m/px</b></div>
                  </div>
                  <div className="text-[9px] text-slate-500 pt-0.5 border-t border-slate-800">
                    * ~90% interpolated between ground tracks
                  </div>
                </div>

                {/* Section 5: Constraints Summary */}
                <div className="mt-2 flex items-center justify-between px-1 text-[10px]">
                  <span className="text-slate-400">Constraints Status:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> {scRes.passed_constraints_count} Pass
                    </span>
                    {scRes.failed_constraints_count > 0 && (
                      <span className="text-rose-400 font-bold flex items-center gap-0.5">
                        <XCircle className="w-3 h-3" /> {scRes.failed_constraints_count} Fail
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyScenario(sc.id);
                  }}
                  className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200"
                  title="Duplicate Scenario"
                >
                  <Copy className="w-3 h-3" />
                  <span>Duplicate</span>
                </button>

                {sc.id.startsWith('scenario-') && !sc.id.startsWith('scenario-cr-') && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeScenario(sc.id);
                    }}
                    className="flex items-center gap-1 text-[10px] text-rose-400 hover:text-rose-300"
                    title="Delete Custom Scenario"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
