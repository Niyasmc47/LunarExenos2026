import React, { useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Calendar,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useVisibilityStore } from '../../stores/visibilityStore';
import { useDynamicAnalysisStore } from '../../stores/dynamicAnalysisStore';
import { useLocationStore } from '../../stores/locationStore';

const PRESETS = [
  {
    name: 'Planned: Artemis III Window',
    timestamp: '2026-10-04T12:00:00Z',
    note: 'South Pole exploration season',
  },
  {
    name: 'Illustrative: Summer Solstice',
    timestamp: '2026-06-21T00:00:00Z',
    note: 'Maximum southern solar elevation',
  },
  {
    name: 'Illustrative: Winter Solstice',
    timestamp: '2026-12-21T00:00:00Z',
    note: 'Deep southern shadow conditions',
  },
];

export const VisibilityControlToolbar: React.FC = () => {
  const selectedTimestamp = useVisibilityStore((state) => state.selectedTimestamp);
  const setSelectedTimestamp = useVisibilityStore((state) => state.setSelectedTimestamp);
  const observerHeight = useVisibilityStore((state) => state.observerHeight);
  const setObserverHeight = useVisibilityStore((state) => state.setObserverHeight);
  const durationDays = useVisibilityStore((state) => state.durationDays);
  const setDurationDays = useVisibilityStore((state) => state.setDurationDays);
  const setStepHours = useVisibilityStore((state) => state.setStepHours);

  const isPlaying = useVisibilityStore((state) => state.isPlaying);
  const setIsPlaying = useVisibilityStore((state) => state.setIsPlaying);
  const stepTime = useVisibilityStore((state) => state.stepTime);

  const computeInstant = useVisibilityStore((state) => state.computeInstant);
  const computeAnalysis = useVisibilityStore((state) => state.computeAnalysis);
  const isLoadingInstant = useVisibilityStore((state) => state.isLoadingInstant);
  const isLoadingAnalysis = useVisibilityStore((state) => state.isLoadingAnalysis);

  const currentPointTelemetry = useDynamicAnalysisStore((state) => state.currentPointTelemetry);
  const selectedLat = useLocationStore((state) => state.selectedLatitude);
  const selectedLon = useLocationStore((state) => state.selectedLongitude);

  const observerLat = currentPointTelemetry?.latitude ?? selectedLat;
  const observerLon = currentPointTelemetry?.longitude ?? selectedLon;

  const timerRef = useRef<number | null>(null);

  // Time animation loop
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = window.setInterval(() => {
        stepTime(1.0, observerLat, observerLon);
      }, 1200);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, observerLat, observerLon, stepTime]);

  const handlePreset = (ts: string) => {
    setSelectedTimestamp(ts);
    computeInstant(observerLat, observerLon);
  };

  const handleStep = (hours: number) => {
    stepTime(hours, observerLat, observerLon);
  };

  return (
    <div className="bg-[#141619] border border-[#2b2d32] rounded-xl p-2.5 space-y-2 font-mono text-xs shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Epoch Stepper and Animation Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-[#0e1013] px-2.5 py-1 rounded-lg border border-[#2b2d32] text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] text-slate-400 uppercase">EPOCH:</span>
            <input
              type="text"
              value={selectedTimestamp}
              onChange={(e) => setSelectedTimestamp(e.target.value)}
              onBlur={() => computeInstant(observerLat, observerLon)}
              className="bg-transparent text-emerald-300 font-bold focus:outline-none w-44"
              title="Observation Epoch (UTC ISO 8601)"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#0e1013] p-1 rounded-lg border border-[#2b2d32]">
            <button
              onClick={() => handleStep(-24)}
              className="px-2 py-0.5 rounded text-[11px] font-bold text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              title="Step -1 Day"
            >
              -1d
            </button>
            <button
              onClick={() => handleStep(-6)}
              className="px-2 py-0.5 rounded text-[11px] font-bold text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              title="Step -6 Hours"
            >
              -6h
            </button>
            <button
              onClick={() => handleStep(-1)}
              className="px-2 py-0.5 rounded text-[11px] font-bold text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              title="Step -1 Hour"
            >
              -1h
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold transition-all ${
                isPlaying
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                  : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
              }`}
              title={isPlaying ? 'Pause Simulation Animation' : 'Play Simulation (+1h/step)'}
            >
              {isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
              <span>{isPlaying ? 'PAUSE' : 'ANIMATE'}</span>
            </button>

            <button
              onClick={() => handleStep(1)}
              className="px-2 py-0.5 rounded text-[11px] font-bold text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              title="Step +1 Hour"
            >
              +1h
            </button>
            <button
              onClick={() => handleStep(6)}
              className="px-2 py-0.5 rounded text-[11px] font-bold text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              title="Step +6 Hours"
            >
              +6h
            </button>
            <button
              onClick={() => handleStep(24)}
              className="px-2 py-0.5 rounded text-[11px] font-bold text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              title="Step +1 Day"
            >
              +1d
            </button>
          </div>
        </div>

        {/* Observer Eye Height */}
        <div className="flex items-center gap-1.5 bg-[#0e1013] px-2 py-1 rounded-lg border border-[#2b2d32]">
          <span className="text-[10px] text-slate-400 uppercase">EYE HEIGHT:</span>
          {[0, 1.0, 2.0, 10.0].map((h) => (
            <button
              key={h}
              onClick={() => {
                setObserverHeight(h);
                computeInstant(observerLat, observerLon);
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                observerHeight === h
                  ? 'bg-emerald-500 text-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {h}m
            </button>
          ))}
        </div>

        {/* Action Triggers */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => computeInstant(observerLat, observerLon)}
            disabled={isLoadingInstant}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold border transition-all ${
              isLoadingInstant
                ? 'bg-slate-800 border-[#303238] text-slate-500 cursor-not-allowed'
                : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/40 text-emerald-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isLoadingInstant ? 'COMPUTING...' : 'EVALUATE INSTANT'}</span>
          </button>

          <button
            onClick={() => computeAnalysis(observerLat, observerLon)}
            disabled={isLoadingAnalysis}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-all ${
              isLoadingAnalysis
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{isLoadingAnalysis ? 'ANALYZING...' : 'GENERATE TIMELINES'}</span>
          </button>
        </div>
      </div>

      {/* Presets and Timeline Duration Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#202228] text-[11px]">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[10px] uppercase">PRESETS:</span>
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => handlePreset(p.timestamp)}
              className="px-2 py-0.5 rounded bg-slate-800/70 hover:bg-slate-700 border border-[#2b2d32] text-slate-300 hover:text-emerald-300 transition-colors"
              title={`${p.name} (${p.note})`}
            >
              {p.name.split(':')[0]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[10px] uppercase">ANALYSIS WINDOW:</span>
          {[
            { label: '24h', days: 1, step: 0.5 },
            { label: '3d', days: 3, step: 1.0 },
            { label: '7d', days: 7, step: 2.0 },
            { label: '28d (Lunar Month)', days: 28, step: 4.0 },
          ].map((w) => (
            <button
              key={w.label}
              onClick={() => {
                setDurationDays(w.days);
                setStepHours(w.step);
              }}
              className={`px-2 py-0.5 rounded font-bold transition-all ${
                durationDays === w.days
                  ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
