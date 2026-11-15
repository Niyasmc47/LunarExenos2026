import React from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { useScenarioStore } from '../../stores/scenarioStore';

export const ComparativeMetricsTable: React.FC = () => {
  const comparisonResult = useScenarioStore((state) => state.comparisonResult);
  const scenarios = comparisonResult?.scenarios ?? [];

  if (scenarios.length === 0) return null;

  return (
    <div className="bg-[#141619] border border-[#2b2d32] rounded-xl p-3 shadow-lg space-y-3 font-mono text-xs overflow-x-auto">
      <div className="flex items-center justify-between pb-2 border-b border-[#2b2d32]">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-slate-100">
            COMPREHENSIVE MULTI-SCENARIO METRIC MATRIX
          </span>
        </div>
      </div>

      <table className="w-full text-left border-collapse min-w-[750px]">
        <thead>
          <tr className="border-b border-[#2b2d32] text-slate-400 text-[10px] uppercase">
            <th className="py-2 pr-4">Metric / Parameter</th>
            {scenarios.map((scRes) => (
              <th key={scRes.scenario.id} className="py-2 px-3 text-cyan-300 font-bold">
                {scRes.scenario.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60 text-[11px]">
          {/* Section: Observer Location & Terrain */}
          <tr className="bg-slate-900/40">
            <td colSpan={scenarios.length + 1} className="py-1 px-2 font-bold text-emerald-400 text-[10px] uppercase">
              1. Geographic Coordinates & Terrain Parameters
            </td>
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-slate-400">Observer Latitude (°)</td>
            {scenarios.map((r) => (
              <td key={r.scenario.id} className="py-1.5 px-3 text-slate-200">{r.scenario.latitude.toFixed(4)}° N</td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-slate-400">Observer Longitude (°)</td>
            {scenarios.map((r) => (
              <td key={r.scenario.id} className="py-1.5 px-3 text-slate-200">{r.scenario.longitude.toFixed(4)}° E</td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-slate-400">Surface Elevation (h0)</td>
            {scenarios.map((r) => (
              <td key={r.scenario.id} className="py-1.5 px-3 text-slate-200">{r.terrain.observer_surface_elevation_m.toFixed(1)} m</td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-slate-400">Observer Eye Height (h_obs)</td>
            {scenarios.map((r) => (
              <td key={r.scenario.id} className="py-1.5 px-3 text-cyan-300">+{r.terrain.observer_height_m.toFixed(1)} m</td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-slate-400">Total Altitude (Z)</td>
            {scenarios.map((r) => (
              <td key={r.scenario.id} className="py-1.5 px-3 text-slate-100 font-bold">{r.terrain.total_observer_elevation_m.toFixed(1)} m</td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-slate-400">Local Terrain Slope (°)</td>
            {scenarios.map((r) => (
              <td key={r.scenario.id} className="py-1.5 px-3 text-amber-300 font-bold">
                {r.terrain.local_slope_deg !== undefined ? `${r.terrain.local_slope_deg.toFixed(1)}°` : 'N/A'}
              </td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-slate-400">DEM Grid Spacing</td>
            {scenarios.map((r) => (
              <td key={r.scenario.id} className="py-1.5 px-3 text-slate-300">{r.terrain.dem_nominal_spacing_m.toFixed(1)} m/px (LOLA)</td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-slate-400">LOLA Measurement Support</td>
            {scenarios.map((r) => (
              <td key={r.scenario.id} className="py-1.5 px-3 text-slate-400 text-[10px]">
                {r.terrain.lola_laser_count !== undefined ? `${r.terrain.lola_laser_count} returns` : '~90% interpolated'}
              </td>
            ))}
          </tr>

          {/* Section: Solar Illumination */}
          <tr className="bg-slate-900/40">
            <td colSpan={scenarios.length + 1} className="py-1 px-2 font-bold text-amber-400 text-[10px] uppercase">
              2. Solar Illumination Metrics (Geometric Terrain Line-of-Sight)
            </td>
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-slate-400">Total Sunlight Duration</td>
            {scenarios.map((r) => (
              <td key={r.scenario.id} className="py-1.5 px-3 text-amber-300 font-bold">
                {r.solar.total_sun_visible_hours.toFixed(1)} h ({(r.solar.illumination_fraction * 100).toFixed(1)}%)
              </td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-slate-400">Full Sunlight Duration</td>
            {scenarios.map((r) => (
              <td key={r.scenario.id} className="py-1.5 px-3 text-slate-200">{r.solar.total_sun_full_hours.toFixed(1)} h</td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-slate-400">Partial Sunlight Duration</td>
            {scenarios.map((r) => (
              <td key={r.scenario.id} className="py-1.5 px-3 text-slate-300">{r.solar.total_sun_partial_hours.toFixed(1)} h</td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-slate-400">Total Darkness Duration</td>
            {scenarios.map((r) => (
              <td key={r.scenario.id} className="py-1.5 px-3 text-rose-400 font-bold">{r.solar.total_darkness_hours.toFixed(1)} h</td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-slate-400">Longest Continuous Darkness</td>
            {scenarios.map((r) => (
              <td key={r.scenario.id} className="py-1.5 px-3 text-rose-400 font-bold">{r.solar.longest_darkness_hours.toFixed(1)} h</td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-slate-400">Sunrise / Sunset Transitions</td>
            {scenarios.map((r) => (
              <td key={r.scenario.id} className="py-1.5 px-3 text-slate-300">
                {r.solar.sunrise_count} rises / {r.solar.sunset_count} sets
              </td>
            ))}
          </tr>

          {/* Section: Earth Line-of-Sight */}
          <tr className="bg-slate-900/40">
            <td colSpan={scenarios.length + 1} className="py-1 px-2 font-bold text-cyan-400 text-[10px] uppercase">
              3. Earth Line-of-Sight Metrics (Geometric Terrain Clearance)
            </td>
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-slate-400">Total Earth Visibility Duration</td>
            {scenarios.map((r) => (
              <td key={r.scenario.id} className="py-1.5 px-3 text-cyan-300 font-bold">
                {r.earth.total_earth_visible_hours.toFixed(1)} h ({(r.earth.earth_visibility_fraction * 100).toFixed(1)}%)
              </td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-slate-400">Full Earth Visibility</td>
            {scenarios.map((r) => (
              <td key={r.scenario.id} className="py-1.5 px-3 text-slate-200">{r.earth.total_earth_full_hours.toFixed(1)} h</td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-slate-400">Total Earth Blackout (LOS Loss)</td>
            {scenarios.map((r) => (
              <td key={r.scenario.id} className="py-1.5 px-3 text-rose-400 font-bold">{r.earth.total_earth_blackout_hours.toFixed(1)} h</td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-slate-400">Longest Earth Blackout</td>
            {scenarios.map((r) => (
              <td key={r.scenario.id} className="py-1.5 px-3 text-rose-400 font-bold">{r.earth.longest_earth_blackout_hours.toFixed(1)} h</td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-slate-400">Earthrise / Earthset Transitions</td>
            {scenarios.map((r) => (
              <td key={r.scenario.id} className="py-1.5 px-3 text-slate-300">
                {r.earth.earthrise_count} rises / {r.earth.earthset_count} sets
              </td>
            ))}
          </tr>

          {/* Section: Combined Opportunities */}
          <tr className="bg-slate-900/40">
            <td colSpan={scenarios.length + 1} className="py-1 px-2 font-bold text-emerald-400 text-[10px] uppercase">
              4. Combined Mission Windows
            </td>
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-slate-400">Both Sun & Earth Geometrically Visible</td>
            {scenarios.map((r) => (
              <td key={r.scenario.id} className="py-1.5 px-3 text-emerald-300 font-bold">{r.combined.both_visible_hours.toFixed(1)} h</td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-slate-400">Sun Visible Only</td>
            {scenarios.map((r) => (
              <td key={r.scenario.id} className="py-1.5 px-3 text-amber-300">{r.combined.sun_only_hours.toFixed(1)} h</td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-slate-400">Earth Visible Only</td>
            {scenarios.map((r) => (
              <td key={r.scenario.id} className="py-1.5 px-3 text-cyan-300">{r.combined.earth_only_hours.toFixed(1)} h</td>
            ))}
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-slate-400">Neither Visible (Dual Occlusion)</td>
            {scenarios.map((r) => (
              <td key={r.scenario.id} className="py-1.5 px-3 text-rose-400 font-bold">{r.combined.neither_visible_hours.toFixed(1)} h</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
};
