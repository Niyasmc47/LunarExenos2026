import React, { useState, useMemo } from 'react';
import { Eye } from 'lucide-react';
import { useVisibilityStore } from '../../stores/visibilityStore';

export const LocalSkyHorizonChart: React.FC = () => {
  const instantData = useVisibilityStore((state) => state.instantData);
  const analysisData = useVisibilityStore((state) => state.analysisData);

  const [viewMode, setViewMode] = useState<'panoramic' | 'polar'>('panoramic');
  const [hoveredAzimuth, setHoveredAzimuth] = useState<number | null>(null);

  // Profile data from instantData or analysisData
  const profile = useMemo(() => {
    if (instantData?.horizon_profile && instantData.horizon_profile.length > 0) {
      return instantData.horizon_profile;
    }
    if (analysisData?.horizon_profile && analysisData.horizon_profile.length > 0) {
      return analysisData.horizon_profile;
    }
    return [];
  }, [instantData, analysisData]);

  const sun = instantData?.sun;
  const earth = instantData?.earth;

  // Chart bounds for panoramic view
  const width = 800;
  const height = 260;
  const padding = { top: 25, right: 30, bottom: 35, left: 45 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  // Compute elevation min/max
  const { minElev, maxElev } = useMemo(() => {
    let minE = -5;
    let maxE = 25;
    if (profile.length > 0) {
      for (const p of profile) {
        if (p.horizon_elevation_deg < minE) minE = p.horizon_elevation_deg;
        if (p.horizon_elevation_deg > maxE) maxE = p.horizon_elevation_deg;
      }
    }
    if (sun) {
      if (sun.elevation_deg + sun.angular_radius_deg > maxE) maxE = sun.elevation_deg + sun.angular_radius_deg;
      if (sun.elevation_deg - sun.angular_radius_deg < minE) minE = sun.elevation_deg - sun.angular_radius_deg;
    }
    if (earth) {
      if (earth.elevation_deg + earth.angular_radius_deg > maxE) maxE = earth.elevation_deg + earth.angular_radius_deg;
      if (earth.elevation_deg - earth.angular_radius_deg < minE) minE = earth.elevation_deg - earth.angular_radius_deg;
    }
    return {
      minElev: Math.floor(minE - 2),
      maxElev: Math.ceil(maxE + 3),
    };
  }, [profile, sun, earth]);

  const xToAz = (x: number) => ((x - padding.left) / plotWidth) * 360;
  const azToX = (az: number) => padding.left + (az / 360) * plotWidth;
  const elToY = (el: number) => padding.top + ((maxElev - el) / (maxElev - minElev)) * plotHeight;

  // Build SVG path for skyline
  const skylinePath = useMemo(() => {
    if (profile.length === 0) return '';
    return profile
      .map((p, idx) => {
        const x = azToX(p.azimuth_deg);
        const y = elToY(p.horizon_elevation_deg);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [profile, maxElev, minElev]);

  // Shaded terrain area polygon (from skyline down to bottom)
  const terrainPolygon = useMemo(() => {
    if (profile.length === 0) return '';
    const bottomY = elToY(minElev);
    const startX = azToX(0);
    const endX = azToX(360);
    return `${skylinePath} L ${endX.toFixed(1)} ${bottomY.toFixed(1)} L ${startX.toFixed(1)} ${bottomY.toFixed(1)} Z`;
  }, [skylinePath, minElev, maxElev]);

  const yZero = elToY(0);

  // Polar coordinates calculation
  const polarCenter = 160;
  const polarRadius = 135;
  const maxPolarElev = Math.max(30, maxElev);

  const azElToPolar = (az: number, el: number) => {
    const r = polarRadius * Math.max(0, (maxPolarElev - el) / (maxPolarElev - minElev));
    // 0 deg Azimuth is North (top)
    const angleRad = ((az - 90) * Math.PI) / 180;
    return {
      x: polarCenter + r * Math.cos(angleRad),
      y: polarCenter + r * Math.sin(angleRad),
    };
  };

  const polarSkylinePath = useMemo(() => {
    if (profile.length === 0) return '';
    return (
      profile
        .map((p, idx) => {
          const pt = azElToPolar(p.azimuth_deg, p.horizon_elevation_deg);
          return `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
        })
        .join(' ') + ' Z'
    );
  }, [profile, minElev, maxPolarElev]);

  return (
    <div className="bg-[#141619] border border-[#2b2d32] rounded-xl p-3 font-mono text-xs shadow-lg space-y-2">
      {/* Header with Mode Switcher */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[#2b2d32]">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-slate-200">
            LOCAL SKY HORIZON SKYLINE & CELESTIAL PROJECTION
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-[#303238]">
            {profile.length > 0 ? `${profile.length} Azimuth Rays` : '360° Profile'}
          </span>
        </div>

        <div className="flex items-center gap-1 bg-[#0e1013] p-0.5 rounded-lg border border-[#2b2d32]">
          <button
            onClick={() => setViewMode('panoramic')}
            className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all ${
              viewMode === 'panoramic'
                ? 'bg-emerald-500 text-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            PANORAMIC (0°–360°)
          </button>
          <button
            onClick={() => setViewMode('polar')}
            className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all ${
              viewMode === 'polar'
                ? 'bg-emerald-500 text-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            POLAR SKY DOME
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      {viewMode === 'panoramic' ? (
        <div className="relative w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto select-none overflow-visible"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const svgX = ((e.clientX - rect.left) / rect.width) * width;
              if (svgX >= padding.left && svgX <= width - padding.right) {
                setHoveredAzimuth(Math.round(xToAz(svgX)));
              }
            }}
            onMouseLeave={() => setHoveredAzimuth(null)}
          >
            <defs>
              <linearGradient id="terrainGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                <stop offset="60%" stopColor="#064e3b" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#022c22" stopOpacity="0.95" />
              </linearGradient>

              <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity="1" />
                <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#d97706" stopOpacity="0.3" />
              </radialGradient>

              <radialGradient id="earthGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="1" />
                <stop offset="60%" stopColor="#0284c7" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#0369a1" stopOpacity="0.3" />
              </radialGradient>
            </defs>

            {/* Background Sky */}
            <rect
              x={padding.left}
              y={padding.top}
              width={plotWidth}
              height={plotHeight}
              fill="#060a12"
              stroke="#1e293b"
              strokeWidth="1"
            />

            {/* Horizontal Grid lines */}
            {[0, 5, 10, 15, 20, 25].map((el) => {
              if (el < minElev || el > maxElev) return null;
              const y = elToY(el);
              return (
                <g key={el}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke={el === 0 ? '#38bdf8' : '#1e293b'}
                    strokeDasharray={el === 0 ? '4 3' : '2 2'}
                    strokeWidth={el === 0 ? 1.2 : 0.8}
                    strokeOpacity={el === 0 ? 0.8 : 0.5}
                  />
                  <text
                    x={padding.left - 6}
                    y={y + 3}
                    textAnchor="end"
                    fill={el === 0 ? '#38bdf8' : '#64748b'}
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {el > 0 ? `+${el}°` : `${el}°`}
                  </text>
                </g>
              );
            })}

            {/* Azimuth Vertical Grid lines (0, 90, 180, 270, 360) */}
            {[
              { az: 0, label: 'N (0°)' },
              { az: 45, label: 'NE' },
              { az: 90, label: 'E (90°)' },
              { az: 135, label: 'SE' },
              { az: 180, label: 'S (180°)' },
              { az: 225, label: 'SW' },
              { az: 270, label: 'W (270°)' },
              { az: 315, label: 'NW' },
              { az: 360, label: 'N (360°)' },
            ].map((col) => {
              const x = azToX(col.az);
              return (
                <g key={col.az}>
                  <line
                    x1={x}
                    y1={padding.top}
                    x2={x}
                    y2={height - padding.bottom}
                    stroke="#1e293b"
                    strokeWidth="0.8"
                    strokeDasharray="2 2"
                  />
                  <text
                    x={x}
                    y={height - padding.bottom + 14}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {col.label}
                  </text>
                </g>
              );
            })}

            {/* Shaded Terrain Profile */}
            {profile.length > 0 && (
              <>
                <path d={terrainPolygon} fill="url(#terrainGradient)" />
                <path d={skylinePath} fill="none" stroke="#34d399" strokeWidth="2" />
              </>
            )}

            {/* 0° Local Tangent Horizon Label */}
            <text
              x={width - padding.right - 4}
              y={yZero - 4}
              textAnchor="end"
              fill="#38bdf8"
              fontSize="8"
              fontFamily="monospace"
              opacity="0.8"
            >
              0° Tangent Plane
            </text>

            {/* Sun Disk Representation */}
            {sun && (
              <g>
                {/* Vertical projection drop line */}
                <line
                  x1={azToX(sun.azimuth_deg)}
                  y1={elToY(sun.elevation_deg)}
                  x2={azToX(sun.azimuth_deg)}
                  y2={elToY(sun.horizon_elevation_at_azimuth_deg)}
                  stroke="#f59e0b"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  strokeOpacity="0.7"
                />

                {/* Sun Disk Circle */}
                <circle
                  cx={azToX(sun.azimuth_deg)}
                  cy={elToY(sun.elevation_deg)}
                  r={Math.max(8, (sun.angular_radius_deg / (maxElev - minElev)) * plotHeight)}
                  fill="url(#sunGlow)"
                  stroke={sun.visibility_state === 'FULLY_OBSTRUCTED' ? '#ef4444' : '#f59e0b'}
                  strokeWidth={sun.visibility_state === 'FULLY_OBSTRUCTED' ? 2 : 1}
                  className="transition-all duration-300"
                />

                {/* Sun Label */}
                <text
                  x={azToX(sun.azimuth_deg)}
                  y={elToY(sun.elevation_deg) - 12}
                  textAnchor="middle"
                  fill="#fcd34d"
                  fontSize="9"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  SUN ({sun.visible_percentage.toFixed(0)}%)
                </text>
              </g>
            )}

            {/* Earth Disk Representation */}
            {earth && (
              <g>
                {/* Vertical projection drop line */}
                <line
                  x1={azToX(earth.azimuth_deg)}
                  y1={elToY(earth.elevation_deg)}
                  x2={azToX(earth.azimuth_deg)}
                  y2={elToY(earth.horizon_elevation_at_azimuth_deg)}
                  stroke="#38bdf8"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  strokeOpacity="0.7"
                />

                {/* Earth Disk Circle */}
                <circle
                  cx={azToX(earth.azimuth_deg)}
                  cy={elToY(earth.elevation_deg)}
                  r={Math.max(10, (earth.angular_radius_deg / (maxElev - minElev)) * plotHeight)}
                  fill="url(#earthGlow)"
                  stroke={earth.visibility_state === 'FULLY_OBSTRUCTED' ? '#ef4444' : '#38bdf8'}
                  strokeWidth={earth.visibility_state === 'FULLY_OBSTRUCTED' ? 2 : 1}
                  className="transition-all duration-300"
                />

                {/* Earth Label */}
                <text
                  x={azToX(earth.azimuth_deg)}
                  y={elToY(earth.elevation_deg) - 14}
                  textAnchor="middle"
                  fill="#7dd3fc"
                  fontSize="9"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  EARTH ({earth.visible_percentage.toFixed(0)}%)
                </text>
              </g>
            )}

            {/* Interactive Hover Indicator */}
            {hoveredAzimuth !== null && (
              <g>
                <line
                  x1={azToX(hoveredAzimuth)}
                  y1={padding.top}
                  x2={azToX(hoveredAzimuth)}
                  y2={height - padding.bottom}
                  stroke="#10b981"
                  strokeWidth="1"
                  strokeDasharray="1 1"
                />
                <circle
                  cx={azToX(hoveredAzimuth)}
                  cy={elToY(profile[hoveredAzimuth]?.horizon_elevation_deg ?? 0)}
                  r="3.5"
                  fill="#10b981"
                />
              </g>
            )}
          </svg>
        </div>
      ) : (
        /* Polar Sky Dome View */
        <div className="flex justify-center items-center py-2">
          <svg viewBox="0 0 320 320" className="w-72 h-72 select-none">
            <defs>
              <radialGradient id="polarSkyGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#020617" />
              </radialGradient>
            </defs>

            {/* Polar Sky Background */}
            <circle cx={polarCenter} cy={polarCenter} r={polarRadius} fill="url(#polarSkyGrad)" stroke="#334155" strokeWidth="1" />

            {/* Concentric Elevation Circles: 0°, 10°, 20° */}
            {[0, 10, 20].map((el) => {
              const r = polarRadius * ((maxPolarElev - el) / (maxPolarElev - minElev));
              if (r <= 0 || r > polarRadius) return null;
              return (
                <circle
                  key={el}
                  cx={polarCenter}
                  cy={polarCenter}
                  r={r}
                  fill="none"
                  stroke="#1e293b"
                  strokeDasharray={el === 0 ? 'none' : '2 2'}
                  strokeWidth="1"
                />
              );
            })}

            {/* Cardinal Radii */}
            {[0, 90, 180, 270].map((az) => {
              const pt = azElToPolar(az, minElev);
              return (
                <line
                  key={az}
                  x1={polarCenter}
                  y1={polarCenter}
                  x2={pt.x}
                  y2={pt.y}
                  stroke="#1e293b"
                  strokeWidth="0.8"
                />
              );
            })}

            {/* Labels N, E, S, W */}
            <text x={polarCenter} y={15} textAnchor="middle" fill="#34d399" fontSize="10" fontWeight="bold">N (0°)</text>
            <text x={310} y={polarCenter + 3} textAnchor="end" fill="#94a3b8" fontSize="9">E (90°)</text>
            <text x={polarCenter} y={315} textAnchor="middle" fill="#94a3b8" fontSize="9">S (180°)</text>
            <text x={10} y={polarCenter + 3} textAnchor="start" fill="#94a3b8" fontSize="9">W (270°)</text>

            {/* Polar Terrain Skyline Polygon */}
            {profile.length > 0 && (
              <path
                d={polarSkylinePath}
                fill="#10b981"
                fillOpacity="0.25"
                stroke="#34d399"
                strokeWidth="1.5"
              />
            )}

            {/* Sun in Polar Dome */}
            {sun && (
              <circle
                cx={azElToPolar(sun.azimuth_deg, sun.elevation_deg).x}
                cy={azElToPolar(sun.azimuth_deg, sun.elevation_deg).y}
                r="7"
                fill="#f59e0b"
                stroke="#fff"
                strokeWidth="1"
              />
            )}

            {/* Earth in Polar Dome */}
            {earth && (
              <circle
                cx={azElToPolar(earth.azimuth_deg, earth.elevation_deg).x}
                cy={azElToPolar(earth.azimuth_deg, earth.elevation_deg).y}
                r="8"
                fill="#38bdf8"
                stroke="#fff"
                strokeWidth="1"
              />
            )}
          </svg>
        </div>
      )}

      {/* Footer Info Strip */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-[#202228] px-1">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            <span>Terrain Skyline</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
            <span>Sun Disk</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block"></span>
            <span>Earth Disk</span>
          </span>
          <span className="flex items-center gap-1.5 text-cyan-300/80">
            <span className="w-3 border-t border-dashed border-cyan-400 inline-block"></span>
            <span>0° Tangent Plane</span>
          </span>
        </div>

        {hoveredAzimuth !== null && profile[hoveredAzimuth] && (
          <div className="text-emerald-300 font-bold">
            Azimuth {hoveredAzimuth}° → Terrain Elevation: +{profile[hoveredAzimuth].horizon_elevation_deg.toFixed(2)}°
          </div>
        )}
      </div>
    </div>
  );
};
