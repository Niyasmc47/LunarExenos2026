import React, { useState } from 'react';
import { useDynamicAnalysisStore } from '../../stores/dynamicAnalysisStore';
import { TerrainViewer3D } from '../terrain-explorer/TerrainViewer3D';
import { RegionSelectionToolbar } from './RegionSelectionToolbar';
import { RegionalMapCanvas } from './RegionalMapCanvas';
import { HillshadeControls } from './HillshadeControls';
import { DynamicElevationProfile } from './DynamicElevationProfile';
import { RegionalStatisticsPanel } from './RegionalStatisticsPanel';
import { ExportToolbar } from './ExportToolbar';
import {
  Mountain,
  Map,
  Box,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';

export const TerrainExplorer: React.FC = () => {
  const workspaceMode = useDynamicAnalysisStore((state) => state.workspaceMode);
  const setWorkspaceMode = useDynamicAnalysisStore((state) => state.setWorkspaceMode);
  const activeLayerMode = useDynamicAnalysisStore((state) => state.activeLayerMode);

  const [panelOpen, setPanelOpen] = useState(true);

  return (
    <div className="flex-1 flex flex-col md:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-[#070b12] p-2 md:p-3 gap-2 md:gap-3">
      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col gap-2 min-h-0 min-w-0 overflow-hidden">
        {/* Workspace Mode Sub-Navigation Strip */}
        <div className="shrink-0 flex items-center justify-between bg-[#0c121e]/90 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-mono">
          <div className="flex items-center gap-2">
            <Mountain className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-slate-200 uppercase tracking-wider hidden sm:inline">
              LUNAR TERRAIN EXPLORER
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              NASA LOLA DATA
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-[#070b12] p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setWorkspaceMode('3d-terrain')}
              title="Interactive 3D lunar terrain mesh with altitude relief and orbit controls"
              className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all ${
                workspaceMode === '3d-terrain'
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>3D TERRAIN VIEW</span>
            </button>

            <button
              onClick={() => setWorkspaceMode('2d-map')}
              title="2D map with elevation, slope hazard classification and transects"
              className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all ${
                workspaceMode === '2d-map'
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>2D MAP VIEW</span>
            </button>
          </div>
        </div>

        {/* Region Selection Toolbar */}
        <RegionSelectionToolbar />

        {/* Hillshade Controls if active in 2D mode */}
        {workspaceMode === '2d-map' && activeLayerMode === 'hillshade' && <HillshadeControls />}

        {/* Primary Viewport: 3D Terrain Mesh OR 2D Regional Map */}
        <div className="flex-1 min-h-[280px] overflow-hidden">
          {workspaceMode === '3d-terrain' ? (
            <TerrainViewer3D />
          ) : (
            <RegionalMapCanvas />
          )}
        </div>

        {/* Bottom Elevation Profile Transect */}
        <div className="h-44 shrink-0 min-h-[150px]">
          <DynamicElevationProfile />
        </div>

        {/* Scientific Data Export Toolbar */}
        <ExportToolbar />
      </div>

      {/* Right Collapsible Inspection & Statistics Sidebar */}
      <div
        className={`relative transition-all duration-300 shrink-0 flex flex-col ${
          panelOpen ? 'w-full md:w-80 lg:w-96' : 'w-full md:w-0'
        } ${!panelOpen && 'hidden md:flex'}`}
      >
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          title={panelOpen ? 'Collapse Terrain Info' : 'Expand Terrain Info'}
          className="hidden md:flex absolute -left-3.5 top-1/2 -translate-y-1/2 z-40 items-center justify-center w-7 h-12 bg-[#0c121e] border border-slate-700 hover:border-emerald-500 rounded-l-md text-slate-400 hover:text-emerald-400 shadow-xl transition-colors"
        >
          {panelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {panelOpen && (
          <div className="w-full h-full overflow-y-auto pr-0.5 space-y-3">
            <RegionalStatisticsPanel />
          </div>
        )}
      </div>

      {!panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          className="hidden md:flex absolute right-4 bottom-4 z-40 items-center gap-2 bg-[#0c121e]/90 hover:bg-slate-800 text-emerald-400 border border-slate-700 px-3 py-2 rounded-xl text-xs font-mono shadow-2xl transition-all"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>SHOW STATS</span>
        </button>
      )}
    </div>
  );
};
