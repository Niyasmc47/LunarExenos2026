import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useLocationStore } from '../../stores/locationStore';
import { fetchElevationProfile } from '../../services/terrainApi';
import { Activity, Ruler, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

const PRESET_TRANSECTS = [
  {
    name: 'Connecting Ridge Crest',
    start: { lat: -89.58, lon: -135.5 },
    end: { lat: -89.36, lon: -139.8 },
  },
  {
    name: 'Shackleton Rim to Ridge',
    start: { lat: -89.70, lon: -125.0 },
    end: { lat: -89.45, lon: -137.5 },
  },
  {
    name: 'Ridge Saddle Cross-Section',
    start: { lat: -89.48, lon: -142.0 },
    end: { lat: -89.44, lon: -133.0 },
  },
];

export const ElevationProfileChart: React.FC = () => {
  const profileStart = useLocationStore((state) => state.profileStart);
  const profileEnd = useLocationStore((state) => state.profileEnd);
  const profileData = useLocationStore((state) => state.profileData);
  const setProfileLine = useLocationStore((state) => state.setProfileLine);
  const setProfileData = useLocationStore((state) => state.setProfileData);
  const setSelectedCoordinates = useLocationStore((state) => state.setSelectedCoordinates);

  const [loading, setLoading] = useState(false);

  // Fetch elevation profile whenever start or end changes
  useEffect(() => {
    if (!profileStart || !profileEnd) return;

    setLoading(true);
    fetchElevationProfile(
      profileStart.lat,
      profileStart.lon,
      profileEnd.lat,
      profileEnd.lon,
      120
    )
      .then((data) => {
        if (data) setProfileData(data);
      })
      .finally(() => setLoading(false));
  }, [profileStart, profileEnd, setProfileData]);

  const chartData = (profileData?.samples || []).map((s) => ({
    distKm: (s.distance_m / 1000).toFixed(2),
    distance_m: s.distance_m,
    elevation: s.elevation_m !== null && s.elevation_m !== undefined ? Math.round(s.elevation_m) : null,
    slope: s.slope_deg !== null && s.slope_deg !== undefined ? s.slope_deg.toFixed(1) : null,
    lat: s.latitude,
    lon: s.longitude,
  }));

  const handleSelectPreset = (transect: typeof PRESET_TRANSECTS[0]) => {
    setProfileLine(transect.start, transect.end);
  };

  const handleChartClick = (e: any) => {
    if (e && e.activePayload && e.activePayload.length > 0) {
      const pt = e.activePayload[0].payload;
      if (pt && typeof pt.lat === 'number' && typeof pt.lon === 'number') {
        setSelectedCoordinates(pt.lat, pt.lon, 'terrain');
      }
    }
  };

  return (
    <div className="bg-[#141619]/95 backdrop-blur-md border border-[#2b2d32] rounded-xl p-3 flex flex-col h-full shadow-xl">
      {/* Top Header & Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2b2d32] pb-2 mb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider">
            ELEVATION PROFILE TRANSECT
          </h3>
          {loading && <RefreshCw className="w-3 h-3 text-emerald-400 animate-spin ml-1" />}
        </div>

        {/* Transect Preset Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">TRANSECT:</span>
          {PRESET_TRANSECTS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => handleSelectPreset(preset)}
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#0e1013] hover:bg-slate-800 border border-[#2b2d32] hover:border-emerald-500/50 text-slate-300 hover:text-emerald-400 transition-colors"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Profile Metrics Summary Pills */}
      {profileData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2 text-xs font-mono">
          <div className="bg-[#0e1013] p-1.5 px-2.5 rounded-lg border border-[#2b2d32]/80 flex items-center justify-between">
            <span className="text-slate-400 text-[10px] flex items-center gap-1">
              <Ruler className="w-3 h-3 text-slate-500" /> DISTANCE
            </span>
            <span className="text-slate-200 font-bold">
              {(profileData.total_distance_m / 1000).toFixed(2)} km
            </span>
          </div>

          <div className="bg-[#0e1013] p-1.5 px-2.5 rounded-lg border border-[#2b2d32]/80 flex items-center justify-between">
            <span className="text-slate-400 text-[10px] flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-400" /> MAX ELEV
            </span>
            <span className="text-emerald-400 font-bold">
              {profileData.max_elevation_m !== null ? `+${Math.round(profileData.max_elevation_m!)} m` : 'N/A'}
            </span>
          </div>

          <div className="bg-[#0e1013] p-1.5 px-2.5 rounded-lg border border-[#2b2d32]/80 flex items-center justify-between">
            <span className="text-slate-400 text-[10px] flex items-center gap-1">
              <TrendingDown className="w-3 h-3 text-cyan-400" /> MIN ELEV
            </span>
            <span className="text-cyan-400 font-bold">
              {profileData.min_elevation_m !== null ? `${Math.round(profileData.min_elevation_m!)} m` : 'N/A'}
            </span>
          </div>

          <div className="bg-[#0e1013] p-1.5 px-2.5 rounded-lg border border-[#2b2d32]/80 flex items-center justify-between">
            <span className="text-slate-400 text-[10px]">ΔH RELIEF</span>
            <span className="text-amber-400 font-bold">
              {profileData.elevation_diff_m !== null ? `${Math.round(profileData.elevation_diff_m!)} m` : 'N/A'}
            </span>
          </div>
        </div>
      )}

      {/* Chart Area */}
      <div className="flex-1 w-full min-h-[140px]">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              onClick={handleChartClick}
              margin={{ top: 5, right: 15, left: -15, bottom: 0 }}
            >
              <defs>
                <linearGradient id="elevationGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#047857" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="distKm"
                stroke="#64748b"
                tick={{ fontSize: 10, fill: '#64748b' }}
                unit=" km"
              />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 10, fill: '#64748b' }}
                unit="m"
                domain={['auto', 'auto']}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-[#0e1013] border border-[#2b2d32] p-2 rounded-lg text-xs font-mono shadow-xl">
                        <div className="text-emerald-400 font-bold">
                          Elevation: {data.elevation !== null ? `${data.elevation > 0 ? '+' : ''}${data.elevation} m` : 'N/A'}
                        </div>
                        <div className="text-slate-300">
                          Distance: {data.distKm} km
                        </div>
                        {data.slope && (
                          <div className="text-amber-400">
                            Local Slope: {data.slope}°
                          </div>
                        )}
                        <div className="text-[10px] text-slate-500 mt-1">
                          {data.lat.toFixed(4)}°, {data.lon.toFixed(4)}° (Click to inspect)
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="elevation"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#elevationGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-xs font-mono text-slate-500">
            Sampling elevation profile along selected transect...
          </div>
        )}
      </div>
    </div>
  );
};
