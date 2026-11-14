import {
  DatasetCatalogueResponse,
  DatasetDiscoveryResponse,
  RegionalStatistics,
  TerrainInspectionPoint,
  TransectProfileResponse,
} from '../types/dynamicAnalysis';

const BACKEND_BASE = 'http://127.0.0.1:8000';

export async function fetchDatasetCatalogue(): Promise<DatasetCatalogueResponse | null> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/datasets/catalogue`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[DynamicAnalysis API] Catalogue error:', err);
    return null;
  }
}

export async function discoverDatasets(
  minLat: number,
  maxLat: number,
  minLon: number,
  maxLon: number
): Promise<DatasetDiscoveryResponse | null> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/datasets/discover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        min_latitude: minLat,
        max_latitude: maxLat,
        min_longitude: minLon,
        max_longitude: maxLon,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[DynamicAnalysis API] Discovery error:', err);
    return null;
  }
}

export async function fetchRegionalStatistics(
  datasetId: string,
  minLat: number,
  maxLat: number,
  minLon: number,
  maxLon: number
): Promise<RegionalStatistics | null> {
  try {
    const url = `${BACKEND_BASE}/api/regional/statistics?dataset_id=${datasetId}&min_lat=${minLat}&max_lat=${maxLat}&min_lon=${minLon}&max_lon=${maxLon}`;
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[DynamicAnalysis API] Statistics error:', err);
    return null;
  }
}

export async function inspectTerrainPoint(
  lat: number,
  lon: number,
  datasetId: string = 'site01'
): Promise<TerrainInspectionPoint | null> {
  try {
    const res = await fetch(
      `${BACKEND_BASE}/api/regional/inspect?lat=${lat}&lon=${lon}&dataset_id=${datasetId}`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[DynamicAnalysis API] Point inspection error:', err);
    return null;
  }
}

export async function fetchTransectProfile(
  datasetId: string,
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  samples: number = 150
): Promise<TransectProfileResponse | null> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/regional/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataset_id: datasetId,
        start_latitude: startLat,
        start_longitude: startLon,
        end_latitude: endLat,
        end_longitude: endLon,
        num_samples: samples,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[DynamicAnalysis API] Profile error:', err);
    return null;
  }
}

export function getExportStatisticsCsvUrl(
  datasetId: string,
  minLat: number,
  maxLat: number,
  minLon: number,
  maxLon: number
): string {
  return `${BACKEND_BASE}/api/exports/statistics-csv?dataset_id=${datasetId}&min_lat=${minLat}&max_lat=${maxLat}&min_lon=${minLon}&max_lon=${maxLon}`;
}

export function getExportClippedGeotiffUrl(
  datasetId: string,
  minLat: number,
  maxLat: number,
  minLon: number,
  maxLon: number
): string {
  return `${BACKEND_BASE}/api/exports/geotiff?dataset_id=${datasetId}&min_lat=${minLat}&max_lat=${maxLat}&min_lon=${minLon}&max_lon=${maxLon}`;
}
