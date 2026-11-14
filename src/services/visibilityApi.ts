import {
  VisibilityInstantRequest,
  VisibilityInstantResponse,
  VisibilityAnalysisRequest,
  VisibilityAnalysisResponse,
} from '../types/visibility';

import { API_BASE_URL } from './apiClient';

const BACKEND_BASE = API_BASE_URL;

export async function fetchInstantVisibility(
  req: VisibilityInstantRequest
): Promise<VisibilityInstantResponse | null> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/visibility/instant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Visibility API] Instant error ${res.status}:`, errText);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('[Visibility API] Network error (instant):', err);
    return null;
  }
}

export async function fetchVisibilityAnalysis(
  req: VisibilityAnalysisRequest
): Promise<VisibilityAnalysisResponse | null> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/visibility/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Visibility API] Analyze error ${res.status}:`, errText);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('[Visibility API] Network error (analyze):', err);
    return null;
  }
}

export async function fetchVisibilityStatus(): Promise<any> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/visibility/status`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[Visibility API] Status check failed:', err);
    return null;
  }
}

export async function fetchVisibilityProvenance(): Promise<any> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/visibility/provenance`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[Visibility API] Provenance check failed:', err);
    return null;
  }
}
