import React from 'react';
import {
  Sun,
  Globe,
  Layers,
  Clock,
  Database,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { useVisibilityStore } from '../../stores/visibilityStore';
import { useDynamicAnalysisStore } from '../../stores/dynamicAnalysisStore';
import { useLocationStore } from '../../stores/locationStore';

export const VisibilityMetricsSummary: React.FC = () => {
  const analysisData = useVisibilityStore((state) => state.analysisData);
  const instantData = useVisibilityStore((state) => state.instantData);

  const currentPointTelemetry = useDynamicAnalysisStore((state) => state.currentPointTelemetry);
  const selectedLat = useLocationStore((state) => state.selectedLatitude);
  const selectedLon = useLocationStore((state) => state.selectedLongitude);
  const observerLat = currentPointTelemetry?.latitude ?? selectedLat;
  const observerLon = currentPointTelemetry?.longitude ?? selectedLon;

  const solar = analysisData?.solar_metrics;
  const earth = analysisData?.earth_metrics;
  const combined = analysisData?.combined_metrics;
  const transitions = analysisData?.transitions ?? [];
  const horizonSummary = analysisData?.terrain_horizon_summary ?? instantData?.terrain_horizon_summary;

  return (
    <div className="space-y-3 font-mono text-xs">
      {/* Observer Location Telemetry */}
      <div className="bg-[#0c121e]/90 border border-slate-800 rounded-xl p-3 shadow-lg">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="text-slate-200 font-bold flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>OBSERVER LOCATION & DEM</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            CONFIRMED
          </span>
        </div>

        <div className="mt-2 space-y-1.5 text-[11px]">
          <div className="flex justify-between">
            <span className="text-slate-400">Observer Coordinates:</span>
            <span className="text-emerald-300 font-bold">
              {observerLat.toFixed(4)}° N, {observerLon.toFixed(4)}° E
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Surface Elevation (h0):</span>
            <span className="text-slate-200">
              {instantData?.observer_surface_elevation_m !== undefined
                ? `${instantData.observer_surface_elevation_m.toFixed(1)} m`
                : '1441.8 m'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Observer Height (h_obs):</span>
            <span className="text-cyan-300 font-bold">
              +{instantData?.observer_height_m ?? 2.0} m above surface
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Max Terrain Skyline:</span>
            <span className="text-emerald-400 font-bold">
              {horizonSummary ? `+${horizonSummary.max_horizon_elevation_deg.toFixed(2)}° at ${horizonSummary.max_horizon_azimuth_deg.toFixed(0)}° Az` : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* Solar Mission Metrics */}
      <div className="bg-[#0c121e]/90 border border-slate-800 rounded-xl p-3 shadow-lg">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="text-amber-400 font-bold flex items-center gap-2">
            <Sun className="w-4 h-4" />
            <span>SOLAR ILLUMINATION METRICS</span>
          </div>
        </div>

        {solar ? (
          <div className="mt-2 space-y-2 text-[11px]">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#070b12] p-2 rounded-lg border border-slate-800/80">
                <div className="text-slate-500 text-[10px]">TIME-WEIGHTED DISK</div>
                <div className="text-amber-300 font-bold text-sm">
                  {(solar.time_weighted_sunlight_percentage ?? (solar.illumination_fraction * 100)).toFixed(1)}%
                </div>
                <div className="text-slate-400 text-[10px]">
                  Effective solar flux area
                </div>
              </div>
              <div className="bg-[#070b12] p-2 rounded-lg border border-slate-800/80">
                <div className="text-slate-500 text-[10px]">ANY CONTACT TIME</div>
                <div className="text-amber-400 font-bold text-sm">
                  {solar.total_sun_visible_hours.toFixed(1)} h
                </div>
                <div className="text-slate-400 text-[10px]">
                  ({(solar.any_sunlight_percentage ?? (solar.illumination_fraction * 100)).toFixed(1)}% of window)
                </div>
              </div>
            </div>

            <div className="space-y-1 pt-1 text-[10px] text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Full Sunlight (F=1):</span>
                <span className="font-bold">
                  {solar.total_sun_full_hours.toFixed(1)} h
                  {solar.full_sunlight_percentage !== undefined ? ` (${solar.full_sunlight_percentage.toFixed(1)}%)` : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Partial Grazing (0&lt;F&lt;1):</span>
                <span className="font-bold">
                  {solar.total_sun_partial_hours.toFixed(1)} h
                  {solar.partial_sunlight_percentage !== undefined ? ` (${solar.partial_sunlight_percentage.toFixed(1)}%)` : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Darkness (F=0):</span>
                <span className="font-bold">
                  {solar.total_darkness_hours.toFixed(1)} h
                  {solar.darkness_percentage !== undefined ? ` (${solar.darkness_percentage.toFixed(1)}%)` : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Longest Darkness:</span>
                <span className="font-bold text-rose-400">{solar.longest_darkness_hours.toFixed(1)} h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Transitions:</span>
                <span className="font-bold text-amber-300">
                  {solar.sunrise_count} Sunrises, {solar.sunset_count} Sunsets
                </span>
              </div>
              {solar.coverage_certainty === 'INDETERMINATE_PARTIAL_DEM' && (
                <div className="text-[10px] text-amber-400/90 pt-1 border-t border-slate-800">
                  ⚠️ DEM horizon incomplete: {solar.indeterminate_hours?.toFixed(1)} h ({solar.indeterminate_percentage?.toFixed(1)}%) indeterminate.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-4 text-center text-slate-500 text-xs">
            Generate timelines to compute solar illumination duration.
          </div>
        )}
      </div>

      {/* Earth Mission Metrics */}
      <div className="bg-[#0c121e]/90 border border-slate-800 rounded-xl p-3 shadow-lg">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="text-cyan-400 font-bold flex items-center gap-2">
            <Globe className="w-4 h-4" />
            <span>EARTH COMM LINE-OF-SIGHT</span>
          </div>
        </div>

        {earth ? (
          <div className="mt-2 space-y-2 text-[11px]">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#070b12] p-2 rounded-lg border border-slate-800/80">
                <div className="text-slate-500 text-[10px]">TOTAL EARTH VISIBLE</div>
                <div className="text-cyan-300 font-bold text-sm">
                  {earth.total_earth_visible_hours.toFixed(1)} h
                </div>
                <div className="text-slate-400 text-[10px]">
                  ({(earth.earth_visibility_fraction * 100).toFixed(1)}% of window)
                </div>
              </div>
              <div className="bg-[#070b12] p-2 rounded-lg border border-slate-800/80">
                <div className="text-slate-500 text-[10px]">LONGEST BLACKOUT</div>
                <div className="text-rose-400 font-bold text-sm">
                  {earth.longest_earth_blackout_hours.toFixed(1)} h
                </div>
                <div className="text-slate-400 text-[10px]">
                  Terrain LOS occlusion
                </div>
              </div>
            </div>

            <div className="space-y-1 pt-1 text-[10px] text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Full Visibility:</span>
                <span className="font-bold">{earth.total_earth_full_hours.toFixed(1)} h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Partial Visibility:</span>
                <span className="font-bold">{earth.total_earth_partial_hours.toFixed(1)} h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Transitions:</span>
                <span className="font-bold text-cyan-300">
                  {earth.earthrise_count} Earthrises, {earth.earthset_count} Earthsets
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center text-slate-500 text-xs">
            Generate timelines to compute Earth line-of-sight metrics.
          </div>
        )}
      </div>

      {/* Combined Mission Simultaneous Window */}
      {combined && (
        <div className="bg-[#0c121e]/90 border border-slate-800 rounded-xl p-3 shadow-lg">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="text-emerald-400 font-bold flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <span>COMBINED MISSION WINDOWS</span>
            </div>
          </div>

          <div className="mt-2 space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Both Sun & Earth Visible:</span>
              <span className="text-emerald-300 font-bold">{combined.both_visible_hours.toFixed(1)} h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Sun Visible Only:</span>
              <span className="text-amber-300 font-bold">{combined.sun_only_hours.toFixed(1)} h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Earth Visible Only:</span>
              <span className="text-cyan-300 font-bold">{combined.earth_only_hours.toFixed(1)} h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Neither Visible (Dual Loss):</span>
              <span className="text-rose-400 font-bold">{combined.neither_visible_hours.toFixed(1)} h</span>
            </div>
          </div>
        </div>
      )}

      {/* Transition Events Log */}
      {transitions.length > 0 && (
        <div className="bg-[#0c121e]/90 border border-slate-800 rounded-xl p-3 shadow-lg">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="text-slate-200 font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>HORIZON LIMB TRANSITIONS</span>
            </div>
            <span className="text-[10px] text-slate-400">
              {transitions.length} Event{transitions.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {transitions.map((t, idx) => (
              <div
                key={idx}
                className="bg-[#070b12] p-1.5 rounded-lg border border-slate-800/80 text-[10px] flex items-center justify-between"
              >
                <div className="flex items-center gap-1.5">
                  {t.transition_type.includes('RISE') ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  <span className="font-bold text-slate-200">{t.transition_type}</span>
                </div>
                <div className="text-slate-400">
                  {t.timestamp_iso.replace('T', ' ').slice(5, 16)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
