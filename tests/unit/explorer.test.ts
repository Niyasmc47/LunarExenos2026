import test from 'node:test';
import assert from 'node:assert/strict';
import { LUNAR_PRESETS, validateCoordinates, normalizeLongitude, lunarHaversineDistance, MOON_RADIUS_KM } from '../../src/utils/lunarCoordinates';
import { insideSite01, site01Footprint } from '../../src/utils/explorerCoverage';
import { lunarToSpherePosition, spherePositionToLunar } from '../../src/utils/sphereCoordinates';
import { useLocationStore } from '../../src/stores/locationStore';

test('coordinate contract rejects non-finite and out-of-range values', () => {
  for (const pair of [[NaN, 0], [Infinity, 0], [0, -Infinity], [91, 0], [-91, 0], [0, 181], [0, -181]]) assert.equal(validateCoordinates(...pair as [number, number]).valid, false);
  for (const pair of [[-90, -180], [90, 180], [0, 0]]) assert.equal(validateCoordinates(...pair as [number, number]).valid, true);
});
test('actual globe conversions preserve poles, seams, and named places', () => {
  for (const { latitude, longitude } of [...LUNAR_PRESETS, { latitude: -90, longitude: 0 }, { latitude: 90, longitude: 0 }, { latitude: 0, longitude: 180 }, { latitude: 0, longitude: -180 }]) {
    const result = spherePositionToLunar(lunarToSpherePosition(latitude, longitude));
    assert.ok(Math.abs(result.latitude - latitude) < 1e-7);
    if (Math.abs(latitude) < 90) assert.ok(Math.abs(normalizeLongitude(result.longitude - longitude)) < 1e-7);
  }
});
test('great-circle distances remain finite at antipodes and symmetric', () => {
  const a = { latitude: 45, longitude: 25 }, b = { latitude: -45, longitude: -155 };
  assert.ok(Math.abs(lunarHaversineDistance(a, b) - Math.PI * MOON_RADIUS_KM) < 1e-4);
  assert.equal(lunarHaversineDistance(a, b), lunarHaversineDistance(b, a));
  assert.equal(lunarHaversineDistance(a, a), 0);
});
test('coverage uses the polar raster footprint rather than geographic bounding rectangle', () => {
  assert.equal(insideSite01(-89.4632, -137.4896), true);
  assert.equal(insideSite01(-89.4632, 222.5104), true);
  assert.equal(insideSite01(0.67416, 23.47314), false);
  assert.equal(insideSite01(-90, 0), false);
  assert.equal(insideSite01(-89.8, -170), false);
  assert.equal(insideSite01(NaN, 0), false);
  const ring = site01Footprint();
  assert.equal(ring.length, 97); assert.deepEqual(ring[0], ring.at(-1));
  assert.ok(ring.every(p => p.every(Number.isFinite)));
});
test('catalogue has unique sourced, categorized valid locations', () => {
  assert.equal(new Set(LUNAR_PRESETS.map(p => p.id)).size, LUNAR_PRESETS.length);
  for (const place of LUNAR_PRESETS) {
    assert.equal(validateCoordinates(place.latitude, place.longitude).valid, true);
    assert.equal(new URL(place.sourceUrl).protocol, 'https:');
    assert.ok(place.kind && place.coordinateNote && place.reviewedOn);
  }
  assert.deepEqual(LUNAR_PRESETS.filter(p => p.category === 'apollo').map(p => [p.latitude, p.longitude]), [[0.67416, 23.47314], [-3.0128, -23.4219], [20.1911, 30.7723]]);
});
test('shared selection ignores invalid input, clears stale telemetry, survives view switches and resets', () => {
  useLocationStore.getState().resetToDefault();
  const initial = useLocationStore.getState().selectedLatitude;
  useLocationStore.getState().setSelectedCoordinates(NaN, 10, 'manual');
  assert.equal(useLocationStore.getState().selectedLatitude, initial);
  useLocationStore.setState({ currentElevationData: { in_bounds: true } as never });
  useLocationStore.getState().setSelectedCoordinates(-30, 210, 'globe');
  assert.equal(useLocationStore.getState().selectedLongitude, -150);
  assert.equal(useLocationStore.getState().currentElevationData, null);
  for (const mode of ['2d', '3d', 'split'] as const) {
    useLocationStore.getState().setActiveView(mode);
    assert.equal(useLocationStore.getState().selectedLatitude, -30);
  }
  useLocationStore.getState().resetToDefault();
  assert.equal(useLocationStore.getState().selectedLatitude, LUNAR_PRESETS[1].latitude);
  assert.equal(useLocationStore.getState().selectedLongitude, LUNAR_PRESETS[1].longitude);
});
