import { HorizonAnalysisRequest, HorizonAnalysisResponse } from '../types/horizon';

import { API_BASE_URL } from './apiClient';

const BACKEND_BASE = API_BASE_URL;

export async function calculateHorizon(
  req: HorizonAnalysisRequest
): Promise<HorizonAnalysisResponse | null> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/horizon/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Horizon API] Error ${res.status}:`, errText);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error('[Horizon API] Network/Fetch error:', err);
    return null;
  }
}
