import React, { useState } from 'react';
import { useLocationStore } from '../../stores/locationStore';
import { formatCoordinates } from '../../utils/lunarCoordinates';
import { ViewSwitcher } from '../controls/ViewSwitcher';
import { Orbit, Copy, Check, Radio } from 'lucide-react';

export const Header: React.FC = () => {
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
    <header className="h-16 shrink-0 bg-[#070b12]/95 border-b border-slate-800/80 px-4 md:px-6 flex items-center justify-between backdrop-blur-md z-30">
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
              MVP 1
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400 hidden sm:block">
            Lunar Landing-Site Evaluation • NASA Space Apps 2026
          </span>
        </div>
      </div>

      {/* Center: View Switcher */}
      <div className="hidden lg:flex items-center">
        <ViewSwitcher />
      </div>

      {/* Right: Current Active Coordinates & NASA WMTS Status */}
      <div className="flex items-center gap-3">
        {/* Live Service Status */}
        <div className="hidden md:flex items-center gap-1.5 bg-[#0c121e] border border-slate-800 px-2.5 py-1.5 rounded-lg text-xs font-mono text-slate-400">
          <Radio className={`w-3.5 h-3.5 ${liveCapabilitiesActive ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className="text-[11px]">NASA TREK WMTS:</span>
          <span className={`text-[11px] font-semibold ${liveCapabilitiesActive ? 'text-emerald-400' : 'text-amber-400'}`}>
            {liveCapabilitiesActive ? 'LIVE' : 'ACTIVE'}
          </span>
        </div>

        {/* Selected Coordinates Readout Button */}
        <button
          onClick={handleCopyCoords}
          title="Click to copy coordinates"
          className="flex items-center gap-2 bg-[#0c121e] hover:bg-slate-800/80 border border-slate-700/80 hover:border-emerald-500/50 px-3 py-1.5 rounded-lg text-xs font-mono transition-all group"
        >
          <span className="text-slate-400 text-[11px] hidden sm:inline">COORDS:</span>
          <span className="text-emerald-400 font-semibold tracking-wide">
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
