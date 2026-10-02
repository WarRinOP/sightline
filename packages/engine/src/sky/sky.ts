import type { Location, SunEarthState } from "@sightline/contracts";
import type { Ephemeris } from "../ephemeris";
import {
  MOON_REFERENCE_RADIUS_KM,
  add,
  azElFromVector,
  dot,
  moonFixedPosition_km,
  norm,
  scale,
  sub,
} from "../frames";

export interface SkyOptions {
  mast_height_m: number;
  /** Earth must clear the horizon by this much to count as visible. Default 0. */
  min_earth_elev_rad?: number;
  /** A DSN complex must see the site at least this high above its own horizon. Default 0. */
  dsn_min_elev_rad?: number;
}

export interface SkyDetails {
  state: SunEarthState;
  /** Elevation of the site above each DSN complex's horizon, keyed `goldstone`, `canberra`, `madrid`. */
  dsn_elevation_rad: Record<string, number>;
  horizon_dip_rad: number;
  sun_angular_radius_rad: number;
}

/**
 * Fraction of a circular Sun disk above a straight horizon (circular-segment area). `d` is the
 * signed height of the disk centre over the horizon in disk radii: f = 1/2 + (d√(1−d²) + asin d)/π.
 */
export function diskFraction(
  sun_elevation_rad: number,
  horizon_rad: number,
  sun_radius_rad: number,
): number {
  const d = Math.max(-1, Math.min(1, (sun_elevation_rad - horizon_rad) / sun_radius_rad));
  return 0.5 + (d * Math.sqrt(1 - d * d) + Math.asin(d)) / Math.PI;
}

/**
 * Sun and Earth as seen from a site at `epoch_et`, from the ephemeris and nothing else.
 *
 * - Site vector: lat, lon and height (ground plus mast) on the 1737.4 km sphere, MOON_ME.
 * - Directions: apparent (LT+S) Moon-centre states minus the site vector, so topocentric
 *   parallax is included for both bodies (about 0.26° for Earth at the pole).
 * - Horizon: terrain is NOT modelled. The horizon is flat ground at the site's own height, so it
 *   dips below the tangent plane by acos(R/(R+mast)) from the top of the mast.
 * - DSN: a complex sees the site when the site is above that complex's horizon, taking the
 *   station's vertical as its geocentric direction (up to 0.19° from the geodetic vertical).
 */
export function computeSky(
  eph: Ephemeris,
  epoch_et: number,
  location: Location,
  options: SkyOptions,
): SkyDetails {
  const { lat_rad, lon_rad } = location;
  const ground_m = location.elev_m ?? 0;
  const mast_m = options.mast_height_m;
  const site = moonFixedPosition_km(lat_rad, lon_rad, ground_m + mast_m);
  const { sun, earth, stations } = eph.at(epoch_et);

  const toSun = sub(sun, site);
  const toEarth = sub(earth, site);
  const sunDir = azElFromVector(toSun, lat_rad, lon_rad);
  const earthDir = azElFromVector(toEarth, lat_rad, lon_rad);

  const groundRadius_km = MOON_REFERENCE_RADIUS_KM + ground_m / 1000;
  const dip = mast_m > 0 ? Math.acos(groundRadius_km / (groundRadius_km + mast_m / 1000)) : 0;
  const sunRadius = Math.asin(eph.meta.sun_radius_km / norm(toSun));

  const dsn_elevation_rad: Record<string, number> = {};
  stations.forEach((rel, k) => {
    const body = eph.meta.header.bodies[k + 2] ?? `STATION_${k}`;
    const station = add(earth, rel);
    const v = sub(site, station);
    const vertical = scale(rel, 1 / norm(rel));
    dsn_elevation_rad[body.replace(/^DSN_/, "").toLowerCase()] = Math.asin(
      dot(v, vertical) / norm(v),
    );
  });

  const earth_visible = earthDir.elevation_rad > -dip + (options.min_earth_elev_rad ?? 0);
  const dsnMin = options.dsn_min_elev_rad ?? 0;
  const dsn_visible =
    earth_visible && Object.values(dsn_elevation_rad).some((elevation) => elevation >= dsnMin);

  return {
    state: {
      epoch_et,
      sun_azimuth_rad: sunDir.azimuth_rad,
      sun_elevation_rad: sunDir.elevation_rad,
      sun_disk_fraction: diskFraction(sunDir.elevation_rad, -dip, sunRadius),
      earth_azimuth_rad: earthDir.azimuth_rad,
      earth_elevation_rad: earthDir.elevation_rad,
      earth_visible,
      dsn_visible,
      // Real if and only if the ephemeris says so (a synthetic test file says it is not).
      simulated: eph.meta.header.simulated,
    },
    dsn_elevation_rad,
    horizon_dip_rad: dip,
    sun_angular_radius_rad: sunRadius,
  };
}
