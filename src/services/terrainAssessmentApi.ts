import {
  TerrainAssessmentRequest,
  TerrainAssessmentResponse,
  TerrainAssessmentRecord,
} from '../types/terrainAssessment';

const API_BASE = '/api/terrain-assessment';

export async function runTerrainAssessment(req: TerrainAssessmentRequest): Promise<TerrainAssessmentRecord> {
  const resp = await fetch(`${API_BASE}/assess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!resp.ok) {
    const errorBody = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(errorBody.detail || 'Failed to execute terrain assessment');
  }
  const data: TerrainAssessmentResponse = await resp.json();
  return data.assessment;
}

export async function fetchTerrainAssessments(): Promise<TerrainAssessmentRecord[]> {
  const resp = await fetch(`${API_BASE}/assessments`);
  if (!resp.ok) {
    throw new Error(`Failed to fetch terrain assessments: ${resp.statusText}`);
  }
  return resp.json();
}

export async function fetchTerrainAssessment(id: string): Promise<TerrainAssessmentRecord> {
  const resp = await fetch(`${API_BASE}/assessments/${id}`);
  if (!resp.ok) {
    throw new Error(`Failed to fetch terrain assessment ${id}: ${resp.statusText}`);
  }
  return resp.json();
}

export async function deleteTerrainAssessment(id: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/assessments/${id}`, {
    method: 'DELETE',
  });
  if (!resp.ok && resp.status !== 404) {
    throw new Error(`Failed to delete terrain assessment ${id}: ${resp.statusText}`);
  }
}

export function getTerrainExportJsonUrl(id: string): string {
  return `${API_BASE}/assessments/${id}/export/json`;
}

export function getTerrainExportCsvUrl(id: string): string {
  return `${API_BASE}/assessments/${id}/export/csv`;
}
