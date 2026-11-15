import React, { useState, useEffect, useRef } from 'react';
import { useEphemerisStore } from '../../stores/ephemerisStore';
import {
  Calendar,
  Clock,
  Ruler,
  RefreshCw,
  Play,
  Pause,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
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

  const [isPlaying, setIsPlaying] = useState(false);
  const playTimerRef = useRef<number | null>(null);

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

  const stepTime = (deltaHours: number) => {
    const cur = new Date(selectedTimestamp);
    const updated = new Date(cur.getTime() + deltaHours * 3600 * 1000);
    const updatedIso = updated.toISOString().slice(0, 19) + 'Z';
    setSelectedTimestamp(updatedIso);
    setTimeout(() => {
      computePosition(observerLat, observerLon);
    }, 50);
  };

  // Auto-play animation loop stepping 1 simulation hour forward per tick
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = window.setInterval(() => {
        // Prevent overlapping requests if a calculation is already executing
        if (useEphemerisStore.getState().isLoading) {
          return;
        }
        const cur = new Date(useEphemerisStore.getState().selectedTimestamp);
        const next = new Date(cur.getTime() + 3600 * 1000);
        const nextIso = next.toISOString().slice(0, 19) + 'Z';
        setSelectedTimestamp(nextIso);
        computePosition(observerLat, observerLon);
      }, 1000);
    } else {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    }
    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
      }
    };
  }, [isPlaying, observerLat, observerLon, computePosition, setSelectedTimestamp]);

  return (
    <div className="flex flex-col gap-2.5 bg-[#141619] backdrop-blur-md border border-[#2b2d32] rounded-xl p-3 shadow-xl text-xs font-mono">
      {/* Top Controls Row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Date / Time Input with Quick Stepper */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold mr-1">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] uppercase">DATE & TIME (UTC):</span>
          </div>

          <div className="flex items-center gap-1.5 bg-[#0e1013] px-2.5 py-1 rounded-lg border border-[#2b2d32]">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="datetime-local"
              value={localDateTimeValue}
              onChange={(e) => handleDateChange(e.target.value)}
              className="bg-transparent text-emerald-400 font-bold outline-none text-xs"
            />
            <span className="text-slate-500 text-[10px]">UTC</span>
          </div>

          {/* Time Stepper Buttons for Normal Users */}
          <div className="flex items-center gap-1 bg-[#0e1013] p-0.5 rounded-lg border border-[#2b2d32]">
            <button
              onClick={() => stepTime(-24)}
              title="Step Backward 1 Day (-24h)"
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => stepTime(-6)}
              title="Step Backward 6 Hours"
              className="px-1.5 py-0.5 rounded text-[10px] hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
            >
              -6h
            </button>
            <button
              onClick={() => stepTime(-1)}
              title="Step Backward 1 Hour"
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Play / Pause Time Animation */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              title={isPlaying ? 'Pause time animation' : 'Animate celestial motion (+1 hour / sec)'}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                isPlaying
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
              }`}
            >
              {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span>{isPlaying ? 'PAUSE' : 'ANIMATE'}</span>
            </button>

            <button
              onClick={() => stepTime(1)}
              title="Step Forward 1 Hour"
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => stepTime(6)}
              title="Step Forward 6 Hours"
              className="px-1.5 py-0.5 rounded text-[10px] hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
            >
              +6h
            </button>
            <button
              onClick={() => stepTime(24)}
              title="Step Forward 1 Day (+24h)"
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Scientific Epoch Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-500 font-semibold uppercase">PRESETS:</span>
            <button
              onClick={() => {
                setSelectedTimestamp('2026-10-04T12:00:00Z');
                setTimeout(handleComputeAll, 50);
              }}
              title="NASA Artemis III Planned Mission Window (Target epoch October 2026)"
              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#0e1013] text-amber-300/90 hover:text-amber-200 border border-amber-500/30 flex items-center gap-1"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              Planned: Artemis III Window (Late 2026)
            </button>
            <button
              onClick={() => {
                setSelectedTimestamp('2026-12-21T12:00:00Z');
                setTimeout(handleComputeAll, 50);
              }}
              title="Illustrative: Lunar South Pole Summer Solstice (Maximum Solar Elevation)"
              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#0e1013] text-slate-300 hover:text-emerald-400 border border-[#2b2d32]"
            >
              Illustrative: Summer Solstice (Dec 2026)
            </button>
            <button
              onClick={() => {
                setSelectedTimestamp('2026-06-21T12:00:00Z');
                setTimeout(handleComputeAll, 50);
              }}
              title="Illustrative: Lunar South Pole Winter Solstice (Minimum Solar Elevation)"
              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#0e1013] text-slate-300 hover:text-emerald-400 border border-[#2b2d32]"
            >
              Illustrative: Winter Solstice (Jun 2026)
            </button>
            <button
              onClick={() => {
                const now = new Date().toISOString().slice(0, 19) + 'Z';
                setSelectedTimestamp(now);
                setTimeout(handleComputeAll, 50);
              }}
              title="Illustrative: Real-Time Current Epoch (Now UTC)"
              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#0e1013] text-sky-300/80 hover:text-sky-300 border border-[#2b2d32]"
            >
              Simulation: Current UTC
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
            <span>RECOMPUTE</span>
          </button>

          <button
            onClick={() => computeTimeSeries(observerLat, observerLon)}
            disabled={isTimeSeriesLoading}
            className="flex items-center gap-1.5 px-3 py-1 bg-sky-500 hover:bg-sky-400 text-black font-bold rounded-lg shadow-md transition-all disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${isTimeSeriesLoading ? 'animate-spin' : ''}`} />
            <span>PLOT TRAJECTORY</span>
          </button>
        </div>
      </div>

      {/* Secondary Controls: Observer Height, Duration, Aberration Correction */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-[#2b2d32] text-[11px]">
        {/* Observer Height */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-400 flex items-center gap-1">
            <Ruler className="w-3 h-3 text-sky-400" /> Observer Height:
          </span>
          {[
            { h: 0.0, label: '0m (Ground level)' },
            { h: 1.0, label: '1m (Rover)' },
            { h: 2.0, label: '2m (Astronaut eye)' },
            { h: 10.0, label: '10m (Lander mast)' },
          ].map((item) => (
            <button
              key={item.h}
              onClick={() => {
                setObserverHeight(item.h);
                setTimeout(handleComputeAll, 50);
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                observerHeight === item.h
                  ? 'bg-emerald-500 text-black'
                  : 'bg-[#0e1013] text-slate-400 hover:text-slate-200 border border-[#2b2d32]'
              }`}
            >
              {item.label}
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
                  : 'bg-[#0e1013] text-slate-400 hover:text-slate-200 border border-[#2b2d32]'
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
            className="px-2 py-0.5 rounded text-[10px] bg-[#0e1013] text-amber-300 font-bold border border-[#2b2d32] hover:border-amber-500"
          >
            {aberrationCorrection === 'LT+S' ? 'LT+S (Apparent)' : 'NONE (Geometric)'}
          </button>
        </div>
      </div>
    </div>
  );
};
