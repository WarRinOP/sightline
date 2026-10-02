import { type Location } from "@sightline/contracts";
import {
  AXIAL_TILT_RAD,
  EARTH_LIBRATION_LAT_AMPLITUDE_RAD,
  EARTH_LIBRATION_PERIOD_S,
  SUBSOLAR_LATITUDE_PERIOD_S,
  SUN_ANGULAR_RADIUS_RAD,
  SYNODIC_PERIOD_S,
} from "./constants";

export interface AzEl {
  azimuth_rad: number;
  elevation_rad: number;
}

const TWO_PI = 2 * Math.PI;

/**
 * Azimuth (clockwise from north, [0, 2π)) and elevation of a distant body whose sub-point on the
 * Moon is (lat, lon). Spherical trigonometry with the body at infinity.
 */
export function azElFromSubpoint(
  observer: Location,
  subpoint_lat_rad: number,
  subpoint_lon_rad: number,
): AzEl {
  const dLon = subpoint_lon_rad - observer.lon_rad;
  const sinEl =
    Math.sin(observer.lat_rad) * Math.sin(subpoint_lat_rad) +
    Math.cos(observer.lat_rad) * Math.cos(subpoint_lat_rad) * Math.cos(dLon);
  const az = Math.atan2(
    Math.cos(subpoint_lat_rad) * Math.sin(dLon),
    Math.cos(observer.lat_rad) * Math.sin(subpoint_lat_rad) -
      Math.sin(observer.lat_rad) * Math.cos(subpoint_lat_rad) * Math.cos(dLon),
  );
  return {
    azimuth_rad: ((az % TWO_PI) + TWO_PI) % TWO_PI,
    elevation_rad: Math.asin(Math.max(-1, Math.min(1, sinEl))),
  };
}

/** Circular-orbit Sun: the sub-solar point sweeps west once per synodic month and wobbles by the axial tilt. */
export function mockSun(epoch_et: number, observer: Location): AzEl {
  const lat_rad = AXIAL_TILT_RAD * Math.sin((TWO_PI * epoch_et) / SUBSOLAR_LATITUDE_PERIOD_S);
  const lon_rad = (-TWO_PI * epoch_et) / SYNODIC_PERIOD_S;
  return azElFromSubpoint(observer, lat_rad, lon_rad);
}

/** Circular-orbit Earth: fixed longitude, sub-Earth latitude librating by ±6.7°. */
export function mockEarth(epoch_et: number, observer: Location): AzEl {
  const lat_rad =
    EARTH_LIBRATION_LAT_AMPLITUDE_RAD * Math.sin((TWO_PI * epoch_et) / EARTH_LIBRATION_PERIOD_S);
  return azElFromSubpoint(observer, lat_rad, 0);
}

/**
 * Fraction of a Sun disk of radius `SUN_ANGULAR_RADIUS_RAD` that is above a straight horizon.
 * Circular-segment area: with d = signed centre height / radius, f = 1/2 + (d√(1−d²) + asin d)/π.
 */
export function solarDiskFraction(sun_elevation_rad: number, horizon_rad: number): number {
  const d = Math.max(-1, Math.min(1, (sun_elevation_rad - horizon_rad) / SUN_ANGULAR_RADIUS_RAD));
  return 0.5 + (d * Math.sqrt(1 - d * d) + Math.asin(d)) / Math.PI;
}
