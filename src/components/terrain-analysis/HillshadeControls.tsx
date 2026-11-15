import React from 'react';
import { useDynamicAnalysisStore } from '../../stores/dynamicAnalysisStore';
import { Sun, Info } from 'lucide-react';

export const HillshadeControls: React.FC = () => {
  const hillshadeAzimuth = useDynamicAnalysisStore((state) => state.hillshadeAzimuth);
  const hillshadeAltitude = useDynamicAnalysisStore((state) => state.hillshadeAltitude);
  const hillshadeZFactor = useDynamicAnalysisStore((state) => state.hillshadeZFactor);
  const setHillshadeParams = useDynamicAnalysisStore((state) => state.setHillshadeParams);

  return (
    <div className="bg-[#0e1013] border border-[#2b2d32] rounded-xl p-3 text-xs font-mono space-y-2.5 shadow-xl">
      <div className="flex items-center justify-between border-b border-[#202228] pb-2">
        <span className="flex items-center gap-1.5 font-bold text-slate-200 uppercase tracking-wide">
          <Sun className="w-4 h-4 text-[#ffe3b0]" />
          DYNAMIC HILLSHADING VECTOR CONTROLS
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded bg-[#191b20] text-[#ffe3b0] border border-[#2b2d32] font-semibold">
          CARTOGRAPHIC RELIEF
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Illumination Azimuth (Sub-solar longitude) */}
        <div className="space-y-1.5 bg-[#141619] p-2.5 rounded-lg border border-[#2b2d32]">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-slate-400">Sun Azimuth (Sub-solar longitude):</span>
            <span className="text-[#ffe3b0] font-bold">{hillshadeAzimuth.toFixed(1)}°</span>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            step="1"
            value={hillshadeAzimuth}
            onChange={(e) =>
              setHillshadeParams(parseFloat(e.target.value), hillshadeAltitude, hillshadeZFactor)
            }
            className="w-full h-1.5 bg-[#08090b] rounded appearance-none cursor-pointer accent-[#ffe3b0]"
          />
          <div className="flex justify-between text-[9px] text-slate-500 font-mono">
            <span>0° (North)</span>
            <span>90° (East)</span>
            <span>180° (South)</span>
            <span>270° (West)</span>
          </div>
        </div>

        {/* Solar Altitude (Grazing Angle) */}
        <div className="space-y-1.5 bg-[#141619] p-2.5 rounded-lg border border-[#2b2d32]">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-slate-400">Solar Altitude (Grazing Angle):</span>
            <span className="text-[#ffe3b0] font-bold">+{hillshadeAltitude.toFixed(1)}°</span>
          </div>
          <input
            type="range"
            min="1"
            max="90"
            step="0.5"
            value={hillshadeAltitude}
            onChange={(e) =>
              setHillshadeParams(hillshadeAzimuth, parseFloat(e.target.value), hillshadeZFactor)
            }
            className="w-full h-1.5 bg-[#08090b] rounded appearance-none cursor-pointer accent-[#ffe3b0]"
          />
          <div className="flex justify-between text-[9px] text-slate-500 font-mono">
            <span>1° (Grazing)</span>
            <span>15° (Low sun)</span>
            <span>45° (Standard)</span>
            <span>90° (Zenith)</span>
          </div>
        </div>

        {/* Vertical Exaggeration Z-factor */}
        <div className="space-y-1.5 bg-[#141619] p-2.5 rounded-lg border border-[#2b2d32]">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-slate-400">Z-Factor Multiplier:</span>
            <span className="text-[#7bd0ff] font-bold">{hillshadeZFactor.toFixed(1)}×</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="3.0"
            step="0.1"
            value={hillshadeZFactor}
            onChange={(e) =>
              setHillshadeParams(hillshadeAzimuth, hillshadeAltitude, parseFloat(e.target.value))
            }
            className="w-full h-1.5 bg-[#08090b] rounded appearance-none cursor-pointer accent-[#7bd0ff]"
          />
          <div className="flex justify-between text-[9px] text-slate-500 font-mono">
            <span>0.5×</span>
            <span>1.0× (True)</span>
            <span>2.0×</span>
            <span>3.0×</span>
          </div>
        </div>
      </div>

      {/* Scientific Notice */}
      <div className="flex items-start gap-2 bg-[#08090b] p-2 rounded-lg border border-[#2b2d32] text-[10px] text-slate-400 leading-relaxed">
        <Info className="w-3.5 h-3.5 text-[#ffe3b0] shrink-0 mt-0.5" />
        <span>
          <strong className="text-slate-200">Notice:</strong> Hillshade provides morphological terrain relief perception. For ephemeris-accurate raytraced illumination and PSR shadows, inspect the <strong>Skyline Horizon</strong> and <strong>Solar &amp; Earth Visibility</strong> tabs.
        </span>
      </div>
    </div>
  );
};
