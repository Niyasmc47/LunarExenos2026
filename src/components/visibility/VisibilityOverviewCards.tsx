import React from 'react';
import {
  Sun,
  Globe,
  Radio,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldAlert,
  Layers,
} from 'lucide-react';
import { CombinedVisibilityState, VisibilityState } from '../../types/visibility';
import { useVisibilityStore } from '../../stores/visibilityStore';

function getVisibilityBadge(state: VisibilityState, fraction: number) {
  switch (state) {
    case 'FULLY_VISIBLE':
      return {
        label: 'FULLY VISIBLE (100%)',
        bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
        icon: CheckCircle2,
      };
    case 'PARTIALLY_VISIBLE':
      return {
        label: `PARTIALLY VISIBLE (${(fraction * 100).toFixed(1)}%)`,
        bg: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
        icon: AlertTriangle,
      };
    case 'FULLY_OBSTRUCTED':
      return {
        label: 'FULLY OBSTRUCTED (0%)',
        bg: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
        icon: XCircle,
      };
    case 'INDETERMINATE':
    default:
      return {
        label: 'INDETERMINATE (PARTIAL DEM)',
        bg: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
        icon: HelpCircle,
      };
  }
}

function getCombinedBadge(state?: CombinedVisibilityState) {
  switch (state) {
    case 'SUN_AND_EARTH_VISIBLE':
      return {
        label: 'DUAL VISIBILITY: SUN & EARTH VISIBLE',
        desc: 'Simultaneous solar illumination and direct Earth line-of-sight available.',
        bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      };
    case 'SUN_VISIBLE_ONLY':
      return {
        label: 'SOLAR ILLUMINATION ONLY',
        desc: 'Sun visible above terrain. Earth is obstructed by lunar ridge.',
        bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      };
    case 'EARTH_VISIBLE_ONLY':
      return {
        label: 'EARTH LINE-OF-SIGHT ONLY',
        desc: 'Earth visible above terrain. Sun is obstructed (Lunar Night / Ridge Shadow).',
        bg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      };
    case 'NEITHER_VISIBLE':
      return {
        label: 'COMPLETE DUAL OCCLUSION',
        desc: 'Both Sun and Earth are obstructed by lunar terrain or below local horizon.',
        bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      };
    case 'PARTIAL_DUAL_VISIBILITY':
      return {
        label: 'PARTIAL DUAL VISIBILITY',
        desc: 'One or both celestial disks partially occluded by terrain skyline.',
        bg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
      };
    default:
      return {
        label: 'EVALUATING COMBINED STATE...',
        desc: 'Awaiting instant visibility evaluation from backend engine.',
        bg: 'bg-slate-800 text-slate-400 border-[#303238]',
      };
  }
}

export const VisibilityOverviewCards: React.FC = () => {
  const instantData = useVisibilityStore((state) => state.instantData);
  const isLoading = useVisibilityStore((state) => state.isLoadingInstant);

  const sun = instantData?.sun;
  const earth = instantData?.earth;
  const combinedState = instantData?.combined_state;

  const sunBadge = sun ? getVisibilityBadge(sun.visibility_state, sun.visible_fraction) : null;
  const earthBadge = earth ? getVisibilityBadge(earth.visibility_state, earth.visible_fraction) : null;
  const combinedBadge = getCombinedBadge(combinedState);

  return (
    <div className="space-y-2">
      {/* Combined State Banner */}
      <div className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-xs ${combinedBadge.bg}`}>
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 shrink-0" />
          <span className="font-bold tracking-wide">{combinedBadge.label}</span>
        </div>
        <div className="text-[11px] opacity-90">{combinedBadge.desc}</div>
      </div>

      {/* Grid of Sun and Earth Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {/* Sun Card */}
        <div className="bg-[#141619] border border-[#2b2d32] rounded-xl p-3 font-mono text-xs shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[#2b2d32]">
              <div className="flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-slate-200">SUN VISIBILITY & ILLUMINATION</span>
              </div>
              {sunBadge && (
                <span className={`px-2 py-0.5 rounded border text-[10px] font-bold flex items-center gap-1 ${sunBadge.bg}`}>
                  <sunBadge.icon className="w-3 h-3" />
                  <span>{sunBadge.label}</span>
                </span>
              )}
            </div>

            {sun ? (
              <div className="mt-2 space-y-2">
                {/* Horizontal plane status */}
                <div className="flex items-center justify-between text-[11px] bg-[#0e1013] px-2.5 py-1.5 rounded-lg border border-[#202228]">
                  <span className="text-slate-400">Geometric Horizon Status:</span>
                  <span className={`font-bold ${sun.elevation_deg >= 0 ? 'text-amber-300' : 'text-slate-400'}`}>
                    {sun.elevation_deg >= 0 ? 'Sun Above Local Horizontal' : 'Sun Below Local Horizontal'}
                  </span>
                </div>

                {/* Telemetry Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
                  <div className="bg-[#0e1013] p-2 rounded-lg border border-[#202228]">
                    <div className="text-slate-500 text-[10px]">SUN AZIMUTH</div>
                    <div className="text-slate-200 font-bold">{sun.azimuth_deg.toFixed(2)}°</div>
                  </div>
                  <div className="bg-[#0e1013] p-2 rounded-lg border border-[#202228]">
                    <div className="text-slate-500 text-[10px]">SUN ELEVATION</div>
                    <div className="text-amber-400 font-bold">{sun.elevation_deg.toFixed(2)}°</div>
                  </div>
                  <div className="bg-[#0e1013] p-2 rounded-lg border border-[#202228]">
                    <div className="text-slate-500 text-[10px]">SKYLINE ELEVATION</div>
                    <div className="text-emerald-400 font-bold">{sun.horizon_elevation_at_azimuth_deg.toFixed(2)}°</div>
                  </div>
                  <div className="bg-[#0e1013] p-2 rounded-lg border border-[#202228]">
                    <div className="text-slate-500 text-[10px]">UPPER LIMB CLEARANCE</div>
                    <div className={`font-bold ${sun.upper_limb_clearance_deg >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {sun.upper_limb_clearance_deg >= 0 ? '+' : ''}{sun.upper_limb_clearance_deg.toFixed(2)}°
                    </div>
                  </div>
                </div>

                {/* Angular diameter & limb clearances */}
                <div className="text-[10px] text-slate-400 flex flex-wrap justify-between gap-1 px-1">
                  <span>Ang Diameter: <b className="text-slate-300">{(sun.angular_diameter_deg * 60).toFixed(1)}' ({sun.angular_diameter_deg.toFixed(3)}°)</b></span>
                  <span>Lower Limb Clearance: <b className={sun.lower_limb_clearance_deg >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{sun.lower_limb_clearance_deg.toFixed(2)}°</b></span>
                  <span>Distance: <b className="text-slate-300">{(sun.distance_km / 1e6).toFixed(2)}M km</b></span>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-slate-500 text-xs">
                {isLoading ? 'Computing Sun visibility against lunar terrain...' : 'Click "Evaluate Instant" to compute solar visibility.'}
              </div>
            )}
          </div>

          {/* Mandatory Scientific Disclaimer */}
          <div className="mt-2.5 pt-2 border-t border-[#202228] flex items-start gap-1.5 text-[10px] text-slate-400 leading-tight">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500/80 shrink-0 mt-0.5" />
            <span>
              <b>Scientific Note:</b> Solar visibility and actual electrical power generation are different measurements. Terrain obstruction and solar-panel system parameters have not yet been evaluated.
            </span>
          </div>
        </div>

        {/* Earth Card */}
        <div className="bg-[#141619] border border-[#2b2d32] rounded-xl p-3 font-mono text-xs shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[#2b2d32]">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-slate-200">EARTH DIRECT LINE-OF-SIGHT</span>
              </div>
              {earthBadge && (
                <span className={`px-2 py-0.5 rounded border text-[10px] font-bold flex items-center gap-1 ${earthBadge.bg}`}>
                  <earthBadge.icon className="w-3 h-3" />
                  <span>{earthBadge.label}</span>
                </span>
              )}
            </div>

            {earth ? (
              <div className="mt-2 space-y-2">
                {/* Horizontal plane status */}
                <div className="flex items-center justify-between text-[11px] bg-[#0e1013] px-2.5 py-1.5 rounded-lg border border-[#202228]">
                  <span className="text-slate-400">Geometric Horizon Status:</span>
                  <span className={`font-bold ${earth.elevation_deg >= 0 ? 'text-cyan-300' : 'text-slate-400'}`}>
                    {earth.elevation_deg >= 0 ? 'Earth Above Local Horizontal' : 'Earth Below Local Horizontal'}
                  </span>
                </div>

                {/* Telemetry Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
                  <div className="bg-[#0e1013] p-2 rounded-lg border border-[#202228]">
                    <div className="text-slate-500 text-[10px]">EARTH AZIMUTH</div>
                    <div className="text-slate-200 font-bold">{earth.azimuth_deg.toFixed(2)}°</div>
                  </div>
                  <div className="bg-[#0e1013] p-2 rounded-lg border border-[#202228]">
                    <div className="text-slate-500 text-[10px]">EARTH ELEVATION</div>
                    <div className="text-cyan-400 font-bold">{earth.elevation_deg.toFixed(2)}°</div>
                  </div>
                  <div className="bg-[#0e1013] p-2 rounded-lg border border-[#202228]">
                    <div className="text-slate-500 text-[10px]">SKYLINE ELEVATION</div>
                    <div className="text-emerald-400 font-bold">{earth.horizon_elevation_at_azimuth_deg.toFixed(2)}°</div>
                  </div>
                  <div className="bg-[#0e1013] p-2 rounded-lg border border-[#202228]">
                    <div className="text-slate-500 text-[10px]">UPPER LIMB CLEARANCE</div>
                    <div className={`font-bold ${earth.upper_limb_clearance_deg >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {earth.upper_limb_clearance_deg >= 0 ? '+' : ''}{earth.upper_limb_clearance_deg.toFixed(2)}°
                    </div>
                  </div>
                </div>

                {/* Angular diameter & limb clearances */}
                <div className="text-[10px] text-slate-400 flex flex-wrap justify-between gap-1 px-1">
                  <span>Ang Diameter: <b className="text-slate-300">{(earth.angular_diameter_deg * 60).toFixed(1)}' ({earth.angular_diameter_deg.toFixed(3)}°)</b></span>
                  <span>Lower Limb Clearance: <b className={earth.lower_limb_clearance_deg >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{earth.lower_limb_clearance_deg.toFixed(2)}°</b></span>
                  <span>Light-Time: <b className="text-slate-300">{earth.light_time_seconds.toFixed(2)}s ({Math.round(earth.distance_km).toLocaleString()} km)</b></span>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-slate-500 text-xs">
                {isLoading ? 'Computing Earth visibility against lunar terrain...' : 'Click "Evaluate Instant" to compute Earth visibility.'}
              </div>
            )}
          </div>

          {/* Mandatory Scientific Disclaimer */}
          <div className="mt-2.5 pt-2 border-t border-[#202228] flex items-start gap-1.5 text-[10px] text-slate-400 leading-tight">
            <Radio className="w-3.5 h-3.5 text-cyan-500/80 shrink-0 mt-0.5" />
            <span>
              <b>Scientific Note:</b> Geometric Earth visibility does not guarantee an operational radio link. Terrain obstruction and RF link-budget analysis have not yet been evaluated.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
