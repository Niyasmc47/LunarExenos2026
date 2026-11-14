import {
  MissionWindowSearchRequest,
  MissionWindowSearchResponse,
  MissionWindowSearchRecord,
  WindowComparisonResponse,
} from '../types/windowPlanner';
import { parseApiResponse } from './apiClient';

const API_BASE = '/api/window-planner';

export async function executeWindowSearch(req: MissionWindowSearchRequest): Promise<MissionWindowSearchRecord> {
  const endpoint = `${API_BASE}/search`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  const data = await parseApiResponse<MissionWindowSearchResponse>(resp, endpoint);
  return data.search;
}

export async function fetchWindowSearches(): Promise<MissionWindowSearchRecord[]> {
  const endpoint = `${API_BASE}/searches`;
  const resp = await fetch(endpoint);
  return parseApiResponse<MissionWindowSearchRecord[]>(resp, endpoint);
}

export async function fetchWindowSearch(searchId: string): Promise<MissionWindowSearchRecord> {
  const endpoint = `${API_BASE}/searches/${searchId}`;
  const resp = await fetch(endpoint);
  return parseApiResponse<MissionWindowSearchRecord>(resp, endpoint);
}

export async function deleteWindowSearch(searchId: string): Promise<void> {
  const endpoint = `${API_BASE}/searches/${searchId}`;
  const resp = await fetch(endpoint, {
    method: 'DELETE',
  });
  if (!resp.ok && resp.status !== 404) {
    throw new Error(`Failed to delete window search ${searchId}: HTTP ${resp.status} ${resp.statusText}`);
  }
}

export async function compareWindows(searchId: string, windowIds: string[]): Promise<WindowComparisonResponse> {
  const endpoint = `${API_BASE}/searches/${searchId}/compare`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ window_ids: windowIds }),
  });
  return parseApiResponse<WindowComparisonResponse>(resp, endpoint);
}

export function getWindowExportJsonUrl(searchId: string): string {
  return `${API_BASE}/searches/${searchId}/export/json`;
}

export function getWindowExportCsvUrl(searchId: string): string {
  return `${API_BASE}/searches/${searchId}/export/csv`;
}
