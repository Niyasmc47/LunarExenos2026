import React, { useState } from 'react';
import { useDynamicAnalysisStore } from '../../stores/dynamicAnalysisStore';
import { RegionSelectionToolbar } from './RegionSelectionToolbar';
import { RegionalMapCanvas } from './RegionalMapCanvas';
import { HillshadeControls } from './HillshadeControls';
import { DynamicElevationProfile } from './DynamicElevationProfile';
import { RegionalStatisticsPanel } from './RegionalStatisticsPanel';
import { ExportToolbar } from './ExportToolbar';
import {
  Map,
  Sparkles,
  Columns,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  LineChart,
  Compass,
  Sun,
  Eye,
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
import { useCelestialSimulationStore } from '../../stores/celestialSimulationStore';
import { CelestialViewer3D } from '../celestial/CelestialViewer3D';
import { CelestialTimeControls } from '../celestial/CelestialTimeControls';
import { LocationAnalysisDrawer } from '../celestial/LocationAnalysisDrawer';
import { ScenarioCreateModal, ScenarioInitialValues } from '../scenario-comparison/ScenarioCreateModal';

export const TerrainExplorer: React.FC = () => {
  const workspaceMode = useDynamicAnalysisStore((state) => state.workspaceMode);
  const setWorkspaceMode = useDynamicAnalysisStore((state) => state.setWorkspaceMode);
  const activeLayerMode = useDynamicAnalysisStore((state) => state.activeLayerMode);
  const currentPointTelemetry = useDynamicAnalysisStore((state) => state.currentPointTelemetry);
  const activeDatasetId = useDynamicAnalysisStore((state) => state.activeDatasetId) || 'site01';

  const selectedLat = useLocationStore((state) => state.selectedLatitude);
  const selectedLon = useLocationStore((state) => state.selectedLongitude);
  const observerHeight = 2.0;

  const horizonData = useHorizonStore((state) => state.horizonData);
  const isHorizonLoading = useHorizonStore((state) => state.isLoading);

  const analysisDrawerOpen = useCelestialSimulationStore((state) => state.analysisDrawerOpen);
  const closeAnalysisDrawer = useCelestialSimulationStore((state) => state.closeAnalysisDrawer);
  const simulationTime = useCelestialSimulationStore((state) => state.simulationTime);

  const observerLat = currentPointTelemetry?.latitude ?? selectedLat;
  const observerLon = currentPointTelemetry?.longitude ?? selectedLon;

  const [panelOpen, setPanelOpen] = useState(true);
  const [showTransect, setShowTransect] = useState(false);

  // Scenario Creation modal state
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [candidateInitialValues, setCandidateInitialValues] = useState<ScenarioInitialValues | undefined>(undefined);

  const handleOpenCandidateModalFromSelection = () => {
    setCandidateInitialValues({
      siteId: activeDatasetId,
      latitude: selectedLat,
      longitude: selectedLon,
      observerHeight: 2.0,
      startIso: simulationTime,
      name: `${activeDatasetId.toUpperCase()} — Candidate`,
      description: `Evaluated at ${selectedLat.toFixed(4)}°, ${selectedLon.toFixed(4)}° using NASA LOLA 5m DEM & SPICE ephemeris`,
    });
    setIsCandidateModalOpen(true);
  };

  const handleOpenCandidateModalFromDrawer = (coords: {
    latitude: number;
    longitude: number;
    siteId: string;
    observerHeight: number;
    startIso: string;
  }) => {
    setCandidateInitialValues({
      siteId: coords.siteId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      observerHeight: coords.observerHeight,
      startIso: coords.startIso,
      name: `${coords.siteId.toUpperCase()} — Selected Point`,
      description: `Target landing site selected at ${coords.latitude.toFixed(4)}°, ${coords.longitude.toFixed(4)}° on ${new Date(coords.startIso).toUTCString()}`,
    });
    setIsCandidateModalOpen(true);
    closeAnalysisDrawer();
  };

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
                NASA LOLA &amp; SPICE
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
              {/* 1. 3D Celestial Environment */}
              <button
                aria-pressed={workspaceMode === '3d-terrain'}
                onClick={() => setWorkspaceMode('3d-terrain')}
                title="3D Celestial Environment: LOLA DEM terrain with calculated Sun & Earth positions and dynamic shadows"
                className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all text-xs ${
                  workspaceMode === '3d-terrain'
                    ? 'bg-[#ffe3b0] text-[#1a1408] shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>3D Celestial</span>
              </button>

              {/* 2. 2D Surface Map */}
              <button
                aria-pressed={workspaceMode === '2d-map'}
                onClick={() => setWorkspaceMode('2d-map')}
                title="2D Map: Lunar surface map with elevation, slope hazard classification, and transects"
                className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all text-xs ${
                  workspaceMode === '2d-map'
                    ? 'bg-[#ffe3b0] text-[#1a1408] shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Map className="w-3.5 h-3.5" />
                <span>2D Surface</span>
              </button>

              {/* 3. Split View */}
              <button
                aria-pressed={workspaceMode === 'split-view'}
                onClick={() => setWorkspaceMode('split-view')}
                title="Split View: Synchronized side-by-side 2D lunar map and 3D celestial environment"
                className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all text-xs ${
                  workspaceMode === 'split-view'
                    ? 'bg-[#ffe3b0] text-[#1a1408] shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Split View</span>
              </button>

              {/* 4. Local Skyline */}
              <button
                aria-pressed={workspaceMode === 'horizon'}
                onClick={() => setWorkspaceMode('horizon')}
                title="Local Skyline: Lunar terrain skyline elevation angles across 360° azimuth"
                className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all text-xs ${
                  workspaceMode === 'horizon'
                    ? 'bg-[#ffe3b0] text-[#1a1408] shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Local Skyline</span>
              </button>

              {/* 5. Ephemeris Track */}
              <button
                aria-pressed={workspaceMode === 'ephemeris'}
                onClick={() => setWorkspaceMode('ephemeris')}
                title="Topocentric Sun & Earth positions, trajectory time-series, and SPICE ephemerides"
                className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all text-xs ${
                  workspaceMode === 'ephemeris'
                    ? 'bg-[#ffe3b0] text-[#1a1408] shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Ephemeris</span>
              </button>

              {/* 6. Solar & Earth Visibility */}
              <button
                aria-pressed={workspaceMode === 'visibility'}
                onClick={() => setWorkspaceMode('visibility')}
                title="Terrain-aware Sun & Earth visibility, disk partial illumination, and mission timelines"
                className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all text-xs ${
                  workspaceMode === 'visibility'
                    ? 'bg-[#ffe3b0] text-[#1a1408] shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5 text-[#7bd0ff]" />
                <span>Visibility</span>
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

        {/* Time Simulation Strip for 3D Celestial & Split Views */}
        {(workspaceMode === '3d-terrain' || workspaceMode === 'split-view') && (
          <CelestialTimeControls />
        )}

        {/* Primary Viewport */}
        <div className="flex-1 min-h-[350px] overflow-hidden flex flex-col">
          {workspaceMode === '3d-terrain' ? (
            <CelestialViewer3D onOpenCandidateModal={handleOpenCandidateModalFromSelection} />
          ) : workspaceMode === 'split-view' ? (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-2 min-h-0 overflow-hidden">
              {/* Left: 2D Surface Map */}
              <div className="flex flex-col h-full min-h-0 bg-[#080d19] border border-slate-800 rounded-xl overflow-hidden relative">
                <div className="absolute top-2 left-2 z-20 bg-[#070b14]/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800 text-[11px] font-mono font-bold text-slate-300">
                  2D Moon Surface Map
                </div>
                <div className="flex-1 min-h-0">
                  <RegionalMapCanvas />
                </div>
              </div>

              {/* Right: 3D Celestial Environment */}
              <div className="flex flex-col h-full min-h-0 bg-[#040711] border border-slate-800 rounded-xl overflow-hidden relative">
                <div className="absolute top-2 left-2 z-20 bg-[#070b14]/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800 text-[11px] font-mono font-bold text-slate-300 pointer-events-none">
                  3D Celestial Environment (Sun & Earth)
                </div>
                <div className="flex-1 min-h-0">
                  <CelestialViewer3D onOpenCandidateModal={handleOpenCandidateModalFromSelection} />
                </div>
              </div>
            </div>
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

      {/* Location Analysis Drawer */}
      <LocationAnalysisDrawer
        isOpen={analysisDrawerOpen}
        onClose={closeAnalysisDrawer}
        onSaveAsCandidate={handleOpenCandidateModalFromDrawer}
      />

      {/* Candidate Creation Modal */}
      <ScenarioCreateModal
        isOpen={isCandidateModalOpen}
        onClose={() => setIsCandidateModalOpen(false)}
        initialValues={candidateInitialValues}
      />
    </div>
  );
};
