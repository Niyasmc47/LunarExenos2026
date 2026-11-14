import {
  MissionProfile,
  MissionProfileCreateRequest,
  MissionProfileUpdateRequest,
  MissionProfileValidationResponse,
} from '../types/missionProfile';

const API_BASE = '/api/profiles';

export async function fetchMissionProfiles(): Promise<MissionProfile[]> {
  const resp = await fetch(`${API_BASE}/`);
  if (!resp.ok) {
    throw new Error(`Failed to fetch mission profiles: ${resp.statusText}`);
  }
  return resp.json();
}

export async function fetchMissionProfile(profileId: string): Promise<MissionProfile> {
  const resp = await fetch(`${API_BASE}/${profileId}`);
  if (!resp.ok) {
    throw new Error(`Failed to fetch mission profile '${profileId}': ${resp.statusText}`);
  }
  return resp.json();
}

export async function createMissionProfile(
  req: MissionProfileCreateRequest
): Promise<MissionProfile> {
  const resp = await fetch(`${API_BASE}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || 'Failed to create mission profile');
  }
  return resp.json();
}

export async function updateMissionProfile(
  profileId: string,
  req: MissionProfileUpdateRequest
): Promise<MissionProfile> {
  const resp = await fetch(`${API_BASE}/${profileId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || 'Failed to update mission profile');
  }
  return resp.json();
}

export async function duplicateMissionProfile(profileId: string): Promise<MissionProfile> {
  const resp = await fetch(`${API_BASE}/${profileId}/duplicate`, {
    method: 'POST',
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || 'Failed to duplicate mission profile');
  }
  return resp.json();
}

export async function deleteMissionProfile(profileId: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/${profileId}`, {
    method: 'DELETE',
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || 'Failed to delete mission profile');
  }
}

export async function validateMissionProfile(
  req: Partial<MissionProfileCreateRequest>
): Promise<MissionProfileValidationResponse> {
  const resp = await fetch(`${API_BASE}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!resp.ok) {
    throw new Error(`Validation check failed: ${resp.statusText}`);
  }
  return resp.json();
}

export async function restoreTemplates(): Promise<MissionProfile[]> {
  const resp = await fetch(`${API_BASE}/reset-templates`, {
    method: 'POST',
  });
  if (!resp.ok) {
    throw new Error(`Failed to restore templates: ${resp.statusText}`);
  }
  return resp.json();
}
