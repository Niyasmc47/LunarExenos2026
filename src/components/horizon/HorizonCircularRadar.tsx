import React, { useMemo } from 'react';
import { HorizonAnalysisResponse, HorizonPoint } from '../../types/horizon';
import { Compass, Eye } from 'lucide-react';

interface HorizonCircularRadarProps {
  data: HorizonAnalysisResponse | null;
  hoveredPoint: HorizonPoint | null;
  onHoverPoint: (pt: HorizonPoint | null) => void;
}

export const HorizonCircularRadar: React.FC<HorizonCircularRadarProps> = ({
  data,
  hoveredPoint,
  onHoverPoint,
}) => {
  const size = 380;
  const center = size / 2;
  const radius = center - 35; // outer circle radius

  // Map elevation angles to radial distance
  // Minimum mapped elevation: -5°, Maximum mapped elevation: max_elevation + 5° (or 25°)
  const { minElev, maxElev, pointsString } = useMemo(() => {
    if (!data || data.horizon_profile.length === 0) {
      return { minElev: -5, maxElev: 25, pointsString: '' };
    }

    const maxVal = Math.max(15, Math.ceil(data.summary.max_horizon_elevation_deg / 5) * 5);
    const minVal = Math.min(0, Math.floor(data.summary.min_horizon_elevation_deg / 5) * 5);

    let maxAng = -999;

    // Build SVG polygon points
    // Azimuth 0° is North (top, y < center)
    // Azimuth 90° is East (right, x > center)
    // Math angle from +X axis: phi = (azimuth - 90) * (pi / 180)
    const pts = data.horizon_profile.map((p) => {
      if (p.horizon_elevation_deg > maxAng) {
        maxAng = p.horizon_elevation_deg;
      }

      // Normalized elevation ratio: 0 at minVal, 1 at maxVal
      // Base horizon radius at 0° is r0
      const norm = Math.max(0, Math.min(1, (p.horizon_elevation_deg - minVal) / (maxVal - minVal)));
      const r = 25 + norm * (radius - 25);

      const rad = (p.azimuth_deg - 90) * (Math.PI / 180);
      const x = center + r * Math.cos(rad);
      const y = center + r * Math.sin(rad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return {
      minElev: minVal,
      maxElev: maxVal,
      pointsString: pts.join(' '),
    };
  }, [data, center, radius]);

  // Zero-degree horizontal plane reference radius
  const zeroPlaneRadius = useMemo(() => {
    const norm = Math.max(0, Math.min(1, (0 - minElev) / (maxElev - minElev)));
    return 25 + norm * (radius - 25);
  }, [minElev, maxElev, radius]);

  // Cursor ray calculation for hovered point
  const hoverCoords = useMemo(() => {
    if (!hoveredPoint) return null;
    const rad = (hoveredPoint.azimuth_deg - 90) * (Math.PI / 180);
    const norm = Math.max(0, Math.min(1, (hoveredPoint.horizon_elevation_deg - minElev) / (maxElev - minElev)));
    const r = 25 + norm * (radius - 25);
    return {
      x: center + r * Math.cos(rad),
      y: center + r * Math.sin(rad),
      outerX: center + radius * Math.cos(rad),
      outerY: center + radius * Math.sin(rad),
    };
  }, [hoveredPoint, center, minElev, maxElev, radius]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!data || data.horizon_profile.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - center;
    const y = e.clientY - rect.top - center;

    // Angle in degrees clockwise from top (North)
    let deg = (Math.atan2(y, x) * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;

    // Find closest point in profile
    let closest = data.horizon_profile[0];
    let minDiff = 999;
    for (const p of data.horizon_profile) {
      const diff = Math.abs(p.azimuth_deg - deg);
      if (diff < minDiff) {
        minDiff = diff;
        closest = p;
      }
    }
    onHoverPoint(closest);
  };

  return (
    <div className="flex flex-col h-full bg-[#0c121e]/90 border border-slate-800 rounded-xl p-3 select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-2">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
            360° TERRAIN HORIZON SKYLINE (POLAR RADAR)
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
            Skyline
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-slate-600 inline-block"></span>
            0° Horizontal
          </span>
        </div>
      </div>

      {/* SVG Polar Radar Display */}
      <div className="flex-1 flex items-center justify-center relative min-h-[300px]">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full max-w-[360px] h-auto cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => onHoverPoint(null)}
        >
          <defs>
            <radialGradient id="skylineGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.05" />
              <stop offset="70%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.5" />
            </radialGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Concentric Background Grid Rings */}
          <circle cx={center} cy={center} r={radius} fill="#05080e" stroke="#1e293b" strokeWidth="1.5" />
          <circle
            cx={center}
            cy={center}
            r={zeroPlaneRadius}
            fill="none"
            stroke="#334155"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* Elevation Rings Labels */}
          <text x={center + 4} y={center - zeroPlaneRadius - 3} fill="#64748b" fontSize="8" fontFamily="monospace">
            0° (Tangent)
          </text>
          <text x={center + 4} y={center - radius + 12} fill="#64748b" fontSize="8" fontFamily="monospace">
            +{maxElev}°
          </text>

          {/* Cardinal Direction Rays and Labels */}
          {/* North */}
          <line x1={center} y1={center - radius} x2={center} y2={center + radius} stroke="#1e293b" strokeWidth="1" />
          {/* East-West */}
          <line x1={center - radius} y1={center} x2={center + radius} y2={center} stroke="#1e293b" strokeWidth="1" />
          {/* Diagonal Guides */}
          <line
            x1={center - radius * 0.707}
            y1={center - radius * 0.707}
            x2={center + radius * 0.707}
            y2={center + radius * 0.707}
            stroke="#162032"
            strokeWidth="0.8"
            strokeDasharray="2 4"
          />
          <line
            x1={center - radius * 0.707}
            y1={center + radius * 0.707}
            x2={center + radius * 0.707}
            y2={center - radius * 0.707}
            stroke="#162032"
            strokeWidth="0.8"
            strokeDasharray="2 4"
          />

          {/* Cardinal Markers */}
          <text x={center} y={center - radius - 8} fill="#10b981" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
            N (0°)
          </text>
          <text x={center + radius + 14} y={center + 4} fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
            E (90°)
          </text>
          <text x={center} y={center + radius + 16} fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
            S (180°)
          </text>
          <text x={center - radius - 16} y={center + 4} fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
            W (270°)
          </text>

          {/* Polygon Filled Skyline */}
          {pointsString && (
            <polygon
              points={pointsString}
              fill="url(#skylineGrad)"
              stroke="#10b981"
              strokeWidth="2"
              filter="url(#glow)"
            />
          )}

          {/* Observer Center Pin */}
          <circle cx={center} cy={center} r={4} fill="#059669" stroke="#34d399" strokeWidth="1.5" />
          <circle cx={center} cy={center} r={1.5} fill="#ffffff" />

          {/* Hover Azimuth Ray */}
          {hoverCoords && hoveredPoint && (
            <g>
              <line
                x1={center}
                y1={center}
                x2={hoverCoords.outerX}
                y2={hoverCoords.outerY}
                stroke="#38bdf8"
                strokeWidth="1.5"
                strokeDasharray="3 2"
              />
              <circle
                cx={hoverCoords.x}
                cy={hoverCoords.y}
                r={4.5}
                fill="#38bdf8"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            </g>
          )}
        </svg>

        {/* Hover Inspector Floating Overlay */}
        {hoveredPoint && (
          <div className="absolute top-2 right-2 bg-[#070b12]/95 border border-sky-500/40 px-2.5 py-1.5 rounded-lg shadow-xl text-left pointer-events-none text-xs font-mono">
            <div className="text-[10px] text-sky-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Eye className="w-3 h-3" />
              Azimuth {hoveredPoint.azimuth_deg.toFixed(1)}°
            </div>
            <div className="text-slate-100 font-bold mt-0.5">
              Skyline Elev:{' '}
              <span className={hoveredPoint.horizon_elevation_deg >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                {hoveredPoint.horizon_elevation_deg > 0 ? '+' : ''}
                {hoveredPoint.horizon_elevation_deg.toFixed(2)}°
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              Obstacle Dist: {(hoveredPoint.distance_to_horizon_m / 1000).toFixed(2)} km
            </div>
            <div className="text-[10px] text-slate-500">
              Terrain Alt: {hoveredPoint.horizon_surface_elevation_m.toFixed(0)} m
            </div>
          </div>
        )}
      </div>

      {/* Footer Quick Telemetry */}
      {data && (
        <div className="shrink-0 flex items-center justify-between text-[11px] font-mono bg-[#070b12] px-3 py-1.5 rounded-lg border border-slate-800">
          <div className="text-slate-400">
            Max Skyline:{' '}
            <span className="text-emerald-400 font-bold">
              +{data.summary.max_horizon_elevation_deg.toFixed(1)}°
            </span>{' '}
            at {data.summary.max_horizon_azimuth_deg.toFixed(0)}°
          </div>
          <div className="text-slate-400">
            Mean:{' '}
            <span className="text-slate-200">
              {data.summary.mean_horizon_elevation_deg > 0 ? '+' : ''}
              {data.summary.mean_horizon_elevation_deg.toFixed(1)}°
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
