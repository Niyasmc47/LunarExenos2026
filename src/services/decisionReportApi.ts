import {
  DecisionReportRecord,
  DecisionReportSummary,
  DecisionReportCreateRequest,
} from '../types/decisionReport';

const API_BASE = '/api/reports';

export async function fetchDecisionReports(): Promise<DecisionReportSummary[]> {
  const resp = await fetch(`${API_BASE}/`);
  if (!resp.ok) {
    throw new Error(`Failed to fetch decision reports: ${resp.statusText}`);
  }
  const data = await resp.json();
  return data.reports || [];
}

export async function fetchDecisionReport(reportId: string): Promise<DecisionReportRecord> {
  const resp = await fetch(`${API_BASE}/${reportId}`);
  if (!resp.ok) {
    throw new Error(`Failed to fetch decision report '${reportId}': ${resp.statusText}`);
  }
  const data = await resp.json();
  return data.report;
}

export async function createDecisionReport(
  req: DecisionReportCreateRequest
): Promise<DecisionReportRecord> {
  const resp = await fetch(`${API_BASE}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || 'Failed to create decision report');
  }
  const data = await resp.json();
  return data.report;
}

export async function deleteDecisionReport(reportId: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/${reportId}`, {
    method: 'DELETE',
  });
  if (!resp.ok) {
    throw new Error(`Failed to delete decision report '${reportId}': ${resp.statusText}`);
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
