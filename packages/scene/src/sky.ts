import * as THREE from "three";
import type { Site, SunEarthState } from "@sightline/contracts";
import { getLocalDirectionInScene, locationToScenePosition } from "./math";

/** Sun's angular radius at 1 AU (CLAUDE.md §9); the real Earth–Sun distance changes it by under 2 %. */
export const SUN_ANGULAR_RADIUS_RAD = 0.2666 * (Math.PI / 180);
/** Earth's angular radius from the Moon (≈ 1.9° diameter, CLAUDE.md §9). */
export const EARTH_ANGULAR_RADIUS_RAD = 0.95 * (Math.PI / 180);

/**
 * What the 3D view draws in the sky, written once per frame from the engine's answer for the
 * selected site and read by the sky, the terrain and the light. Mutable on purpose: per-frame values
 * never go through React state (CLAUDE.md §6).
 */
export interface SkyState {
  /** The engine has answered for the selected site; without it there is no Sun and no Earth. */
  hasSunEarth: boolean;
  /** Unit vectors in the scene frame (site east/north/up on the flat plane, D-031). */
  sunDirection: THREE.Vector3;
  earthDirection: THREE.Vector3;
  /** Drawn only when the engine says part of the body clears the terrain horizon at the site. */
  sunVisible: boolean;
  earthVisible: boolean;
  /** Share of the Earth's disk lit by the Sun, as seen from the site (drives the drawn phase only). */
  earthLitFraction: number;
  /** The selected site on the tile plane (m, x east, y map north): the curvature origin. */
  siteMap: THREE.Vector2;
  hasSite: boolean;
}

export function createSkyState(): SkyState {
  return {
    hasSunEarth: false,
    sunDirection: new THREE.Vector3(0, 1, 0),
    earthDirection: new THREE.Vector3(0, 1, 0),
    sunVisible: false,
    earthVisible: false,
    earthLitFraction: 0,
    siteMap: new THREE.Vector2(0, 0),
    hasSite: false,
  };
}

/**
 * The visibility rule: the sky follows the engine, not the drawn terrain. The Sun is drawn while any
 * part of its disk clears the terrain horizon (`sun_disk_fraction > 0`), the Earth while its centre
 * does (`earth_visible`). The picture is a flat plane, so its own far ridges cannot decide this.
 */
export function skyBodyVisibility(sunEarth: SunEarthState | null | undefined): {
  sun: boolean;
  earth: boolean;
} {
  if (!sunEarth) return { sun: false, earth: false };
  return { sun: sunEarth.sun_disk_fraction > 0, earth: sunEarth.earth_visible };
}

/**
 * Lit share of the Earth's disk seen from the Moon. The Sun is so far away that its rays at the
 * Earth are parallel to the site's Sun direction, so the phase angle at the Earth is 180° minus the
 * Sun–Earth elongation in the site's sky, and the lit share is (1 + cos phase) / 2 = (1 − cos e) / 2.
 * Ignores the ≈ 0.15° solar parallax over the Earth–Moon distance.
 */
export function earthLitFraction(
  sunDirection: THREE.Vector3,
  earthDirection: THREE.Vector3,
): number {
  const cosE = THREE.MathUtils.clamp(sunDirection.dot(earthDirection), -1, 1);
  return (1 - cosE) / 2;
}

/** Writes the sky for `site` from the engine's answer into `state`; no allocation per frame. */
export function updateSkyState(
  state: SkyState,
  sunEarth: SunEarthState | null | undefined,
  site: Site | undefined,
): void {
  state.hasSite = site !== undefined;
  if (site) {
    const [x, , z] = locationToScenePosition(
      (site.lat_deg * Math.PI) / 180,
      (site.lon_deg * Math.PI) / 180,
      site.elev_m,
    );
    state.siteMap.set(x, -z);
  }
  if (!sunEarth || !site) {
    state.hasSunEarth = false;
    state.sunVisible = false;
    state.earthVisible = false;
    return;
  }
  const lat_rad = (site.lat_deg * Math.PI) / 180;
  const lon_rad = (site.lon_deg * Math.PI) / 180;
  state.hasSunEarth = true;
  state.sunDirection.copy(
    getLocalDirectionInScene(
      lat_rad,
      lon_rad,
      sunEarth.sun_azimuth_rad,
      sunEarth.sun_elevation_rad,
    ),
  );
  state.earthDirection.copy(
    getLocalDirectionInScene(
      lat_rad,
      lon_rad,
      sunEarth.earth_azimuth_rad,
      sunEarth.earth_elevation_rad,
    ),
  );
  const visible = skyBodyVisibility(sunEarth);
  state.sunVisible = visible.sun;
  state.earthVisible = visible.earth;
  state.earthLitFraction = earthLitFraction(state.sunDirection, state.earthDirection);
}
