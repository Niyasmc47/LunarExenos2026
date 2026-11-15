import React, { useEffect, useRef } from 'react';
import { useCelestialSimulationStore } from '../../stores/celestialSimulationStore';
import { useLocationStore } from '../../stores/locationStore';
import { useDynamicAnalysisStore } from '../../stores/dynamicAnalysisStore';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Clock,
  Zap,
} from 'lucide-react';

export const CelestialTimeControls: React.FC = () => {
  const simulationTime = useCelestialSimulationStore((state) => state.simulationTime);
  const isPlaying = useCelestialSimulationStore((state) => state.isPlaying);
  const playbackSpeed = useCelestialSimulationStore((state) => state.playbackSpeed);
  const timeStepSeconds = useCelestialSimulationStore((state) => state.timeStepSeconds);
  const setSimulationTime = useCelestialSimulationStore((state) => state.setSimulationTime);
  const togglePlayPause = useCelestialSimulationStore((state) => state.togglePlayPause);
  const setPlaybackSpeed = useCelestialSimulationStore((state) => state.setPlaybackSpeed);
  const setTimeStepSeconds = useCelestialSimulationStore((state) => state.setTimeStepSeconds);
  const resetToInitialEpoch = useCelestialSimulationStore((state) => state.resetToInitialEpoch);
  const stepForward = useCelestialSimulationStore((state) => state.stepForward);
  const stepBackward = useCelestialSimulationStore((state) => state.stepBackward);
  const updateCelestialPositions = useCelestialSimulationStore((state) => state.updateCelestialPositions);

  const selectedLat = useLocationStore((state) => state.selectedLatitude);
  const selectedLon = useLocationStore((state) => state.selectedLongitude);
  const activeDatasetId = useDynamicAnalysisStore((state) => state.activeDatasetId) || 'site01';

  // Animation interval for playing simulation time
  const animRef = useRef<any>(null);

  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) clearInterval(animRef.current);
      return;
    }

    // Interval fires every 250ms advancing simulation time
    animRef.current = setInterval(() => {
      const curMs = new Date(simulationTime).getTime();
      // Delta in seconds = (interval in sec) * playbackSpeed
      // Scaled so 1x = 1 real sec, 100x = 100s per sec, etc.
      const deltaSec = 0.25 * playbackSpeed;
      const nextTime = new Date(curMs + deltaSec * 1000).toISOString();
      setSimulationTime(nextTime);
      updateCelestialPositions(selectedLat, selectedLon, activeDatasetId, nextTime);
    }, 250);

    return () => {
      if (animRef.current) clearInterval(animRef.current);
    };
  }, [isPlaying, playbackSpeed, simulationTime, selectedLat, selectedLon, activeDatasetId, setSimulationTime, updateCelestialPositions]);

  // Initial celestial update on mount
  useEffect(() => {
    updateCelestialPositions(selectedLat, selectedLon, activeDatasetId);
  }, [selectedLat, selectedLon, activeDatasetId]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    try {
      const parsed = new Date(val).toISOString();
      setSimulationTime(parsed);
      updateCelestialPositions(selectedLat, selectedLon, activeDatasetId, parsed);
    } catch {
      // Ignore intermediate typing
    }
  };

  // Format ISO timestamp for input (YYYY-MM-DDTHH:mm)
  const formattedForInput = simulationTime ? simulationTime.slice(0, 16) : '';

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 bg-[#080d1a]/95 backdrop-blur-md border border-slate-800 px-3 py-2 rounded-xl text-xs font-mono shadow-xl shrink-0">
      {/* Left: Playback & Step Controls */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={togglePlayPause}
          title={isPlaying ? 'Pause Celestial Time (Space)' : 'Play Celestial Time (Space)'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold shadow-md transition-all ${
            isPlaying
              ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20'
              : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
          }`}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
        </button>

        <button
          onClick={() => stepBackward(selectedLat, selectedLon, activeDatasetId)}
          title="Step Backward"
          className="p-1.5 rounded-lg bg-[#0c1220] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => stepForward(selectedLat, selectedLon, activeDatasetId)}
          title="Step Forward"
          className="p-1.5 rounded-lg bg-[#0c1220] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => {
            resetToInitialEpoch();
            updateCelestialPositions(selectedLat, selectedLon, activeDatasetId, '2026-10-04T12:00:00Z');
          }}
          title="Reset to Initial Epoch (2026-10-04 12:00 UTC)"
          className="p-1.5 rounded-lg bg-[#0c1220] hover:bg-slate-800 text-slate-400 hover:text-emerald-400 border border-slate-700 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* UTC Date & Time Picker */}
        <div className="flex items-center gap-1.5 bg-[#050811] px-2.5 py-1 rounded-lg border border-slate-700">
          <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="text-slate-400 text-[10px] uppercase font-bold">UTC:</span>
          <input
            type="datetime-local"
            value={formattedForInput}
            onChange={handleDateChange}
            className="bg-transparent text-emerald-400 font-bold text-xs outline-none cursor-pointer"
          />
        </div>
      </div>

      {/* Right: Speed & Step Selectors */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Playback Speeds */}
        <div className="flex items-center gap-1 bg-[#050811] p-0.5 rounded-lg border border-slate-800 text-[11px]">
          <span className="text-[10px] text-slate-400 px-1.5 flex items-center gap-0.5">
            <Zap className="w-3 h-3 text-amber-400" /> SPEED:
          </span>
          {[1, 10, 100, 1000, 10000].map((s) => (
            <button
              key={s}
              onClick={() => setPlaybackSpeed(s)}
              className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                playbackSpeed === s
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {s.toLocaleString()}×
            </button>
          ))}
        </div>

        {/* Configurable Steps */}
        <div className="flex items-center gap-1 bg-[#050811] p-0.5 rounded-lg border border-slate-800 text-[11px]">
          <span className="text-[10px] text-slate-400 px-1.5">STEP:</span>
          {[
            { label: '1m', sec: 60 },
            { label: '10m', sec: 600 },
            { label: '1h', sec: 3600 },
            { label: '6h', sec: 21600 },
            { label: '24h', sec: 86400 },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => setTimeStepSeconds(item.sec)}
              className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                timeStepSeconds === item.sec
                  ? 'bg-cyan-500 text-black shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
