import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { HorizonAnalysisResponse, HorizonPoint } from '../../types/horizon';
import { LineChart, ArrowUpRight, Compass } from 'lucide-react';

interface HorizonElevationGraphProps {
  data: HorizonAnalysisResponse | null;
  hoveredPoint: HorizonPoint | null;
  onHoverPoint: (pt: HorizonPoint | null) => void;
}

export const HorizonElevationGraph: React.FC<HorizonElevationGraphProps> = ({
  data,
  hoveredPoint,
  onHoverPoint,
}) => {
  const chartData = data?.horizon_profile || [];

  return (
    <div className="flex flex-col h-full bg-[#0c121e]/90 border border-slate-800 rounded-xl p-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-2">
        <div className="flex items-center gap-2">
          <LineChart className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
            HORIZON ELEVATION VS AZIMUTH (0°–360°)
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-sky-400 inline-block"></span>
            Skyline Angle (°)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-slate-600 inline-block"></span>
            0° Local Tangent
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="flex-1 w-full min-h-[220px]">
        {chartData.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-xs font-mono text-slate-500">
            No horizon profile data computed yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 15, left: -15, bottom: 0 }}
              onMouseMove={(e: any) => {
                if (e && e.activePayload && e.activePayload.length > 0) {
                  onHoverPoint(e.activePayload[0].payload as HorizonPoint);
                }
              }}
              onMouseLeave={() => onHoverPoint(null)}
            >
              <defs>
                <linearGradient id="horizonElevationGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />

              <XAxis
                dataKey="azimuth_deg"
                type="number"
                domain={[0, 360]}
                ticks={[0, 45, 90, 135, 180, 225, 270, 315, 360]}
                tickFormatter={(val) => {
                  if (val === 0 || val === 360) return `${val}° N`;
                  if (val === 90) return '90° E';
                  if (val === 180) return '180° S';
                  if (val === 270) return '270° W';
                  return `${val}°`;
                }}
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
              />

              <YAxis
                stroke="#64748b"
                unit="°"
                tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                domain={['auto', 'auto']}
              />

              {/* Local Horizontal Plane (0° tangent) */}
              <ReferenceLine
                y={0}
                stroke="#475569"
                strokeDasharray="4 4"
                label={{
                  value: '0° Tangent Plane',
                  fill: '#64748b',
                  fontSize: 9,
                  position: 'insideBottomRight',
                }}
              />

              {/* Maximum Obstruction Peak Line */}
              {data && (
                <ReferenceLine
                  y={data.summary.max_horizon_elevation_deg}
                  stroke="#34d399"
                  strokeDasharray="2 2"
                  label={{
                    value: `Max Skyline: +${data.summary.max_horizon_elevation_deg.toFixed(1)}°`,
                    fill: '#34d399',
                    fontSize: 9,
                    position: 'insideTopLeft',
                  }}
                />
              )}

              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const pt = payload[0].payload as HorizonPoint;
                  return (
                    <div className="bg-[#070b12]/95 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs font-mono text-slate-200">
                      <div className="text-emerald-400 font-bold flex items-center gap-1 mb-1">
                        <Compass className="w-3.5 h-3.5" />
                        Azimuth: {pt.azimuth_deg.toFixed(1)}°
                      </div>
                      <div>
                        Horizon Elevation:{' '}
                        <span className="text-white font-bold">
                          {pt.horizon_elevation_deg > 0 ? '+' : ''}
                          {pt.horizon_elevation_deg.toFixed(2)}°
                        </span>
                      </div>
                      <div className="text-slate-400 text-[10px]">
                        Distance to Feature: {(pt.distance_to_horizon_m / 1000).toFixed(2)} km
                      </div>
                      <div className="text-slate-400 text-[10px]">
                        Feature Altitude: {pt.horizon_surface_elevation_m.toFixed(1)} m
                      </div>
                      <div className="text-slate-500 text-[9px] mt-1">
                        Coord: {pt.horizon_lat.toFixed(4)}°, {pt.horizon_lon.toFixed(4)}°
                      </div>
                    </div>
                  );
                }}
              />

              <Area
                type="monotone"
                dataKey="horizon_elevation_deg"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#horizonElevationGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Synchronized Hover Marker Bar */}
      {hoveredPoint && (
        <div className="shrink-0 flex items-center justify-between text-xs font-mono bg-[#070b12] px-3 py-1.5 rounded-lg border border-sky-500/30 mt-2">
          <div className="flex items-center gap-1.5 text-sky-400 font-bold">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>AZ {hoveredPoint.azimuth_deg.toFixed(1)}°</span>
          </div>
          <div className="text-slate-300">
            Angle:{' '}
            <span className="text-emerald-400 font-bold">
              {hoveredPoint.horizon_elevation_deg > 0 ? '+' : ''}
              {hoveredPoint.horizon_elevation_deg.toFixed(2)}°
            </span>
          </div>
          <div className="text-slate-400 text-[11px]">
            Range: {(hoveredPoint.distance_to_horizon_m / 1000).toFixed(2)} km
          </div>
          <div className="text-slate-400 text-[11px]">
            Z: {hoveredPoint.horizon_surface_elevation_m.toFixed(0)} m
          </div>
        </div>
      )}
    </div>
  );
};
