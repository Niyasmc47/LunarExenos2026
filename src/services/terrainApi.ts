import { ElevationPoint, ElevationProfileData, TerrainMeshData, TerrainMetadata } from '../types/terrain';

import { API_BASE_URL } from './apiClient';

const BACKEND_BASE = API_BASE_URL;

export async function fetchTerrainMetadata(datasetId: string = 'site01'): Promise<TerrainMetadata | null> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/terrain/${datasetId}/metadata`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[Terrain API] Could not fetch metadata for ${datasetId}:`, err);
    return null;
  }
}

export async function fetchElevationPoint(lat: number, lon: number): Promise<ElevationPoint | null> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/terrain/elevation?latitude=${lat}&longitude=${lon}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[Terrain API] Could not fetch elevation at ${lat}, ${lon}:`, err);
    return null;
  }
}

export async function fetchTerrainMesh(
  datasetId: string = 'site01',
  lod: 'low' | 'medium' | 'high' = 'medium',
  exaggeration: number = 1.0
): Promise<TerrainMeshData | null> {
  try {
    const res = await fetch(
      `${BACKEND_BASE}/api/terrain/${datasetId}/mesh?lod=${lod}&exaggeration=${exaggeration}`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[Terrain API] Could not fetch mesh for ${datasetId}:`, err);
    return null;
  }
}

export function getOverlayImageUrl(type: 'elevation' | 'slope' = 'elevation'): string {
  return `${BACKEND_BASE}/api/terrain/site01/overlay/${type}.png`;
}

export async function fetchElevationProfile(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  samples: number = 100,
  datasetId: string = 'site01'
): Promise<ElevationProfileData | null> {
  try {
    const url = `${BACKEND_BASE}/api/terrain/profile?dataset_id=${datasetId}&start_lat=${startLat}&start_lon=${startLon}&end_lat=${endLat}&end_lon=${endLon}&num_samples=${samples}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[Terrain API] Could not fetch profile:', err);
    return null;
  }
}

export async function fetchTerrainQuality(datasetId: string = 'site01'): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/terrain/${datasetId}/quality`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[Terrain API] Could not fetch quality report:', err);
    return null;
  }
}

