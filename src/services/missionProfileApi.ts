import {
  MissionProfile,
  MissionProfileCreateRequest,
  MissionProfileUpdateRequest,
  MissionProfileValidationResponse,
} from '../types/missionProfile';
import { parseApiResponse } from './apiClient';

const API_BASE = '/api/profiles';

export async function fetchMissionProfiles(): Promise<MissionProfile[]> {
  const endpoint = `${API_BASE}/`;
  const resp = await fetch(endpoint);
  return parseApiResponse<MissionProfile[]>(resp, endpoint);
}

export async function fetchMissionProfile(profileId: string): Promise<MissionProfile> {
  const endpoint = `${API_BASE}/${profileId}`;
  const resp = await fetch(endpoint);
  return parseApiResponse<MissionProfile>(resp, endpoint);
}

export async function createMissionProfile(
  req: MissionProfileCreateRequest
): Promise<MissionProfile> {
  const endpoint = `${API_BASE}/`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return parseApiResponse<MissionProfile>(resp, endpoint);
}

export async function updateMissionProfile(
  profileId: string,
  req: MissionProfileUpdateRequest
): Promise<MissionProfile> {
  const endpoint = `${API_BASE}/${profileId}`;
  const resp = await fetch(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return parseApiResponse<MissionProfile>(resp, endpoint);
}

export async function duplicateMissionProfile(profileId: string): Promise<MissionProfile> {
  const endpoint = `${API_BASE}/${profileId}/duplicate`;
  const resp = await fetch(endpoint, {
    method: 'POST',
  });
  return parseApiResponse<MissionProfile>(resp, endpoint);
}

export async function deleteMissionProfile(profileId: string): Promise<void> {
  const endpoint = `${API_BASE}/${profileId}`;
  const resp = await fetch(endpoint, {
    method: 'DELETE',
  });
  if (!resp.ok) {
    throw new Error(`Failed to delete mission profile: HTTP ${resp.status} ${resp.statusText}`);
  }
}

export async function validateMissionProfile(
  req: Partial<MissionProfileCreateRequest>
): Promise<MissionProfileValidationResponse> {
  const endpoint = `${API_BASE}/validate`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return parseApiResponse<MissionProfileValidationResponse>(resp, endpoint);
}

export async function restoreTemplates(): Promise<MissionProfile[]> {
  const endpoint = `${API_BASE}/reset-templates`;
  const resp = await fetch(endpoint, {
    method: 'POST',
  });
  return parseApiResponse<MissionProfile[]>(resp, endpoint);
}
