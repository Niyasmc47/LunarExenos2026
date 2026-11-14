import React, { useEffect } from 'react';
import { useHorizonStore } from '../../stores/horizonStore';
import { useLocationStore } from '../../stores/locationStore';
import { useDynamicAnalysisStore } from '../../stores/dynamicAnalysisStore';
import { HorizonCircularRadar } from './HorizonCircularRadar';
import { HorizonElevationGraph } from './HorizonElevationGraph';
import { TerrainViewer3D } from '../terrain-explorer/TerrainViewer3D';
import { Compass, Mountain } from 'lucide-react';

export const HorizonExplorerView: React.FC = () => {
  const {
    horizonData,
    hoveredPoint,
    setHoveredPoint,
    computeHorizon,
  } = useHorizonStore();

  const selectedLat = useLocationStore((state) => state.selectedLatitude);
  const selectedLon = useLocationStore((state) => state.selectedLongitude);
  const currentPointTelemetry = useDynamicAnalysisStore((state) => state.currentPointTelemetry);

  // Determine observer coordinate: use user's inspected point if set, else selected location
  const observerLat = currentPointTelemetry?.latitude ?? selectedLat;
  const observerLon = currentPointTelemetry?.longitude ?? selectedLon;

  // Trigger compute on initial mount or when inspected observer changes
  useEffect(() => {
    computeHorizon(observerLat, observerLon);
  }, [observerLat, observerLon, computeHorizon]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden gap-2">
      {/* Top Skyline Alert Banner */}
      {horizonData && (
        <div className="shrink-0 flex items-center justify-between bg-[#0c121e]/80 border border-slate-800/80 px-3 py-1.5 rounded-xl text-xs font-mono">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300">
              Observer Location:{' '}
              <span className="text-emerald-400 font-bold">
                {observerLat.toFixed(4)}°, {observerLon.toFixed(4)}°
              </span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-400">
              Max Obstruction:{' '}
              <span className="text-emerald-400 font-bold">
                +{horizonData.summary.max_horizon_elevation_deg.toFixed(1)}°
              </span>{' '}
              at Azimuth {horizonData.summary.max_horizon_azimuth_deg.toFixed(0)}°
            </span>
            <span className="text-slate-400">
              Eye Height: <span className="text-sky-400 font-bold">{horizonData.observer_height_m} m</span>
            </span>
          </div>
        </div>
      )}

      {/* Primary Horizon Visualizations Area */}
      <div className="flex-1 flex flex-col lg:flex-row gap-2 min-h-0 overflow-hidden">
        {/* Left Side: Circular 360° Polar Radar */}
        <div className="w-full lg:w-[45%] flex flex-col min-h-0">
          <HorizonCircularRadar
            data={horizonData}
            hoveredPoint={hoveredPoint}
            onHoverPoint={setHoveredPoint}
          />
        </div>

        {/* Right Side: Cartesian Azimuth vs Elevation Graph + 3D Visual Context */}
        <div className="w-full lg:w-[55%] flex flex-col gap-2 min-h-0">
          {/* Top: Cartesian Elevation Graph */}
          <div className="flex-1 min-h-[220px]">
            <HorizonElevationGraph
              data={horizonData}
              hoveredPoint={hoveredPoint}
              onHoverPoint={setHoveredPoint}
            />
          </div>

          {/* Bottom: Context 3D Terrain View showing observer position */}
          <div className="h-44 shrink-0 rounded-xl overflow-hidden border border-slate-800 bg-[#070b12] relative">
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#0c121e]/90 border border-slate-700 text-[10px] font-mono text-emerald-400">
              <Mountain className="w-3 h-3" />
              <span>3D TERRAIN OBSERVER CONTEXT</span>
            </div>
            <TerrainViewer3D />
          </div>
        </div>
      </div>
    </div>
  );
};
