import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { EphemerisTimeSeriesResponse } from '../../types/ephemeris';
import { LineChart as LineChartIcon, Sun, Globe } from 'lucide-react';

interface EphemerisTimeSeriesChartProps {
  data: EphemerisTimeSeriesResponse | null;
  isLoading: boolean;
}

export const EphemerisTimeSeriesChart: React.FC<EphemerisTimeSeriesChartProps> = ({
  data,
  isLoading,
}) => {
  const [metricMode, setMetricMode] = useState<'elevation' | 'azimuth'>('elevation');

  const chartData = data?.series || [];

  return (
    <div className="flex flex-col h-full bg-[#0c121e]/90 border border-slate-800 rounded-xl p-3 text-xs font-mono">
      {/* Header & Metric Switcher */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
        <div className="flex items-center gap-2">
          <LineChartIcon className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-slate-200 uppercase tracking-wider">
            CELESTIAL TRAJECTORY TIME-SERIES
          </span>
          {isLoading && <span className="text-emerald-400 text-[10px] animate-pulse">COMPUTING...</span>}
        </div>

        {/* Elevation vs Azimuth Switcher */}
        <div className="flex items-center gap-1 bg-[#070b12] p-0.5 rounded-lg border border-slate-800 text-[11px]">
          <button
            onClick={() => setMetricMode('elevation')}
            className={`px-2.5 py-1 rounded font-bold transition-all ${
              metricMode === 'elevation'
                ? 'bg-emerald-500 text-black shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ELEVATION (HORIZON ALTITUDE)
          </button>
          <button
            onClick={() => setMetricMode('azimuth')}
            className={`px-2.5 py-1 rounded font-bold transition-all ${
              metricMode === 'azimuth'
                ? 'bg-emerald-500 text-black shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            AZIMUTH (0°–360°)
          </button>
        </div>
      </div>

      {/* Legend Bar */}
      <div className="flex items-center gap-4 text-[11px] mb-2 px-1">
        <span className="flex items-center gap-1.5 text-amber-400 font-bold">
          <Sun className="w-3.5 h-3.5" />
          Sun {metricMode === 'elevation' ? 'Elevation (°)' : 'Azimuth (°)'}
        </span>
        <span className="flex items-center gap-1.5 text-sky-400 font-bold">
          <Globe className="w-3.5 h-3.5" />
          Earth {metricMode === 'elevation' ? 'Elevation (°)' : 'Azimuth (°)'}
        </span>
        {metricMode === 'elevation' && (
          <span className="text-slate-500 text-[10px]">
            Dashed line: 0° Local Tangent Plane
          </span>
        )}
      </div>

      {/* Chart Canvas */}
      <div className="flex-1 w-full min-h-[220px]">
        {chartData.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
            {isLoading ? 'Computing ephemeris time-series...' : 'No time-series trajectory generated yet.'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="timestamp_iso"
                tickFormatter={(iso) => {
                  const d = new Date(iso);
                  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${d.getUTCHours().toString().padStart(2, '0')}:00`;
                }}
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
              />
              <YAxis
                unit="°"
                domain={metricMode === 'azimuth' ? [0, 360] : ['auto', 'auto']}
                ticks={metricMode === 'azimuth' ? [0, 90, 180, 270, 360] : undefined}
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
              />

              {metricMode === 'elevation' && (
                <ReferenceLine
                  y={0}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  label={{ value: '0° Horizon', fill: '#10b981', fontSize: 9, position: 'insideBottomRight' }}
                />
              )}

              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const pt = payload[0].payload;
                  return (
                    <div className="bg-[#070b12]/95 border border-slate-700 p-2.5 rounded-lg shadow-2xl text-xs font-mono text-slate-200">
                      <div className="text-slate-400 font-bold mb-1 border-b border-slate-800 pb-1">
                        Epoch: {pt.timestamp_iso}
                      </div>
                      <div className="text-amber-400 font-bold mt-1">
                        Sun: {metricMode === 'elevation' ? `${pt.sun_elevation_deg.toFixed(2)}° Elev` : `${pt.sun_azimuth_deg.toFixed(1)}° Azimuth`}
                      </div>
                      <div className="text-slate-400 text-[10px]">
                        Dist: {(pt.sun_distance_km / 149597870.7).toFixed(3)} AU | Angular Diam: {pt.sun_angular_diameter_deg.toFixed(3)}°
                      </div>
                      <div className="text-sky-400 font-bold mt-2">
                        Earth: {metricMode === 'elevation' ? `${pt.earth_elevation_deg.toFixed(2)}° Elev` : `${pt.earth_azimuth_deg.toFixed(1)}° Azimuth`}
                      </div>
                      <div className="text-slate-400 text-[10px]">
                        Dist: {(pt.earth_distance_km / 1000).toFixed(1)}k km | Angular Diam: {pt.earth_angular_diameter_deg.toFixed(3)}°
                      </div>
                    </div>
                  );
                }}
              />

              <Line
                type="monotone"
                dataKey={metricMode === 'elevation' ? 'sun_elevation_deg' : 'sun_azimuth_deg'}
                stroke="#fbbf24"
                strokeWidth={2.5}
                dot={false}
                name="Sun"
              />
              <Line
                type="monotone"
                dataKey={metricMode === 'elevation' ? 'earth_elevation_deg' : 'earth_azimuth_deg'}
                stroke="#38bdf8"
                strokeWidth={2.5}
                dot={false}
                name="Earth"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
