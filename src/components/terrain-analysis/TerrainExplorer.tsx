import React, { useState } from 'react';
import { useDynamicAnalysisStore } from '../../stores/dynamicAnalysisStore';
import { SouthPoleDualMaps } from './SouthPoleDualMaps';
import { RegionSelectionToolbar } from './RegionSelectionToolbar';
import { RegionalMapCanvas } from './RegionalMapCanvas';
import { HillshadeControls } from './HillshadeControls';
import { DynamicElevationProfile } from './DynamicElevationProfile';
import { RegionalStatisticsPanel } from './RegionalStatisticsPanel';
import { ExportToolbar } from './ExportToolbar';
import {
  Mountain,
  Layers,
  Map,
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
              DYNAMIC LUNAR TERRAIN ANALYSIS SYSTEM
            </span>
          </div>

          <div className="flex items-center gap-1 bg-[#070b12] p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setWorkspaceMode('south-pole-overview')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all ${
                workspaceMode === 'south-pole-overview'
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>SOUTH POLE OVERVIEW</span>
            </button>

            <button
              onClick={() => setWorkspaceMode('selected-region')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all ${
                workspaceMode === 'selected-region'
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>SELECTED REGION ANALYSIS</span>
            </button>
          </div>
        </div>

        {/* WORKSPACE MODE 1: SOUTH POLE DUAL MAPS OVERVIEW */}
        {workspaceMode === 'south-pole-overview' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <SouthPoleDualMaps />
          </div>
        )}

        {/* WORKSPACE MODE 2: SELECTED REGION DYNAMIC ANALYSIS */}
        {workspaceMode === 'selected-region' && (
          <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
            {/* Region Selection Toolbar & Automatic Discovery Banner */}
            <RegionSelectionToolbar />

            {/* Hillshade Controls if active */}
            {activeLayerMode === 'hillshade' && <HillshadeControls />}

            {/* Dynamic Map Canvas */}
            <div className="flex-1 min-h-[260px] overflow-hidden">
              <RegionalMapCanvas />
            </div>

            {/* Bottom Elevation Profile Transect */}
            <div className="h-48 shrink-0 min-h-[160px]">
              <DynamicElevationProfile />
            </div>

            {/* Scientific Data Export Toolbar */}
            <ExportToolbar />
          </div>
        )}
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
