import {
  TerrainAssessmentRequest,
  TerrainAssessmentResponse,
  TerrainAssessmentRecord,
} from '../types/terrainAssessment';
import { parseApiResponse } from './apiClient';

const API_BASE = '/api/terrain-assessment';

export async function runTerrainAssessment(req: TerrainAssessmentRequest): Promise<TerrainAssessmentRecord> {
  const endpoint = `${API_BASE}/assess`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  const data = await parseApiResponse<TerrainAssessmentResponse>(resp, endpoint);
  return data.assessment;
}

export async function fetchTerrainAssessments(): Promise<TerrainAssessmentRecord[]> {
  const endpoint = `${API_BASE}/assessments`;
  const resp = await fetch(endpoint);
  return parseApiResponse<TerrainAssessmentRecord[]>(resp, endpoint);
}

export async function fetchTerrainAssessment(id: string): Promise<TerrainAssessmentRecord> {
  const endpoint = `${API_BASE}/assessments/${id}`;
  const resp = await fetch(endpoint);
  return parseApiResponse<TerrainAssessmentRecord>(resp, endpoint);
}

export async function deleteTerrainAssessment(id: string): Promise<void> {
  const endpoint = `${API_BASE}/assessments/${id}`;
  const resp = await fetch(endpoint, {
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
