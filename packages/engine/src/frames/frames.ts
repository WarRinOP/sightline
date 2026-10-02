import { MOON_REFERENCE_RADIUS_M } from "@sightline/contracts";

export type Vec3 = readonly [number, number, number];

export const MOON_REFERENCE_RADIUS_KM = MOON_REFERENCE_RADIUS_M / 1000;

export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];

export interface EnuBasis {
  up: Vec3;
  east: Vec3;
  north: Vec3;
}

/**
 * Local up, east and north in MOON_ME (x toward 0° N 0° E, z the mean pole, y east) for a point on
 * the reference sphere. East-positive longitude, planetocentric latitude.
 *
 * Pole convention: the formulas stay finite at φ = ±90° and use the longitude given, so at the
 * exact pole "north" is the horizontal direction along that meridian (grid north). The azimuth
 * there depends on the longitude you pass; nothing else is special-cased.
 */
export function enuBasis(lat_rad: number, lon_rad: number): EnuBasis {
  const sl = Math.sin(lat_rad);
  const cl = Math.cos(lat_rad);
  const so = Math.sin(lon_rad);
  const co = Math.cos(lon_rad);
  return {
    up: [cl * co, cl * so, sl],
    east: [-so, co, 0],
    north: [-sl * co, -sl * so, cl],
  };
}

/** Position in km from the Moon's centre, in MOON_ME, of a point `height_m` above the sphere. */
export function moonFixedPosition_km(lat_rad: number, lon_rad: number, height_m: number): Vec3 {
  const { up } = enuBasis(lat_rad, lon_rad);
  return scale(up, MOON_REFERENCE_RADIUS_KM + height_m / 1000);
}

/** Inverse of `moonFixedPosition_km`: latitude, longitude (east, (-π, π]) and height above the sphere. */
export function geodeticFromMoonFixed(p_km: Vec3): {
  lat_rad: number;
  lon_rad: number;
  height_m: number;
} {
  const r = norm(p_km);
  return {
    lat_rad: Math.asin(p_km[2] / r),
    lon_rad: Math.atan2(p_km[1], p_km[0]),
    height_m: (r - MOON_REFERENCE_RADIUS_KM) * 1000,
  };
}

/**
 * Azimuth (clockwise from local north, [0, 2π)) and elevation (above the local tangent plane)
 * of a vector given in MOON_ME, seen from a point at (lat, lon).
 */
export function azElFromVector(
  v: Vec3,
  lat_rad: number,
  lon_rad: number,
): { azimuth_rad: number; elevation_rad: number } {
  const { up, east, north } = enuBasis(lat_rad, lon_rad);
  const twoPi = 2 * Math.PI;
  const az = Math.atan2(dot(v, east), dot(v, north));
  return {
    azimuth_rad: ((az % twoPi) + twoPi) % twoPi,
    elevation_rad: Math.asin(Math.max(-1, Math.min(1, dot(v, up) / norm(v)))),
  };
}
