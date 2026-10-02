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
  // Local Up in ME
  const upMeX = Math.cos(lat_rad) * Math.cos(lon_rad);
  const upMeY = Math.cos(lat_rad) * Math.sin(lon_rad);
  const upMeZ = Math.sin(lat_rad);

  // Local North in ME
  const northMeX = -Math.sin(lat_rad) * Math.cos(lon_rad);
  const northMeY = -Math.sin(lat_rad) * Math.sin(lon_rad);
  const northMeZ = Math.cos(lat_rad);

  // Local East in ME
  const eastMeX = -Math.sin(lon_rad);
  const eastMeY = Math.cos(lon_rad);
  const eastMeZ = 0;

  // Convert to Scene coordinates
  // Scene X = ME Y
  // Scene Y = ME -Z
  // Scene Z = ME -X
  const up = new THREE.Vector3(upMeY, -upMeZ, -upMeX);
  const north = new THREE.Vector3(northMeY, -northMeZ, -northMeX);
  const east = new THREE.Vector3(eastMeY, -eastMeZ, -eastMeX);

  // Azimuth is clockwise from North in ENU
  const dEast = Math.sin(az_rad) * Math.cos(el_rad);
  const dNorth = Math.cos(az_rad) * Math.cos(el_rad);
  const dUp = Math.sin(el_rad);

  const dir = new THREE.Vector3();
  dir.addScaledVector(east, dEast);
  dir.addScaledVector(north, dNorth);
  dir.addScaledVector(up, dUp);

  return dir.normalize();
}
