import {
  DecisionReportRecord,
  DecisionReportSummary,
  DecisionReportCreateRequest,
} from '../types/decisionReport';
import { parseApiResponse } from './apiClient';

const API_BASE = '/api/decision-reports';

export async function fetchDecisionReports(): Promise<DecisionReportSummary[]> {
  const endpoint = `${API_BASE}/`;
  const resp = await fetch(endpoint);
  const data = await parseApiResponse<{ reports: DecisionReportSummary[] }>(resp, endpoint);
  return data.reports || [];
}

export async function fetchDecisionReport(reportId: string): Promise<DecisionReportRecord> {
  const endpoint = `${API_BASE}/${reportId}`;
  const resp = await fetch(endpoint);
  const data = await parseApiResponse<{ report: DecisionReportRecord }>(resp, endpoint);
  return data.report;
}

export async function createDecisionReport(
  req: DecisionReportCreateRequest
): Promise<DecisionReportRecord> {
  const endpoint = `${API_BASE}/`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  const data = await parseApiResponse<{ report: DecisionReportRecord }>(resp, endpoint);
  return data.report;
}

export async function deleteDecisionReport(reportId: string): Promise<void> {
  const endpoint = `${API_BASE}/${reportId}`;
  const resp = await fetch(endpoint, {
    method: 'DELETE',
  });
  if (!resp.ok && resp.status !== 404) {
    throw new Error(`Failed to delete decision report '${reportId}': HTTP ${resp.status} ${resp.statusText}`);
  }
}

export function getReportPdfExportUrl(reportId: string): string {
  return `${API_BASE}/${reportId}/export/pdf`;
}

export function getReportJsonExportUrl(reportId: string): string {
  return `${API_BASE}/${reportId}/export/json`;
}

export function getReportCsvExportUrl(reportId: string): string {
  return `${API_BASE}/${reportId}/export/csv`;
}
