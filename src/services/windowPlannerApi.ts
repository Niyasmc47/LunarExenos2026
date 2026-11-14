import {
  MissionWindowSearchRequest,
  MissionWindowSearchResponse,
  MissionWindowSearchRecord,
  WindowComparisonResponse,
} from '../types/windowPlanner';

const API_BASE = '/api/window-planner';

export async function executeWindowSearch(req: MissionWindowSearchRequest): Promise<MissionWindowSearchRecord> {
  const resp = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!resp.ok) {
    const errorBody = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(errorBody.detail || 'Failed to execute window search');
  }
  const data: MissionWindowSearchResponse = await resp.json();
  return data.search;
}

export async function fetchWindowSearches(): Promise<MissionWindowSearchRecord[]> {
  const resp = await fetch(`${API_BASE}/searches`);
  if (!resp.ok) {
    throw new Error(`Failed to fetch window searches: ${resp.statusText}`);
  }
  return resp.json();
}

export async function fetchWindowSearch(searchId: string): Promise<MissionWindowSearchRecord> {
  const resp = await fetch(`${API_BASE}/searches/${searchId}`);
  if (!resp.ok) {
    throw new Error(`Failed to fetch window search ${searchId}: ${resp.statusText}`);
  }
  return resp.json();
}

export async function deleteWindowSearch(searchId: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/searches/${searchId}`, {
    method: 'DELETE',
  });
  if (!resp.ok && resp.status !== 404) {
    throw new Error(`Failed to delete window search ${searchId}: ${resp.statusText}`);
  }
}

export async function compareWindows(searchId: string, windowIds: string[]): Promise<WindowComparisonResponse> {
  const resp = await fetch(`${API_BASE}/searches/${searchId}/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ window_ids: windowIds }),
  });
  if (!resp.ok) {
    const errorBody = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(errorBody.detail || 'Failed to compare windows');
  }
  return resp.json();
}

export function getWindowExportJsonUrl(searchId: string): string {
  return `${API_BASE}/searches/${searchId}/export/json`;
}

export function getWindowExportCsvUrl(searchId: string): string {
  return `${API_BASE}/searches/${searchId}/export/csv`;
}
