import { describe, expect, it } from "vitest";
import {
  HorizonMaskSchema,
  SunEarthStateSchema,
  siteLocation,
  type EngineClient,
  type Location,
  type Site,
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
import connectingRidge from "../src/data/horizon_connecting-ridge.json";
import deGerlache from "../src/data/horizon_de-gerlache-rim.json";
import shackleton from "../src/data/horizon_shackleton-rim.json";
import { BUNDLED_BIN, readArrayBuffer } from "./helpers";

const DEG = Math.PI / 180;
const TWO_PI = 2 * Math.PI;
const DOCS: Record<string, unknown> = {
  "shackleton-rim": shackleton,
  "connecting-ridge": connectingRidge,
  "de-gerlache-rim": deGerlache,
};
const engine: EngineClient = createSightlineEngineClient(readArrayBuffer(BUNDLED_BIN));
const START_ET = BUNDLED_EPHEMERIS_META.header.start_et;
const END_ET = BUNDLED_EPHEMERIS_META.header.end_et;

/** Each catalog site with its horizon file, parsed, and the profile the engine built from it. */
const cases = BUNDLED_SITES.map((site: Site) => {
  const file = parseHorizonFile(DOCS[site.id]);
  const profile = BUNDLED_HORIZONS.find((h) => h.siteId === site.id) as HorizonProfile;
  return { site, loc: siteLocation(site), file, profile };
});
const rim = cases[0]!;

describe("the committed horizon files", () => {
  it("exist for every catalog site, one each", () => {
    expect(BUNDLED_SITES.map((s) => s.id).sort()).toEqual(Object.keys(DOCS).sort());
    expect(BUNDLED_HORIZONS).toHaveLength(BUNDLED_SITES.length);
    for (const c of cases) expect(c.profile).toBeInstanceOf(HorizonProfile);
  });

  describe.each(cases)("$site.id", ({ site, loc, file, profile }) => {
    it("covers the circle at 0.25° with a few envelope lines per azimuth, and real provenance", () => {
      expect(file.schema_version).toBe(2);
      expect(file.azimuth_samples).toBe(1440);
      expect(file.azimuth_step_rad).toBeCloseTo(TWO_PI / 1440, 15);
      expect(file.max_mast_height_m).toBe(20);
      expect(file.hull_offsets).toHaveLength(1441);
      expect(file.hull_offsets[1440]).toBe(file.hull_a.length);
      expect(file.hull_b).toHaveLength(file.hull_a.length);
      // An envelope, not a copy of every ground sample (there are about 6,000 per azimuth).
      expect(file.hull_a.length).toBeLessThan(1440 * 40);
      expect(file.provenance.simulated).toBe(false);
      expect(file.provenance.data_sources).toHaveLength(2);
      expect(file.provenance.data_sources[1]).toBe("pgda90-ldem-80s-80m");
      expect(file.site_id).toBe(site.id);
    });

    it("is at the catalog's position and height, to the catalog's own rounding", () => {
      expect(file.location.lat_rad).toBeCloseTo(loc.lat_rad, 9);
      expect(file.location.lon_rad).toBeCloseTo(loc.lon_rad, 9);
      expect(file.location.elev_m).toBe(site.elev_m);
    });

    it("never rises with mast height: delta theta <= 0 at every azimuth, and falls somewhere", () => {
      const heights = [0, 0.1, 0.5, 1, 2, 3.3, 7, 12, 20];
      let changed = false;
      for (let i = 0; i < 1440; i += 3) {
        const az = i * file.azimuth_step_rad;
        let prev = profile.maskAt(az, heights[0]!);
        for (const h of heights.slice(1)) {
          const m = profile.maskAt(az, h);
          expect(m).toBeLessThanOrEqual(prev + 1e-12);
          if (m < prev - 1e-6) changed = true;
          prev = m;
        }
      }
      expect(changed).toBe(true);
    });

    it("has masks inside (-90°, 90°) at every azimuth and mast", () => {
      for (let i = 0; i < 1440; i += 2) {
        for (const h of [0, 2, 20]) {
          expect(Math.abs(profile.maskAt(i * file.azimuth_step_rad, h))).toBeLessThan(Math.PI / 2);
        }
      }
    });
  });

  it("rejects a malformed file", () => {
    const doc = shackleton as unknown as Record<string, unknown>;
    expect(() => parseHorizonFile({ ...doc, schema_version: 1 })).toThrow(TypeError);
    expect(() => parseHorizonFile({ ...doc, hull_b: (doc.hull_b as number[]).slice(1) })).toThrow(
      RangeError,
    );
    expect(() =>
      parseHorizonFile({ ...doc, hull_offsets: (doc.hull_offsets as number[]).slice(1) }),
    ).toThrow(RangeError);
    const offsets = [...(doc.hull_offsets as number[])];
    offsets[10] = offsets[9]!; // an azimuth with no lines
    expect(() => parseHorizonFile({ ...doc, hull_offsets: offsets })).toThrow(/bin 9 has no lines/);
    const negative = [...(doc.hull_b as number[])];
    negative[0] = -1;
    expect(() => parseHorizonFile({ ...doc, hull_b: negative })).toThrow(RangeError);
    expect(() => parseHorizonFile({ ...doc, max_mast_height_m: 0 })).toThrow(RangeError);
  });
});

describe("azimuth convention", () => {
  it("is the one the pipeline used: north towards increasing latitude, east towards increasing longitude", () => {
    // pipeline/tests/test_horizon.py builds its rays from exactly these vectors (3-D, independent
    // of its own destination formula), so equality here ties the files' azimuths to the engine's.
    for (const { loc } of cases) {
      const { lat_rad: lat, lon_rad: lon } = loc;
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
    }
  });
});

/** The mask of one azimuth bin straight from the stored lines, written out again here. */
function binMask(file: (typeof cases)[number]["file"], i: number, h: number): number {
  let best = -Infinity;
  for (let k = file.hull_offsets[i]!; k < file.hull_offsets[i + 1]!; k++) {
    best = Math.max(best, file.hull_a[k]! - file.hull_b[k]! * h);
  }
  return Math.atan(best);
}

describe("HorizonProfile.maskAt", () => {
  const { file, profile, loc } = rim;

  it("returns the envelope's value at a bin and interpolates between bins", () => {
    const step = file.azimuth_step_rad;
    for (const h of [0, 0.3, 2, 11]) {
      expect(profile.maskAt(100 * step, h)).toBeCloseTo(binMask(file, 100, h), 12);
      const mid = profile.maskAt(100.5 * step, h);
      expect(mid).toBeCloseTo((binMask(file, 100, h) + binMask(file, 101, h)) / 2, 12);
    }
  });

  it("keeps azimuths in [0, 2π) without a seam at north", () => {
    const step = file.azimuth_step_rad;
    const first = binMask(file, 0, 2);
    const last = binMask(file, 1439, 2);
    expect(profile.maskAt(1439.5 * step, 2)).toBeCloseTo((last + first) / 2, 12);
    expect(profile.maskAt(-step, 2)).toBeCloseTo(last, 12);
    expect(profile.maskAt(TWO_PI, 2)).toBeCloseTo(first, 12);
    expect(profile.maskAt(5 * TWO_PI + 3 * step, 2)).toBeCloseTo(binMask(file, 3, 2), 9);
    for (const az of [TWO_PI - 1e-15, TWO_PI - 1e-9, -1e-15, 0]) {
      expect(Number.isFinite(profile.maskAt(az, 2))).toBe(true);
    }
    expect(() => profile.maskAt(Number.NaN, 0)).toThrow(RangeError);
  });

  it("is the maximum of lines in mast height: tan(mask) is convex and falling, and exact at any height", () => {
    // Between any two heights, tan(mask) lies on or below the chord (a max of lines is convex);
    // the old grid-and-interpolate scheme broke exactly this.
    for (const i of [0, 150, 600, 1000, 1439]) {
      const az = i * file.azimuth_step_rad;
      for (let h = 0.05; h < 19.9; h += 0.37) {
        const [lo, mid, hi] = [h - 0.05, h, h + 0.05].map((x) => Math.tan(profile.maskAt(az, x)));
        expect(mid!).toBeLessThanOrEqual((lo! + hi!) / 2 + 1e-12);
        expect(hi!).toBeLessThanOrEqual(lo! + 1e-12);
      }
    }
    expect(() => profile.maskAt(0, 20.5)).toThrow(RangeError);
    expect(() => profile.maskAt(0, -1)).toThrow(RangeError);
    expect(Number.isFinite(profile.maskAt(0, 20))).toBe(true);
  });

  it("matches only the site it was computed for", () => {
    expect(profile.matches(loc)).toBe(true);
    expect(profile.matches({ ...loc, lat_rad: loc.lat_rad + 10 / 1_737_400 })).toBe(false);
    expect(profile.matches({ ...loc, elev_m: (loc.elev_m ?? 0) + 50 })).toBe(false);
    const noHeight: Location = { lat_rad: loc.lat_rad, lon_rad: loc.lon_rad };
    expect(profile.matches(noHeight)).toBe(false);
    for (const other of cases) {
      if (other.site.id !== rim.site.id) expect(profile.matches(other.loc)).toBe(false);
    }
  });
});

describe("getHorizon", () => {
  it.each(cases)(
    "returns a contract HorizonMask for $site.id, for any mast height",
    async ({ loc }) => {
      for (const mast of [0, 2, 3.7, 20]) {
        const h = await engine.getHorizon(loc, mast);
        expect(HorizonMaskSchema.safeParse(h).success).toBe(true);
        expect(h.simulated).toBe(false);
        expect(h.mast_height_m).toBe(mast);
        expect(h.mask_elevation_rad).toHaveLength(1440);
      }
    },
  );

  it.each(cases)(
    "is lower with a 2 m mast than without, at every azimuth ($site.id)",
    async ({ loc }) => {
      const [flat, mast] = await Promise.all([
        engine.getHorizon(loc, 0),
        engine.getHorizon(loc, 2),
      ]);
      for (let i = 0; i < 1440; i++) {
        expect(mast.mask_elevation_rad[i]!).toBeLessThanOrEqual(flat.mask_elevation_rad[i]!);
      }
    },
  );

  it("refuses other places, and a mast beyond the grid", async () => {
    const other: Location = { ...rim.loc, lat_rad: rim.loc.lat_rad + 1e-3 };
    await expect(engine.getHorizon(other, 2)).rejects.toBeInstanceOf(NotAvailableError);
    await expect(engine.getHorizon(rim.loc, 25)).rejects.toThrow();
  });
});

/** Hourly samples across 2026. */
const epochs: number[] = [];
for (let t = START_ET; t <= END_ET; t += 3600) epochs.push(t);

describe.each(cases)("getSunEarth and probeLit at $site.id", ({ loc, profile }) => {
  it("judges the Sun and Earth against the mask at their own azimuths", async () => {
    let lit = 0;
    for (const t of epochs.filter((_, i) => i % 7 === 0)) {
      const s = await engine.getSunEarth(t, loc, 2);
      expect(SunEarthStateSchema.safeParse(s).success).toBe(true);
      const sunMask = profile.maskAt(s.sun_azimuth_rad, 2);
      const earthMask = profile.maskAt(s.earth_azimuth_rad, 2);
      expect(s.earth_visible).toBe(s.earth_elevation_rad > earthMask);
      // Disk fraction is 1 when the whole disk clears the mask and 0 when the top is below it.
      const radius = 0.2666 * DEG * 1.02;
      if (s.sun_elevation_rad - radius > sunMask) expect(s.sun_disk_fraction).toBe(1);
      if (s.sun_elevation_rad + radius < sunMask) expect(s.sun_disk_fraction).toBe(0);
      if (s.sun_disk_fraction > 0) lit += 1;
      expect(!s.dsn_visible || s.earth_visible).toBe(true);
    }
    // The terrain is not degenerate: it is neither always dark nor always lit over a year.
    expect(lit).toBeGreaterThan(0);
    expect(lit).toBeLessThan(epochs.length / 7);
  });

  it("probeLit agrees with getSunEarth and returns the contract's fields", async () => {
    for (const t of epochs.filter((_, i) => i % 97 === 0)) {
      const state = await engine.getSunEarth(t, loc, 2);
      const probe = await engine.probeLit(loc, t, 2);
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
      const low = await engine.getSunEarth(t, loc, 0);
      const high = await engine.getSunEarth(t, loc, 20);
      // The mask only falls with height, so the lit part of the disk can only grow.
      expect(high.sun_disk_fraction).toBeGreaterThanOrEqual(low.sun_disk_fraction - 1e-9);
    }
  });
});

describe("a place with no terrain horizon", () => {
  it("stays on the flat horizon, as before", async () => {
    const ridge = cases[1]!.loc;
    const nowhere: Location = { ...ridge, lat_rad: ridge.lat_rad + 1e-3 };
    const t = epochs[1234]!;
    const noTerrain = createSightlineEngineClient(readArrayBuffer(BUNDLED_BIN), { horizons: [] });
    expect(await engine.getSunEarth(t, nowhere, 2)).toEqual(
      await noTerrain.getSunEarth(t, nowhere, 2),
    );
  });
});
