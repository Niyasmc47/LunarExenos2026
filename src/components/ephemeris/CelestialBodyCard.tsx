import React from 'react';
import { CelestialBodyPosition } from '../../types/ephemeris';
import { Sun, Globe, Eye, EyeOff, Radio, Orbit, Clock } from 'lucide-react';

interface CelestialBodyCardProps {
  body: CelestialBodyPosition | null;
  type: 'Sun' | 'Earth';
}

export const CelestialBodyCard: React.FC<CelestialBodyCardProps> = ({ body, type }) => {
  const isSun = type === 'Sun';
  const isVisible = body ? body.elevation_deg >= 0 : false;

  return (
    <div className="flex flex-col bg-[#0c121e]/90 border border-slate-800 rounded-xl p-3 text-xs font-mono">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          {isSun ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Globe className="w-4 h-4 text-sky-400" />
          )}
          <span className="font-bold text-slate-200 uppercase tracking-wider">
            {isSun ? 'SUN APPARENT POSITION' : 'EARTH APPARENT POSITION'}
          </span>
        </div>

        {/* Above vs Below Horizon Tag */}
        {body && (
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border ${
              isVisible
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}
          >
            {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {isVisible ? 'ABOVE HORIZON' : 'BELOW HORIZON'}
          </span>
        )}
      </div>

      {/* Primary Coordinates Grid */}
      {body ? (
        <div className="space-y-2 mt-2">
          <div className="grid grid-cols-2 gap-2 bg-[#070b12] p-2 rounded-lg border border-slate-800">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                TOPOCENTRIC AZIMUTH
              </span>
              <div className="text-white font-bold text-sm mt-0.5">
                {body.azimuth_deg.toFixed(2)}°
              </div>
              <div className="text-[9px] text-slate-400">
                {body.azimuth_deg < 45 || body.azimuth_deg >= 315
                  ? 'North Quadrant'
                  : body.azimuth_deg < 135
                  ? 'East Quadrant'
                  : body.azimuth_deg < 225
                  ? 'South Quadrant'
                  : 'West Quadrant'}
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                TOPOCENTRIC ELEVATION
              </span>
              <div
                className={`font-bold text-sm mt-0.5 ${
                  body.elevation_deg >= 0 ? (isSun ? 'text-amber-400' : 'text-sky-400') : 'text-rose-400'
                }`}
              >
                {body.elevation_deg > 0 ? '+' : ''}
                {body.elevation_deg.toFixed(3)}°
              </div>
              <div className="text-[9px] text-slate-400">
                Above Local Tangent Plane
              </div>
            </div>
          </div>

          {/* Distance & Angular Size */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-[#070b12] p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Orbit className="w-3 h-3 text-slate-400" />
                OBSERVER DISTANCE
              </span>
              <div className="text-slate-200 font-bold mt-0.5">
                {isSun
                  ? `${(body.distance_km / 149597870.7).toFixed(4)} AU`
                  : `${(body.distance_km / 1000).toFixed(1)}k km`}
              </div>
              <div className="text-[9px] text-slate-500">
                {body.distance_km.toLocaleString()} km
              </div>
            </div>

            <div className="bg-[#070b12] p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Radio className="w-3 h-3 text-slate-400" />
                ANGULAR DIAMETER
              </span>
              <div className="text-slate-200 font-bold mt-0.5">
                {body.apparent_angular_diameter_deg.toFixed(4)}°
              </div>
              <div className="text-[9px] text-slate-500">
                {(body.apparent_angular_diameter_deg * 60).toFixed(1)} arcminutes
              </div>
            </div>
          </div>

          {/* Light-time Travel */}
          <div className="flex items-center justify-between bg-[#070b12] px-2.5 py-1.5 rounded-lg border border-slate-800 text-[10px]">
            <span className="text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              One-way Light Travel Time:
            </span>
            <span className="text-slate-300 font-bold">
              {isSun
                ? `${(body.light_time_seconds / 60).toFixed(2)} min (${body.light_time_seconds.toFixed(1)} s)`
                : `${body.light_time_seconds.toFixed(3)} s`}
            </span>
          </div>
        </div>
      ) : (
        <div className="py-6 text-center text-slate-500 text-xs">
          Computing celestial position...
        </div>
      )}
    </div>
  );
};
