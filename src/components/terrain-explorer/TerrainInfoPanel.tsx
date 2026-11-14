import React, { useEffect } from 'react';
import { useLocationStore } from '../../stores/locationStore';
import { fetchTerrainMetadata } from '../../services/terrainApi';
import { formatCoordinates } from '../../utils/lunarCoordinates';
import {
  MapPin,
  BarChart3,
  Sliders,
  Info,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export const TerrainInfoPanel: React.FC = () => {
  const selectedLatitude = useLocationStore((state) => state.selectedLatitude);
  const selectedLongitude = useLocationStore((state) => state.selectedLongitude);
  const currentElevationData = useLocationStore((state) => state.currentElevationData);
  const terrainMetadata = useLocationStore((state) => state.terrainMetadata);
  const setTerrainMetadata = useLocationStore((state) => state.setTerrainMetadata);

  const terrainExaggeration = useLocationStore((state) => state.terrainExaggeration);
  const setTerrainExaggeration = useLocationStore((state) => state.setTerrainExaggeration);
  const terrainLod = useLocationStore((state) => state.terrainLod);
  const setTerrainLod = useLocationStore((state) => state.setTerrainLod);

  const elevationLayerType = useLocationStore((state) => state.elevationLayerType);

  useEffect(() => {
    fetchTerrainMetadata().then((meta) => {
      if (meta) setTerrainMetadata(meta);
    });
  }, [setTerrainMetadata]);

  return (
    <div className="flex flex-col gap-4 text-xs font-mono">
      {/* SECTION A: SELECTED LOCATION */}
      <div className="bg-[#0c121e]/95 backdrop-blur-md border border-slate-800 rounded-xl p-3.5 shadow-xl space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="flex items-center gap-1.5 font-bold uppercase text-slate-200">
            <MapPin className="w-4 h-4 text-emerald-400" />
            SELECTED LOCATION
          </span>
          <span className="text-[10px] text-slate-400">DATUM R=1,737.4 KM</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] text-slate-500">COORDINATES</div>
            <div className="text-emerald-400 font-bold truncate">
              {formatCoordinates({ latitude: selectedLatitude, longitude: selectedLongitude }, 3)}
            </div>
            <div className="text-[10px] text-slate-400">
              {selectedLatitude.toFixed(5)}°, {selectedLongitude.toFixed(5)}°
            </div>
          </div>

          <div>
            <div className="text-[10px] text-slate-500">COVERAGE STATUS</div>
            <div className="flex items-center gap-1 mt-0.5">
              {currentElevationData?.in_bounds ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold uppercase">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  {currentElevationData.quality_status}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  Outside Site01 DEM
                </span>
              )}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-slate-500">SURFACE ELEVATION</div>
            <div className="text-base font-bold text-slate-100">
              {currentElevationData?.in_bounds && typeof currentElevationData.elevation_m === 'number'
                ? `${currentElevationData.elevation_m > 0 ? '+' : ''}${currentElevationData.elevation_m.toFixed(1)} m`
                : 'N/A'}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-slate-500">LOCAL SLOPE</div>
            <div className="text-base font-bold text-slate-100">
              {currentElevationData?.in_bounds && typeof currentElevationData.slope_deg === 'number'
                ? `${currentElevationData.slope_deg.toFixed(1)}°`
                : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION B: TERRAIN STATISTICS */}
      <div className="bg-[#0c121e]/95 backdrop-blur-md border border-slate-800 rounded-xl p-3.5 shadow-xl space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="flex items-center gap-1.5 font-bold uppercase text-slate-200">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            TERRAIN STATISTICS (SITE 01)
          </span>
          <span className="text-[10px] text-emerald-400">16 × 16 km</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#070b12] p-2 rounded-lg border border-slate-800/80">
            <div className="text-[10px] text-slate-500">MAX ELEVATION (PEAK)</div>
            <div className="text-emerald-400 font-bold text-sm">
              {terrainMetadata?.elevation_stats.max_m ? `+${terrainMetadata.elevation_stats.max_m.toFixed(1)} m` : '+1,959.5 m'}
            </div>
          </div>

          <div className="bg-[#070b12] p-2 rounded-lg border border-slate-800/80">
            <div className="text-[10px] text-slate-500">MIN ELEVATION (BASIN)</div>
            <div className="text-cyan-400 font-bold text-sm">
              {terrainMetadata?.elevation_stats.min_m ? `${terrainMetadata.elevation_stats.min_m.toFixed(1)} m` : '-523.2 m'}
            </div>
          </div>

          <div className="bg-[#070b12] p-2 rounded-lg border border-slate-800/80">
            <div className="text-[10px] text-slate-500">MEAN ELEVATION</div>
            <div className="text-slate-200 font-bold text-sm">
              {terrainMetadata?.elevation_stats.mean_m ? `+${terrainMetadata.elevation_stats.mean_m.toFixed(1)} m` : '+1,139.1 m'}
            </div>
          </div>

          <div className="bg-[#070b12] p-2 rounded-lg border border-slate-800/80">
            <div className="text-[10px] text-slate-500">ELEVATION RANGE (ΔH)</div>
            <div className="text-amber-400 font-bold text-sm">
              {terrainMetadata?.elevation_stats.range_m ? `${terrainMetadata.elevation_stats.range_m.toFixed(1)} m` : '2,482.7 m'}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION C: TERRAIN CONTROLS */}
      <div className="bg-[#0c121e]/95 backdrop-blur-md border border-slate-800 rounded-xl p-3.5 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="flex items-center gap-1.5 font-bold uppercase text-slate-200">
            <Sliders className="w-4 h-4 text-emerald-400" />
            TERRAIN CONTROLS
          </span>
        </div>

        {/* Vertical Exaggeration Slider */}
        <div className="space-y-1 bg-[#070b12] p-2.5 rounded-lg border border-slate-800">
          <div className="flex justify-between items-center text-[11px]">
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
          <div className="flex justify-between text-[9px] text-slate-500">
            <span>1.0× (True Scale)</span>
            <span>3.0×</span>
            <span>5.0× (Perceptual)</span>
          </div>
          {terrainExaggeration > 1.0 && (
            <div className="text-[9px] text-amber-400/90 pt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>Exaggeration active for visual relief. Real physical slope is preserved.</span>
            </div>
          )}
        </div>

        {/* Mesh Detail LOD */}
        <div className="space-y-1 bg-[#070b12] p-2.5 rounded-lg border border-slate-800">
          <span className="text-[11px] text-slate-400 block mb-1">Mesh Resolution (LOD):</span>
          <div className="grid grid-cols-3 gap-1.5">
            {(['low', 'medium', 'high'] as const).map((lod) => (
              <button
                key={lod}
                type="button"
                onClick={() => setTerrainLod(lod)}
                className={`py-1 text-[10px] rounded font-semibold uppercase transition-all ${
                  terrainLod === lod
                    ? 'bg-emerald-500 text-black shadow-md'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
                }`}
              >
                {lod === 'low' ? 'Low (4K)' : lod === 'medium' ? 'Med (16K)' : 'High (65K)'}
              </button>
            ))}
          </div>
        </div>

        {/* 2D Map Colormap Legend */}
        <div className="space-y-2 bg-[#070b12] p-2.5 rounded-lg border border-slate-800">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-semibold">2D Layer Colormap:</span>
            <span className="text-emerald-400 uppercase font-bold text-[10px]">{elevationLayerType}</span>
          </div>

          {elevationLayerType === 'elevation' ? (
            <div className="space-y-1">
              <div className="text-[9px] text-slate-400 flex justify-between">
                <span>-520 m (Deep Basins)</span>
                <span>+1,960 m (Ridge Crest)</span>
              </div>
              <div
                className="h-2 rounded w-full"
                style={{
                  background: 'linear-gradient(to right, #1d0e40, #2b4984, #1b8770, #4db150, #d6d338, #ffffff)',
                }}
              />
            </div>
          ) : (
            <div className="space-y-1 text-[9px]">
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
      </div>

      {/* SECTION D: DATA QUALITY & PROVENANCE */}
      <div className="bg-[#0c121e]/95 backdrop-blur-md border border-slate-800 rounded-xl p-3.5 shadow-xl space-y-2">
        <div className="flex items-center gap-1.5 font-bold uppercase text-slate-200 border-b border-slate-800 pb-2">
          <Info className="w-4 h-4 text-emerald-400" />
          SCIENTIFIC DATA QUALITY & PROVENANCE
        </div>

        <div className="space-y-1.5 text-[10px] text-slate-400">
          <div><strong className="text-slate-300">Product:</strong> NASA LOLA South Pole 5m DEM (PGDA #78)</div>
          <div><strong className="text-slate-300">Reference Frame:</strong> MOON_ME (DE421)</div>
          <div><strong className="text-slate-300">Projection:</strong> South Polar Stereographic (R = 1,737,400 m)</div>
          <div><strong className="text-slate-300">Raster Grid Spacing:</strong> 5.0 m / pixel</div>
          <div className="p-2 rounded bg-[#070b12] border border-amber-900/40 text-amber-300/90 text-[9px] leading-relaxed">
            <strong className="text-amber-200 block mb-0.5">Measurement Support Caveat:</strong>
            5 m pixel spacing reflects the raster interpolation mesh, not the effective laser measurement footprint.
            Approximately ~90% of raster pixels between LOLA orbital tracks are interpolated via Delaunay triangulation.
          </div>
        </div>
      </div>
    </div>
  );
};
