import React, { useState } from 'react';
import { useLocationStore } from '../../stores/locationStore';
import { formatCoordinates } from '../../utils/lunarCoordinates';
import { ViewSwitcher } from '../controls/ViewSwitcher';
import { Orbit, Copy, Check, Radio, Globe2, Mountain, GitCompare, SlidersHorizontal, ShieldCheck, CalendarClock, Compass, Scale, FileText } from 'lucide-react';

export const Header: React.FC = () => {
  const appScreen = useLocationStore((state) => state.appScreen);
  const setAppScreen = useLocationStore((state) => state.setAppScreen);
  const selectedLatitude = useLocationStore((state) => state.selectedLatitude);
  const selectedLongitude = useLocationStore((state) => state.selectedLongitude);
  const liveCapabilitiesActive = useLocationStore((state) => state.liveCapabilitiesActive);

  const [copied, setCopied] = useState(false);

  const handleCopyCoords = () => {
    const text = formatCoordinates({ latitude: selectedLatitude, longitude: selectedLongitude });
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="h-16 shrink-0 bg-[#070b12]/95 border-b border-slate-800/80 px-3 md:px-6 flex items-center justify-between backdrop-blur-md z-30">
      {/* Brand & Project Identity */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-slate-900 border border-emerald-500/40 shadow-lg shadow-emerald-950/40">
          <Orbit className="w-5 h-5 text-emerald-400 animate-spin-slow" />
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-wider text-slate-100 font-mono">
              LUNAVISTA
            </h1>
            <span className="text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded tracking-widest font-semibold">
              {appScreen === 'lunar-explorer' ? 'MVP 1' : appScreen === 'terrain-explorer' ? 'MVP 2–5' : appScreen === 'mission-comparison' ? 'MVP 6' : appScreen === 'candidate-screening' ? 'MVP 7.2' : appScreen === 'window-planner' ? 'MVP 7.3' : appScreen === 'terrain-assessment' ? 'MVP 7.4' : appScreen === 'trade-off-analysis' ? 'MVP 7.5' : appScreen === 'mission-reports' ? 'MVP 7.6' : 'MVP 7.1'}
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400 hidden xl:block">
            Lunar Landing-Site Evaluation • NASA Space Apps 2026
          </span>
        </div>
      </div>

      {/* Screen Navigation Tabs */}
      <div className="flex items-center bg-[#0c121e] border border-slate-800 p-1 rounded-xl shadow-inner">
        <button
          onClick={() => setAppScreen('lunar-explorer')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
            appScreen === 'lunar-explorer'
              ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Globe2 className="w-3.5 h-3.5" />
          <span>LUNAR EXPLORER</span>
        </button>

        <button
          onClick={() => setAppScreen('terrain-explorer')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
            appScreen === 'terrain-explorer'
              ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Mountain className="w-3.5 h-3.5" />
          <span>TERRAIN EXPLORER</span>
          <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-600/40 hidden sm:inline">
            SITE 01
          </span>
        </button>

        <button
          onClick={() => setAppScreen('mission-comparison')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
            appScreen === 'mission-comparison'
              ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <GitCompare className="w-3.5 h-3.5" />
          <span>SCENARIO COMPARISON</span>
        </button>

        <button
          onClick={() => setAppScreen('mission-requirements')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
            appScreen === 'mission-requirements'
              ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>REQUIREMENTS</span>
        </button>

        <button
          onClick={() => setAppScreen('candidate-screening')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
            appScreen === 'candidate-screening'
              ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>SCREENING</span>
          <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-600/40 hidden sm:inline">
            MVP 7.2
          </span>
        </button>

        <button
          onClick={() => setAppScreen('window-planner')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
            appScreen === 'window-planner'
              ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <CalendarClock className="w-3.5 h-3.5" />
          <span>WINDOW PLANNER</span>
          <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-600/40 hidden sm:inline">
            MVP 7.3
          </span>
        </button>

        <button
          onClick={() => setAppScreen('terrain-assessment')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
            appScreen === 'terrain-assessment'
              ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>TERRAIN ASSESSMENT</span>
          <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-600/40 hidden sm:inline">
            MVP 7.4
          </span>
        </button>

        <button
          onClick={() => setAppScreen('trade-off-analysis')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
            appScreen === 'trade-off-analysis'
              ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Scale className="w-3.5 h-3.5" />
          <span>TRADE-OFF</span>
          <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-600/40 hidden sm:inline">
            MVP 7.5
          </span>
        </button>

        <button
          onClick={() => setAppScreen('mission-reports')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
            appScreen === 'mission-reports'
              ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>REPORTS</span>
          <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-pink-950 text-pink-300 border border-pink-600/40 hidden sm:inline">
            MVP 7.6
          </span>
        </button>
      </div>

      {/* Center/Right Controls */}
      <div className="flex items-center gap-3">
        {/* View Switcher only in Lunar Explorer */}
        {appScreen === 'lunar-explorer' && (
          <div className="hidden lg:flex items-center">
            <ViewSwitcher />
          </div>
        )}

        {/* Dataset Label in Terrain Explorer */}
        {appScreen === 'terrain-explorer' && (
          <div className="hidden lg:flex items-center gap-1.5 bg-[#0c121e] border border-slate-800 px-2.5 py-1.5 rounded-lg text-xs font-mono text-slate-300">
            <Mountain className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] text-slate-400">DEM:</span>
            <span className="text-emerald-400 font-semibold text-[11px]">NASA LOLA 5m/px</span>
          </div>
        )}

        {/* Live Service Status */}
        <div className="hidden md:flex items-center gap-1.5 bg-[#0c121e] border border-slate-800 px-2.5 py-1.5 rounded-lg text-xs font-mono text-slate-400">
          <Radio className={`w-3.5 h-3.5 ${liveCapabilitiesActive ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className="text-[11px]">NASA TREK:</span>
          <span className={`text-[11px] font-semibold ${liveCapabilitiesActive ? 'text-emerald-400' : 'text-amber-400'}`}>
            {liveCapabilitiesActive ? 'LIVE' : 'ACTIVE'}
          </span>
        </div>

        {/* Selected Coordinates Readout Button */}
        <button
          onClick={handleCopyCoords}
          title="Click to copy coordinates"
          className="flex items-center gap-2 bg-[#0c121e] hover:bg-slate-800/80 border border-slate-700/80 hover:border-emerald-500/50 px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-mono transition-all group"
        >
          <span className="text-slate-400 text-[11px] hidden sm:inline">COORDS:</span>
          <span className="text-emerald-400 font-semibold tracking-wide text-[11px] md:text-xs">
            {formatCoordinates({ latitude: selectedLatitude, longitude: selectedLongitude }, 3)}
          </span>
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
          )}
        </button>
      </div>
    </header>
  );
};
