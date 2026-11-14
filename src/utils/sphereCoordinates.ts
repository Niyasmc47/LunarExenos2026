import * as THREE from 'three';
import { LunarCoordinates } from '../types/lunar';
import { clampLatitude, normalizeLongitude } from './lunarCoordinates';

/**
 * Converts lunar latitude/longitude to a 3D Cartesian Vector3 position on a sphere.
 *
 * Coordinate convention:
 * - Latitude: -90° (South pole, -Y) to +90° (North pole, +Y)
 * - Longitude: -180° to +180°
 * - Sub-Earth / Prime meridian (0° Lat, 0° Lon): faces +Z
 * - Positive Longitude (East): +X direction
 * - Negative Longitude (West): -X direction
 * - Far side (±180° Lon): -Z direction
 */
export function lunarToSpherePosition(
  lat: number,
  lon: number,
  radius: number = 2.0,
  altitudeOffset: number = 0.0
): THREE.Vector3 {
  const clampedLat = clampLatitude(lat);
  const normalizedLon = normalizeLongitude(lon);

  const phi = (clampedLat * Math.PI) / 180;
  const lambda = (normalizedLon * Math.PI) / 180;
  const r = radius + altitudeOffset;

  const x = r * Math.cos(phi) * Math.sin(lambda);
  const y = r * Math.sin(phi);
  const z = r * Math.cos(phi) * Math.cos(lambda);

  return new THREE.Vector3(x, y, z);
}

/**
 * Converts a 3D position vector on the sphere to lunar latitude and longitude.
 */
export function spherePositionToLunar(position: THREE.Vector3): LunarCoordinates {
  const dir = position.clone().normalize();

  // Clamp y to [-1, 1] to avoid NaN from Math.asin
  const clampedY = Math.max(-1, Math.min(1, dir.y));
  const lat = (Math.asin(clampedY) * 180) / Math.PI;

  // atan2(x, z) gives 0 at +Z (prime meridian), +90° at +X (East), -90° at -X (West), ±180° at -Z (Far side)
  const lon = (Math.atan2(dir.x, dir.z) * 180) / Math.PI;

  return {
    latitude: clampLatitude(lat),
    longitude: normalizeLongitude(lon),
  };
}

/**
 * Returns surface normal vector for a given lunar coordinate.
 */
export function getSurfaceNormal(lat: number, lon: number): THREE.Vector3 {
  const phi = (lat * Math.PI) / 180;
  const lambda = (lon * Math.PI) / 180;

  return new THREE.Vector3(
    Math.cos(phi) * Math.sin(lambda),
    Math.sin(phi),
    Math.cos(phi) * Math.cos(lambda)
  ).normalize();
}
