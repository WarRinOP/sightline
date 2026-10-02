import { describe, expect, it } from "vitest";
import { siteLocation } from "@sightline/contracts";
import { Ephemeris, computeSky, BUNDLED_EPHEMERIS_META } from "../src";
import { BUNDLED_BIN, GOLDEN_DIR, readArrayBuffer, readJson } from "../test/helpers";

// Tolerances fixed before the first run (CLAUDE.md §7.8: never loosen them to pass).
//  - Sun and Earth direction: 1e-4 degree, the interpolation budget in M2-03.
//  - Solar disk fraction: what 1e-4 degree of elevation can change it, (2/pi) * dEl / r_sun.
//  - DSN elevation: 0.25 degree. The engine takes each station's vertical as its geocentric
//    direction; SPICE's topocentric frame uses the geodetic vertical. They differ by up to 0.19 degree.
const ANGLE_TOL_RAD = (1e-4 * Math.PI) / 180;
const DSN_TOL_RAD = (0.25 * Math.PI) / 180;

interface Case {
  site_id: string;
  lat_deg: number;
  lon_deg: number;
  elev_m: number;
  mast_height_m: number;
  epoch_et: number;
  sun_azimuth_rad: number;
  sun_elevation_rad: number;
  sun_disk_fraction: number;
  earth_azimuth_rad: number;
  earth_elevation_rad: number;
  dsn_elevation_rad: Record<string, number>;
}
const golden = readJson(new URL("sun_earth.json", GOLDEN_DIR)) as {
  cases: Case[];
  kernels: string[];
  sun_radius_km: number;
};
const eph = new Ephemeris(BUNDLED_EPHEMERIS_META, readArrayBuffer(BUNDLED_BIN));

/** Smallest difference between two azimuths, wrapping at 2π. */
const azDiff = (a: number, b: number) => {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return Math.min(d, 2 * Math.PI - d);
};

describe("Sun and Earth parity with SPICE (fixtures/golden/sun_earth.json)", () => {
  it("covers the three catalog sites and the exact pole, with and without a mast", () => {
    const ids = new Set(golden.cases.map((c) => c.site_id));
    expect([...ids].sort()).toEqual(
      ["connecting-ridge", "de-gerlache-rim", "pole-test-point", "shackleton-rim"].sort(),
    );
    expect(new Set(golden.cases.map((c) => c.mast_height_m))).toEqual(new Set([0, 2]));
    expect(golden.kernels).toContain("de440s.bsp");
  });

  it("agrees on every case", () => {
    const worst = { sun: 0, earth: 0, disk: 0, dsn: 0 };
    for (const c of golden.cases) {
      const loc = siteLocation({ lat_deg: c.lat_deg, lon_deg: c.lon_deg, elev_m: c.elev_m });
      const r = computeSky(eph, c.epoch_et, loc, { mast_height_m: c.mast_height_m });
      const where = `${c.site_id} mast ${c.mast_height_m} et ${c.epoch_et}`;
      const sunAz = azDiff(r.state.sun_azimuth_rad, c.sun_azimuth_rad);
      const sunEl = Math.abs(r.state.sun_elevation_rad - c.sun_elevation_rad);
      const earthAz = azDiff(r.state.earth_azimuth_rad, c.earth_azimuth_rad);
      const earthEl = Math.abs(r.state.earth_elevation_rad - c.earth_elevation_rad);
      // Azimuth error on the sky is dAz * cos(el); near the zenith it would be amplified, but Sun
      // and Earth stay within about 10 degrees of the horizon here.
      expect(sunAz * Math.cos(c.sun_elevation_rad), `sun az ${where}`).toBeLessThan(ANGLE_TOL_RAD);
      expect(sunEl, `sun el ${where}`).toBeLessThan(ANGLE_TOL_RAD);
      expect(earthAz * Math.cos(c.earth_elevation_rad), `earth az ${where}`).toBeLessThan(
        ANGLE_TOL_RAD,
      );
      expect(earthEl, `earth el ${where}`).toBeLessThan(ANGLE_TOL_RAD);
      const diskTol = ((2 / Math.PI) * ANGLE_TOL_RAD) / r.sun_angular_radius_rad;
      const disk = Math.abs(r.state.sun_disk_fraction - c.sun_disk_fraction);
      expect(disk, `disk ${where}`).toBeLessThan(diskTol);
      for (const [name, el] of Object.entries(c.dsn_elevation_rad)) {
        const d = Math.abs(r.dsn_elevation_rad[name]! - el);
        expect(d, `dsn ${name} ${where}`).toBeLessThan(DSN_TOL_RAD);
        worst.dsn = Math.max(worst.dsn, d);
      }
      worst.sun = Math.max(worst.sun, sunAz * Math.cos(c.sun_elevation_rad), sunEl);
      worst.earth = Math.max(worst.earth, earthAz * Math.cos(c.earth_elevation_rad), earthEl);
      worst.disk = Math.max(worst.disk, disk);
    }
    // Printed so the margin is visible in the log, not only the pass.
    console.log(
      `worst gaps over ${golden.cases.length} cases: sun ${((worst.sun * 180) / Math.PI).toExponential(2)} deg, ` +
        `earth ${((worst.earth * 180) / Math.PI).toExponential(2)} deg, disk ${worst.disk.toExponential(2)}, ` +
        `dsn ${((worst.dsn * 180) / Math.PI).toFixed(3)} deg`,
    );
  });

  it("uses the Sun radius the kernels give", () => {
    expect(golden.sun_radius_km).toBe(BUNDLED_EPHEMERIS_META.sun_radius_km);
  });
});
