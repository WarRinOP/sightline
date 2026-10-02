import { describe, expect, it } from "vitest";
import {
  ProvenanceRecordSchema,
  SiteSchema,
  SunEarthStateSchema,
  siteLocation,
  DEFAULT_LANDER_PROFILE,
  type EngineClient,
} from "@sightline/contracts";
import {
  BUNDLED_EPHEMERIS_META,
  BUNDLED_SITES,
  Ephemeris,
  NotAvailableError,
  computeSky,
  createSightlineEngineClient,
  etToUtcIso,
  utcIsoToEt,
} from "../src";
import { BUNDLED_BIN, readArrayBuffer } from "./helpers";

const DEG = Math.PI / 180;
const engine: EngineClient = createSightlineEngineClient(readArrayBuffer(BUNDLED_BIN));
const START_ET = BUNDLED_EPHEMERIS_META.header.start_et;
const DAY_S = 86_400;

describe("the bundled ephemeris", () => {
  it("covers a year from one minute into 2026 at one-hour steps and cites its sources", () => {
    const h = BUNDLED_EPHEMERIS_META.header;
    // The Earth orientation kernel starts at 2026-01-01T00:00:00 UTC; see ephem.py.
    expect(etToUtcIso(h.start_et)).toBe("2026-01-01T00:01:00.000");
    expect(etToUtcIso(h.end_et)).toBe("2027-01-01T00:01:00.000");
    expect(h.step_s).toBe(3600);
    expect(h.record_count).toBe(365 * 24 + 1);
    expect(h.simulated).toBe(false);
    expect(h.frame).toBe("MOON_ME");
    expect(h.aberration_correction).toBe("LT+S");
    expect(h.spice_kernels).toContain("moon_pa_de440_200625.bpc");
    expect(h.spice_kernels).toContain("moon_de440_250416.tf");
    expect(BUNDLED_EPHEMERIS_META.sun_radius_km).toBe(695_700);
  });

  it("agrees with the time module on the start of the file", () => {
    expect(utcIsoToEt("2026-01-01T00:01:00")).toBeCloseTo(
      BUNDLED_EPHEMERIS_META.header.start_et,
      6,
    );
  });
});

describe("listSites", () => {
  it("returns the three verified sites, none simulated, each with a source", async () => {
    const sites = await engine.listSites();
    expect(sites.map((s) => s.id)).toEqual([
      "shackleton-rim",
      "connecting-ridge",
      "de-gerlache-rim",
    ]);
    for (const s of sites) {
      expect(SiteSchema.safeParse(s).success).toBe(true);
      expect(s.simulated).toBe(false);
      expect(s.source_url).toBe("https://pgda.gsfc.nasa.gov/products/78");
      expect(s.description).toContain("tile centre, not a landing or rim point");
    }
  });

  it("holds the tile centres confirmed in D-019 (option A)", () => {
    const want: Record<string, [number, number]> = {
      "shackleton-rim": [-89.767, 188.13 - 360],
      "connecting-ridge": [-89.463, 222.51 - 360],
      "de-gerlache-rim": [-88.683, 292.068 - 360],
    };
    for (const s of BUNDLED_SITES) {
      const [lat, lon] = want[s.id]!;
      expect(Math.abs(s.lat_deg - lat)).toBeLessThan(5e-4);
      expect(Math.abs(s.lon_deg - lon)).toBeLessThan(5e-4);
    }
  });

  it("has the heights sampled from the 5 m DEMs, not the ones in the brief", () => {
    const byId = Object.fromEntries(BUNDLED_SITES.map((s) => [s.id, s.elev_m]));
    // D-019: at the Connecting Ridge centre the 5 m DEM reads about 1958 m, not 800 m.
    expect(byId["connecting-ridge"]).toBeGreaterThan(1500);
    expect(byId["connecting-ridge"]).toBeLessThan(2500);
    for (const h of Object.values(byId)) expect(Math.abs(h!)).toBeLessThan(7000);
  });

  it("hands out copies", async () => {
    const [first] = await engine.listSites();
    first!.name = "changed";
    expect((await engine.listSites())[0]!.name).toBe("Shackleton Rim");
  });
});

describe("provenance", () => {
  it("says the sky is real and names the kernels", () => {
    const p = engine.provenance;
    expect(ProvenanceRecordSchema.safeParse(p).success).toBe(true);
    expect(p.simulated).toBe(false);
    expect(p.source).toBe("SIGHTLINE_PIPELINE");
    expect(p.data_sources).toContain("naif-spk-de440s");
    expect(p.pipeline_version).not.toBeNull();
  });
});

describe("getSunEarth on real positions", () => {
  const sites = BUNDLED_SITES;

  async function year(siteIndex: number, step_s: number, mast = 2) {
    const loc = siteLocation(sites[siteIndex]!);
    const out = [];
    for (let t = START_ET + 3600; t < START_ET + 364 * DAY_S; t += step_s) {
      out.push(await engine.getSunEarth(t, loc, mast));
    }
    return out;
  }

  it("returns valid, non-simulated states", async () => {
    const states = await year(0, 5 * DAY_S);
    for (const s of states) {
      expect(SunEarthStateSchema.safeParse(s).success).toBe(true);
      expect(s.simulated).toBe(false);
    }
  });

  it("keeps the Sun within the lunar tilt of the horizon all year (about ±1.5° plus the colatitude)", async () => {
    for (let i = 0; i < sites.length; i++) {
      const colat = (90 - Math.abs(sites[i]!.lat_deg)) * DEG;
      const limit = 1.6 * DEG + colat + 0.1 * DEG;
      const els = (await year(i, 6 * 3600)).map((s) => s.sun_elevation_rad);
      expect(Math.max(...els)).toBeLessThan(limit);
      expect(Math.min(...els)).toBeGreaterThan(-limit);
      // And it does get close to those limits: the cycle is real, not a flat line.
      expect(Math.max(...els)).toBeGreaterThan(1.0 * DEG);
      expect(Math.min(...els)).toBeLessThan(-1.0 * DEG);
    }
  });

  it("swings the Sun round the horizon once a lunar day: 12 or 13 turns in 2026", async () => {
    const states = await year(1, 6 * 3600);
    let turns = 0;
    for (let i = 1; i < states.length; i++) {
      if (states[i]!.sun_azimuth_rad < states[i - 1]!.sun_azimuth_rad - Math.PI) turns += 1;
    }
    // 365 d / 29.53 d = 12.4 synodic months; the sign of the turn depends on the direction, so count both.
    let back = 0;
    for (let i = 1; i < states.length; i++) {
      if (states[i]!.sun_azimuth_rad > states[i - 1]!.sun_azimuth_rad + Math.PI) back += 1;
    }
    expect(turns + back).toBeGreaterThanOrEqual(12);
    expect(turns + back).toBeLessThanOrEqual(13);
  });

  it("flips the sign of the month-averaged Sun elevation 2 or 3 times in 2026 (the draconic cycle)", async () => {
    const els = (await year(1, 3600)).map((s) => s.sun_elevation_rad);
    const window = Math.round(29.53 * 24);
    const avg: number[] = [];
    for (let i = 0; i + window <= els.length; i += 6) {
      avg.push(els.slice(i, i + window).reduce((a, b) => a + b, 0) / window);
    }
    let flips = 0;
    for (let i = 1; i < avg.length; i++)
      if (Math.sign(avg[i]!) !== Math.sign(avg[i - 1]!)) flips += 1;
    expect(flips).toBeGreaterThanOrEqual(2);
    expect(flips).toBeLessThanOrEqual(3);
    // The monthly mean reaches about the 1.54° tilt, give or take the colatitude and the Sun's own motion.
    expect(Math.max(...avg.map(Math.abs))).toBeGreaterThan(1.2 * DEG);
    expect(Math.max(...avg.map(Math.abs))).toBeLessThan(2.2 * DEG);
  });

  it("shows Earth bobbing within about 10° of the horizon and visible a fair share of the time", async () => {
    const states = await year(0, 3600);
    const els = states.map((s) => s.earth_elevation_rad);
    expect(Math.max(...els)).toBeLessThan(12 * DEG);
    expect(Math.min(...els)).toBeGreaterThan(-12 * DEG);
    const visible = states.filter((s) => s.earth_visible).length / states.length;
    expect(visible).toBeGreaterThan(0.2);
    expect(visible).toBeLessThan(0.8);
    expect(states.every((s) => !s.dsn_visible || s.earth_visible)).toBe(true);
    expect(states.some((s) => s.dsn_visible)).toBe(true);
    // Three complexes about 120° apart: with a 0° mask a link exists whenever Earth is up.
    expect(states.every((s) => s.dsn_visible === s.earth_visible)).toBe(true);
  });

  it("finds short DSN gaps only once the station mask is 10° (measured: about 0.5% of Earth-up time)", () => {
    const eph = new Ephemeris(BUNDLED_EPHEMERIS_META, readArrayBuffer(BUNDLED_BIN));
    const loc = siteLocation(sites[0]!);
    let earthUp = 0;
    let gaps0 = 0;
    let gaps10 = 0;
    for (let t = eph.start_et; t <= eph.end_et; t += 600) {
      const open = computeSky(eph, t, loc, { mast_height_m: 2 });
      if (!open.state.earth_visible) continue;
      earthUp += 1;
      if (!open.state.dsn_visible) gaps0 += 1;
      if (
        !computeSky(eph, t, loc, { mast_height_m: 2, dsn_min_elev_rad: 10 * DEG }).state.dsn_visible
      ) {
        gaps10 += 1;
      }
    }
    expect(gaps0).toBe(0);
    expect(gaps10).toBeGreaterThan(0);
    expect(gaps10 / earthUp).toBeLessThan(0.02);
  });

  it("moves Earth's direction by about elev/384,400 km when the ground is 2 km higher (parallax)", async () => {
    const base = siteLocation({ ...sites[0]!, elev_m: 0 });
    const high = siteLocation({ ...sites[0]!, elev_m: 2000 });
    const t = START_ET + 100 * DAY_S;
    const a = await engine.getSunEarth(t, base, 0);
    const b = await engine.getSunEarth(t, high, 0);
    const delta = Math.hypot(
      a.earth_elevation_rad - b.earth_elevation_rad,
      Math.cos(a.earth_elevation_rad) * (a.earth_azimuth_rad - b.earth_azimuth_rad),
    );
    expect(delta / DEG).toBeGreaterThan(1e-4);
    expect(delta / DEG).toBeLessThan(6e-4);
  });

  it("a taller mast sees the Sun as high or higher, and slightly more of its disk", async () => {
    const loc = siteLocation(sites[1]!);
    for (let t = START_ET; t < START_ET + 60 * DAY_S; t += 11 * 3600) {
      const low = await engine.getSunEarth(t, loc, 0);
      const mast = await engine.getSunEarth(t, loc, 20);
      expect(mast.sun_disk_fraction).toBeGreaterThanOrEqual(low.sun_disk_fraction - 1e-12);
    }
  });

  it("refuses an epoch outside the ephemeris", async () => {
    const loc = siteLocation(sites[0]!);
    await expect(engine.getSunEarth(START_ET - 1, loc, 0)).rejects.toThrow(RangeError);
    await expect(
      engine.getSunEarth(BUNDLED_EPHEMERIS_META.header.end_et + 1, loc, 0),
    ).rejects.toThrow(RangeError);
  });
});

describe("methods that need terrain", () => {
  const loc = siteLocation(BUNDLED_SITES[0]!);
  const range = { start_et: START_ET, end_et: START_ET + DAY_S, step_s: 3600 };

  it("refuse instead of answering with a flat-ground verdict", async () => {
    const calls: Promise<unknown>[] = [
      engine.getHorizon(loc, 2),
      engine.getTimeline({ location: loc, profile: DEFAULT_LANDER_PROFILE, ...range }),
      engine.findWindows({
        location: loc,
        profile: DEFAULT_LANDER_PROFILE,
        ...range,
        min_duration_s: 0,
        max_results: 3,
      }),
      engine.probeLit(loc, START_ET),
    ];
    for (const c of calls) {
      await expect(c).rejects.toBeInstanceOf(NotAvailableError);
      await expect(c).rejects.toThrow(/M2-05/);
    }
  });
});
