import { MOON_REFERENCE_RADIUS_M } from "@sightline/contracts";

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
  elev_m: number = 0
): [number, number, number] {
  const r = MOON_REFERENCE_RADIUS_M + elev_m;
  const x = r * Math.cos(lat_rad) * Math.cos(lon_rad);
  // Z in ThreeJS is typically "forward/backward", so let's match an ENU or ME frame.
  // Standard Moon ME frame has Z as polar axis (lat=90), X as lon=0 lat=0, Y as lon=90 lat=0.
  // ThreeJS default camera looks down -Z, Y is up.
  // If we map Z(ME) -> Y(Three), X(ME) -> X(Three), Y(ME) -> -Z(Three):
  const y = r * Math.sin(lat_rad); // Polar axis
  const z = -r * Math.cos(lat_rad) * Math.sin(lon_rad);
  
  return [x, y, z];
}
