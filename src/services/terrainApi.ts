import { ElevationPoint, TerrainMeshData, TerrainMetadata } from '../types/terrain';

const BACKEND_BASE = 'http://127.0.0.1:8000';

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
