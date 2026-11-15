import React from 'react';
import { CelestialBodyPosition } from '../../types/ephemeris';
import { Sun, Globe, Eye, EyeOff, Radio, Orbit, Clock } from 'lucide-react';

interface CelestialBodyCardProps {
  body: CelestialBodyPosition | null;
  type: 'Sun' | 'Earth';
}

function getCompassDirection(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return 'North (N)';
  if (normalized < 67.5) return 'North-East (NE)';
  if (normalized < 112.5) return 'East (E)';
  if (normalized < 157.5) return 'South-East (SE)';
  if (normalized < 202.5) return 'South (S)';
  if (normalized < 247.5) return 'South-West (SW)';
  if (normalized < 292.5) return 'West (W)';
  return 'North-West (NW)';
}

function getElevationDescription(deg: number): string {
  if (deg < -5) return 'Far Below Horizon (Deep Shadow)';
  if (deg < 0) return 'Just Below Horizon (Grazing Shadow)';
  if (deg < 2) return 'Low Skimming Sun (Touching Ridge Crests)';
  if (deg < 10) return 'Low on Lunar Horizon';
  if (deg < 30) return 'Moderate Elevation';
  return 'High Overhead';
}

export const CelestialBodyCard: React.FC<CelestialBodyCardProps> = ({ body, type }) => {
  const isSun = type === 'Sun';
  const isVisible = body ? body.elevation_deg >= 0 : false;

  return (
    <div className="flex flex-col bg-[#141619] border border-[#2b2d32] rounded-xl p-3 text-xs font-mono shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#2b2d32]">
        <div className="flex items-center gap-2">
          {isSun ? (
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <Sun className="w-4 h-4 text-amber-400" />
            </div>
          ) : (
            <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30">
              <Globe className="w-4 h-4 text-sky-400" />
            </div>
          )}
          <div>
            <div className="font-bold text-slate-100 uppercase tracking-wider text-xs">
              {isSun ? 'Sun (Solar Position)' : 'Earth (Topocentric Geometry)'}
            </div>
            <div className="text-[10px] text-slate-400">
              {isSun ? 'Geometric direction & elevation above local horizontal' : 'Topocentric line-of-sight & apparent disk'}
            </div>
          </div>
        </div>

        {/* Above vs Below Local Horizontal Tag */}
        {body && (
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 border ${
              isVisible
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                : 'bg-rose-500/15 text-rose-400 border-rose-500/40'
            }`}
          >
            {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {isVisible ? 'ABOVE LOCAL HORIZONTAL' : 'BELOW LOCAL HORIZONTAL'}
          </span>
        )}
      </div>

      {/* Primary Coordinates Grid */}
      {body ? (
        <div className="space-y-2 mt-2">
          {/* Plain-English Scientific Status Banner */}
          <div
            className={`p-2.5 rounded-lg border flex flex-col gap-1.5 ${
              isVisible
                ? isSun
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-900/80 border-[#2b2d32] text-slate-400'
            }`}
          >
            <div className="flex items-center gap-2">
              {isSun ? (
                <Sun className={`w-4 h-4 shrink-0 ${isVisible ? 'text-amber-400' : 'text-slate-500'}`} />
              ) : (
                <Globe className={`w-4 h-4 shrink-0 ${isVisible ? 'text-emerald-400' : 'text-rose-400'}`} />
              )}
              <div className="font-bold text-[11px]">
                {isSun
                  ? isVisible
                    ? '☀️ Sun Above Local Horizontal'
                    : '🌑 Sun Below Local Horizontal'
                  : isVisible
                  ? '📡 Earth Above Local Horizontal'
                  : '🚫 Earth Below Local Horizontal'}
              </div>
            </div>
            <div className="text-[9.5px] opacity-85 leading-tight bg-black/30 p-1.5 rounded border border-white/5">
              {isSun
                ? 'Solar visibility and actual electrical power generation are different measurements. Terrain obstruction and solar-panel system parameters have not yet been evaluated.'
                : 'Geometric Earth visibility does not guarantee an operational radio link. Terrain obstruction and RF link-budget analysis have not yet been evaluated.'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 bg-[#0e1013] p-2 rounded-lg border border-[#2b2d32]">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                WHERE TO LOOK (COMPASS)
              </span>
              <div className="text-white font-bold text-sm mt-0.5">
                {body.azimuth_deg.toFixed(1)}°
              </div>
              <div className="text-[10px] text-emerald-400 font-semibold">
                {getCompassDirection(body.azimuth_deg)}
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                HEIGHT IN SKY (ELEVATION)
              </span>
              <div
                className={`font-bold text-sm mt-0.5 ${
                  body.elevation_deg >= 0 ? (isSun ? 'text-amber-400' : 'text-sky-400') : 'text-rose-400'
                }`}
              >
                {body.elevation_deg > 0 ? '+' : ''}
                {body.elevation_deg.toFixed(2)}°
              </div>
              <div className="text-[10px] text-slate-400">
                {getElevationDescription(body.elevation_deg)}
              </div>
            </div>
          </div>

          {/* Distance & Angular Size */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-[#0e1013] p-2 rounded-lg border border-[#2b2d32]">
              <span className="text-[10px] text-slate-500 flex items-center gap-1 font-semibold">
                <Orbit className="w-3 h-3 text-slate-400" />
                DISTANCE FROM LANDER
              </span>
              <div className="text-slate-200 font-bold mt-0.5">
                {isSun
                  ? `${(body.distance_km / 149597870.7).toFixed(4)} AU`
                  : `${Math.round(body.distance_km).toLocaleString()} km`}
              </div>
              <div className="text-[9px] text-slate-500">
                {isSun ? `${Math.round(body.distance_km).toLocaleString()} km` : `~30 Earth diameters`}
              </div>
            </div>

            <div className="bg-[#0e1013] p-2 rounded-lg border border-[#2b2d32]">
              <span className="text-[10px] text-slate-500 flex items-center gap-1 font-semibold">
                <Radio className="w-3 h-3 text-slate-400" />
                APPARENT SIZE IN SKY
              </span>
              <div className="text-slate-200 font-bold mt-0.5">
                {body.apparent_angular_diameter_deg.toFixed(3)}°
              </div>
              <div className="text-[9px] text-slate-500">
                {isSun ? `~0.5° (matches Earth view)` : `~3.7× larger than Moon in Earth sky`}
              </div>
            </div>
          </div>

          {/* Light-time Travel */}
          <div className="flex items-center justify-between bg-[#0e1013] px-2.5 py-1.5 rounded-lg border border-[#2b2d32] text-[10px]">
            <span className="text-slate-500 flex items-center gap-1 font-semibold">
              <Clock className="w-3 h-3 text-slate-400" />
              Radio / Light Speed Delay:
            </span>
            <span className="text-slate-300 font-bold">
              {isSun
                ? `${(body.light_time_seconds / 60).toFixed(1)} minutes`
                : `${body.light_time_seconds.toFixed(2)} seconds round-trip delay ~${(body.light_time_seconds * 2).toFixed(2)}s`}
            </span>
          </div>
        </div>
      ) : (
        <div className="py-6 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
          <div className="w-5 h-5 border-2 border-emerald-500/40 border-t-emerald-400 rounded-full animate-spin"></div>
          <span>Computing celestial position...</span>
        </div>
      )}
    </div>
  );
};
