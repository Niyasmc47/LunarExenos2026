import {
  EphemerisPositionRequest,
  EphemerisPositionResponse,
  EphemerisTimeSeriesRequest,
  EphemerisTimeSeriesResponse,
  EphemerisStatusResponse,
} from '../types/ephemeris';

import { API_BASE_URL } from './apiClient';

const BACKEND_BASE = API_BASE_URL;

export async function fetchEphemerisPosition(
  req: EphemerisPositionRequest
): Promise<EphemerisPositionResponse | null> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/ephemeris/position`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Ephemeris API] Position error ${res.status}:`, errText);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('[Ephemeris API] Network error (position):', err);
    return null;
  }
}

export async function fetchEphemerisTimeSeries(
  req: EphemerisTimeSeriesRequest
): Promise<EphemerisTimeSeriesResponse | null> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/ephemeris/timeseries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Ephemeris API] TimeSeries error ${res.status}:`, errText);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('[Ephemeris API] Network error (timeseries):', err);
    return null;
  }
}

export async function fetchEphemerisStatus(): Promise<EphemerisStatusResponse | null> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/ephemeris/status`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[Ephemeris API] Status check failed:', err);
    return null;
  }
}
