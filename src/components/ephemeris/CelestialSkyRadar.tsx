import React, { useMemo } from 'react';
import { CelestialBodyPosition } from '../../types/ephemeris';
import { Compass, Sun, Globe } from 'lucide-react';

interface CelestialSkyRadarProps {
  sun: CelestialBodyPosition | null;
  earth: CelestialBodyPosition | null;
  observerLat: number;
  observerLon: number;
}

export const CelestialSkyRadar: React.FC<CelestialSkyRadarProps> = ({
  sun,
  earth,
}) => {
  const size = 360;
  const center = size / 2;
  const maxRadius = center - 30; // outer boundary circle (-10° elevation)
  const horizonRadius = maxRadius * (90 / 100); // 0° elevation ring

  // Helper to map (azimuth_deg, elevation_deg) to 2D SVG coordinates
  // Zenith (El = +90°) maps to center (r = 0)
  // Horizon (El = 0°) maps to horizonRadius
  // Sub-horizon (El = -10°) maps to maxRadius
  const mapCoords = (azimuthDeg: number, elevationDeg: number) => {
    // Clamped elevation from -10° to +90°
    const clampedEl = Math.max(-10, Math.min(90, elevationDeg));
    // Radial distance: 0 at +90°, horizonRadius at 0°, maxRadius at -10°
    const r = ((90 - clampedEl) / 100) * maxRadius;

    // Azimuth 0° is North (top, y < center)
    // Azimuth 90° is East (right, x > center)
    const rad = (azimuthDeg - 90) * (Math.PI / 180);
    const x = center + r * Math.cos(rad);
    const y = center + r * Math.sin(rad);

    return { x, y, r, isBelowHorizon: elevationDeg < 0 };
  };

  const sunCoords = useMemo(() => {
    if (!sun) return null;
    return mapCoords(sun.azimuth_deg, sun.elevation_deg);
  }, [sun]);

  const earthCoords = useMemo(() => {
    if (!earth) return null;
    return mapCoords(earth.azimuth_deg, earth.elevation_deg);
  }, [earth]);

  return (
    <div className="flex flex-col h-full bg-[#141619] border border-[#2b2d32] rounded-xl p-3 select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#2b2d32] mb-2">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
            LOCAL SKY DOME (TOPOCENTRIC CELESTIAL PROJECTION)
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className="flex items-center gap-1 text-amber-300 font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block shadow-sm"></span>
            Sun ({sun ? (sun.elevation_deg > 0 ? `+${sun.elevation_deg.toFixed(1)}°` : `${sun.elevation_deg.toFixed(1)}°`) : '--'})
          </span>
          <span className="flex items-center gap-1 text-sky-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-sky-400 inline-block shadow-sm"></span>
            Earth ({earth ? (earth.elevation_deg > 0 ? `+${earth.elevation_deg.toFixed(1)}°` : `${earth.elevation_deg.toFixed(1)}°`) : '--'})
          </span>
        </div>
      </div>

      {/* SVG Celestial Local Sky Radar */}
      <div className="flex-1 flex items-center justify-center relative min-h-[300px]">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[340px] h-auto">
          <defs>
            {/* Sun Glow Gradient */}
            <radialGradient id="sunGlowGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="1" />
              <stop offset="40%" stopColor="#f59e0b" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
            </radialGradient>
            {/* Earth Marble Gradient */}
            <radialGradient id="earthGrad" cx="40%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#93c5fd" stopOpacity="1" />
              <stop offset="50%" stopColor="#2563eb" stopOpacity="1" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="1" />
            </radialGradient>
          </defs>

          {/* Sub-horizon dark background ring */}
          <circle cx={center} cy={center} r={maxRadius} fill="#05080e" stroke="#1e293b" strokeWidth="1" />

          {/* 0° Horizon Tangent Plane Reference Circle */}
          <circle
            cx={center}
            cy={center}
            r={horizonRadius}
            fill="#080e18"
            stroke="#10b981"
            strokeWidth="1.5"
            strokeDasharray="4 2"
          />

          {/* Inner Elevation Rings (+30°, +60°) */}
          <circle
            cx={center}
            cy={center}
            r={horizonRadius * (60 / 90)}
            fill="none"
            stroke="#1e293b"
            strokeWidth="1"
            strokeDasharray="2 3"
          />
          <circle
            cx={center}
            cy={center}
            r={horizonRadius * (30 / 90)}
            fill="none"
            stroke="#1e293b"
            strokeWidth="1"
            strokeDasharray="2 3"
          />

          {/* Elevation Ring Labels */}
          <text x={center + 4} y={center - horizonRadius * (30 / 90) + 3} fill="#475569" fontSize="8" fontFamily="monospace">
            +60°
          </text>
          <text x={center + 4} y={center - horizonRadius * (60 / 90) + 3} fill="#475569" fontSize="8" fontFamily="monospace">
            +30°
          </text>
          <text x={center + 4} y={center - horizonRadius + 10} fill="#10b981" fontSize="8" fontFamily="monospace" fontWeight="bold">
            0° (Horizon)
          </text>

          {/* Zenith (Center point) */}
          <circle cx={center} cy={center} r={2} fill="#64748b" />
          <text x={center + 4} y={center + 3} fill="#475569" fontSize="8" fontFamily="monospace">
            Zenith (+90°)
          </text>

          {/* Cardinal Direction Axis Lines */}
          <line x1={center} y1={center - maxRadius} x2={center} y2={center + maxRadius} stroke="#1e293b" strokeWidth="1" />
          <line x1={center - maxRadius} y1={center} x2={center + maxRadius} y2={center} stroke="#1e293b" strokeWidth="1" />

          {/* Cardinal Direction Markers */}
          <text x={center} y={center - maxRadius - 6} fill="#10b981" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
            N (0°)
          </text>
          <text x={center + maxRadius + 14} y={center + 4} fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
            E (90°)
          </text>
          <text x={center} y={center + maxRadius + 16} fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
            S (180°)
          </text>
          <text x={center - maxRadius - 16} y={center + 4} fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
            W (270°)
          </text>

          {/* Sun Celestial Object */}
          {sun && sunCoords && (
            <g>
              {/* Sightline from Observer to Sun */}
              <line
                x1={center}
                y1={center}
                x2={sunCoords.x}
                y2={sunCoords.y}
                stroke="#f59e0b"
                strokeWidth="1.2"
                strokeDasharray="2 2"
                opacity={0.6}
              />
              {/* Outer Radiant Corona */}
              <circle cx={sunCoords.x} cy={sunCoords.y} r={18} fill="url(#sunGlowGrad)" />
              {/* Core Sun Disk */}
              <circle
                cx={sunCoords.x}
                cy={sunCoords.y}
                r={8}
                fill="#fbbf24"
                stroke="#ffffff"
                strokeWidth="1.5"
                opacity={sunCoords.isBelowHorizon ? 0.4 : 1.0}
              />
              {/* Label */}
              <text
                x={sunCoords.x + 12}
                y={sunCoords.y + 4}
                fill="#fde047"
                fontSize="10"
                fontFamily="monospace"
                fontWeight="bold"
              >
                SUN ({sun.elevation_deg > 0 ? `+${sun.elevation_deg.toFixed(1)}°` : `${sun.elevation_deg.toFixed(1)}°`})
              </text>
            </g>
          )}

          {/* Earth Celestial Object */}
          {earth && earthCoords && (
            <g>
              {/* Sightline from Observer to Earth */}
              <line
                x1={center}
                y1={center}
                x2={earthCoords.x}
                y2={earthCoords.y}
                stroke="#38bdf8"
                strokeWidth="1.2"
                strokeDasharray="2 2"
                opacity={0.6}
              />
              {/* Earth Atmosphere Glow */}
              <circle cx={earthCoords.x} cy={earthCoords.y} r={14} fill="#38bdf8" opacity={0.2} />
              {/* Core Earth Marble Disk */}
              <circle
                cx={earthCoords.x}
                cy={earthCoords.y}
                r={9}
                fill="url(#earthGrad)"
                stroke="#93c5fd"
                strokeWidth="1.5"
                opacity={earthCoords.isBelowHorizon ? 0.4 : 1.0}
              />
              {/* Label */}
              <text
                x={earthCoords.x + 12}
                y={earthCoords.y + 4}
                fill="#7dd3fc"
                fontSize="10"
                fontFamily="monospace"
                fontWeight="bold"
              >
                EARTH ({earth.elevation_deg > 0 ? `+${earth.elevation_deg.toFixed(1)}°` : `${earth.elevation_deg.toFixed(1)}°`})
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Quick Visual Guide for Normal Users */}
      <div className="shrink-0 flex items-center justify-between text-[10px] font-mono bg-slate-900/60 px-2.5 py-1 rounded-lg border border-[#2b2d32] text-slate-400 mb-1.5 flex-wrap gap-1">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full border border-dashed border-emerald-400"></span>
          Green Circle = Horizon (0°)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          Center = Overhead (Zenith, 90°)
        </span>
        <span className="flex items-center gap-1 text-slate-500">
          Dark outer rim = Below ground
        </span>
      </div>

      {/* Footer Quick Telemetry */}
      <div className="shrink-0 flex items-center justify-between text-[11px] font-mono bg-[#0e1013] px-3 py-1.5 rounded-lg border border-[#2b2d32]">
        <div className="flex items-center gap-1.5 text-amber-300">
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          <span>Az {sun?.azimuth_deg.toFixed(1)}°</span>
          <span className="text-slate-500">|</span>
          <span>El {sun ? (sun.elevation_deg > 0 ? `+${sun.elevation_deg.toFixed(2)}°` : `${sun.elevation_deg.toFixed(2)}°`) : '--'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sky-300">
          <Globe className="w-3.5 h-3.5 text-sky-400" />
          <span>Az {earth?.azimuth_deg.toFixed(1)}°</span>
          <span className="text-slate-500">|</span>
          <span>El {earth ? (earth.elevation_deg > 0 ? `+${earth.elevation_deg.toFixed(2)}°` : `${earth.elevation_deg.toFixed(2)}°`) : '--'}</span>
        </div>
      </div>
    </div>
  );
};
