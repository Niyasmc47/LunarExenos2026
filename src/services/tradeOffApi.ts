import {
  TradeOffStudyCreateRequest,
  TradeOffStudyUpdateRequest,
  TradeOffStudyRecord,
  SensitivityAnalysisResponse,
} from '../types/tradeOff';

const API_BASE = '/api/trade-off';

export async function createTradeOffStudy(req: TradeOffStudyCreateRequest): Promise<TradeOffStudyRecord> {
  const resp = await fetch(`${API_BASE}/studies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!resp.ok) {
    const errorBody = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(errorBody.detail || 'Failed to create trade-off study');
  }
  const data = await resp.json();
  return data.study;
}

export async function fetchTradeOffStudies(): Promise<TradeOffStudyRecord[]> {
  const resp = await fetch(`${API_BASE}/studies`);
  if (!resp.ok) {
    throw new Error(`Failed to fetch trade-off studies: ${resp.statusText}`);
  }
  return resp.json();
}

export async function fetchTradeOffStudy(id: string): Promise<TradeOffStudyRecord> {
  const resp = await fetch(`${API_BASE}/studies/${id}`);
  if (!resp.ok) {
    throw new Error(`Failed to fetch trade-off study ${id}: ${resp.statusText}`);
  }
  return resp.json();
}

export async function updateTradeOffStudy(id: string, req: TradeOffStudyUpdateRequest): Promise<TradeOffStudyRecord> {
  const resp = await fetch(`${API_BASE}/studies/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!resp.ok) {
    const errorBody = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(errorBody.detail || 'Failed to update trade-off study');
  }
  return resp.json();
}

export async function deleteTradeOffStudy(id: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/studies/${id}`, {
    method: 'DELETE',
  });
  if (!resp.ok && resp.status !== 404) {
    throw new Error(`Failed to delete trade-off study ${id}: ${resp.statusText}`);
  }
}

export async function reanalyzeTradeOffStudy(id: string): Promise<TradeOffStudyRecord> {
  const resp = await fetch(`${API_BASE}/studies/${id}/analyze`, {
    method: 'POST',
  });
  if (!resp.ok) {
    const errorBody = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(errorBody.detail || 'Failed to reanalyze trade-off study');
  }
  return resp.json();
}

export async function runTradeOffSensitivity(id: string): Promise<SensitivityAnalysisResponse> {
  const resp = await fetch(`${API_BASE}/studies/${id}/sensitivity`, {
    method: 'POST',
  });
  if (!resp.ok) {
    const errorBody = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(errorBody.detail || 'Failed to execute sensitivity analysis');
  }
  return resp.json();
}

export function getTradeOffExportJsonUrl(id: string): string {
  return `${API_BASE}/studies/${id}/export/json`;
}

export function getTradeOffExportCsvUrl(id: string): string {
  return `${API_BASE}/studies/${id}/export/csv`;
}
