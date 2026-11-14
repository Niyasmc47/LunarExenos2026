import { create } from 'zustand';
import { ActiveView, LocationSource, LunarCoordinates } from '../types/lunar';
import { clampLatitude, normalizeLongitude } from '../utils/lunarCoordinates';

interface LocationState {
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

  // Actions
  setSelectedCoordinates: (lat: number, lon: number, source: LocationSource) => void;
  setActiveView: (view: ActiveView) => void;
  setMapLoading: (loading: boolean) => void;
  setMapError: (error: string | null) => void;
  setGlobeLoading: (loading: boolean) => void;
  setGlobeError: (error: string | null) => void;
  setLiveCapabilitiesActive: (active: boolean) => void;
  resetToDefault: () => void;
}

// Default to Apollo 11 landing site (Statio Tranquillitatis)
const DEFAULT_COORDINATES: LunarCoordinates = {
  latitude: 0.6741,
  longitude: 23.4730,
};

export const useLocationStore = create<LocationState>((set, get) => ({
  selectedLatitude: DEFAULT_COORDINATES.latitude,
  selectedLongitude: DEFAULT_COORDINATES.longitude,
  selectedLocationSource: 'initial',

  activeView: 'split',

  mapLoading: true,
  mapError: null,
  globeLoading: true,
  globeError: null,
  liveCapabilitiesActive: false,

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

  resetToDefault: () =>
    set({
      selectedLatitude: DEFAULT_COORDINATES.latitude,
      selectedLongitude: DEFAULT_COORDINATES.longitude,
      selectedLocationSource: 'preset',
    }),
}));
