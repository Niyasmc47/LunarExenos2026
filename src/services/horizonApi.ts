import { HorizonAnalysisRequest, HorizonAnalysisResponse } from '../types/horizon';

const BACKEND_BASE = 'http://127.0.0.1:8000';

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
