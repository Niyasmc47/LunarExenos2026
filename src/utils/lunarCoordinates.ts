import { LunarCoordinates, PresetLocation } from '../types/lunar';

/**
 * Normalizes latitude to [-90, +90]
 */
export function clampLatitude(lat: number): number {
  return Math.max(-90, Math.min(90, lat));
}

/**
 * Wraps longitude to [-180, +180]
 */
export function normalizeLongitude(lon: number): number {
  let normalized = ((lon + 180) % 360 + 360) % 360 - 180;
  if (normalized === -180 && lon > 0) {
    normalized = 180;
  }
  return normalized;
}

/**
 * Validates coordinate inputs
 */
export function validateCoordinates(lat: number, lon: number): { valid: boolean; error?: string } {
  if (isNaN(lat) || isNaN(lon)) {
    return { valid: false, error: 'Coordinates must be valid numbers' };
  }
  if (lat < -90 || lat > 90) {
    return { valid: false, error: 'Latitude must be between -90° and +90°' };
  }
  if (lon < -180 || lon > 180) {
    return { valid: false, error: 'Longitude must be between -180° and +180°' };
  }
  return { valid: true };
}

/**
 * Format latitude with N / S notation
 */
export function formatLatitude(lat: number, decimals: number = 4): string {
  const dir = lat >= 0 ? 'N' : 'S';
  return `${Math.abs(lat).toFixed(decimals)}° ${dir}`;
}

/**
 * Format longitude with E / W notation
 */
export function formatLongitude(lon: number, decimals: number = 4): string {
  const dir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lon).toFixed(decimals)}° ${dir}`;
}

/**
 * Format full lunar coordinate string
 */
export function formatCoordinates(coords: LunarCoordinates, decimals: number = 4): string {
  return `${formatLatitude(coords.latitude, decimals)}, ${formatLongitude(coords.longitude, decimals)}`;
}

/**
 * Lunar Mean Radius in kilometers
 */
export const MOON_RADIUS_KM = 1737.4;

/**
 * Calculates great-circle distance between two lunar coordinates in km
 */
export function lunarHaversineDistance(
  coord1: LunarCoordinates,
  coord2: LunarCoordinates
): number {
  const toRad = Math.PI / 180;
  const dLat = (coord2.latitude - coord1.latitude) * toRad;
  const dLon = (coord2.longitude - coord1.longitude) * toRad;
  const lat1 = coord1.latitude * toRad;
  const lat2 = coord2.latitude * toRad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return MOON_RADIUS_KM * c;
}

/**
 * Key lunar landing sites and landmarks for instant testing and reference
 */
export const LUNAR_PRESETS: PresetLocation[] = [
  {
    id: 'site-01-connecting-ridge',
    name: 'Site 01 (Connecting Ridge - Artemis)',
    latitude: -89.4632,
    longitude: -137.4896,
    description: 'NASA LOLA 5m DEM test site near Shackleton Crater, candidate Artemis landing region',
    category: 'artemis',
  },
  {
    id: 'apollo-11',
    name: 'Apollo 11 (Statio Tranquillitatis)',
    latitude: 0.6741,
    longitude: 23.4730,
    description: 'First crewed lunar landing by Armstrong & Aldrin (July 20, 1969)',
    category: 'apollo',
  },
  {
    id: 'apollo-12',
    name: 'Apollo 12 (Oceanus Procellarum)',
    latitude: -3.0124,
    longitude: -23.4216,
    description: 'Precision landing near Surveyor 3 probe (Nov 1969)',
    category: 'apollo',
  },
  {
    id: 'apollo-17',
    name: 'Apollo 17 (Taurus-Littrow)',
    latitude: 20.1908,
    longitude: 30.7717,
    description: 'Final Apollo mission with geologist Harrison Schmitt (Dec 1972)',
    category: 'apollo',
  },
  {
    id: 'shackleton',
    name: 'Shackleton Crater (South Pole)',
    latitude: -89.67,
    longitude: 0.0,
    description: 'Permanently shadowed region at South Pole, prime Artemis target for water ice',
    category: 'artemis',
  },
  {
    id: 'change-4',
    name: "Chang'e 4 (Von Kármán / South Pole-Aitken)",
    latitude: -45.457,
    longitude: 177.589,
    description: 'First soft landing on the lunar Far Side (Jan 2019)',
    category: 'robotic',
  },
  {
    id: 'copernicus',
    name: 'Copernicus Crater',
    latitude: 9.62,
    longitude: -20.08,
    description: 'Prominent 93 km impact crater with central peaks and bright ray system',
    category: 'feature',
  },
  {
    id: 'tycho',
    name: 'Tycho Crater',
    latitude: -43.31,
    longitude: -11.36,
    description: 'Spectacular young impact crater with rays spanning over 1,500 km',
    category: 'feature',
  },
  {
    id: 'prime-meridian',
    name: 'Sinus Medii (0°N, 0°E)',
    latitude: 0.0,
    longitude: 0.0,
    description: 'Center of lunar near side facing Earth directly',
    category: 'feature',
  },
];
