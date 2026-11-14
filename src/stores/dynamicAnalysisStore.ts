import { create } from 'zustand';
import {
  DatasetDiscoveryResponse,
  RegionalStatistics,
  TerrainInspectionPoint,
  TransectProfileResponse,
} from '../types/dynamicAnalysis';

export type WorkspaceMode = 'south-pole-overview' | 'selected-region';
export type ActiveLayerMode = 'elevation' | 'slope' | 'hillshade' | '3d-mesh';
export type ColormapName = 'hypsometric' | 'turbo' | 'viridis' | 'magma';

export interface BoundingBoxGeographic {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

// Predefined Lunar South Pole Candidate Sites
export const PREDEFINED_SITES = [
  {
    id: 'site01',
    name: 'Site 01 — Connecting Ridge',
    region: 'Shackleton–de Gerlache Ridge',
    bbox: { minLat: -89.8351, maxLat: -89.0903, minLon: -171.4692, maxLon: -101.8887 },
    center: { lat: -89.4632, lon: -137.4896 },
    description: 'Prominent high-elevation ridge connecting Shackleton and de Gerlache craters with extended illumination.',
    datasetId: 'site01',
  },
  {
    id: 'site04',
    name: 'Site 04 — Shackleton Rim',
    region: 'South Pole / Shackleton Crater',
    bbox: { minLat: -89.98, maxLat: -89.45, minLon: -180.0, maxLon: 180.0 },
    center: { lat: -89.67, lon: 0.0 },
    description: 'Exact lunar South Pole on the rim crest of Shackleton crater overlooking permanently shadowed interior.',
    datasetId: 'site04',
  },
  {
    id: 'site11',
    name: 'Site 11 — de Gerlache Rim',
    region: 'de Gerlache Crater Rim',
    bbox: { minLat: -88.95, maxLat: -88.10, minLon: -105.0, maxLon: -75.0 },
    center: { lat: -88.52, lon: -88.35 },
    description: 'High-elevation rim candidate for Artemis missions with direct Earth communication line-of-sight.',
    datasetId: 'site11',
  },
  {
    id: 'site23',
    name: 'Site 23 — Malapert Massif',
    region: 'Malapert Mountain',
    bbox: { minLat: -86.50, maxLat: -85.10, minLon: -5.0, maxLon: 25.0 },
    center: { lat: -85.80, lon: 3.0 },
    description: '5,000 m massif with continuous line-of-sight Earth communication and flat landing tableland.',
    datasetId: 'site23',
  },
];

interface DynamicAnalysisState {
  workspaceMode: WorkspaceMode;
  selectedRegionBbox: BoundingBoxGeographic;
  activeDatasetId: string;

  // Discovery
  discoveryResponse: DatasetDiscoveryResponse | null;
  isDiscovering: boolean;

  // Visualization settings
  activeLayerMode: ActiveLayerMode;
  activeColormap: ColormapName;
  hillshadeAzimuth: number;
  hillshadeAltitude: number;
  hillshadeZFactor: number;

  // Statistics & Inspection
  regionalStatistics: RegionalStatistics | null;
  statisticsLoading: boolean;
  currentPointTelemetry: TerrainInspectionPoint | null;

  // Profile transect
  transectStart: { lat: number; lon: number };
  transectEnd: { lat: number; lon: number };
  transectProfile: TransectProfileResponse | null;
  profileLoading: boolean;
  isDrawingTransect: boolean;

  // Setters
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  setSelectedRegionBbox: (bbox: BoundingBoxGeographic) => void;
  setActiveDatasetId: (id: string) => void;
  setDiscoveryResponse: (resp: DatasetDiscoveryResponse | null) => void;
  setIsDiscovering: (discovering: boolean) => void;
  setActiveLayerMode: (mode: ActiveLayerMode) => void;
  setActiveColormap: (cmap: ColormapName) => void;
  setHillshadeParams: (azimuth: number, altitude: number, zFactor: number) => void;
  setRegionalStatistics: (stats: RegionalStatistics | null) => void;
  setStatisticsLoading: (loading: boolean) => void;
  setCurrentPointTelemetry: (pt: TerrainInspectionPoint | null) => void;
  setTransectLine: (start: { lat: number; lon: number }, end: { lat: number; lon: number }) => void;
  setTransectProfile: (prof: TransectProfileResponse | null) => void;
  setProfileLoading: (loading: boolean) => void;
  setIsDrawingTransect: (drawing: boolean) => void;
  selectPredefinedSite: (siteId: string) => void;
}

export const useDynamicAnalysisStore = create<DynamicAnalysisState>((set) => ({
  workspaceMode: 'south-pole-overview',
  selectedRegionBbox: PREDEFINED_SITES[0].bbox,
  activeDatasetId: 'site01',

  discoveryResponse: null,
  isDiscovering: false,

  activeLayerMode: 'elevation',
  activeColormap: 'hypsometric',
  hillshadeAzimuth: 315.0,
  hillshadeAltitude: 45.0,
  hillshadeZFactor: 1.0,

  regionalStatistics: null,
  statisticsLoading: false,
  currentPointTelemetry: null,

  transectStart: { lat: -89.58, lon: -135.5 },
  transectEnd: { lat: -89.36, lon: -139.8 },
  transectProfile: null,
  profileLoading: false,
  isDrawingTransect: false,

  setWorkspaceMode: (mode) => set({ workspaceMode: mode }),
  setSelectedRegionBbox: (bbox) => set({ selectedRegionBbox: bbox }),
  setActiveDatasetId: (id) => set({ activeDatasetId: id }),
  setDiscoveryResponse: (resp) => set({ discoveryResponse: resp }),
  setIsDiscovering: (discovering) => set({ isDiscovering: discovering }),
  setActiveLayerMode: (mode) => set({ activeLayerMode: mode }),
  setActiveColormap: (cmap) => set({ activeColormap: cmap }),
  setHillshadeParams: (az, alt, z) => set({ hillshadeAzimuth: az, hillshadeAltitude: alt, hillshadeZFactor: z }),
  setRegionalStatistics: (stats) => set({ regionalStatistics: stats }),
  setStatisticsLoading: (loading) => set({ statisticsLoading: loading }),
  setCurrentPointTelemetry: (pt) => set({ currentPointTelemetry: pt }),
  setTransectLine: (start, end) => set({ transectStart: start, transectEnd: end }),
  setTransectProfile: (prof) => set({ transectProfile: prof }),
  setProfileLoading: (loading) => set({ profileLoading: loading }),
  setIsDrawingTransect: (drawing) => set({ isDrawingTransect: drawing }),

  selectPredefinedSite: (siteId) => {
    const site = PREDEFINED_SITES.find((s) => s.id === siteId);
    if (!site) return;
    set({
      selectedRegionBbox: site.bbox,
      activeDatasetId: site.datasetId,
      transectStart: { lat: site.center.lat - 0.05, lon: site.center.lon - 1.0 },
      transectEnd: { lat: site.center.lat + 0.05, lon: site.center.lon + 1.0 },
    });
  },
}));
