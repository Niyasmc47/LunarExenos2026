import {
  TradeOffStudyCreateRequest,
  TradeOffStudyUpdateRequest,
  TradeOffStudyRecord,
  SensitivityAnalysisResponse,
} from '../types/tradeOff';
import { parseApiResponse } from './apiClient';

const API_BASE = '/api/trade-off';

export async function createTradeOffStudy(req: TradeOffStudyCreateRequest): Promise<TradeOffStudyRecord> {
  const endpoint = `${API_BASE}/studies`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  const data = await parseApiResponse<{ study: TradeOffStudyRecord }>(resp, endpoint);
  return data.study;
}

export async function fetchTradeOffStudies(): Promise<TradeOffStudyRecord[]> {
  const endpoint = `${API_BASE}/studies`;
  const resp = await fetch(endpoint);
  return parseApiResponse<TradeOffStudyRecord[]>(resp, endpoint);
}

export async function fetchTradeOffStudy(id: string): Promise<TradeOffStudyRecord> {
  const endpoint = `${API_BASE}/studies/${id}`;
  const resp = await fetch(endpoint);
  return parseApiResponse<TradeOffStudyRecord>(resp, endpoint);
}

export async function updateTradeOffStudy(id: string, req: TradeOffStudyUpdateRequest): Promise<TradeOffStudyRecord> {
  const endpoint = `${API_BASE}/studies/${id}`;
  const resp = await fetch(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return parseApiResponse<TradeOffStudyRecord>(resp, endpoint);
}

export async function deleteTradeOffStudy(id: string): Promise<void> {
  const endpoint = `${API_BASE}/studies/${id}`;
  const resp = await fetch(endpoint, {
    method: 'DELETE',
  });
  if (!resp.ok && resp.status !== 404) {
    throw new Error(`Failed to delete trade-off study ${id}: HTTP ${resp.status} ${resp.statusText}`);
  }
}

export async function reanalyzeTradeOffStudy(id: string): Promise<TradeOffStudyRecord> {
  const endpoint = `${API_BASE}/studies/${id}/analyze`;
  const resp = await fetch(endpoint, {
    method: 'POST',
  });
  return parseApiResponse<TradeOffStudyRecord>(resp, endpoint);
}

export async function runTradeOffSensitivity(id: string): Promise<SensitivityAnalysisResponse> {
  const endpoint = `${API_BASE}/studies/${id}/sensitivity`;
  const resp = await fetch(endpoint, {
    method: 'POST',
  });
  return parseApiResponse<SensitivityAnalysisResponse>(resp, endpoint);
}

export function getTradeOffExportJsonUrl(id: string): string {
  return `${API_BASE}/studies/${id}/export/json`;
}

export function getTradeOffExportCsvUrl(id: string): string {
  return `${API_BASE}/studies/${id}/export/csv`;
}
