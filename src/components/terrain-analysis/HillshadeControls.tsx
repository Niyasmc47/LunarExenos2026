import React from 'react';
import { useDynamicAnalysisStore } from '../../stores/dynamicAnalysisStore';
import { Sun, Info } from 'lucide-react';

export const HillshadeControls: React.FC = () => {
  const hillshadeAzimuth = useDynamicAnalysisStore((state) => state.hillshadeAzimuth);
  const hillshadeAltitude = useDynamicAnalysisStore((state) => state.hillshadeAltitude);
  const hillshadeZFactor = useDynamicAnalysisStore((state) => state.hillshadeZFactor);
  const setHillshadeParams = useDynamicAnalysisStore((state) => state.setHillshadeParams);

  return (
    <div className="bg-[#0c121e]/95 border border-slate-800 rounded-xl p-3 text-xs font-mono space-y-2.5 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="flex items-center gap-1.5 font-bold text-slate-200 uppercase">
          <Sun className="w-4 h-4 text-amber-400" />
          HILLSHADE ILLUMINATION CONTROLS
        </span>
        <span className="text-[10px] text-amber-400">CARTOGRAPHIC SHADING</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Illumination Azimuth */}
        <div className="space-y-1 bg-[#070b12] p-2 rounded-lg border border-slate-800">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-slate-400">Illumination Azimuth:</span>
            <span className="text-amber-400 font-bold">{hillshadeAzimuth.toFixed(0)}°</span>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            step="5"
            value={hillshadeAzimuth}
            onChange={(e) =>
              setHillshadeParams(parseFloat(e.target.value), hillshadeAltitude, hillshadeZFactor)
            }
            className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
          />
          <div className="flex justify-between text-[9px] text-slate-500">
            <span>0° (N)</span>
            <span>90° (E)</span>
            <span>180° (S)</span>
            <span>270° (W)</span>
            <span>315° (NW)</span>
          </div>
        </div>

        {/* Solar Altitude Angle */}
        <div className="space-y-1 bg-[#070b12] p-2 rounded-lg border border-slate-800">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-slate-400">Sun Altitude Angle:</span>
            <span className="text-amber-400 font-bold">{hillshadeAltitude.toFixed(0)}°</span>
          </div>
          <input
            type="range"
            min="10"
            max="90"
            step="5"
            value={hillshadeAltitude}
            onChange={(e) =>
              setHillshadeParams(hillshadeAzimuth, parseFloat(e.target.value), hillshadeZFactor)
            }
            className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
          />
          <div className="flex justify-between text-[9px] text-slate-500">
            <span>10° (Grazing)</span>
            <span>45° (Standard)</span>
            <span>90° (Zenith)</span>
          </div>
        </div>

        {/* Vertical Exaggeration Z-factor */}
        <div className="space-y-1 bg-[#070b12] p-2 rounded-lg border border-slate-800">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-slate-400">Z-Factor Multiplier:</span>
            <span className="text-amber-400 font-bold">{hillshadeZFactor.toFixed(1)}×</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="3.0"
            step="0.5"
            value={hillshadeZFactor}
            onChange={(e) =>
              setHillshadeParams(hillshadeAzimuth, hillshadeAltitude, parseFloat(e.target.value))
            }
            className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
          />
          <div className="flex justify-between text-[9px] text-slate-500">
            <span>0.5×</span>
            <span>1.0× (True)</span>
            <span>3.0×</span>
          </div>
        </div>
      </div>

      {/* Mandatory Scientific Disclaimer */}
      <div className="flex items-start gap-2 bg-[#070b12] p-2 rounded border border-amber-900/40 text-[10px] text-amber-300/90 leading-relaxed">
        <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
        <span>
          <strong>Scientific Notice:</strong> Conventional hillshade is an artificial morphological shading tool
          designed for cartographic relief perception. It is <strong>NOT</strong> an astronomical simulation of
          actual time-dependent lunar sunlight or permanently shadowed regions (PSRs).
        </span>
      </div>
    </div>
  );
};
