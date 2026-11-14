import React from 'react';
import { useEphemerisStore } from '../../stores/ephemerisStore';
import {
  Calendar,
  Clock,
  Ruler,
  RefreshCw,
  Play,
  Layers,
} from 'lucide-react';

interface EphemerisControlToolbarProps {
  observerLat: number;
  observerLon: number;
}

export const EphemerisControlToolbar: React.FC<EphemerisControlToolbarProps> = ({
  observerLat,
  observerLon,
}) => {
  const {
    selectedTimestamp,
    observerHeight,
    aberrationCorrection,
    timeSeriesDurationDays,
    isLoading,
    isTimeSeriesLoading,
    setSelectedTimestamp,
    setObserverHeight,
    setAberrationCorrection,
    setTimeSeriesDurationDays,
    setTimeSeriesStepHours,
    computePosition,
    computeTimeSeries,
  } = useEphemerisStore();

  const handleComputeAll = () => {
    computePosition(observerLat, observerLon);
    computeTimeSeries(observerLat, observerLon);
  };

  // Convert ISO string (e.g. 2026-10-04T12:00:00Z) to datetime-local value (2026-10-04T12:00)
  const localDateTimeValue = selectedTimestamp.slice(0, 16);

  const handleDateChange = (val: string) => {
    if (!val) return;
    const iso = `${val}:00Z`;
    setSelectedTimestamp(iso);
  };

  return (
    <div className="flex flex-col gap-2.5 bg-[#0c121e]/95 backdrop-blur-md border border-slate-800 rounded-xl p-2.5 shadow-xl text-xs font-mono">
      {/* Top Controls Row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Date / Time Input */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold mr-1">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] uppercase">OBSERVATION EPOCH (UTC):</span>
          </div>

          <div className="flex items-center gap-1.5 bg-[#070b12] px-2.5 py-1 rounded-lg border border-slate-800">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="datetime-local"
              value={localDateTimeValue}
              onChange={(e) => handleDateChange(e.target.value)}
              className="bg-transparent text-emerald-400 font-bold outline-none text-xs"
            />
            <span className="text-slate-500 text-[10px]">UTC</span>
          </div>

          {/* Quick Presets for Artemis III timeframe */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setSelectedTimestamp('2026-10-04T12:00:00Z');
                setTimeout(handleComputeAll, 50);
              }}
              className="px-2 py-0.5 rounded text-[10px] bg-[#070b12] text-slate-400 hover:text-emerald-400 border border-slate-800"
            >
              Oct 2026
            </button>
            <button
              onClick={() => {
                const now = new Date().toISOString().slice(0, 19) + 'Z';
                setSelectedTimestamp(now);
                setTimeout(handleComputeAll, 50);
              }}
              className="px-2 py-0.5 rounded text-[10px] bg-[#070b12] text-slate-400 hover:text-emerald-400 border border-slate-800"
            >
              Now
            </button>
          </div>
        </div>

        {/* Action Trigger Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => computePosition(observerLat, observerLon)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg shadow-md transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>CALCULATE POSITION</span>
          </button>

          <button
            onClick={() => computeTimeSeries(observerLat, observerLon)}
            disabled={isTimeSeriesLoading}
            className="flex items-center gap-1.5 px-3 py-1 bg-sky-500 hover:bg-sky-400 text-black font-bold rounded-lg shadow-md transition-all disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${isTimeSeriesLoading ? 'animate-spin' : ''}`} />
            <span>GENERATE TRAJECTORY</span>
          </button>
        </div>
      </div>

      {/* Secondary Controls: Observer Height, Duration, Aberration Correction */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-slate-800 text-[11px]">
        {/* Observer Height */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-400 flex items-center gap-1">
            <Ruler className="w-3 h-3 text-sky-400" /> Height (h_obs):
          </span>
          {[0.0, 1.0, 2.0, 10.0].map((h) => (
            <button
              key={h}
              onClick={() => {
                setObserverHeight(h);
                setTimeout(handleComputeAll, 50);
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                observerHeight === h
                  ? 'bg-emerald-500 text-black'
                  : 'bg-[#070b12] text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {h}m
            </button>
          ))}
        </div>

        {/* Time-Series Duration */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-400">Trajectory Horizon:</span>
          {[
            { days: 1, label: '24 Hours' },
            { days: 3, label: '3 Days' },
            { days: 7, label: '7 Days' },
            { days: 28, label: 'Lunar Month (28d)' },
          ].map((item) => (
            <button
              key={item.days}
              onClick={() => {
                setTimeSeriesDurationDays(item.days);
                setTimeSeriesStepHours(item.days > 7 ? 6.0 : 2.0);
                setTimeout(() => computeTimeSeries(observerLat, observerLon), 50);
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                timeSeriesDurationDays === item.days
                  ? 'bg-sky-500 text-black'
                  : 'bg-[#070b12] text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Aberration Correction */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 flex items-center gap-1">
            <Layers className="w-3 h-3 text-amber-400" /> Aberration:
          </span>
          <button
            onClick={() => {
              const next = aberrationCorrection === 'LT+S' ? 'NONE' : 'LT+S';
              setAberrationCorrection(next);
              setTimeout(handleComputeAll, 50);
            }}
            title="Toggle between LT+S (Apparent light-time & stellar aberration) and NONE (Geometric)"
            className="px-2 py-0.5 rounded text-[10px] bg-[#070b12] text-amber-300 font-bold border border-slate-800 hover:border-amber-500"
          >
            {aberrationCorrection === 'LT+S' ? 'LT+S (Apparent)' : 'NONE (Geometric)'}
          </button>
        </div>
      </div>
    </div>
  );
};
