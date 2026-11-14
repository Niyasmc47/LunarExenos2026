// Footprint from the local Site01 raster, not a guarantee of valid pixels or skyline coverage.
export const SITE01_BOUNDS = { left: -19000, right: -3000, bottom: -20000, top: -4000 };
const RADIUS = 1737400;

export function insideSite01(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude >= 90) return false;
  const rho = 2 * RADIUS * Math.tan((90 + latitude) * Math.PI / 360);
  const x = rho * Math.sin(longitude * Math.PI / 180);
  const y = rho * Math.cos(longitude * Math.PI / 180);
  return x >= SITE01_BOUNDS.left && x <= SITE01_BOUNDS.right && y >= SITE01_BOUNDS.bottom && y <= SITE01_BOUNDS.top;
}

export function site01Footprint(): number[][] {
  const { left, right, bottom, top } = SITE01_BOUNDS;
  const corners = [[left, bottom], [right, bottom], [right, top], [left, top], [left, bottom]];
  const ring: number[][] = [];
  for (let edge = 0; edge < 4; edge++) {
    for (let step = 0; step < 24; step++) {
      const t = step / 24;
      const x = corners[edge][0] * (1 - t) + corners[edge + 1][0] * t;
      const y = corners[edge][1] * (1 - t) + corners[edge + 1][1] * t;
      ring.push([Math.atan2(x, y) * 180 / Math.PI, -90 + 2 * Math.atan2(Math.hypot(x, y), 2 * RADIUS) * 180 / Math.PI]);
    }
  }
  return [...ring, ring[0]];
}
