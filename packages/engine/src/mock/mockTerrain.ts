import { MOON_REFERENCE_RADIUS_M, type Location } from "@sightline/contracts";

interface Crater {
  cx_m: number;
  cy_m: number;
  radius_m: number;
  depth_m: number;
}

// Two analytic bowls in a south-polar-stereographic plane (pole at the origin). Synthetic.
const CRATERS: readonly Crater[] = [
  { cx_m: 0, cy_m: 0, radius_m: 6000, depth_m: 2000 },
  { cx_m: -5000, cy_m: -9000, radius_m: 3500, depth_m: 900 },
];

const RIM_HEIGHT_FRACTION = 0.1;
const RIM_WIDTH_FRACTION = 0.2;

/** Height in meters above the reference sphere: a parabolic bowl with a smooth raised rim. */
export function mockHeightM(x_m: number, y_m: number): number {
  let h_m = 0;
  for (const c of CRATERS) {
    const r_m = Math.hypot(x_m - c.cx_m, y_m - c.cy_m);
    const bowl_m = r_m <= c.radius_m ? -c.depth_m * (1 - (r_m / c.radius_m) ** 2) : 0;
    const w_m = RIM_WIDTH_FRACTION * c.radius_m;
    const rim_m = RIM_HEIGHT_FRACTION * c.depth_m * Math.exp(-(((r_m - c.radius_m) / w_m) ** 2));
    h_m += bowl_m + rim_m;
  }
  return h_m;
}

/** Plane coordinates in meters, x = ρ sin λ and y = ρ cos λ, with ρ = 2R tan(π/4 + φ/2). */
export function projectSouthPolar(location: Location): { x_m: number; y_m: number } {
  const rho_m = 2 * MOON_REFERENCE_RADIUS_M * Math.tan(Math.PI / 4 + location.lat_rad / 2);
  return { x_m: rho_m * Math.sin(location.lon_rad), y_m: rho_m * Math.cos(location.lon_rad) };
}

/**
 * Horizon elevation seen from `location` along `azimuth_rad` (clockwise from north). North at a
 * south-polar site points away from the pole, east is the direction of increasing longitude.
 * Flat-plane ray-march with growing steps: good enough for a mock, no curvature.
 */
export function mockHorizonElevationRad(
  location: Location,
  observer_height_m: number,
  azimuth_rad: number,
): number {
  const { x_m, y_m } = projectSouthPolar(location);
  const lon = location.lon_rad;
  const north = { x: Math.sin(lon), y: Math.cos(lon) };
  const east = { x: Math.cos(lon), y: -Math.sin(lon) };
  const dx = Math.cos(azimuth_rad) * north.x + Math.sin(azimuth_rad) * east.x;
  const dy = Math.cos(azimuth_rad) * north.y + Math.sin(azimuth_rad) * east.y;
  const eye_m = mockHeightM(x_m, y_m) + observer_height_m;

  let max_rad = -Math.PI / 2;
  for (let s_m = 25; s_m <= 20_000; s_m *= 1.02) {
    const rise_m = mockHeightM(x_m + dx * s_m, y_m + dy * s_m) - eye_m;
    max_rad = Math.max(max_rad, Math.atan2(rise_m, s_m));
  }
  return max_rad;
}
