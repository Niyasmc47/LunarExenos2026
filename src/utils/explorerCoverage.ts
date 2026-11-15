// Footprints from authentic NASA LOLA Product 78 rasters.
const RADIUS = 1737400;

export interface ImportedSiteInfo {
  id: string;
  name: string;
  shortName: string;
  left: number;
  right: number;
  bottom: number;
  top: number;
}

export const IMPORTED_SITES: ImportedSiteInfo[] = [
  {
    id: 'site01',
    name: 'Site 01 (Connecting Ridge)',
    shortName: 'Site 01',
    left: -19000,
    right: -3000,
    bottom: -20000,
    top: -4000,
  },
  {
    id: 'site04',
    name: 'Site 04 (Shackleton Rim)',
    shortName: 'Site 04',
    left: -9000,
    right: 7000,
    bottom: -15000,
    top: 1000,
  },
  {
    id: 'site11',
    name: 'Site 11 (de Gerlache Rim)',
    shortName: 'Site 11',
    left: -45000,
    right: -29000,
    bottom: 7000,
    top: 23000,
  },
];

export const SITE01_BOUNDS = IMPORTED_SITES[0];

export function findCoveringSite(latitude: number, longitude: number): ImportedSiteInfo | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude >= 90) {
    return null;
  }
  const rho = 2 * RADIUS * Math.tan(((90 + latitude) * Math.PI) / 360);
  const x = rho * Math.sin((longitude * Math.PI) / 180);
  const y = rho * Math.cos((longitude * Math.PI) / 180);

  for (const s of IMPORTED_SITES) {
    if (x >= s.left && x <= s.right && y >= s.bottom && y <= s.top) {
      return s;
    }
  }
  return null;
}

export function insideSite01(latitude: number, longitude: number): boolean {
  return findCoveringSite(latitude, longitude) !== null;
}

function calculateFootprintRing(bounds: { left: number; right: number; bottom: number; top: number }): number[][] {
  const { left, right, bottom, top } = bounds;
  const corners = [
    [left, bottom],
    [right, bottom],
    [right, top],
    [left, top],
    [left, bottom],
  ];
  const ring: number[][] = [];
  for (let edge = 0; edge < 4; edge++) {
    for (let step = 0; step < 24; step++) {
      const t = step / 24;
      const x = corners[edge][0] * (1 - t) + corners[edge + 1][0] * t;
      const y = corners[edge][1] * (1 - t) + corners[edge + 1][1] * t;
      ring.push([
        (Math.atan2(x, y) * 180) / Math.PI,
        -90 + (2 * Math.atan2(Math.hypot(x, y), 2 * RADIUS) * 180) / Math.PI,
      ]);
    }
  }
  return [...ring, ring[0]];
}

export function site01Footprint(): number[][] {
  return calculateFootprintRing(SITE01_BOUNDS);
}

export function allSiteFootprints(): { id: string; name: string; coordinates: number[][] }[] {
  return IMPORTED_SITES.map((s) => ({
    id: s.id,
    name: s.name,
    coordinates: calculateFootprintRing(s),
  }));
}
