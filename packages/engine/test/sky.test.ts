import { describe, expect, it } from "vitest";
import { SUN_ANGULAR_RADIUS_RAD_FOR_TESTS } from "./constants";
import { computeSky, diskFraction, enuBasis, type Vec3 } from "../src";
import { syntheticEphemeris } from "./helpers";

const DEG = Math.PI / 180;
const R_MOON = 1737.4;
const EARTH_DIST = 384_400;
const SUN_DIST = 1.496e8;

/** A point `dist` km from `from` in the given az/el seen at (lat, lon). */
function along(from: Vec3, lat: number, lon: number, az: number, el: number, dist: number): Vec3 {
  const { up, east, north } = enuBasis(lat, lon);
  const h = Math.cos(el);
  return [0, 1, 2].map(
    (i) =>
      from[i]! +
      dist * (h * (Math.cos(az) * north[i]! + Math.sin(az) * east[i]!) + Math.sin(el) * up[i]!),
  ) as unknown as Vec3;
}

describe("diskFraction", () => {
  const r = SUN_ANGULAR_RADIUS_RAD_FOR_TESTS;

  it("is 1/2 with the centre on the horizon, 1 with the whole disk above, 0 below", () => {
    expect(diskFraction(0.1, 0.1, r)).toBeCloseTo(0.5, 12);
    expect(diskFraction(0.1 + r, 0.1, r)).toBeCloseTo(1, 12);
    expect(diskFraction(0.1 - r, 0.1, r)).toBeCloseTo(0, 12);
    expect(diskFraction(1, 0, r)).toBe(1);
    expect(diskFraction(-1, 0, r)).toBe(0);
  });

  it("matches the circular-segment area and is symmetric about the half-lit point", () => {
    // Centre half a radius above the line: 1/2 + (0.5·√0.75 + asin 0.5)/π.
    expect(diskFraction(r / 2, 0, r)).toBeCloseTo(
      0.5 + (0.5 * Math.sqrt(0.75) + Math.PI / 6) / Math.PI,
      12,
    );
    expect(diskFraction(0.3 * r, 0, r) + diskFraction(-0.3 * r, 0, r)).toBeCloseTo(1, 12);
  });
});

describe("computeSky geometry", () => {
  // Observer at 0° N, 90° E (up = +y). Sun far away along +x: on the horizon, shifted down by parallax.
  const site = { lat_rad: 0, lon_rad: Math.PI / 2 };

  it("sees a body at infinity straight up when it is overhead", () => {
    const eph = syntheticEphemeris([SUN_DIST, 0, 0], [0, EARTH_DIST, 0], [0, EARTH_DIST - 6371, 0]);
    const s = computeSky(eph, 100, site, { mast_height_m: 0 }).state;
    expect(s.earth_elevation_rad).toBeGreaterThan(Math.PI / 2 - 1e-3);
  });

  it("includes topocentric parallax: a Sun on the Moon-centre horizon sits 1737.4 km / distance below it", () => {
    const eph = syntheticEphemeris([SUN_DIST, 0, 0], [0, EARTH_DIST, 0], [0, EARTH_DIST - 6371, 0]);
    const s = computeSky(eph, 100, site, { mast_height_m: 0 }).state;
    // Site at (0, 1737.4, 0): v = (SUN_DIST, -1737.4, 0), so el = -asin(1737.4 / |v|).
    expect(s.sun_elevation_rad).toBeCloseTo(-Math.asin(R_MOON / Math.hypot(SUN_DIST, R_MOON)), 12);
    // That is below the horizon by more than the Sun's radius? No: 1.2e-5 rad against 4.65e-3 rad.
    expect(s.sun_disk_fraction).toBeGreaterThan(0.49);
    expect(s.sun_disk_fraction).toBeLessThan(0.5);
  });

  it("raises the site by its ground height: a 2 km rim shifts Earth's direction by ~2000/384400 rad", () => {
    const eph = syntheticEphemeris([SUN_DIST, 0, 0], [EARTH_DIST, 0, 0], [EARTH_DIST - 6371, 0, 0]);
    // Site at lon 0 (up = +x): Earth overhead, so use a site 90° away where the shift is vertical.
    const flat = computeSky(eph, 0, site, { mast_height_m: 0 }).state;
    const rim = computeSky(eph, 0, { ...site, elev_m: 2000 }, { mast_height_m: 0 }).state;
    // Earth is along +x, the site's up is +y: raising the site along +y shifts elevation by -2/384400.
    expect(flat.earth_elevation_rad - rim.earth_elevation_rad).toBeCloseTo(2 / EARTH_DIST, 9);
  });
});

describe("computeSky horizon and visibility", () => {
  const lat = -1.4;
  const lon = 0.6;
  const site = { lat_rad: lat, lon_rad: lon };
  const ground: Vec3 = (() => {
    const { up } = enuBasis(lat, lon);
    return [up[0] * R_MOON, up[1] * R_MOON, up[2] * R_MOON];
  })();

  function withEarthAt(el: number, station: Vec3 = [-6371, 0, 0]) {
    const earth = along(ground, lat, lon, 1, el, EARTH_DIST);
    return syntheticEphemeris(along(ground, lat, lon, 4, 0.01, SUN_DIST), earth, station);
  }

  it("dips the horizon from the top of the mast: 2 m is about 0.0869°, 0 m is none", () => {
    const eph = withEarthAt(0);
    expect(computeSky(eph, 0, site, { mast_height_m: 0 }).horizon_dip_rad).toBe(0);
    expect(computeSky(eph, 0, site, { mast_height_m: 2 }).horizon_dip_rad / DEG).toBeCloseTo(
      0.0869,
      3,
    );
  });

  it("lets a mast see Earth just below the tangent plane that flat ground would hide", () => {
    const eph = withEarthAt(-0.05 * DEG);
    expect(computeSky(eph, 0, site, { mast_height_m: 0 }).state.earth_visible).toBe(false);
    expect(computeSky(eph, 0, site, { mast_height_m: 2 }).state.earth_visible).toBe(true);
  });

  it("honours the minimum Earth elevation", () => {
    const eph = withEarthAt(3 * DEG);
    expect(
      computeSky(eph, 0, site, { mast_height_m: 0, min_earth_elev_rad: 2 * DEG }).state
        .earth_visible,
    ).toBe(true);
    expect(
      computeSky(eph, 0, site, { mast_height_m: 0, min_earth_elev_rad: 4 * DEG }).state
        .earth_visible,
    ).toBe(false);
  });

  it("needs a DSN complex that sees the site, and never reports a link without Earth", () => {
    // Station on the Moon-facing side of Earth: its vertical points at the Moon.
    const earth = along(ground, lat, lon, 1, 30 * DEG, EARTH_DIST);
    const toMoon = [ground[0] - earth[0], ground[1] - earth[1], ground[2] - earth[2]];
    const len = Math.hypot(...toMoon);
    const facing = toMoon.map((c) => (6371 * c) / len) as unknown as Vec3;
    const away = facing.map((c) => -c) as unknown as Vec3;
    const sun = along(ground, lat, lon, 4, 0.01, SUN_DIST);

    const seen = computeSky(syntheticEphemeris(sun, earth, facing), 0, site, { mast_height_m: 0 });
    expect(seen.state.dsn_visible).toBe(true);
    expect(seen.dsn_elevation_rad["goldstone"]).toBeGreaterThan(80 * DEG);

    const hidden = computeSky(syntheticEphemeris(sun, earth, away), 0, site, { mast_height_m: 0 });
    expect(hidden.state.earth_visible).toBe(true);
    expect(hidden.state.dsn_visible).toBe(false);
    expect(hidden.dsn_elevation_rad["goldstone"]).toBeLessThan(-80 * DEG);

    const below = along(ground, lat, lon, 1, -20 * DEG, EARTH_DIST);
    const toMoon2 = [ground[0] - below[0], ground[1] - below[1], ground[2] - below[2]];
    const len2 = Math.hypot(...toMoon2);
    const facing2 = toMoon2.map((c) => (6371 * c) / len2) as unknown as Vec3;
    const night = computeSky(syntheticEphemeris(sun, below, facing2), 0, site, {
      mast_height_m: 0,
    });
    expect(night.state.earth_visible).toBe(false);
    expect(night.state.dsn_visible).toBe(false);
  });

  it("applies the DSN elevation mask", () => {
    const earth = along(ground, lat, lon, 1, 30 * DEG, EARTH_DIST);
    const toMoon = [ground[0] - earth[0], ground[1] - earth[1], ground[2] - earth[2]];
    const len = Math.hypot(...toMoon);
    const unit = toMoon.map((c) => c / len) as unknown as Vec3;
    // Tilt the station's vertical 85° away from the Moon, in a plane containing the Moon direction.
    const helper: Vec3 = Math.abs(unit[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const side = [
      unit[1] * helper[2] - unit[2] * helper[1],
      unit[2] * helper[0] - unit[0] * helper[2],
      unit[0] * helper[1] - unit[1] * helper[0],
    ];
    const sl = Math.hypot(...side);
    const tilt = 85 * DEG;
    const vertical = [0, 1, 2].map(
      (i) => 6371 * (Math.cos(tilt) * unit[i]! + Math.sin(tilt) * (side[i]! / sl)),
    ) as unknown as Vec3;
    const eph = syntheticEphemeris(along(ground, lat, lon, 4, 0.01, SUN_DIST), earth, vertical);
    const el = computeSky(eph, 0, site, { mast_height_m: 0 }).dsn_elevation_rad["goldstone"]!;
    expect(el / DEG).toBeGreaterThan(3);
    expect(el / DEG).toBeLessThan(7);
    expect(
      computeSky(eph, 0, site, { mast_height_m: 0, dsn_min_elev_rad: 0 }).state.dsn_visible,
    ).toBe(true);
    expect(
      computeSky(eph, 0, site, { mast_height_m: 0, dsn_min_elev_rad: 10 * DEG }).state.dsn_visible,
    ).toBe(false);
  });

  it("takes the simulated flag from the ephemeris", () => {
    expect(computeSky(withEarthAt(0), 0, site, { mast_height_m: 0 }).state.simulated).toBe(true);
  });
});
