import { MOON_REFERENCE_RADIUS_M } from "@sightline/contracts";
import * as THREE from "three";

/**
 * Converts a lunar Location to a 3D scene position (Vector3 array) in Moon-fixed coordinates.
 * X = R * cos(lat) * cos(lon)
 * Y = R * sin(lat)
 * Z = -R * cos(lat) * sin(lon)  // Note: ThreeJS usually uses Y-up, right-handed.
 * We follow standard spherical to cartesian conversion.
 *
 * @param lat_rad Latitude in radians
 * @param lon_rad Longitude in radians (east positive)
 * @param elev_m Elevation above reference sphere in meters
 * @returns [x, y, z] position
 */
export function locationToScenePosition(
  lat_rad: number,
  lon_rad: number,
  elev_m: number = 0,
): [number, number, number] {
  const R = MOON_REFERENCE_RADIUS_M;
  // Polar-stereographic projection
  const rho = 2 * R * Math.tan((Math.PI / 2 + lat_rad) / 2);
  const x = rho * Math.sin(lon_rad);
  const y = rho * Math.cos(lon_rad);

  // Scene position is (x, height, -y) matching terrain mesh
  return [x, elev_m, -y];
}

export function getLocalDirectionInScene(
  lat_rad: number,
  lon_rad: number,
  az_rad: number,
  el_rad: number,
): THREE.Vector3 {
  // In the polar stereographic projection (South Pole at origin, XZ plane):
  // South pole is at x=0, z=0.
  // North (increasing latitude) points radially outward.
  // x = rho * sin(lon), z = -rho * cos(lon)
  // So North direction is (sin(lon), 0, -cos(lon))
  const north = new THREE.Vector3(Math.sin(lon_rad), 0, -Math.cos(lon_rad)).normalize();

  // East (increasing longitude) is 90 degrees clockwise from North?
  // Wait, E x N = U.
  // At lon=0, N=(0,0,-1). E=(1,0,0). (1,0,0) x (0,0,-1) = (0,1,0) = U.
  // E = (cos(lon), 0, sin(lon))
  const east = new THREE.Vector3(Math.cos(lon_rad), 0, Math.sin(lon_rad)).normalize();

  // Up is +Y
  const up = new THREE.Vector3(0, 1, 0);

  // Azimuth is clockwise from North
  const dEast = Math.sin(az_rad) * Math.cos(el_rad);
  const dNorth = Math.cos(az_rad) * Math.cos(el_rad);
  const dUp = Math.sin(el_rad);

  const dir = new THREE.Vector3();
  dir.addScaledVector(east, dEast);
  dir.addScaledVector(north, dNorth);
  dir.addScaledVector(up, dUp);

  return dir.normalize();
}

/**
 * Points of the horizon ring around a site, in scene coordinates relative to the site: one per mask
 * entry (index i is azimuth i * step_rad clockwise from north), at `radius_m`, raised by the mask's
 * elevation. Uses the same east/north/up as the Sun and Earth, so the ring and the Sun agree.
 */
export function horizonRingPoints(
  mask_elevation_rad: readonly number[],
  azimuth_step_rad: number,
  lat_rad: number,
  lon_rad: number,
  radius_m: number,
): THREE.Vector3[] {
  const n = mask_elevation_rad.length;
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const idx = i % n;
    const dir = getLocalDirectionInScene(
      lat_rad,
      lon_rad,
      idx * azimuth_step_rad,
      mask_elevation_rad[idx] ?? 0,
    );
    points.push(dir.multiplyScalar(radius_m));
  }
  return points;
}
