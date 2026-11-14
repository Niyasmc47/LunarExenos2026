import { create } from 'zustand';
import {
  EphemerisPositionResponse,
  EphemerisTimeSeriesResponse,
  EphemerisStatusResponse,
} from '../types/ephemeris';
import {
  fetchEphemerisPosition,
  fetchEphemerisTimeSeries,
  fetchEphemerisStatus,
} from '../services/ephemerisApi';

interface EphemerisState {
  selectedTimestamp: string;
  observerHeight: number;
  aberrationCorrection: string;
  timeSeriesDurationDays: number;
  timeSeriesStepHours: number;

  positionData: EphemerisPositionResponse | null;
  timeSeriesData: EphemerisTimeSeriesResponse | null;
  statusData: EphemerisStatusResponse | null;

  isLoading: boolean;
  isTimeSeriesLoading: boolean;
  error: string | null;

  setSelectedTimestamp: (ts: string) => void;
  setObserverHeight: (h: number) => void;
  setAberrationCorrection: (corr: string) => void;
  setTimeSeriesDurationDays: (days: number) => void;
  setTimeSeriesStepHours: (step: number) => void;

  computePosition: (lat: number, lon: number) => Promise<void>;
  computeTimeSeries: (lat: number, lon: number) => Promise<void>;
  loadStatus: () => Promise<void>;
}

let activePositionRequestId = 0;
let activeTimeSeriesRequestId = 0;

export const useEphemerisStore = create<EphemerisState>((set, get) => ({
  selectedTimestamp: '2026-10-04T12:00:00Z',
  observerHeight: 2.0,
  aberrationCorrection: 'LT+S',
  timeSeriesDurationDays: 3,
  timeSeriesStepHours: 2.0,

  positionData: null,
  timeSeriesData: null,
  statusData: null,

  isLoading: false,
  isTimeSeriesLoading: false,
  error: null,

  setSelectedTimestamp: (selectedTimestamp) => set({ selectedTimestamp }),
  setObserverHeight: (observerHeight) => set({ observerHeight }),
  setAberrationCorrection: (aberrationCorrection) => set({ aberrationCorrection }),
  setTimeSeriesDurationDays: (timeSeriesDurationDays) => set({ timeSeriesDurationDays }),
  setTimeSeriesStepHours: (timeSeriesStepHours) => set({ timeSeriesStepHours }),

  computePosition: async (lat: number, lon: number) => {
    const { selectedTimestamp, observerHeight, aberrationCorrection } = get();
    const requestId = ++activePositionRequestId;
    set({ isLoading: true, error: null });

    try {
      const resp = await fetchEphemerisPosition({
        latitude: lat,
        longitude: lon,
        timestamp_iso: selectedTimestamp,
        observer_height_m: observerHeight,
        dataset_id: 'site01',
        aberration_correction: aberrationCorrection,
      });

      // Ignore stale response if a newer request was dispatched
      if (requestId !== activePositionRequestId) {
        return;
      }

      if (!resp) {
        set({ isLoading: false, error: 'Failed to calculate topocentric ephemeris position.' });
        return;
      }

      set({ positionData: resp, isLoading: false, error: null });
    } catch (err: any) {
      if (requestId === activePositionRequestId) {
        set({ isLoading: false, error: err?.message || 'Ephemeris computation failed' });
      }
    }
  },

  computeTimeSeries: async (lat: number, lon: number) => {
    const { selectedTimestamp, observerHeight, aberrationCorrection, timeSeriesDurationDays, timeSeriesStepHours } = get();
    const requestId = ++activeTimeSeriesRequestId;
    set({ isTimeSeriesLoading: true });

    try {
      // Calculate end timestamp by adding timeSeriesDurationDays
      const startDate = new Date(selectedTimestamp);
      const endDate = new Date(startDate.getTime() + timeSeriesDurationDays * 24 * 3600 * 1000);
      const endTimestampIso = endDate.toISOString();

      const resp = await fetchEphemerisTimeSeries({
        latitude: lat,
        longitude: lon,
        start_timestamp_iso: selectedTimestamp,
        end_timestamp_iso: endTimestampIso,
        step_interval_hours: timeSeriesStepHours,
        observer_height_m: observerHeight,
        dataset_id: 'site01',
        aberration_correction: aberrationCorrection,
      });

      // Ignore stale response if a newer request was dispatched
      if (requestId !== activeTimeSeriesRequestId) {
        return;
      }

      if (resp) {
        set({ timeSeriesData: resp, isTimeSeriesLoading: false });
      } else {
        set({ isTimeSeriesLoading: false });
      }
    } catch (err) {
      if (requestId === activeTimeSeriesRequestId) {
        set({ isTimeSeriesLoading: false });
      }
    }
  },

  loadStatus: async () => {
    const status = await fetchEphemerisStatus();
    if (status) {
      set({ statusData: status });
    }
  },
}));
