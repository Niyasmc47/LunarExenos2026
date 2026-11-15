import React from 'react';
import { CandidateTerrainAssessment } from '../../types/terrainAssessment';
import { useTerrainAssessmentStore } from '../../stores/terrainAssessmentStore';
import {
  Mountain,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Layers,
} from 'lucide-react';

interface Props {
  candidate: CandidateTerrainAssessment;
}

export const CandidateTerrainCard: React.FC<Props> = ({ candidate: c }) => {
  const selectedCandidateId = useTerrainAssessmentStore((state) => state.selectedCandidateId);
  const openDetailDrawer = useTerrainAssessmentStore((state) => state.openDetailDrawer);

  const isActive = selectedCandidateId === c.candidate_id;

  const elev = c.elevation_metrics;
  const slope = c.slope_metrics;
  const dq = c.data_quality;

  return (
    <div
      className={`border rounded-xl p-5 transition-all ${
        isActive
          ? 'bg-[#191b20] border-[#ffe3b0] ring-1 ring-[#ffe3b0]/50 shadow-md shadow-[#ffe3b0]/10'
          : 'bg-[#141619] hover:bg-[#191b20] border-[#2b2d32]'
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#202228]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-mono font-bold text-white tracking-wide">
              {c.candidate_name}
            </h3>
            <span className="text-[10px] font-mono text-slate-500">
              ({c.site_id})
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mt-0.5">
            <MapPin className="w-3.5 h-3.5 text-[#ffe3b0] shrink-0" />
            <span>Lat: {c.latitude.toFixed(4)}° • Lon: {c.longitude.toFixed(4)}°</span>
            {c.projected_x !== null && c.projected_y !== null && (
              <span className="text-slate-500 hidden md:inline">
                • (X: {c.projected_x} m, Y: {c.projected_y} m)
              </span>
            )}
          </div>
        </div>

        {/* Overall Status Badge */}
        <div className="flex items-center gap-2">
          {c.overall_status === 'COMPLIANT' && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>COMPLIANT</span>
            </div>
          )}
          {c.overall_status === 'NON_COMPLIANT' && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono font-semibold">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>NON-COMPLIANT</span>
            </div>
          )}
          {c.overall_status === 'INDETERMINATE' && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>INDETERMINATE</span>
            </div>
          )}

          <div className="flex items-center gap-1 text-[10px] font-mono">
            <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 text-emerald-300">
              {c.hard_constraints_passed} Pass
            </span>
            {c.hard_constraints_failed > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-800/40 text-rose-300">
                {c.hard_constraints_failed} Fail
              </span>
            )}
            {c.hard_constraints_indeterminate > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/40 text-amber-300">
                {c.hard_constraints_indeterminate} Indet
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3.5">
        {/* Elevation Metrics Panel */}
        <div className="bg-[#0e1013] rounded-xl p-3 border border-[#2b2d32] space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-[#ffe3b0] font-semibold flex items-center gap-1.5">
              <Mountain className="w-3.5 h-3.5" />
              <span>Surface Elevation (IAU Datum)</span>
            </span>
            <span className="text-white font-bold">
              {elev.point_elevation_m != null ? `${elev.point_elevation_m.toFixed(1)} m` : 'N/A'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-slate-300 bg-[#08090b] p-2 rounded-lg border border-[#202228]">
            <div>
              <span className="text-[9px] text-slate-500 uppercase block">
                {dq.requested_radius_m === 0 ? 'Point Elev' : 'Footprint Min'}
              </span>
              <span>{elev.min_elevation_m != null ? `${elev.min_elevation_m.toFixed(1)} m` : 'N/A'}</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 uppercase block">
                {dq.requested_radius_m === 0 ? 'Point Elev' : 'Footprint Max'}
              </span>
              <span>{elev.max_elevation_m != null ? `${elev.max_elevation_m.toFixed(1)} m` : 'N/A'}</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 uppercase block">Elev Range (ΔZ)</span>
              <span>{elev.elevation_range_m != null ? `${elev.elevation_range_m.toFixed(1)} m` : 'N/A'}</span>
            </div>
          </div>

          <div className="text-[10px] font-mono text-slate-500">
            Reference Sphere: R = 1,737,400.0 m (not spacecraft altitude)
          </div>
        </div>

        {/* Slope Metrics Panel */}
        <div className="bg-[#0e1013] rounded-xl p-3 border border-[#2b2d32] space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-[#7bd0ff] font-semibold flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Topographic Slope (NASA LOLA)</span>
            </span>
            <span className="text-white font-bold">
              {slope.point_slope_deg != null ? `${slope.point_slope_deg.toFixed(1)}°` : 'N/A'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-slate-300 bg-[#08090b] p-2 rounded-lg border border-[#202228]">
            <div>
              <span className="text-[9px] text-slate-500 uppercase block">
                {dq.requested_radius_m === 0 ? 'Point Slope' : 'Footprint Min'}
              </span>
              <span>{slope.min_slope_deg != null ? `${slope.min_slope_deg.toFixed(1)}°` : 'N/A'}</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 uppercase block">
                {dq.requested_radius_m === 0 ? 'Point Slope' : 'Footprint Max'}
              </span>
              <span>{slope.max_slope_deg != null ? `${slope.max_slope_deg.toFixed(1)}°` : 'N/A'}</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 uppercase block">Threshold Exceed</span>
              <span className={slope.exceedance_percentage && slope.exceedance_percentage > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                {slope.exceedance_percentage != null ? `${slope.exceedance_percentage.toFixed(1)}%` : '0.0%'}
              </span>
            </div>
          </div>

          {/* Mini 7-category slope distribution */}
          {Object.keys(slope.slope_distribution).length > 0 && (
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                <span>Slope Distribution (0° to 30°+)</span>
                <span className="text-slate-500">Lander Tilt Hazard</span>
              </div>
              <div className="w-full bg-[#202228] h-1.5 rounded-full overflow-hidden flex border border-[#2b2d32]">
                <div
                  className="bg-[#ffe3b0] h-full"
                  style={{ width: `${slope.slope_distribution['0° – 5°: Safe Landing (Low Tilt Risk)'] || 0}%` }}
                  title={`0-5°: ${slope.slope_distribution['0° – 5°: Safe Landing (Low Tilt Risk)'] || 0}%`}
                />
                <div
                  className="bg-[#e5c68d] h-full"
                  style={{ width: `${slope.slope_distribution['5° – 10°: Favorable Terrain'] || 0}%` }}
                  title={`5-10°: ${slope.slope_distribution['5° – 10°: Favorable Terrain'] || 0}%`}
                />
                <div
                  className="bg-amber-400 h-full"
                  style={{ width: `${slope.slope_distribution['10° – 15°: Moderate Slope (Caution)'] || 0}%` }}
                  title={`10-15°: ${slope.slope_distribution['10° – 15°: Moderate Slope (Caution)'] || 0}%`}
                />
                <div
                  className="bg-orange-500 h-full"
                  style={{ width: `${slope.slope_distribution['15° – 20°: Steep Slope (Lander Hazard)'] || 0}%` }}
                  title={`15-20°: ${slope.slope_distribution['15° – 20°: Steep Slope (Lander Hazard)'] || 0}%`}
                />
                <div
                  className="bg-rose-500 h-full"
                  style={{ width: `${(slope.slope_distribution['20° – 25°: High Tilt Risk'] || 0) + (slope.slope_distribution['25° – 30°: Severe Slope Hazard'] || 0) + (slope.slope_distribution['> 30°: Extreme Crater Wall'] || 0)}%` }}
                  title="> 20° Steep Wall"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Roughness & Data Quality Callout */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Roughness Status */}
        <div className="p-2.5 bg-[#0e1013] rounded-lg border border-[#2b2d32] text-[10px] font-mono space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-semibold text-amber-400/90 flex items-center gap-1">
              <Layers className="w-3 h-3 text-amber-400" />
              <span>Roughness: UNSUPPORTED</span>
            </span>
            <span className="text-amber-400">INDETERMINATE</span>
          </div>
          <p className="text-slate-500">
            Official LOLA roughness product is not loaded. Slope variance is not substituted for micro-relief roughness.
          </p>
        </div>

        {/* Spatial Coverage */}
        <div className="p-2.5 bg-[#0e1013] rounded-lg border border-[#2b2d32] text-[10px] font-mono space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span>
              {dq.requested_radius_m === 0 ? (
                <strong className="text-[#7bd0ff]">Point Assessment (Single Pixel)</strong>
              ) : (
                <>Footprint Radius: <strong className="text-white">{dq.requested_radius_m} m</strong></>
              )}
            </span>
            <span className={dq.coverage_status === 'COMPLETE' ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
              {dq.coverage_status} ({dq.valid_data_percentage}%)
            </span>
          </div>
          <p className="text-slate-500">
            {dq.requested_radius_m === 0
              ? `Center pixel: ${dq.valid_pixels_in_footprint === 1 ? 'Valid data (5 m × 5 m)' : 'NoData'}`
              : `Evaluated area: ${dq.evaluated_area_m2} m² (${dq.valid_pixels_in_footprint} / ${dq.total_pixels_in_footprint} valid 5m pixels)`}
          </p>
        </div>
      </div>

      {/* Footer / Inspect Button */}
      <div className="flex items-center justify-between mt-3 pt-2 text-[11px] font-mono border-t border-[#202228]">
        <span className="text-slate-500">
          Source: <span className="text-slate-400">NASA LOLA 5 m/px Polar DEM</span>
        </span>
        <button
          onClick={() => openDetailDrawer(c)}
          className="flex items-center gap-1 text-[#ffe3b0] hover:text-[#ffdea3] font-medium transition-colors"
        >
          <span>Inspect Requirements Matrix</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
