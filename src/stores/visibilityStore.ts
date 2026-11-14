import { create } from 'zustand';
import {
  VisibilityInstantResponse,
  VisibilityAnalysisResponse,
} from '../types/visibility';
import {
  fetchInstantVisibility,
  fetchVisibilityAnalysis,
} from '../services/visibilityApi';

interface VisibilityState {
  selectedTimestamp: string;
  observerHeight: number;
  durationDays: number;
  stepHours: number;

  instantData: VisibilityInstantResponse | null;
  analysisData: VisibilityAnalysisResponse | null;

  isLoadingInstant: boolean;
  isLoadingAnalysis: boolean;
  error: string | null;

  isPlaying: boolean;

  setSelectedTimestamp: (ts: string) => void;
  setObserverHeight: (h: number) => void;
  setDurationDays: (days: number) => void;
  setStepHours: (step: number) => void;
  setIsPlaying: (playing: boolean) => void;

  stepTime: (hours: number, lat: number, lon: number) => void;
  computeInstant: (lat: number, lon: number) => Promise<void>;
  computeAnalysis: (lat: number, lon: number) => Promise<void>;
}

let activeInstantRequestId = 0;
let activeAnalysisRequestId = 0;

export const useVisibilityStore = create<VisibilityState>((set, get) => ({
  selectedTimestamp: '2026-10-04T12:00:00Z',
  observerHeight: 2.0,
  durationDays: 3,
  stepHours: 2.0,

  instantData: null,
  analysisData: null,

  isLoadingInstant: false,
  isLoadingAnalysis: false,
  error: null,

  isPlaying: false,

  setSelectedTimestamp: (selectedTimestamp) => set({ selectedTimestamp }),
  setObserverHeight: (observerHeight) => set({ observerHeight }),
  setDurationDays: (durationDays) => set({ durationDays }),
  setStepHours: (stepHours) => set({ stepHours }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),

  stepTime: (hours: number, lat: number, lon: number) => {
    const { selectedTimestamp, computeInstant } = get();
    const currentDate = new Date(selectedTimestamp);
    const newDate = new Date(currentDate.getTime() + hours * 3600 * 1000);
    const newTs = newDate.toISOString();
    set({ selectedTimestamp: newTs });
    computeInstant(lat, lon);
  },

  computeInstant: async (lat: number, lon: number) => {
    const { selectedTimestamp, observerHeight } = get();
    const requestId = ++activeInstantRequestId;
    set({ isLoadingInstant: true, error: null });

    try {
      const resp = await fetchInstantVisibility({
        latitude: lat,
        longitude: lon,
        timestamp_iso: selectedTimestamp,
        observer_height_m: observerHeight,
        dataset_id: 'site01',
      });

      if (requestId !== activeInstantRequestId) return;

      if (!resp) {
        set({
          isLoadingInstant: false,
          error: 'Failed to calculate terrain-aware instant visibility.',
        });
        return;
      }

      set({ instantData: resp, isLoadingInstant: false, error: null });
    } catch (err: any) {
      if (requestId === activeInstantRequestId) {
        set({
          isLoadingInstant: false,
          error: err?.message || 'Instant visibility computation failed',
        });
      }
    }
  },

  computeAnalysis: async (lat: number, lon: number) => {
    const { selectedTimestamp, observerHeight, durationDays, stepHours } = get();
    const requestId = ++activeAnalysisRequestId;
    set({ isLoadingAnalysis: true });

    try {
      const startDate = new Date(selectedTimestamp);
      const endDate = new Date(startDate.getTime() + durationDays * 24 * 3600 * 1000);

      const resp = await fetchVisibilityAnalysis({
        latitude: lat,
        longitude: lon,
        start_timestamp_iso: selectedTimestamp,
        end_timestamp_iso: endDate.toISOString(),
        step_interval_hours: stepHours,
        observer_height_m: observerHeight,
        dataset_id: 'site01',
      });

      if (requestId !== activeAnalysisRequestId) return;

      if (resp) {
        set({ analysisData: resp, isLoadingAnalysis: false });
      } else {
        set({ isLoadingAnalysis: false });
      }
    } catch (err) {
      if (requestId === activeAnalysisRequestId) {
        set({ isLoadingAnalysis: false });
      }
    }
  },
}));
