import {
  CandidateScreeningRequest,
  CandidateScreeningResponse,
  ScreeningRunRecord,
} from '../types/screening';

const API_BASE = '/api/screening';

export async function runCandidateScreening(req: CandidateScreeningRequest): Promise<ScreeningRunRecord> {
  const resp = await fetch(`${API_BASE}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!resp.ok) {
    const errorBody = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(errorBody.detail || 'Failed to execute candidate screening run');
  }
  const data: CandidateScreeningResponse = await resp.json();
  return data.run;
}

export async function fetchScreeningRuns(): Promise<ScreeningRunRecord[]> {
  const resp = await fetch(`${API_BASE}/runs`);
  if (!resp.ok) {
    throw new Error(`Failed to fetch screening runs: ${resp.statusText}`);
  }
  return resp.json();
}

export async function fetchScreeningRun(runId: string): Promise<ScreeningRunRecord> {
  const resp = await fetch(`${API_BASE}/runs/${runId}`);
  if (!resp.ok) {
    throw new Error(`Failed to fetch screening run ${runId}: ${resp.statusText}`);
  }
  return resp.json();
}

export async function deleteScreeningRun(runId: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/runs/${runId}`, {
    method: 'DELETE',
  });
  if (!resp.ok && resp.status !== 404) {
    throw new Error(`Failed to delete screening run ${runId}: ${resp.statusText}`);
  }
}

export function getScreeningExportJsonUrl(runId: string): string {
  return `${API_BASE}/runs/${runId}/export/json`;
}

export function getScreeningExportCsvUrl(runId: string): string {
  return `${API_BASE}/runs/${runId}/export/csv`;
}
