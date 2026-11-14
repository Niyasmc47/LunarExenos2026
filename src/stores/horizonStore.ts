import { create } from 'zustand';
import { HorizonAnalysisResponse, HorizonPoint } from '../types/horizon';
import { calculateHorizon } from '../services/horizonApi';

interface HorizonState {
  observerHeight: number;
  azimuthResolution: number;
  maxSearchDistance: number;
  samplingInterval: number;
  datasetId: string;
  horizonData: HorizonAnalysisResponse | null;
  isLoading: boolean;
  error: string | null;
  selectedAzimuth: number | null;
  hoveredPoint: HorizonPoint | null;

  setObserverHeight: (h: number) => void;
  setAzimuthResolution: (res: number) => void;
  setMaxSearchDistance: (d: number) => void;
  setSamplingInterval: (interval: number) => void;
  setDatasetId: (id: string) => void;
  setSelectedAzimuth: (az: number | null) => void;
  setHoveredPoint: (pt: HorizonPoint | null) => void;

  computeHorizon: (lat: number, lon: number) => Promise<void>;
}

export const useHorizonStore = create<HorizonState>((set, get) => ({
  observerHeight: 2.0,
  azimuthResolution: 1.0,
  maxSearchDistance: 15000.0,
  samplingInterval: 15.0,
  datasetId: 'site01',
  horizonData: null,
  isLoading: false,
  error: null,
  selectedAzimuth: 0.0,
  hoveredPoint: null,

  setObserverHeight: (observerHeight) => set({ observerHeight }),
  setAzimuthResolution: (azimuthResolution) => set({ azimuthResolution }),
  setMaxSearchDistance: (maxSearchDistance) => set({ maxSearchDistance }),
  setSamplingInterval: (samplingInterval) => set({ samplingInterval }),
  setDatasetId: (datasetId) => set({ datasetId }),
  setSelectedAzimuth: (selectedAzimuth) => set({ selectedAzimuth }),
  setHoveredPoint: (hoveredPoint) => set({ hoveredPoint }),

  computeHorizon: async (lat: number, lon: number) => {
    const {
      observerHeight,
      azimuthResolution,
      maxSearchDistance,
      samplingInterval,
      datasetId,
    } = get();

    set({ isLoading: true, error: null });

    try {
      const resp = await calculateHorizon({
        latitude: lat,
        longitude: lon,
        observer_height_m: observerHeight,
        azimuth_resolution_deg: azimuthResolution,
        max_search_distance_m: maxSearchDistance,
        sampling_interval_m: samplingInterval,
        dataset_id: datasetId,
      });

      if (!resp) {
        set({
          isLoading: false,
          error: 'Failed to calculate horizon. Verify coordinates or DEM availability.',
        });
        return;
      }

      set({
        horizonData: resp,
        isLoading: false,
        error: null,
        // Default hovered point to max elevation point
        hoveredPoint:
          resp.horizon_profile.find(
            (p) => p.azimuth_deg === resp.summary.max_horizon_azimuth_deg
          ) || resp.horizon_profile[0] || null,
      });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err?.message || 'Error occurred during horizon calculation',
      });
    }
  },
}));
