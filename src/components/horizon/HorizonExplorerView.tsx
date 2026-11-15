import { ResultIntro } from '../ui/MissionSetup';
import React, { useEffect, useState } from 'react';
import { useHorizonStore } from '../../stores/horizonStore';
import { useLocationStore } from '../../stores/locationStore';
import { useDynamicAnalysisStore } from '../../stores/dynamicAnalysisStore';
import { HorizonCircularRadar } from './HorizonCircularRadar';
import { HorizonElevationGraph } from './HorizonElevationGraph';
import { TerrainViewer3D } from '../terrain-explorer/TerrainViewer3D';
import { Box, Compass, MousePointerClick, Maximize2 } from 'lucide-react';

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

  // Sub-view toggle inside Horizon Engine: '3d-split' | '3d-full' | 'skyline'
  const [viewLayout, setViewLayout] = useState<'3d-split' | '3d-full' | 'skyline'>('3d-split');
  // In split mode, toggle whether to display Radar or Graph
  const [rightPanelMode, setRightPanelMode] = useState<'radar' | 'graph'>('radar');

  // Determine observer coordinate: use user's inspected point if set, else selected location
  const observerLat = currentPointTelemetry?.latitude ?? selectedLat;
  const observerLon = currentPointTelemetry?.longitude ?? selectedLon;

  // Trigger compute on initial mount or when inspected observer changes
  useEffect(() => {
    computeHorizon(observerLat, observerLon);
  }, [observerLat, observerLon, computeHorizon]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto gap-2">
      <ResultIntro title="Your local skyline" description="Click the terrain to move the observer. The skyline shows where nearby ground blocks the sky." />
      {/* View Layout Controls & Quick Help */}
      <div className="shrink-0 flex items-center justify-between bg-[#0c121e]/90 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-mono">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
            <MousePointerClick className="w-3.5 h-3.5" />
            <span className="font-bold">Click terrain to move the observer</span>
          </div>
          <span className="text-slate-400 hidden md:inline text-[11px]">
            Selected: <span className="text-slate-200 font-bold">{observerLat.toFixed(4)}°, {observerLon.toFixed(4)}°</span>
          </span>
        </div>

        {/* View Mode Pills */}
        <div className="flex items-center gap-1 bg-[#070b12] p-1 rounded-lg border border-slate-800 text-[11px]">
          <button
            onClick={() => setViewLayout('3d-split')}
            title="Spacious 3D Terrain alongside interactive 360° Horizon Skyline"
            className={`flex items-center gap-1 px-2.5 py-1 rounded font-bold transition-all ${
              viewLayout === '3d-split'
                ? 'bg-emerald-500 text-black shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Box className="w-3 h-3" />
            <span>Terrain & skyline</span>
          </button>

          <button
            onClick={() => setViewLayout('3d-full')}
            title="Maximized fullscreen 3D Terrain view"
            className={`flex items-center gap-1 px-2.5 py-1 rounded font-bold transition-all ${
              viewLayout === '3d-full'
                ? 'bg-emerald-500 text-black shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Maximize2 className="w-3 h-3" />
            <span>Terrain only</span>
          </button>

          <button
            onClick={() => setViewLayout('skyline')}
            title="Dual Skyline Radar and Cartesian Graph analysis"
            className={`flex items-center gap-1 px-2.5 py-1 rounded font-bold transition-all ${
              viewLayout === 'skyline'
                ? 'bg-emerald-500 text-black shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-3 h-3" />
            <span>SKYLINE PROFILES</span>
          </button>
        </div>
      </div>

      {/* Main View Area based on viewLayout */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* LAYOUT 1: 3D-SPLIT (Spacious 3D Terrain on Left, Horizon Skyline on Right) */}
        {viewLayout === '3d-split' && (
          <div className="h-full flex flex-col lg:flex-row gap-2">
            {/* Big 3D Terrain View (takes 60% of space) */}
            <div className="w-full lg:w-[60%] h-full flex flex-col min-h-[350px]">
              <TerrainViewer3D />
            </div>

            {/* Right Side Horizon Skyline Panel (takes 40% of space) */}
            <div className="w-full lg:w-[40%] h-full flex flex-col gap-1.5 min-h-0">
              {/* Radar vs Graph Switcher Header */}
              <div className="shrink-0 flex items-center justify-between bg-[#0c121e]/90 px-3 py-1 rounded-lg border border-slate-800 text-[11px] font-mono">
                <span className="text-slate-400 font-bold">HORIZON SKYLINE:</span>
                <div className="flex items-center gap-1 bg-[#070b12] p-0.5 rounded border border-slate-800">
                  <button
                    onClick={() => setRightPanelMode('radar')}
                    className={`px-2 py-0.5 rounded font-bold transition-colors ${
                      rightPanelMode === 'radar'
                        ? 'bg-emerald-500 text-black'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    360° POLAR RADAR
                  </button>
                  <button
                    onClick={() => setRightPanelMode('graph')}
                    className={`px-2 py-0.5 rounded font-bold transition-colors ${
                      rightPanelMode === 'graph'
                        ? 'bg-emerald-500 text-black'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ELEVATION GRAPH
                  </button>
                </div>
              </div>

              {/* Display either Radar or Graph with full height */}
              <div className="flex-1 min-h-0">
                {rightPanelMode === 'radar' ? (
                  <HorizonCircularRadar
                    data={horizonData}
                    hoveredPoint={hoveredPoint}
                    onHoverPoint={setHoveredPoint}
                  />
                ) : (
                  <HorizonElevationGraph
                    data={horizonData}
                    hoveredPoint={hoveredPoint}
                    onHoverPoint={setHoveredPoint}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* LAYOUT 2: Terrain only TERRAIN (100% View with floating Horizon badge) */}
        {viewLayout === '3d-full' && (
          <div className="relative w-full h-full">
            <TerrainViewer3D />

            {/* Floating Skyline Quick Badge */}
            {horizonData && (
              <div className="absolute top-16 right-3 z-30 bg-[#0c121e]/95 backdrop-blur-md border border-slate-700/80 p-3 rounded-xl shadow-2xl max-w-xs text-xs font-mono pointer-events-auto">
                <div className="flex items-center justify-between text-emerald-400 font-bold mb-1">
                  <span className="flex items-center gap-1.5">
                    <Compass className="w-4 h-4" />
                    SKYLINE OBSTRUCTION
                  </span>
                  <span>+{horizonData.summary.max_horizon_elevation_deg.toFixed(1)}°</span>
                </div>
                <div className="text-[11px] text-slate-300">
                  Peak at Azimuth: <span className="text-white font-bold">{horizonData.summary.max_horizon_azimuth_deg.toFixed(0)}°</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Eye height: {horizonData.observer_height_m}m | {horizonData.summary.valid_samples_count.toLocaleString()} samples
                </div>
                <button
                  onClick={() => setViewLayout('3d-split')}
                  className="w-full mt-2 py-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded text-[11px] text-center transition-all"
                >
                  OPEN POLAR RADAR
                </button>
              </div>
            )}
          </div>
        )}

        {/* LAYOUT 3: SKYLINE PROFILES (Dual Radar & Graph) */}
        {viewLayout === 'skyline' && (
          <div className="h-full flex flex-col lg:flex-row gap-2">
            <div className="w-full lg:w-1/2 h-full flex flex-col min-h-0">
              <HorizonCircularRadar
                data={horizonData}
                hoveredPoint={hoveredPoint}
                onHoverPoint={setHoveredPoint}
              />
            </div>
            <div className="w-full lg:w-1/2 h-full flex flex-col min-h-0">
              <HorizonElevationGraph
                data={horizonData}
                hoveredPoint={hoveredPoint}
                onHoverPoint={setHoveredPoint}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
