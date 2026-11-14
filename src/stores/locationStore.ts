import { create } from 'zustand';
import { ActiveView, AppScreen, LocationSource, LunarCoordinates } from '../types/lunar';
import { ElevationPoint, ElevationProfileData, TerrainMetadata } from '../types/terrain';
import { clampLatitude, normalizeLongitude } from '../utils/lunarCoordinates';

interface LocationState {
  // Application Screen (MVP 1 Lunar Explorer vs MVP 2 Terrain Explorer)
  appScreen: AppScreen;

  // Current selected coordinates
  selectedLatitude: number;
  selectedLongitude: number;
  selectedLocationSource: LocationSource;

  // View mode
  activeView: ActiveView;

  // Service & loading statuses
  mapLoading: boolean;
  mapError: string | null;
  globeLoading: boolean;
  globeError: string | null;
  liveCapabilitiesActive: boolean;

  // Terrain Engine State (MVP 2)
  terrainEnabled: boolean;
  terrainExaggeration: number;
  terrainLod: 'low' | 'medium' | 'high';
  elevationLayerVisible: boolean;
  elevationLayerType: 'elevation' | 'slope';
  currentElevationData: ElevationPoint | null;
  terrainMetadata: TerrainMetadata | null;

  // Elevation Profile Tool (MVP 2)
  profileStart: { lat: number; lon: number } | null;
  profileEnd: { lat: number; lon: number } | null;
  profileData: ElevationProfileData | null;
  isDrawingProfile: boolean;

  // Actions
  setAppScreen: (screen: AppScreen) => void;
  setSelectedCoordinates: (lat: number, lon: number, source: LocationSource) => void;
  setActiveView: (view: ActiveView) => void;
  setMapLoading: (loading: boolean) => void;
  setMapError: (error: string | null) => void;
  setGlobeLoading: (loading: boolean) => void;
  setGlobeError: (error: string | null) => void;
  setLiveCapabilitiesActive: (active: boolean) => void;

  // Terrain Actions
  setTerrainEnabled: (enabled: boolean) => void;
  setTerrainExaggeration: (exaggeration: number) => void;
  setTerrainLod: (lod: 'low' | 'medium' | 'high') => void;
  setElevationLayerVisible: (visible: boolean) => void;
  setElevationLayerType: (type: 'elevation' | 'slope') => void;
  setCurrentElevationData: (data: ElevationPoint | null) => void;
  setTerrainMetadata: (meta: TerrainMetadata | null) => void;

  // Profile Actions
  setProfileLine: (start: { lat: number; lon: number } | null, end: { lat: number; lon: number } | null) => void;
  setProfileData: (data: ElevationProfileData | null) => void;
  setIsDrawingProfile: (drawing: boolean) => void;

  resetToDefault: () => void;
}

// Default to Apollo 11 landing site (Statio Tranquillitatis)
const DEFAULT_COORDINATES: LunarCoordinates = {
  latitude: 0.6741,
  longitude: 23.4730,
};

const getStoredAppScreen = (): AppScreen => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem('lunavista_app_screen');
    const validScreens: AppScreen[] = [
      'lunar-explorer',
      'terrain-explorer',
      'mission-comparison',
      'mission-requirements',
      'candidate-screening',
      'window-planner',
      'terrain-assessment',
      'trade-off-analysis',
      'mission-reports',
    ];
    if (stored && validScreens.includes(stored as AppScreen)) {
      return stored as AppScreen;
    }
  }
  return 'lunar-explorer';
};

export const useLocationStore = create<LocationState>((set, get) => ({
  appScreen: getStoredAppScreen(),

  selectedLatitude: DEFAULT_COORDINATES.latitude,
  selectedLongitude: DEFAULT_COORDINATES.longitude,
  selectedLocationSource: 'initial',

  activeView: 'split',

  mapLoading: false,
  mapError: null,
  globeLoading: true,
  globeError: null,
  liveCapabilitiesActive: true,

  // MVP 2 Terrain state defaults
  terrainEnabled: true,
  terrainExaggeration: 1.0,
  terrainLod: 'medium',
  elevationLayerVisible: true,
  elevationLayerType: 'elevation',
  currentElevationData: null,
  terrainMetadata: null,

  // Profile tool defaults (Connecting Ridge crest default transect)
  profileStart: { lat: -89.55, lon: -136.0 },
  profileEnd: { lat: -89.38, lon: -139.0 },
  profileData: null,
  isDrawingProfile: false,

  setAppScreen: (screen: AppScreen) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('lunavista_app_screen', screen);
    }
    set({ appScreen: screen });
  },

  setSelectedCoordinates: (lat: number, lon: number, source: LocationSource) => {
    const clampedLat = clampLatitude(lat);
    const normalizedLon = normalizeLongitude(lon);

    const currentLat = get().selectedLatitude;
    const currentLon = get().selectedLongitude;

    // Avoid state update if coordinates are identical to avoid render churn
    if (
      Math.abs(currentLat - clampedLat) < 0.000001 &&
      Math.abs(currentLon - normalizedLon) < 0.000001 &&
      get().selectedLocationSource === source
    ) {
      return;
    }

    set({
      selectedLatitude: clampedLat,
      selectedLongitude: normalizedLon,
      selectedLocationSource: source,
    });
  },

  setActiveView: (view: ActiveView) => set({ activeView: view }),

  setMapLoading: (loading: boolean) => set({ mapLoading: loading }),
  setMapError: (error: string | null) => set({ mapError: error }),

  setGlobeLoading: (loading: boolean) => set({ globeLoading: loading }),
  setGlobeError: (error: string | null) => set({ globeError: error }),

  setLiveCapabilitiesActive: (active: boolean) => set({ liveCapabilitiesActive: active }),

  setTerrainEnabled: (enabled: boolean) => set({ terrainEnabled: enabled }),
  setTerrainExaggeration: (exaggeration: number) => set({ terrainExaggeration: exaggeration }),
  setTerrainLod: (lod: 'low' | 'medium' | 'high') => set({ terrainLod: lod }),
  setElevationLayerVisible: (visible: boolean) => set({ elevationLayerVisible: visible }),
  setElevationLayerType: (type: 'elevation' | 'slope') => set({ elevationLayerType: type }),
  setCurrentElevationData: (data: ElevationPoint | null) => set({ currentElevationData: data }),
  setTerrainMetadata: (meta: TerrainMetadata | null) => set({ terrainMetadata: meta }),

  setProfileLine: (start, end) => set({ profileStart: start, profileEnd: end }),
  setProfileData: (data) => set({ profileData: data }),
  setIsDrawingProfile: (drawing) => set({ isDrawingProfile: drawing }),

  resetToDefault: () =>
    set({
      selectedLatitude: DEFAULT_COORDINATES.latitude,
      selectedLongitude: DEFAULT_COORDINATES.longitude,
      selectedLocationSource: 'preset',
    }),
}));
