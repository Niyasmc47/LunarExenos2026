import {
  CandidateScreeningRequest,
  CandidateScreeningResponse,
  ScreeningRunRecord,
} from '../types/screening';
import { parseApiResponse } from './apiClient';

const API_BASE = '/api/screening';

export async function runCandidateScreening(req: CandidateScreeningRequest): Promise<ScreeningRunRecord> {
  const endpoint = `${API_BASE}/run`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  const data = await parseApiResponse<CandidateScreeningResponse>(resp, endpoint);
  return data.run;
}

export async function fetchScreeningRuns(): Promise<ScreeningRunRecord[]> {
  const endpoint = `${API_BASE}/runs`;
  const resp = await fetch(endpoint);
  return parseApiResponse<ScreeningRunRecord[]>(resp, endpoint);
}

export async function fetchScreeningRun(runId: string): Promise<ScreeningRunRecord> {
  const endpoint = `${API_BASE}/runs/${runId}`;
  const resp = await fetch(endpoint);
  return parseApiResponse<ScreeningRunRecord>(resp, endpoint);
}

export async function deleteScreeningRun(runId: string): Promise<void> {
  const endpoint = `${API_BASE}/runs/${runId}`;
  const resp = await fetch(endpoint, {
    method: 'DELETE',
  });
  if (!resp.ok && resp.status !== 404) {
    throw new Error(`Failed to delete screening run ${runId}: HTTP ${resp.status} ${resp.statusText}`);
  }
}

export function getScreeningExportJsonUrl(runId: string): string {
  return `${API_BASE}/runs/${runId}/export/json`;
}

export function getScreeningExportCsvUrl(runId: string): string {
  return `${API_BASE}/runs/${runId}/export/csv`;
}
