import https from 'https';

console.log('=== LUNAVISTA MVP 1 VERIFICATION SUITE ===\n');

// 1. Lunar Coordinate math
function clampLatitude(lat) {
  return Math.max(-90, Math.min(90, lat));
}

function normalizeLongitude(lon) {
  let normalized = (((lon + 180) % 360) + 360) % 360 - 180;
  if (normalized === -180 && lon > 0) {
    normalized = 180;
  }
  return normalized;
}

function lunarToSpherePosition(lat, lon, r = 2.0) {
  const phi = (clampLatitude(lat) * Math.PI) / 180;
  const lambda = (normalizeLongitude(lon) * Math.PI) / 180;
  return {
    x: r * Math.cos(phi) * Math.sin(lambda),
    y: r * Math.sin(phi),
    z: r * Math.cos(phi) * Math.cos(lambda),
  };
}

function spherePositionToLunar(p) {
  const r = Math.hypot(p.x, p.y, p.z);
  const clampedY = Math.max(-1, Math.min(1, p.y / r));
  const lat = (Math.asin(clampedY) * 180) / Math.PI;
  const lon = (Math.atan2(p.x, p.z) * 180) / Math.PI;
  return {
    latitude: clampLatitude(lat),
    longitude: normalizeLongitude(lon),
  };
}

// Haversine distance
const MOON_RADIUS_KM = 1737.4;
function lunarHaversineDistance(c1, c2) {
  const toRad = Math.PI / 180;
  const dLat = (c2.latitude - c1.latitude) * toRad;
  const dLon = (c2.longitude - c1.longitude) * toRad;
  const lat1 = c1.latitude * toRad;
  const lat2 = c2.latitude * toRad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return MOON_RADIUS_KM * c;
}

console.log('--- TEST 1: Coordinate Transformations & Inverses ---');
const testCases = [
  { name: 'Equator / Prime Meridian (Sinus Medii)', lat: 0, lon: 0 },
  { name: 'North Pole', lat: 90, lon: 0 },
  { name: 'South Pole', lat: -90, lon: 0 },
  { name: 'East Limb (Oceanus Procellarum seam)', lat: 0, lon: 90 },
  { name: 'West Limb', lat: 0, lon: -90 },
  { name: 'Dateline / Far Side Center', lat: 0, lon: 180 },
  { name: 'Dateline Negative', lat: 0, lon: -180 },
  { name: 'Apollo 11 Landing Site', lat: 0.6741, lon: 23.473 },
  { name: 'Apollo 12 Landing Site', lat: -3.0124, lon: -23.4216 },
  { name: "Chang'e 4 (Far side Von Kármán)", lat: -45.457, lon: 177.589 },
  { name: 'Shackleton Crater (South Pole Artemis target)', lat: -89.67, lon: 0.0 },
];

let failedTests = 0;
for (const tc of testCases) {
  const p = lunarToSpherePosition(tc.lat, tc.lon, 2.0);
  const back = spherePositionToLunar(p);
  const dLat = Math.abs(back.latitude - tc.lat);
  const dLon = Math.abs(back.longitude - normalizeLongitude(tc.lon));

  const passed = dLat < 1e-4 && (dLon < 1e-4 || Math.abs(tc.lat) >= 89.99); // at poles, lon is degenerate
  if (!passed) {
    console.error(`FAIL: ${tc.name} -> expected (${tc.lat}, ${tc.lon}), got (${back.latitude}, ${back.longitude})`);
    failedTests++;
  } else {
    console.log(`PASS: ${tc.name.padEnd(45)} -> 3D: (${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)}) -> Recovers: (${back.latitude.toFixed(4)}, ${back.longitude.toFixed(4)})`);
  }
}

console.log('\n--- TEST 2: Longitude Wrapping & Normalization ---');
const wrapTests = [
  { input: 185, expected: -175 },
  { input: -185, expected: 175 },
  { input: 360, expected: 0 },
  { input: 540, expected: 180 },
  { input: -540, expected: -180 },
  { input: 720, expected: 0 },
  { input: 180, expected: 180 },
  { input: -180, expected: -180 },
];

for (const wt of wrapTests) {
  const res = normalizeLongitude(wt.input);
  const passed = Math.abs(res - wt.expected) < 1e-5;
  if (!passed) {
    console.error(`FAIL: Wrap ${wt.input} -> expected ${wt.expected}, got ${res}`);
    failedTests++;
  } else {
    console.log(`PASS: Wrap ${wt.input}° -> ${res}° (Expected: ${wt.expected}°)`);
  }
}

console.log('\n--- TEST 3: Great-Circle Haversine Distances ---');
const distNorthToSouth = lunarHaversineDistance({ latitude: 90, longitude: 0 }, { latitude: -90, longitude: 0 });
const expectedPoleToPole = Math.PI * MOON_RADIUS_KM; // ~5458.2 km
console.log(`Pole to Pole distance: ${distNorthToSouth.toFixed(2)} km (Theoretical: ${expectedPoleToPole.toFixed(2)} km)`);
if (Math.abs(distNorthToSouth - expectedPoleToPole) > 0.1) {
  console.error('FAIL: Pole to Pole distance does not match theoretical half-circumference');
  failedTests++;
} else {
  console.log('PASS: Distance calculation accurate within < 0.1 km.');
}

console.log('\n--- TEST 4: Live NASA Moon Trek WMTS Endpoints & CORS ---');
function fetchHead(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      resolve({
        statusCode: res.statusCode,
        headers: res.headers,
      });
      res.resume();
    }).on('error', reject);
  });
}

async function verifyLiveServices() {
  const capUrl = 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/WMTSCapabilities.xml';
  const tileZ0 = 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/0/0/0.jpg';
  const tileZ1 = 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/1/1/2.jpg';
  const tileSouthPole = 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/2/3/3.jpg';

  try {
    const capRes = await fetchHead(capUrl);
    console.log(`WMTS Capabilities: HTTP ${capRes.statusCode}, CORS Allow-Origin: ${capRes.headers['access-control-allow-origin'] || 'none'}`);
    if (capRes.statusCode !== 200) failedTests++;

    const t0Res = await fetchHead(tileZ0);
    console.log(`Tile Zoom 0 (global): HTTP ${t0Res.statusCode}, Content-Type: ${t0Res.headers['content-type']}, Content-Length: ${t0Res.headers['content-length']}`);
    if (t0Res.statusCode !== 200) failedTests++;

    const t1Res = await fetchHead(tileZ1);
    console.log(`Tile Zoom 1 (sub-earth): HTTP ${t1Res.statusCode}, Content-Type: ${t1Res.headers['content-type']}`);
    if (t1Res.statusCode !== 200) failedTests++;

    const tspRes = await fetchHead(tileSouthPole);
    console.log(`Tile Zoom 2 (south region): HTTP ${tspRes.statusCode}, Content-Type: ${tspRes.headers['content-type']}`);
    if (tspRes.statusCode !== 200) failedTests++;
  } catch (e) {
    console.error('Network check error:', e.message);
    failedTests++;
  }

  console.log(`\n=== VERIFICATION FINISHED: ${failedTests === 0 ? 'ALL CHECKS PASSED (0 FAILURES)' : failedTests + ' FAILURES'} ===`);
  process.exit(failedTests === 0 ? 0 : 1);
}

verifyLiveServices();
