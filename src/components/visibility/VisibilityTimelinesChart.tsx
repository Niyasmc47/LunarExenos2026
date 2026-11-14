import React, { useMemo, useState } from 'react';
import {
  Clock,
  Sun,
  Globe,
  Layers,
} from 'lucide-react';
import { useVisibilityStore } from '../../stores/visibilityStore';
import { useDynamicAnalysisStore } from '../../stores/dynamicAnalysisStore';
import { useLocationStore } from '../../stores/locationStore';
import { VisibilityTimeSeriesPoint } from '../../types/visibility';

export const VisibilityTimelinesChart: React.FC = () => {
  const analysisData = useVisibilityStore((state) => state.analysisData);
  const isLoading = useVisibilityStore((state) => state.isLoadingAnalysis);
  const selectedTimestamp = useVisibilityStore((state) => state.selectedTimestamp);
  const setSelectedTimestamp = useVisibilityStore((state) => state.setSelectedTimestamp);
  const computeInstant = useVisibilityStore((state) => state.computeInstant);

  const currentPointTelemetry = useDynamicAnalysisStore((state) => state.currentPointTelemetry);
  const selectedLat = useLocationStore((state) => state.selectedLatitude);
  const selectedLon = useLocationStore((state) => state.selectedLongitude);
  const observerLat = currentPointTelemetry?.latitude ?? selectedLat;
  const observerLon = currentPointTelemetry?.longitude ?? selectedLon;

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const series = analysisData?.series ?? [];

  // Parse time bounds
  const { startTime, endTime, totalDurationMs } = useMemo(() => {
    if (series.length < 2) return { startTime: 0, endTime: 0, totalDurationMs: 0 };
    const st = new Date(series[0].timestamp_iso).getTime();
    const et = new Date(series[series.length - 1].timestamp_iso).getTime();
    return { startTime: st, endTime: et, totalDurationMs: Math.max(1, et - st) };
  }, [series]);

  // Current epoch position fraction (0 to 1)
  const currentFraction = useMemo(() => {
    if (!startTime || !endTime || totalDurationMs <= 0) return null;
    const currentMs = new Date(selectedTimestamp).getTime();
    if (currentMs < startTime || currentMs > endTime) return null;
    return (currentMs - startTime) / totalDurationMs;
  }, [selectedTimestamp, startTime, endTime, totalDurationMs]);

  const handleTimelineClick = (point: VisibilityTimeSeriesPoint) => {
    setSelectedTimestamp(point.timestamp_iso);
    computeInstant(observerLat, observerLon);
  };

  const getSolarColor = (p: VisibilityTimeSeriesPoint) => {
    if (p.sun_visibility_state === 'FULLY_VISIBLE') return '#fbbf24'; // Gold
    if (p.sun_visibility_state === 'PARTIALLY_VISIBLE') return '#f59e0b'; // Amber
    return '#090d16'; // Obstructed
  };

  const getEarthColor = (p: VisibilityTimeSeriesPoint) => {
    if (p.earth_visibility_state === 'FULLY_VISIBLE') return '#38bdf8'; // Sky Blue
    if (p.earth_visibility_state === 'PARTIALLY_VISIBLE') return '#06b6d4'; // Cyan
    return '#090d16'; // Obstructed
  };

  const getCombinedColor = (p: VisibilityTimeSeriesPoint) => {
    if (p.combined_state === 'SUN_AND_EARTH_VISIBLE') return '#10b981'; // Emerald
    if (p.combined_state === 'SUN_VISIBLE_ONLY') return '#fbbf24'; // Sun only
    if (p.combined_state === 'EARTH_VISIBLE_ONLY') return '#38bdf8'; // Earth only
    if (p.combined_state === 'PARTIAL_DUAL_VISIBILITY') return '#818cf8'; // Indigo
    return '#1e1b4b'; // Neither
  };

  return (
    <div className="bg-[#0c121e]/90 border border-slate-800 rounded-xl p-3 font-mono text-xs shadow-lg space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-slate-200">
            VISIBILITY & ILLUMINATION OPPORTUNITY TIMELINES
          </span>
          {series.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              {series.length} Epochs ({analysisData?.step_interval_hours}h step)
            </span>
          )}
        </div>

        <div className="text-[10px] text-slate-400 hidden sm:block">
          Click any epoch on the timeline to evaluate instantaneous topocentric state
        </div>
      </div>

      {series.length > 0 ? (
        <div className="space-y-3">
          {/* Stacked Timelines */}
          <div className="space-y-2 select-none relative">
            {/* Scrubber vertical bar */}
            {currentFraction !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-30 pointer-events-none shadow-[0_0_8px_rgba(244,63,94,0.8)]"
                style={{ left: `${(currentFraction * 100).toFixed(2)}%` }}
              >
                <div className="absolute -top-1.5 -translate-x-1/2 w-3 h-3 bg-rose-500 rounded-full flex items-center justify-center text-[7px] text-white font-bold">
                  ▼
                </div>
              </div>
            )}

            {/* 1. Solar Timeline */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="flex items-center gap-1.5 font-bold text-amber-300">
                  <Sun className="w-3.5 h-3.5" />
                  <span>Solar Illumination Opportunity</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  Total Sun: {analysisData?.solar_metrics.total_sun_visible_hours.toFixed(1)}h ({(analysisData ? analysisData.solar_metrics.illumination_fraction * 100 : 0).toFixed(1)}%)
                </span>
              </div>
              <div className="h-6 w-full flex rounded-md overflow-hidden border border-slate-800 bg-[#070b12]">
                {series.map((p, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleTimelineClick(p)}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    style={{
                      flex: 1,
                      backgroundColor: getSolarColor(p),
                      opacity: p.sun_visibility_state === 'FULLY_OBSTRUCTED' ? 0.3 : 1,
                    }}
                    className="cursor-pointer hover:brightness-125 transition-all relative group"
                    title={`${p.timestamp_iso}\nSun: ${p.sun_visibility_state} (${(p.sun_visible_fraction * 100).toFixed(0)}%)\nElev: ${p.sun_elevation_deg.toFixed(2)}° vs Skyline: ${p.terrain_elevation_sun_az_deg.toFixed(2)}°`}
                  />
                ))}
              </div>
            </div>

            {/* 2. Earth Timeline */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="flex items-center gap-1.5 font-bold text-cyan-300">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Earth Direct Line-of-Sight Opportunity</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  Total Earth: {analysisData?.earth_metrics.total_earth_visible_hours.toFixed(1)}h ({(analysisData ? analysisData.earth_metrics.earth_visibility_fraction * 100 : 0).toFixed(1)}%)
                </span>
              </div>
              <div className="h-6 w-full flex rounded-md overflow-hidden border border-slate-800 bg-[#070b12]">
                {series.map((p, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleTimelineClick(p)}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    style={{
                      flex: 1,
                      backgroundColor: getEarthColor(p),
                      opacity: p.earth_visibility_state === 'FULLY_OBSTRUCTED' ? 0.3 : 1,
                    }}
                    className="cursor-pointer hover:brightness-125 transition-all relative group"
                    title={`${p.timestamp_iso}\nEarth: ${p.earth_visibility_state} (${(p.earth_visible_fraction * 100).toFixed(0)}%)\nElev: ${p.earth_elevation_deg.toFixed(2)}° vs Skyline: ${p.terrain_elevation_earth_az_deg.toFixed(2)}°`}
                  />
                ))}
              </div>
            </div>

            {/* 3. Combined Dual-State Timeline */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="flex items-center gap-1.5 font-bold text-emerald-300">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Combined Mission Opportunity (Sun & Earth)</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  Both Visible: {analysisData?.combined_metrics.both_visible_hours.toFixed(1)}h
                </span>
              </div>
              <div className="h-6 w-full flex rounded-md overflow-hidden border border-slate-800 bg-[#070b12]">
                {series.map((p, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleTimelineClick(p)}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    style={{
                      flex: 1,
                      backgroundColor: getCombinedColor(p),
                      opacity: p.combined_state === 'NEITHER_VISIBLE' ? 0.3 : 1,
                    }}
                    className="cursor-pointer hover:brightness-125 transition-all relative group"
                    title={`${p.timestamp_iso}\nCombined: ${p.combined_state}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Time axis bounds */}
          <div className="flex justify-between text-[10px] text-slate-500 font-mono px-0.5">
            <span>START: {series[0]?.timestamp_iso.replace('T', ' ').replace('Z', '')}</span>
            <span>END: {series[series.length - 1]?.timestamp_iso.replace('T', ' ').replace('Z', '')}</span>
          </div>

          {/* Hovered point telemetry detail */}
          {hoveredIndex !== null && series[hoveredIndex] && (
            <div className="bg-[#070b12] p-2 rounded-lg border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="text-slate-300 font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>{series[hoveredIndex].timestamp_iso}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-amber-300">
                  Sun: <b>{(series[hoveredIndex].sun_visible_fraction * 100).toFixed(0)}%</b> (Elev: {series[hoveredIndex].sun_elevation_deg.toFixed(2)}° / Sky: {series[hoveredIndex].terrain_elevation_sun_az_deg.toFixed(2)}°)
                </span>
                <span className="text-cyan-300">
                  Earth: <b>{(series[hoveredIndex].earth_visible_fraction * 100).toFixed(0)}%</b> (Elev: {series[hoveredIndex].earth_elevation_deg.toFixed(2)}° / Sky: {series[hoveredIndex].terrain_elevation_earth_az_deg.toFixed(2)}°)
                </span>
                <span className="text-emerald-300 font-bold">
                  {series[hoveredIndex].combined_state}
                </span>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#10b981] inline-block"></span>
                <span>Both Sun & Earth</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#fbbf24] inline-block"></span>
                <span>Sun Only</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#38bdf8] inline-block"></span>
                <span>Earth Only</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#090d16] border border-slate-700 inline-block"></span>
                <span>Obstructed / Darkness</span>
              </span>
            </div>
            <div className="text-rose-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
              <span>Red Marker: Current Instant Epoch ({selectedTimestamp.split('T')[1].slice(0, 5)})</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-slate-500 text-xs">
          {isLoading
            ? 'Calculating terrain-aware ephemeris time-series and transition events...'
            : 'Click "Generate Timelines" in the toolbar above to compute mission illumination and line-of-sight timelines.'}
        </div>
      )}
    </div>
  );
};
