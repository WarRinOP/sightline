import { describe, expect, it } from "vitest";
import {
  HorizonMaskSchema,
  SunEarthStateSchema,
  siteLocation,
  type EngineClient,
  type Location,
} from "@sightline/contracts";
import {
  BUNDLED_EPHEMERIS_META,
  BUNDLED_HORIZONS,
  BUNDLED_SITES,
  HorizonProfile,
  NotAvailableError,
  createSightlineEngineClient,
  enuBasis,
  parseHorizonFile,
} from "../src";
import horizonJson from "../src/data/horizon_shackleton-rim.json";
import { BUNDLED_BIN, readArrayBuffer } from "./helpers";

const DEG = Math.PI / 180;
const TWO_PI = 2 * Math.PI;
const file = parseHorizonFile(horizonJson);
const profile = BUNDLED_HORIZONS[0] as HorizonProfile;
const engine: EngineClient = createSightlineEngineClient(readArrayBuffer(BUNDLED_BIN));
const rim = BUNDLED_SITES.find((s) => s.id === "shackleton-rim")!;
const rimLoc = siteLocation(rim);
const START_ET = BUNDLED_EPHEMERIS_META.header.start_et;
const END_ET = BUNDLED_EPHEMERIS_META.header.end_et;

describe("the committed horizon file", () => {
  it("covers the circle at 0.25° and every mast height, with real provenance", () => {
    expect(file.azimuth_samples).toBe(1440);
    expect(file.azimuth_step_rad).toBeCloseTo(TWO_PI / 1440, 15);
    expect(file.mast_heights_m).toEqual([0, 0.25, 0.5, 1, 1.5, 2, 3, 4, 5, 7.5, 10, 15, 20]);
    for (const row of file.mask_elevation_rad) {
      expect(row).toHaveLength(1440);
      expect(row.every((v) => Math.abs(v) < Math.PI / 2)).toBe(true);
    }
    expect(file.provenance.simulated).toBe(false);
    expect(file.provenance.data_sources).toEqual(["pgda78-site04-surf", "pgda90-ldem-80s-80m"]);
    expect(file.site_id).toBe("shackleton-rim");
  });

  it("is the catalog's Shackleton Rim, to the catalog's own rounding", () => {
    expect(file.location.lat_rad).toBeCloseTo(rimLoc.lat_rad, 9);
    expect(file.location.lon_rad).toBeCloseTo(rimLoc.lon_rad, 9);
    expect(file.location.elev_m).toBe(rim.elev_m);
  });

  it("never rises with mast height: delta theta <= 0 at every azimuth", () => {
    for (let k = 1; k < file.mask_elevation_rad.length; k++) {
      const lower = file.mask_elevation_rad[k - 1]!;
      const upper = file.mask_elevation_rad[k]!;
      for (let i = 0; i < 1440; i++) expect(upper[i]!).toBeLessThanOrEqual(lower[i]!);
    }
    // And a mast does change the mask somewhere (it is not a constant copy).
    expect(
      file.mask_elevation_rad[0]!.some((v, i) => v > file.mask_elevation_rad.at(-1)![i]!),
    ).toBe(true);
  });

  it("rejects a malformed file", () => {
    const bad = { ...horizonJson, mask_elevation_rad: horizonJson.mask_elevation_rad.slice(1) };
    expect(() => parseHorizonFile(bad)).toThrow(RangeError);
    expect(() => parseHorizonFile({ ...horizonJson, schema_version: 2 })).toThrow(TypeError);
    const short = {
      ...horizonJson,
      mask_elevation_rad: horizonJson.mask_elevation_rad.map((r) => r.slice(1)),
    };
    expect(() => parseHorizonFile(short)).toThrow(RangeError);
  });
});

describe("azimuth convention", () => {
  it("is the one the pipeline used: north towards increasing latitude, east towards increasing longitude", () => {
    // pipeline/tests/test_horizon.py builds its rays from exactly these vectors (3-D, independent
    // of its own destination formula), so equality here ties the file's azimuths to the engine's.
    const { lat_rad: lat, lon_rad: lon } = rimLoc;
    const { east, north } = enuBasis(lat, lon);
    const wantEast = [-Math.sin(lon), Math.cos(lon), 0];
    const wantNorth = [
      -Math.sin(lat) * Math.cos(lon),
      -Math.sin(lat) * Math.sin(lon),
      Math.cos(lat),
    ];
    for (let k = 0; k < 3; k++) {
      expect(east[k]!).toBeCloseTo(wantEast[k]!, 14);
      expect(north[k]!).toBeCloseTo(wantNorth[k]!, 14);
    }
  });
});

describe("HorizonProfile.maskAt", () => {
  it("returns the stored value at a bin and interpolates between bins", () => {
    const row = file.mask_elevation_rad[0]!;
    expect(profile.maskAt(100 * file.azimuth_step_rad, 0)).toBeCloseTo(row[100]!, 12);
    const mid = profile.maskAt(100.5 * file.azimuth_step_rad, 0);
    expect(mid).toBeCloseTo((row[100]! + row[101]!) / 2, 12);
  });

  it("keeps azimuths in [0, 2π) without a seam at north", () => {
    const row = file.mask_elevation_rad[0]!;
    const step = file.azimuth_step_rad;
    // The last bin to the first wraps; half way between them is their mean.
    expect(profile.maskAt(1439.5 * step, 0)).toBeCloseTo((row[1439]! + row[0]!) / 2, 12);
    // Azimuths outside [0, 2π) are the same direction.
    expect(profile.maskAt(-step, 0)).toBeCloseTo(row[1439]!, 12);
    expect(profile.maskAt(TWO_PI, 0)).toBeCloseTo(row[0]!, 12);
    expect(profile.maskAt(5 * TWO_PI + 3 * step, 0)).toBeCloseTo(row[3]!, 9);
    // Just under 2π and exactly 2π - ε never read past the array.
    for (const az of [TWO_PI - 1e-15, TWO_PI - 1e-9, -1e-15, 0]) {
      expect(Number.isFinite(profile.maskAt(az, 2))).toBe(true);
    }
    expect(() => profile.maskAt(Number.NaN, 0)).toThrow(RangeError);
  });

  it("interpolates between mast heights, monotonically, and refuses beyond the grid", () => {
    for (const az of [0, 0.7, 2.1, 4.4, 6.2]) {
      let prev = profile.maskAt(az, 0);
      for (let h = 0.25; h <= 20; h += 0.25) {
        const m = profile.maskAt(az, h);
        expect(m).toBeLessThanOrEqual(prev + 1e-15);
        prev = m;
      }
      expect(profile.maskAt(az, 2)).toBeCloseTo(
        file.mask_elevation_rad[file.mast_heights_m.indexOf(2)]![
          Math.floor(az / file.azimuth_step_rad)
        ]!,
        1,
      );
    }
    expect(() => profile.maskAt(0, 20.5)).toThrow(RangeError);
    expect(() => profile.maskAt(0, -1)).toThrow(RangeError);
  });

  it("matches only the site it was computed for", () => {
    expect(profile.matches(rimLoc)).toBe(true);
    expect(profile.matches({ ...rimLoc, lat_rad: rimLoc.lat_rad + 10 / 1_737_400 })).toBe(false);
    expect(profile.matches({ ...rimLoc, elev_m: (rimLoc.elev_m ?? 0) + 50 })).toBe(false);
    const noHeight: Location = { lat_rad: rimLoc.lat_rad, lon_rad: rimLoc.lon_rad };
    expect(profile.matches(noHeight)).toBe(false);
    for (const s of BUNDLED_SITES) {
      if (s.id !== "shackleton-rim") expect(profile.matches(siteLocation(s))).toBe(false);
    }
  });
});

describe("getHorizon", () => {
  it("returns a contract HorizonMask for the site, for any mast height", async () => {
    for (const mast of [0, 2, 3.7, 20]) {
      const h = await engine.getHorizon(rimLoc, mast);
      expect(HorizonMaskSchema.safeParse(h).success).toBe(true);
      expect(h.simulated).toBe(false);
      expect(h.mast_height_m).toBe(mast);
      expect(h.mask_elevation_rad).toHaveLength(1440);
    }
  });

  it("is lower with a 2 m mast than without, at every azimuth", async () => {
    const [flat, mast] = await Promise.all([
      engine.getHorizon(rimLoc, 0),
      engine.getHorizon(rimLoc, 2),
    ]);
    for (let i = 0; i < 1440; i++) {
      expect(mast.mask_elevation_rad[i]!).toBeLessThanOrEqual(flat.mask_elevation_rad[i]!);
    }
  });

  it("refuses other places, and a mast beyond the grid", async () => {
    const other: Location = { ...rimLoc, lat_rad: rimLoc.lat_rad + 1e-3 };
    await expect(engine.getHorizon(other, 2)).rejects.toBeInstanceOf(NotAvailableError);
    await expect(engine.getHorizon(rimLoc, 25)).rejects.toThrow();
  });
});

/** Hourly samples across 2026. */
const epochs: number[] = [];
for (let t = START_ET; t <= END_ET; t += 3600) epochs.push(t);

describe("getSunEarth and probeLit at the terrain site", () => {
  it("judges the Sun and Earth against the mask at their own azimuths", async () => {
    let lit = 0;
    let earth = 0;
    for (const t of epochs.filter((_, i) => i % 7 === 0)) {
      const s = await engine.getSunEarth(t, rimLoc, 2);
      expect(SunEarthStateSchema.safeParse(s).success).toBe(true);
      const sunMask = profile.maskAt(s.sun_azimuth_rad, 2);
      const earthMask = profile.maskAt(s.earth_azimuth_rad, 2);
      expect(s.earth_visible).toBe(s.earth_elevation_rad > earthMask);
      // Disk fraction is positive exactly when the top of the disk clears the mask (0.2666°).
      const top = s.sun_elevation_rad + 0.2666 * DEG * 1.02;
      const bottom = s.sun_elevation_rad - 0.2666 * DEG * 1.02;
      if (bottom > sunMask) expect(s.sun_disk_fraction).toBe(1);
      if (top < sunMask) expect(s.sun_disk_fraction).toBe(0);
      if (s.sun_disk_fraction > 0) lit += 1;
      if (s.earth_visible) earth += 1;
      expect(!s.dsn_visible || s.earth_visible).toBe(true);
    }
    // The terrain is not degenerate: it is neither always dark nor always lit over a year.
    expect(lit).toBeGreaterThan(0);
    expect(lit).toBeLessThan(epochs.length / 7);
    expect(earth).toBeLessThan(epochs.length / 7);
  });

  it("probeLit agrees with getSunEarth and returns the contract's fields", async () => {
    for (const t of epochs.filter((_, i) => i % 97 === 0)) {
      const state = await engine.getSunEarth(t, rimLoc, 2);
      const probe = await engine.probeLit(rimLoc, t, 2);
      expect(probe).toEqual({
        epoch_et: t,
        lit: state.sun_disk_fraction > 0,
        sun_disk_fraction: state.sun_disk_fraction,
        simulated: false,
      });
    }
  });

  it("a taller mast never turns a lit moment dark", async () => {
    for (const t of epochs.filter((_, i) => i % 11 === 0)) {
      const low = await engine.getSunEarth(t, rimLoc, 0);
      const high = await engine.getSunEarth(t, rimLoc, 20);
      expect(high.sun_disk_fraction).toBeGreaterThanOrEqual(low.sun_disk_fraction - 1e-9);
    }
  });

  it("leaves the other sites on the flat horizon, as before", async () => {
    const ridge = siteLocation(BUNDLED_SITES.find((s) => s.id === "connecting-ridge")!);
    const t = epochs[1234]!;
    const s = await engine.getSunEarth(t, ridge, 2);
    const noTerrain = createSightlineEngineClient(readArrayBuffer(BUNDLED_BIN), { horizons: [] });
    expect(await noTerrain.getSunEarth(t, ridge, 2)).toEqual(s);
  });
});
