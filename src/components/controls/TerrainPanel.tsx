import React, { useEffect } from 'react';
import { useLocationStore } from '../../stores/locationStore';
import { fetchTerrainMetadata } from '../../services/terrainApi';
import {
  Mountain,
  Layers,
  Info,
  AlertTriangle,
  Activity
} from 'lucide-react';

export const TerrainPanel: React.FC = () => {
  const terrainEnabled = useLocationStore((state) => state.terrainEnabled);
  const terrainExaggeration = useLocationStore((state) => state.terrainExaggeration);
  const terrainLod = useLocationStore((state) => state.terrainLod);
  const elevationLayerVisible = useLocationStore((state) => state.elevationLayerVisible);
  const elevationLayerType = useLocationStore((state) => state.elevationLayerType);
  const currentElevationData = useLocationStore((state) => state.currentElevationData);

  const setTerrainEnabled = useLocationStore((state) => state.setTerrainEnabled);
  const setTerrainExaggeration = useLocationStore((state) => state.setTerrainExaggeration);
  const setTerrainLod = useLocationStore((state) => state.setTerrainLod);
  const setElevationLayerVisible = useLocationStore((state) => state.setElevationLayerVisible);
  const setElevationLayerType = useLocationStore((state) => state.setElevationLayerType);
  const setTerrainMetadata = useLocationStore((state) => state.setTerrainMetadata);

  // Load dataset metadata from backend on mount
  useEffect(() => {
    fetchTerrainMetadata().then((meta) => {
      if (meta) setTerrainMetadata(meta);
    });
  }, [setTerrainMetadata]);

  return (
    <div className="flex flex-col gap-4 bg-[#141619] backdrop-blur-md border border-[#2b2d32] rounded-xl p-4 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2b2d32] pb-3">
        <div className="flex items-center gap-2">
          <Mountain className="w-4 h-4 text-emerald-400" />
          <h2 className="text-xs font-bold tracking-wider uppercase text-slate-200 font-mono">
            LUNAR TERRAIN ENGINE
          </h2>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          LOLA 5M DEM
        </span>
      </div>

      {/* Target Site Card */}
      <div className="bg-[#0e1013] border border-[#2b2d32] rounded-lg p-3 text-xs font-mono space-y-1.5">
        <div className="flex items-center justify-between text-slate-400">
          <span className="font-semibold text-slate-200">Site 01 — Connecting Ridge</span>
          <span className="text-[10px] text-emerald-400">South Pole</span>
        </div>
        <div className="text-[11px] text-slate-400">
          NASA candidate Artemis landing site near Shackleton Crater (89.46° S, 137.49° W).
        </div>
      </div>

      {/* 3D Globe Mesh Controls */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-mono text-slate-300 font-semibold flex items-center gap-1.5">
            <Mountain className="w-3.5 h-3.5 text-emerald-400" />
            <span>3D TERRAIN PATCH</span>
          </label>
          <button
            type="button"
            onClick={() => setTerrainEnabled(!terrainEnabled)}
            className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors ${
              terrainEnabled
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border border-[#303238]'
            }`}
          >
            {terrainEnabled ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>

        {/* Vertical Exaggeration Slider */}
        <div className="space-y-1 bg-[#0e1013] p-2.5 rounded-lg border border-[#2b2d32]">
          <div className="flex justify-between items-center text-[11px] font-mono">
            <span className="text-slate-400">Vertical Exaggeration:</span>
            <span className="text-emerald-400 font-bold">{terrainExaggeration.toFixed(1)}×</span>
          </div>
          <input
            type="range"
            min="1.0"
            max="5.0"
            step="0.5"
            value={terrainExaggeration}
            onChange={(e) => setTerrainExaggeration(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-[9px] font-mono text-slate-500">
            <span>1.0× (True Scale)</span>
            <span>3.0×</span>
            <span>5.0× (Exaggerated)</span>
          </div>
          {terrainExaggeration > 1.0 && (
            <div className="text-[9px] font-mono text-amber-400/90 pt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>Visual exaggeration enabled. True physical slope is preserved in telemetry.</span>
            </div>
          )}
        </div>

        {/* LOD Level of Detail Selector */}
        <div className="space-y-1 bg-[#0e1013] p-2.5 rounded-lg border border-[#2b2d32]">
          <span className="text-[11px] font-mono text-slate-400 block mb-1">Mesh Resolution (LOD):</span>
          <div className="grid grid-cols-3 gap-1.5">
            {(['low', 'medium', 'high'] as const).map((lod) => (
              <button
                key={lod}
                type="button"
                onClick={() => setTerrainLod(lod)}
                className={`py-1 text-[10px] font-mono rounded font-semibold uppercase transition-all ${
                  terrainLod === lod
                    ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-[#2b2d32]'
                }`}
              >
                {lod === 'low' ? 'Low (4K)' : lod === 'medium' ? 'Med (16K)' : 'High (65K)'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2D Map Elevation Overlay Controls */}
      <div className="space-y-2 pt-2 border-t border-[#2b2d32]">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-mono text-slate-300 font-semibold flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>2D MAP OVERLAY</span>
          </label>
          <button
            type="button"
            onClick={() => setElevationLayerVisible(!elevationLayerVisible)}
            className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors ${
              elevationLayerVisible
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border border-[#303238]'
            }`}
          >
            {elevationLayerVisible ? 'VISIBLE' : 'HIDDEN'}
          </button>
        </div>

        {elevationLayerVisible && (
          <div className="space-y-2 bg-[#0e1013] p-2.5 rounded-lg border border-[#2b2d32]">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setElevationLayerType('elevation')}
                className={`py-1 px-2 text-[10px] font-mono rounded font-semibold transition-all ${
                  elevationLayerType === 'elevation'
                    ? 'bg-emerald-500 text-black shadow-md'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-[#303238]'
                }`}
              >
                ELEVATION TINT
              </button>
              <button
                type="button"
                onClick={() => setElevationLayerType('slope')}
                className={`py-1 px-2 text-[10px] font-mono rounded font-semibold transition-all ${
                  elevationLayerType === 'slope'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-[#303238]'
                }`}
              >
                SLOPE HAZARDS
              </button>
            </div>

            {/* Dynamic Legend */}
            {elevationLayerType === 'elevation' ? (
              <div className="space-y-1 pt-1">
                <div className="text-[9px] font-mono text-slate-400 flex justify-between">
                  <span>-520 m (Deep Basins)</span>
                  <span>+1,960 m (Ridge Peaks)</span>
                </div>
                <div
                  className="h-2 rounded w-full"
                  style={{
                    background: 'linear-gradient(to right, #1d0e40, #2b4984, #1b8770, #4db150, #d6d338, #ffffff)',
                  }}
                />
              </div>
            ) : (
              <div className="space-y-1.5 pt-1 text-[9px] font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shrink-0" />
                  <span className="text-slate-300">0° – 5°: Safe Landing (Low tilt risk)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 shrink-0" />
                  <span className="text-slate-300">5° – 15°: Moderate Slope (Caution)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-600 shrink-0" />
                  <span className="text-slate-300">&gt; 15°: Steep Slope / Hazard</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live Elevation & Slope Point Inspection */}
      <div className="space-y-1.5 pt-2 border-t border-[#2b2d32]">
        <label className="text-[11px] font-mono text-slate-300 font-semibold flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span>REAL-TIME TERRAIN TELEMETRY</span>
        </label>

        <div className="bg-[#0e1013] border border-[#2b2d32] rounded-lg p-3 text-xs font-mono space-y-2">
          {currentElevationData?.in_bounds ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] text-slate-500">LOLA ELEVATION</div>
                <div className="text-emerald-400 font-bold text-sm">
                  {currentElevationData.elevation_m !== null && currentElevationData.elevation_m !== undefined
                    ? `${currentElevationData.elevation_m > 0 ? '+' : ''}${currentElevationData.elevation_m.toFixed(1)} m`
                    : 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">LOCAL SLOPE</div>
                <div className="text-slate-200 font-bold text-sm">
                  {currentElevationData.slope_deg !== null && currentElevationData.slope_deg !== undefined
                    ? `${currentElevationData.slope_deg.toFixed(1)}°`
                    : 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">SAMPLING STATUS</div>
                <div className="text-slate-300 text-[11px] uppercase">
                  {currentElevationData.quality_status}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">REFERENCE DATUM</div>
                <div className="text-slate-300 text-[11px]">
                  R = 1,737,400 m
                </div>
              </div>
            </div>
          ) : (
            <div className="text-slate-500 text-[11px] italic py-1 text-center">
              Click on the South Pole (Site 01) on the 2D map or 3D globe to inspect high-resolution elevation & slope.
            </div>
          )}
        </div>
      </div>

      {/* Scientific Data Quality & Provenance Card */}
      <div className="bg-[#0e1013] border border-[#202228] rounded-lg p-2.5 text-[10px] font-mono text-slate-400 space-y-1">
        <div className="flex items-center gap-1 text-slate-300 font-semibold">
          <Info className="w-3 h-3 text-emerald-400" />
          <span>DATASET PROVENANCE</span>
        </div>
        <div>Source: NASA GSFC LOLA South Pole 5m DEM</div>
        <div>Frame: MOON_ME (DE421) | South Polar Stereographic</div>
        <div className="text-[9px] text-slate-500">
          Note: 5 m pixel grid spacing. Real orbital laser tracks are ~90% interpolated between tracks.
        </div>
      </div>
    </div>
  );
};
