import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANDER_PROFILE,
  HORIZON_AZIMUTH_SAMPLES,
  HorizonMaskSchema,
  ProbeLitResultSchema,
  ProvenanceRecordSchema,
  SiteSchema,
  SunEarthStateSchema,
  TimelineRequestSchema,
  TimelineResponseSchema,
  WindowSearchResponseSchema,
  siteLocation,
  type EngineClient,
  type StepState,
} from "@sightline/contracts";
import {
  MOCK_EPOCH_ET,
  MOCK_PROVENANCE,
  MOCK_SITES,
  SYNTHETIC_SOURCE,
  createMockEngineClient,
  summarizeSteps,
} from "../src";
import {
  AXIAL_TILT_RAD,
  EARTH_LIBRATION_LAT_AMPLITUDE_RAD,
  EARTH_LIBRATION_PERIOD_S,
  SUBSOLAR_LATITUDE_PERIOD_S,
  SUN_ANGULAR_RADIUS_RAD,
} from "../src/mock/constants";
import { maskElevationAt } from "../src/mock/mockEngine";
import { mockEarth, mockSun, solarDiskFraction } from "../src/mock/mockSky";
import { mockHorizonElevationRad } from "../src/mock/mockTerrain";

const engine: EngineClient = createMockEngineClient();
const DAY_S = 86_400;
const rimSite = MOCK_SITES[0]!;
const rimLocation = siteLocation(rimSite);
const POLE = { lat_rad: -Math.PI / 2, lon_rad: 0 };

describe("provenance and the SIMULATED flag", () => {
  it("is a valid, simulated, synthetic provenance record", () => {
    expect(ProvenanceRecordSchema.safeParse(engine.provenance).success).toBe(true);
    expect(engine.provenance.simulated).toBe(true);
    expect(engine.provenance.source).toBe(SYNTHETIC_SOURCE);
    expect(engine.provenance).toEqual(MOCK_PROVENANCE);
  });

  it("flags every response as simulated", async () => {
    const [sites, horizon, sunEarth, probe] = await Promise.all([
      engine.listSites(),
      engine.getHorizon(rimLocation, 2),
      engine.getSunEarth(MOCK_EPOCH_ET, rimLocation),
      engine.probeLit(rimLocation, MOCK_EPOCH_ET),
    ]);
    const timeline = await engine.getTimeline({
      location: rimLocation,
      profile: DEFAULT_LANDER_PROFILE,
      start_et: MOCK_EPOCH_ET,
      end_et: MOCK_EPOCH_ET + DAY_S,
      step_s: 3600,
    });
    const windows = await engine.findWindows({
      location: rimLocation,
      profile: DEFAULT_LANDER_PROFILE,
      start_et: MOCK_EPOCH_ET,
      end_et: MOCK_EPOCH_ET + DAY_S,
      step_s: 3600,
      min_duration_s: 0,
      max_results: 5,
    });
    expect(sites.every((s) => s.simulated)).toBe(true);
    for (const r of [horizon, sunEarth, probe, timeline, windows]) {
      expect(r.simulated).toBe(true);
    }
    expect(horizon.provenance.simulated).toBe(true);
    expect(timeline.provenance.simulated).toBe(true);
    expect(windows.provenance.simulated).toBe(true);
  });
});

describe("listSites", () => {
  it("returns the three preset sites, valid against the contract", async () => {
    const sites = await engine.listSites();
    expect(sites.map((s) => s.id)).toEqual([
      "shackleton-rim",
      "connecting-ridge",
      "de-gerlache-rim-2",
    ]);
    for (const s of sites) {
      expect(SiteSchema.safeParse(s).success).toBe(true);
      expect(s.source_url).toBeNull();
      expect(s.lat_deg).toBeLessThan(-89);
    }
  });

  it("returns copies, so callers cannot change the catalog", async () => {
    const [first] = await engine.listSites();
    first!.name = "changed";
    const [again] = await engine.listSites();
    expect(again!.name).toBe("Shackleton Rim");
  });
});

describe("getHorizon", () => {
  it("returns a full-circle mask that satisfies the contract", async () => {
    const mask = await engine.getHorizon(rimLocation, 2);
    expect(HorizonMaskSchema.safeParse(mask).success).toBe(true);
    expect(mask.mask_elevation_rad).toHaveLength(HORIZON_AZIMUTH_SAMPLES);
    expect(mask.mast_height_m).toBe(2);
  });

  it("matches the analytic bowl wall seen from the pole", () => {
    // From the centre of the 6 km, 2 km-deep bowl the wall peaks near the rim at
    // atan((depth + rim height) / radius) = atan(2200 / 6000) ≈ 20.1°, in every direction.
    const expected = Math.atan(2200 / 6000);
    for (let k = 0; k < 8; k++) {
      const h = mockHorizonElevationRad(POLE, 0, (k * Math.PI) / 4);
      expect(Math.abs(h - expected)).toBeLessThan((0.3 * Math.PI) / 180);
    }
  });

  it("never raises the horizon when the mast gets taller", async () => {
    const low = await engine.getHorizon(rimLocation, 0);
    const high = await engine.getHorizon(rimLocation, 10);
    low.mask_elevation_rad.forEach((h, i) => {
      expect(high.mask_elevation_rad[i]!).toBeLessThanOrEqual(h + 1e-12);
    });
  });

  it("is deterministic", async () => {
    const a = await engine.getHorizon(rimLocation, 2);
    const b = await createMockEngineClient().getHorizon(rimLocation, 2);
    expect(b.mask_elevation_rad).toEqual(a.mask_elevation_rad);
  });

  it("interpolates the mask between samples and wraps at north", () => {
    const mask = [0, 0.2, 0.4, 0.2];
    expect(maskElevationAt(mask, 0)).toBeCloseTo(0, 12);
    expect(maskElevationAt(mask, Math.PI / 4)).toBeCloseTo(0.1, 12);
    expect(maskElevationAt(mask, (7 * Math.PI) / 4)).toBeCloseTo(0.1, 12);
  });
});

describe("mock Sun and Earth", () => {
  it("puts the Sun at minus the sub-solar latitude when seen from the pole", () => {
    const q = SUBSOLAR_LATITUDE_PERIOD_S / 4;
    expect(mockSun(q, POLE).elevation_rad).toBeCloseTo(-AXIAL_TILT_RAD, 12);
    expect(mockSun(3 * q, POLE).elevation_rad).toBeCloseTo(AXIAL_TILT_RAD, 12);
    expect(mockSun(0, POLE).elevation_rad).toBeCloseTo(0, 12);
  });

  it("puts Earth at minus the sub-Earth latitude when seen from the pole", () => {
    const q = EARTH_LIBRATION_PERIOD_S / 4;
    expect(mockEarth(q, POLE).elevation_rad).toBeCloseTo(-EARTH_LIBRATION_LAT_AMPLITUDE_RAD, 12);
    expect(mockEarth(3 * q, POLE).elevation_rad).toBeCloseTo(EARTH_LIBRATION_LAT_AMPLITUDE_RAD, 12);
  });

  it("keeps azimuth in [0, 2π) over a year", () => {
    for (let t = 0; t < 365 * DAY_S; t += 7 * 3600) {
      for (const body of [mockSun(t, rimLocation), mockEarth(t, rimLocation)]) {
        expect(body.azimuth_rad).toBeGreaterThanOrEqual(0);
        expect(body.azimuth_rad).toBeLessThan(2 * Math.PI);
      }
    }
  });

  it("computes the lit fraction of the solar disk above a straight horizon", () => {
    const r = SUN_ANGULAR_RADIUS_RAD;
    expect(solarDiskFraction(0.1, 0.1)).toBeCloseTo(0.5, 12);
    expect(solarDiskFraction(0.1 + r, 0.1)).toBeCloseTo(1, 12);
    expect(solarDiskFraction(0.1 - r, 0.1)).toBeCloseTo(0, 12);
    expect(solarDiskFraction(1, 0)).toBe(1);
    expect(solarDiskFraction(-1, 0)).toBe(0);
    // Half the radius above the line: 1/2 + (0.5·√0.75 + asin 0.5)/π.
    expect(solarDiskFraction(r / 2, 0)).toBeCloseTo(
      0.5 + (0.5 * Math.sqrt(0.75) + Math.PI / 6) / Math.PI,
      12,
    );
    // Symmetric about the half-lit point.
    expect(solarDiskFraction(0.3 * r, 0) + solarDiskFraction(-0.3 * r, 0)).toBeCloseTo(1, 12);
  });
});

describe("getSunEarth and probeLit", () => {
  it("returns a state that satisfies the contract at many epochs", async () => {
    for (let k = 0; k < 60; k++) {
      const s = await engine.getSunEarth(MOCK_EPOCH_ET + k * 5 * DAY_S, rimLocation, 2);
      expect(SunEarthStateSchema.safeParse(s).success).toBe(true);
    }
  });

  it("only reports a DSN link while Earth is visible", async () => {
    let linked = 0;
    for (let k = 0; k < 400; k++) {
      const s = await engine.getSunEarth(MOCK_EPOCH_ET + k * 3 * 3600, rimLocation, 2);
      if (s.dsn_visible) {
        linked += 1;
        expect(s.earth_visible).toBe(true);
      }
    }
    expect(linked).toBeGreaterThan(0);
  });

  it("agrees with getSunEarth about whether the Sun is up", async () => {
    for (let k = 0; k < 100; k++) {
      const t = MOCK_EPOCH_ET + k * 40_000;
      const s = await engine.getSunEarth(t, rimLocation, 0);
      const p = await engine.probeLit(rimLocation, t);
      expect(ProbeLitResultSchema.safeParse(p).success).toBe(true);
      expect(p.sun_disk_fraction).toBe(s.sun_disk_fraction);
      expect(p.lit).toBe(s.sun_disk_fraction > 0);
    }
  });
});

describe("summarizeSteps", () => {
  const step = (i: number, lit: boolean, dsn: boolean): StepState => ({
    epoch_et: i * 100,
    sun_disk_fraction: lit ? 1 : 0,
    lit,
    earth_visible: dsn,
    dsn_visible: dsn,
    kind: lit ? (dsn ? "both" : "sun") : dsn ? "earth" : "dark",
  });
  // L = lit, d = dark; the link flag is set on steps 0, 3 and 4.
  const steps = [
    step(0, true, true),
    step(1, false, false),
    step(2, false, false),
    step(3, true, true),
    step(4, false, true),
    step(5, false, false),
    step(6, false, false),
    step(7, true, false),
  ];

  it("counts ratios, the longest night and nights over the battery", () => {
    const stats = summarizeSteps(steps, 100, 250);
    expect(stats.step_count).toBe(8);
    expect(stats.illuminated_ratio).toBe(3 / 8);
    expect(stats.comms_ratio).toBe(3 / 8);
    expect(stats.both_ratio).toBe(2 / 8);
    // Nights: steps 1-2 (200 s) and 4-6 (300 s).
    expect(stats.longest_night_s).toBe(300);
    expect(stats.longest_night_start_et).toBe(400);
    expect(stats.nights_over_battery).toBe(1);
  });

  it("counts a night that runs to the end of the series", () => {
    const tail = [step(0, true, false), step(1, false, false), step(2, false, false)];
    const stats = summarizeSteps(tail, 100, 0);
    expect(stats.longest_night_s).toBe(200);
    expect(stats.nights_over_battery).toBe(1);
  });

  it("reports no night when the Sun never sets", () => {
    const stats = summarizeSteps([step(0, true, true), step(1, true, true)], 100, 0);
    expect(stats.longest_night_s).toBe(0);
    expect(stats.longest_night_start_et).toBeNull();
    expect(stats.nights_over_battery).toBe(0);
  });
});

describe("getTimeline", () => {
  const request = {
    location: rimLocation,
    profile: DEFAULT_LANDER_PROFILE,
    start_et: MOCK_EPOCH_ET,
    end_et: MOCK_EPOCH_ET + 120 * DAY_S,
    step_s: 3600,
  };

  it("returns a response that satisfies the contract", async () => {
    const t = await engine.getTimeline(request);
    expect(TimelineResponseSchema.safeParse(t).success).toBe(true);
    expect(t.steps).toHaveLength(120 * 24 + 1);
    expect(t.steps[0]?.epoch_et).toBe(MOCK_EPOCH_ET);
    expect(t.statistics.step_count).toBe(t.steps.length);
  });

  it("derives the step kind from lit and link", async () => {
    const t = await engine.getTimeline(request);
    for (const s of t.steps) {
      const expected = s.lit ? (s.dsn_visible ? "both" : "sun") : s.dsn_visible ? "earth" : "dark";
      expect(s.kind).toBe(expected);
      if (s.dsn_visible) expect(s.earth_visible).toBe(true);
    }
  });

  it("lights fewer steps when the minimum Sun elevation rises", async () => {
    // A full year: the rim site is dark for the first half-year of the mock calendar.
    const year = { ...request, end_et: MOCK_EPOCH_ET + 365 * DAY_S };
    const base = await engine.getTimeline(year);
    const strict = await engine.getTimeline({
      ...year,
      profile: { ...DEFAULT_LANDER_PROFILE, min_sun_elev_rad: 0.01 },
    });
    expect(base.statistics.illuminated_ratio).toBeGreaterThan(0);
    expect(strict.statistics.illuminated_ratio).toBeLessThan(base.statistics.illuminated_ratio);
  });

  it("reports ratios that match the steps", async () => {
    const t = await engine.getTimeline(request);
    const n = t.steps.length;
    expect(t.statistics.illuminated_ratio).toBe(t.steps.filter((s) => s.lit).length / n);
    expect(t.statistics.comms_ratio).toBe(t.steps.filter((s) => s.dsn_visible).length / n);
    expect(t.statistics.both_ratio).toBe(t.steps.filter((s) => s.kind === "both").length / n);
  });

  it("rejects an invalid request", async () => {
    await expect(
      engine.getTimeline({ ...request, end_et: request.start_et - 1 }),
    ).rejects.toThrow();
    await expect(engine.getTimeline({ ...request, step_s: 0 })).rejects.toThrow();
    expect(TimelineRequestSchema.safeParse({ ...request, step_s: 0 }).success).toBe(false);
  });
});

describe("findWindows", () => {
  const request = {
    location: rimLocation,
    profile: DEFAULT_LANDER_PROFILE,
    start_et: MOCK_EPOCH_ET,
    end_et: MOCK_EPOCH_ET + 365 * DAY_S,
    step_s: 3600,
    min_duration_s: 5 * DAY_S,
    max_results: 5,
  };

  it("returns ranked windows that satisfy the contract", async () => {
    const r = await engine.findWindows(request);
    expect(WindowSearchResponseSchema.safeParse(r).success).toBe(true);
    expect(r.windows.length).toBeGreaterThan(0);
    expect(r.windows.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < r.windows.length; i++) {
      expect(r.windows[i - 1]!.score).toBeGreaterThanOrEqual(r.windows[i]!.score);
    }
    for (const w of r.windows) {
      expect(w.duration_s).toBeGreaterThanOrEqual(request.min_duration_s);
      expect(w.start_et).toBeGreaterThanOrEqual(request.start_et);
    }
  });

  it("only reports windows where every step is sunlit", async () => {
    const [r, t] = await Promise.all([
      engine.findWindows(request),
      engine.getTimeline({ ...request }),
    ]);
    for (const w of r.windows) {
      const inside = t.steps.filter((s) => s.epoch_et >= w.start_et && s.epoch_et < w.end_et);
      expect(inside.length * request.step_s).toBe(w.duration_s);
      expect(inside.every((s) => s.lit)).toBe(true);
    }
  });

  it("honours max_results and an unreachable minimum duration", async () => {
    const one = await engine.findWindows({ ...request, max_results: 1, min_duration_s: 0 });
    expect(one.windows).toHaveLength(1);
    const none = await engine.findWindows({ ...request, min_duration_s: 400 * DAY_S });
    expect(none.windows).toHaveLength(0);
  });
});
