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
  Box,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  LineChart,
  Compass,
  Sun,
  Eye,
  Layers,
  Flame,
  Radio,
} from 'lucide-react';
import { HorizonExplorerView } from '../horizon/HorizonExplorerView';
import { HorizonTelemetryCard } from '../horizon/HorizonTelemetryCard';
import { EphemerisExplorerView } from '../ephemeris/EphemerisExplorerView';
import { EphemerisProvenancePanel } from '../ephemeris/EphemerisProvenancePanel';
import { VisibilityExplorerView } from '../visibility/VisibilityExplorerView';
import { VisibilityMetricsSummary } from '../visibility/VisibilityMetricsSummary';
import { useHorizonStore } from '../../stores/horizonStore';
import { useLocationStore } from '../../stores/locationStore';

export const TerrainExplorer: React.FC = () => {
  const workspaceMode = useDynamicAnalysisStore((state) => state.workspaceMode);
  const setWorkspaceMode = useDynamicAnalysisStore((state) => state.setWorkspaceMode);
  const activeLayerMode = useDynamicAnalysisStore((state) => state.activeLayerMode);
  const setActiveLayerMode = useDynamicAnalysisStore((state) => state.setActiveLayerMode);
  const currentPointTelemetry = useDynamicAnalysisStore((state) => state.currentPointTelemetry);

  const selectedLat = useLocationStore((state) => state.selectedLatitude);
  const selectedLon = useLocationStore((state) => state.selectedLongitude);
  const observerHeight = 2.0;

  const horizonData = useHorizonStore((state) => state.horizonData);
  const isHorizonLoading = useHorizonStore((state) => state.isLoading);

  const observerLat = currentPointTelemetry?.latitude ?? selectedLat;
  const observerLon = currentPointTelemetry?.longitude ?? selectedLon;

  const [panelOpen, setPanelOpen] = useState(true);
  const [showTransect, setShowTransect] = useState(false);

  return (
    <div className="terrain-workspace relative flex-1 flex flex-col xl:flex-row h-full min-h-0 overflow-hidden bg-[#0e1013] p-2 md:p-3 gap-2 md:gap-3">
      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col gap-2 min-h-0 min-w-0 overflow-hidden">
        {/* Workspace Top Header & Mode Sub-Navigation Strip (Stitch Screen b18f9e37a9a44954bf57dfd812343ab9) */}
        <div className="shrink-0 flex flex-col gap-2 bg-[#0e1013] border border-[#2b2d32] p-2.5 rounded-xl text-xs font-mono shadow-xl">
          {/* Top Context Breadcrumb and Telemetry Readout */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#202228]">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="text-[#ffe3b0] font-bold">01 EXPLORE</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-200 font-semibold uppercase tracking-wider">TERRAIN &amp; VISIBILITY</span>
              <span className="text-slate-600">/</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                LOLA DEM 20m
              </span>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <span className="flex items-center gap-1 bg-[#141619] px-2 py-0.5 rounded border border-[#2b2d32]">
                <Radio className="w-3 h-3 text-[#7bd0ff]" />
                <span className="text-slate-200 font-semibold">{observerHeight.toFixed(1)}m MAST</span>
              </span>
              <span className="hidden sm:inline text-slate-600">•</span>
              <span className="hidden sm:inline text-slate-400">
                LAT: <b className="text-[#ffe3b0]">{observerLat.toFixed(4)}°</b> LON: <b className="text-[#ffe3b0]">{observerLon.toFixed(4)}°</b>
              </span>
            </div>
          </div>

          {/* Stitch View Switcher Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="terrain-mode-switcher flex flex-wrap items-center gap-1.5 bg-[#141619] p-1 rounded-lg border border-[#2b2d32]">
              {/* 1. Elevation DEM */}
              <button
                aria-pressed={workspaceMode === '2d-map' && activeLayerMode === 'elevation'}
                onClick={() => {
                  setWorkspaceMode('2d-map');
                  setActiveLayerMode('elevation');
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all text-xs ${
                  workspaceMode === '2d-map' && activeLayerMode === 'elevation'
                    ? 'bg-[#ffe3b0] text-[#1a1408] shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Elevation DEM</span>
              </button>

              {/* 2. Slope Heatmap */}
              <button
                aria-pressed={workspaceMode === '2d-map' && activeLayerMode === 'slope'}
                onClick={() => {
                  setWorkspaceMode('2d-map');
                  setActiveLayerMode('slope');
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all text-xs ${
                  workspaceMode === '2d-map' && activeLayerMode === 'slope'
                    ? 'bg-[#ffe3b0] text-[#1a1408] shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Slope Heatmap</span>
              </button>

              {/* 3. Skyline Horizon */}
              <button
                aria-pressed={workspaceMode === 'horizon'}
                onClick={() => setWorkspaceMode('horizon')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all text-xs ${
                  workspaceMode === 'horizon'
                    ? 'bg-[#ffe3b0] text-[#1a1408] shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Skyline Horizon</span>
              </button>

              {/* 4. Solar & Earth Visibility */}
              <button
                aria-pressed={workspaceMode === 'visibility'}
                onClick={() => setWorkspaceMode('visibility')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all text-xs ${
                  workspaceMode === 'visibility'
                    ? 'bg-[#ffe3b0] text-[#1a1408] shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5 text-[#7bd0ff]" />
                <span>Solar &amp; Earth Visibility</span>
              </button>

              {/* 5. 3D Terrain */}
              <button
                aria-pressed={workspaceMode === '3d-terrain'}
                onClick={() => setWorkspaceMode('3d-terrain')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all text-xs ${
                  workspaceMode === '3d-terrain'
                    ? 'bg-[#ffe3b0] text-[#1a1408] shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                <span>3D Mesh</span>
              </button>

              {/* 6. Ephemeris Positions */}
              <button
                aria-pressed={workspaceMode === 'ephemeris'}
                onClick={() => setWorkspaceMode('ephemeris')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all text-xs ${
                  workspaceMode === 'ephemeris'
                    ? 'bg-[#ffe3b0] text-[#1a1408] shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Sun &amp; Earth Track</span>
              </button>
            </div>

            {/* Quick Slope Hazard Classification Legend from Stitch Screen */}
            <div className="hidden lg:flex items-center gap-2 bg-[#141619] px-2.5 py-1 rounded-lg border border-[#2b2d32] text-[10px]">
              <span className="text-slate-400 font-semibold uppercase">Slope:</span>
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                0°–10° Safe
              </span>
              <span className="flex items-center gap-1 text-amber-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                10°–20° Caution
              </span>
              <span className="flex items-center gap-1 text-rose-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                &gt;20° Hazard
              </span>
            </div>
          </div>
        </div>

        {/* Region Selection Toolbar */}
        <RegionSelectionToolbar />

        {/* Hillshade Controls if active in 2D mode */}
        {workspaceMode === '2d-map' && activeLayerMode === 'hillshade' && <HillshadeControls />}

        {/* Primary Viewport: 3D Terrain Mesh OR 2D Regional Map OR Horizon Engine OR Ephemeris OR Visibility */}
        <div className="flex-1 min-h-[300px] overflow-hidden">
          {workspaceMode === '3d-terrain' ? (
            <TerrainViewer3D />
          ) : workspaceMode === '2d-map' ? (
            <RegionalMapCanvas />
          ) : workspaceMode === 'horizon' ? (
            <HorizonExplorerView />
          ) : workspaceMode === 'ephemeris' ? (
            <EphemerisExplorerView />
          ) : (
            <VisibilityExplorerView />
          )}
        </div>

        {/* Bottom Elevation Profile Transect & Exports (Only in 2D Map mode) */}
        {workspaceMode === '2d-map' && (
          <>
            {showTransect && (
              <div className="h-44 shrink-0 min-h-[150px] transition-all">
                <DynamicElevationProfile />
              </div>
            )}

            <div className="shrink-0 flex items-center justify-between flex-wrap gap-2">
              <button
                onClick={() => setShowTransect(!showTransect)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  showTransect
                    ? 'bg-[#ffe3b0] text-[#1a1408] shadow-md'
                    : 'bg-[#0e1013] hover:bg-[#191b20] text-slate-300 hover:text-[#ffe3b0] border border-[#2b2d32]'
                }`}
              >
                <LineChart className="w-3.5 h-3.5 text-[#ffe3b0]" />
                <span>{showTransect ? 'Hide elevation profile' : 'Show elevation profile'}</span>
              </button>

              <ExportToolbar />
            </div>
          </>
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
          className="hidden xl:flex absolute -left-3.5 top-1/2 -translate-y-1/2 z-40 items-center justify-center w-7 h-12 bg-[#0e1013] border border-[#2b2d32] hover:border-[#ffe3b0] rounded-l-md text-slate-400 hover:text-[#ffe3b0] shadow-xl transition-colors"
        >
          {panelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {panelOpen && (
          <div className="w-full h-full overflow-y-auto pr-0.5 space-y-3">
            {workspaceMode === 'horizon' ? (
              <HorizonTelemetryCard
                data={horizonData}
                isLoading={isHorizonLoading}
                currentLat={observerLat}
                currentLon={observerLon}
              />
            ) : workspaceMode === 'ephemeris' ? (
              <EphemerisProvenancePanel />
            ) : workspaceMode === 'visibility' ? (
              <VisibilityMetricsSummary />
            ) : (
              <RegionalStatisticsPanel />
            )}
          </div>
        )}
      </div>

      {!panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          className="flex absolute right-4 bottom-4 z-40 items-center gap-2 bg-[#0e1013]/90 hover:bg-[#191b20] text-[#ffe3b0] border border-[#2b2d32] px-3 py-2 rounded-xl text-xs font-mono shadow-2xl transition-all"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Show details</span>
        </button>
      )}
    </div>
  );
};
