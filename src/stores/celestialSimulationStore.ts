import { create } from 'zustand';
import { fetchEphemerisPosition } from '../services/ephemerisApi';
import { fetchInstantVisibility } from '../services/visibilityApi';
import { inspectTerrainPoint } from '../services/dynamicAnalysisApi';
import { fetchElevationPoint } from '../services/terrainApi';

export interface CelestialBodyLiveState {
  azimuth_deg: number;
  elevation_deg: number;
  distance_km: number;
  angular_diameter_deg: number;
  is_visible: boolean;
  fraction_visible: number;
  horizon_elevation_deg: number;
  upper_limb_clearance_deg: number;
}

export interface LocationAnalysisResult {
  latitude: number;
  longitude: number;
  site_id: string;
  timestamp_iso: string;
  observer_height_m: number;
  surface_elevation_m: number;
  slope_deg: number;
  coverage_status: string;
  sun: CelestialBodyLiveState;
  earth: CelestialBodyLiveState;
  horizon_summary?: {
    max_horizon_elevation_deg: number;
    max_horizon_azimuth_deg: number;
    min_horizon_elevation_deg: number;
    min_horizon_azimuth_deg: number;
    mean_horizon_elevation_deg: number;
  };
  warnings: string[];
}

export type CameraFocusTarget = 'moon' | 'sun' | 'earth' | 'north' | 'top';

interface CelestialSimulationState {
  // Time Simulation
  simulationTime: string; // ISO 8601
  initialEpoch: string;
  isPlaying: boolean;
  playbackSpeed: number; // 1, 10, 100, 1000, 10000
  timeStepSeconds: number; // 60, 600, 3600, 21600, 86400

  // Celestial Objects
  sun: CelestialBodyLiveState;
  earth: CelestialBodyLiveState;
  isLoadingEphemeris: boolean;
  ephemerisError: string | null;

  // Visual Scene Controls
  cameraFocus: CameraFocusTarget;
  showTerrain: boolean;
  showShadows: boolean;
  showCelestialLabels: boolean;
  showHorizonRing: boolean;
  showCompass: boolean;

  // Location Analysis
  isAnalyzing: boolean;
  analysisResult: LocationAnalysisResult | null;
  analysisDrawerOpen: boolean;

  // Actions
  setSimulationTime: (timeIso: string) => void;
  resetToInitialEpoch: () => void;
  setIsPlaying: (playing: boolean) => void;
  togglePlayPause: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setTimeStepSeconds: (step: number) => void;
  stepForward: (lat: number, lon: number, siteId: string) => void;
  stepBackward: (lat: number, lon: number, siteId: string) => void;

  setCameraFocus: (target: CameraFocusTarget) => void;
  setShowTerrain: (show: boolean) => void;
  setShowShadows: (show: boolean) => void;
  setShowCelestialLabels: (show: boolean) => void;
  setShowHorizonRing: (show: boolean) => void;
  setShowCompass: (show: boolean) => void;

  updateCelestialPositions: (lat: number, lon: number, siteId: string, timeIso?: string) => Promise<void>;
  analyzeLocation: (lat: number, lon: number, siteId: string, observerHeightM?: number) => Promise<void>;
  closeAnalysisDrawer: () => void;
  openAnalysisDrawer: () => void;
}

const DEFAULT_EPOCH = '2026-10-04T12:00:00Z';

let updateDebounceTimer: any = null;
let activeEphemerisReqId = 0;

export const useCelestialSimulationStore = create<CelestialSimulationState>((set, get) => ({
  simulationTime: DEFAULT_EPOCH,
  initialEpoch: DEFAULT_EPOCH,
  isPlaying: false,
  playbackSpeed: 100,
  timeStepSeconds: 3600, // 1 hour step

  sun: {
    azimuth_deg: 37.68,
    elevation_deg: 1.49,
    distance_km: 149571214,
    angular_diameter_deg: 0.533,
    is_visible: true,
    fraction_visible: 1.0,
    horizon_elevation_deg: 1.72,
    upper_limb_clearance_deg: 0.035,
  },
  earth: {
    azimuth_deg: 139.99,
    elevation_deg: 3.16,
    distance_km: 371142,
    angular_diameter_deg: 1.97,
    is_visible: true,
    fraction_visible: 1.0,
    horizon_elevation_deg: 0.64,
    upper_limb_clearance_deg: 3.51,
  },
  isLoadingEphemeris: false,
  ephemerisError: null,

  cameraFocus: 'moon',
  showTerrain: true,
  showShadows: true,
  showCelestialLabels: true,
  showHorizonRing: true,
  showCompass: false,

  isAnalyzing: false,
  analysisResult: null,
  analysisDrawerOpen: false,

  setSimulationTime: (timeIso: string) => set({ simulationTime: timeIso }),

  resetToInitialEpoch: () => {
    set({ simulationTime: get().initialEpoch, isPlaying: false });
  },

  setIsPlaying: (playing: boolean) => set({ isPlaying: playing }),
  togglePlayPause: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setPlaybackSpeed: (speed: number) => set({ playbackSpeed: speed }),
  setTimeStepSeconds: (step: number) => set({ timeStepSeconds: step }),

  stepForward: (lat: number, lon: number, siteId: string) => {
    const cur = new Date(get().simulationTime).getTime();
    const next = new Date(cur + get().timeStepSeconds * 1000).toISOString();
    set({ simulationTime: next });
    get().updateCelestialPositions(lat, lon, siteId, next);
  },

  stepBackward: (lat: number, lon: number, siteId: string) => {
    const cur = new Date(get().simulationTime).getTime();
    const prev = new Date(cur - get().timeStepSeconds * 1000).toISOString();
    set({ simulationTime: prev });
    get().updateCelestialPositions(lat, lon, siteId, prev);
  },

  setCameraFocus: (target) => set({ cameraFocus: target }),
  setShowTerrain: (show) => set({ showTerrain: show }),
  setShowShadows: (show) => set({ showShadows: show }),
  setShowCelestialLabels: (show) => set({ showCelestialLabels: show }),
  setShowHorizonRing: (show) => set({ showHorizonRing: show }),
  setShowCompass: (show) => set({ showCompass: show }),

  updateCelestialPositions: async (lat: number, lon: number, siteId: string, timeIso?: string) => {
    const epoch = timeIso || get().simulationTime;
    const reqId = ++activeEphemerisReqId;

    if (updateDebounceTimer) {
      clearTimeout(updateDebounceTimer);
    }

    // Debounce backend request slightly for ultra-fast time sliders
    updateDebounceTimer = setTimeout(async () => {
      set({ isLoadingEphemeris: true });
      try {
        const resp = await fetchEphemerisPosition({
          latitude: lat,
          longitude: lon,
          timestamp_iso: epoch,
          observer_height_m: 2.0,
          dataset_id: siteId || 'site01',
          aberration_correction: 'LT+S',
        });

        if (reqId !== activeEphemerisReqId) return;

        if (resp) {
          set({
            sun: {
              azimuth_deg: resp.sun.azimuth_deg,
              elevation_deg: resp.sun.elevation_deg,
              distance_km: resp.sun.distance_km,
              angular_diameter_deg: resp.sun.apparent_angular_diameter_deg,
              is_visible: resp.sun.elevation_deg > 0,
              fraction_visible: resp.sun.elevation_deg > 0 ? 1.0 : 0.0,
              horizon_elevation_deg: 0.0,
              upper_limb_clearance_deg: resp.sun.elevation_deg + resp.sun.apparent_angular_diameter_deg / 2,
            },
            earth: {
              azimuth_deg: resp.earth.azimuth_deg,
              elevation_deg: resp.earth.elevation_deg,
              distance_km: resp.earth.distance_km,
              angular_diameter_deg: resp.earth.apparent_angular_diameter_deg,
              is_visible: resp.earth.elevation_deg > 0,
              fraction_visible: resp.earth.elevation_deg > 0 ? 1.0 : 0.0,
              horizon_elevation_deg: 0.0,
              upper_limb_clearance_deg: resp.earth.elevation_deg + resp.earth.apparent_angular_diameter_deg / 2,
            },
            isLoadingEphemeris: false,
            ephemerisError: null,
          });
        } else {
          set({ isLoadingEphemeris: false });
        }
      } catch (err: any) {
        if (reqId === activeEphemerisReqId) {
          set({ isLoadingEphemeris: false, ephemerisError: err?.message || 'Ephemeris failed' });
        }
      }
    }, 40);
  },

  analyzeLocation: async (lat: number, lon: number, siteId: string, observerHeightM = 2.0) => {
    const epoch = get().simulationTime;
    set({ isAnalyzing: true, analysisDrawerOpen: true });

    try {
      const [visResp, ptResp, elevResp] = await Promise.all([
        fetchInstantVisibility({
          latitude: lat,
          longitude: lon,
          timestamp_iso: epoch,
          observer_height_m: observerHeightM,
          dataset_id: siteId,
        }),
        inspectTerrainPoint(lat, lon, siteId),
        fetchElevationPoint(lat, lon, siteId),
      ]);

      const surfaceElev =
        elevResp?.elevation_m ?? ptResp?.elevation_m ?? visResp?.observer_surface_elevation_m ?? 0;
      const slopeDeg = ptResp?.slope_deg ?? 0;
      const coverage = visResp?.terrain_horizon_summary?.coverage_status ?? 'available';

      const sunState: CelestialBodyLiveState = visResp?.sun
        ? {
            azimuth_deg: visResp.sun.azimuth_deg,
            elevation_deg: visResp.sun.elevation_deg,
            distance_km: visResp.sun.distance_km,
            angular_diameter_deg: visResp.sun.angular_diameter_deg,
            is_visible: visResp.sun.visible_fraction > 0,
            fraction_visible: visResp.sun.visible_fraction,
            horizon_elevation_deg: visResp.sun.horizon_elevation_at_azimuth_deg,
            upper_limb_clearance_deg: visResp.sun.upper_limb_clearance_deg,
          }
        : get().sun;

      const earthState: CelestialBodyLiveState = visResp?.earth
        ? {
            azimuth_deg: visResp.earth.azimuth_deg,
            elevation_deg: visResp.earth.elevation_deg,
            distance_km: visResp.earth.distance_km,
            angular_diameter_deg: visResp.earth.angular_diameter_deg,
            is_visible: visResp.earth.visible_fraction > 0,
            fraction_visible: visResp.earth.visible_fraction,
            horizon_elevation_deg: visResp.earth.horizon_elevation_at_azimuth_deg,
            upper_limb_clearance_deg: visResp.earth.upper_limb_clearance_deg,
          }
        : get().earth;

      set({
        isAnalyzing: false,
        analysisResult: {
          latitude: lat,
          longitude: lon,
          site_id: siteId,
          timestamp_iso: epoch,
          observer_height_m: observerHeightM,
          surface_elevation_m: surfaceElev,
          slope_deg: slopeDeg,
          coverage_status: coverage,
          sun: sunState,
          earth: earthState,
          horizon_summary: visResp?.terrain_horizon_summary,
          warnings: visResp?.warnings || [],
        },
      });
    } catch (err) {
      console.error('Point analysis failed:', err);
      set({ isAnalyzing: false });
    }
  },

  closeAnalysisDrawer: () => set({ analysisDrawerOpen: false }),
  openAnalysisDrawer: () => set({ analysisDrawerOpen: true }),
}));
