import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANDER_PROFILE,
  TimelineResponseSchema,
  siteLocation,
  type EngineClient,
  type LanderProfile,
  type Location,
  type StepState,
} from "@sightline/contracts";
import {
  BUNDLED_EPHEMERIS_META,
  BUNDLED_SITES,
  NotAvailableError,
  createSightlineEngineClient,
  isLit,
  summarizeSteps,
} from "../src";
import { BUNDLED_BIN, readArrayBuffer } from "./helpers";

const engine: EngineClient = createSightlineEngineClient(readArrayBuffer(BUNDLED_BIN));
const { start_et: START_ET, end_et: END_ET } = BUNDLED_EPHEMERIS_META.header;
const HOUR = 3600;
const YEAR = { start_et: START_ET, end_et: END_ET, step_s: HOUR };
const sites = BUNDLED_SITES.map((site) => ({ site, loc: siteLocation(site) }));

/** A step list from a string: `L` lit, `.` unlit, one step each, epochs 0, 10, 20, ... */
function stepsOf(pattern: string, link = ""): StepState[] {
  return [...pattern].map((c, i) => ({
    epoch_et: i * 10,
    sun_disk_fraction: c === "L" ? 1 : 0,
    lit: c === "L",
    earth_visible: link[i] === "x",
    dsn_visible: link[i] === "x",
    kind: "dark",
  }));
}

describe("summarizeSteps (hand-made runs)", () => {
  it("finds the longest night and day, with their start epochs and the battery count", () => {
    //            0123456789...
    const steps = stepsOf("..LLL....LL.LLLL");
    const s = summarizeSteps(steps, 10, 25); // a 25 s battery: nights of 3 steps (30 s) break it
    expect(s.step_count).toBe(16);
    expect(s.illuminated_ratio).toBeCloseTo(9 / 16, 12);
    expect(s.longest_night_s).toBe(40); // the 4-step night starting at step 5
    expect(s.longest_night_start_et).toBe(50);
    expect(s.longest_day_s).toBe(40); // the last 4 steps, cut off by the end of the range
    expect(s.longest_day_start_et).toBe(120);
    expect(s.nights_over_battery).toBe(1); // only the 40 s night exceeds 25 s; 20 s and 10 s do not
  });

  it("counts a night that the range cuts off, and a range with no day or no night", () => {
    expect(summarizeSteps(stepsOf("LL..."), 10, 0).longest_night_s).toBe(30);
    const allDark = summarizeSteps(stepsOf("...."), 10, 0);
    expect([allDark.longest_day_s, allDark.longest_day_start_et]).toEqual([0, null]);
    expect(allDark.longest_night_s).toBe(40);
    const allLit = summarizeSteps(stepsOf("LLL"), 10, 0);
    expect([allLit.longest_night_s, allLit.longest_night_start_et]).toEqual([0, null]);
    expect(allLit.nights_over_battery).toBe(0);
  });

  it("counts steps with a link and with sun and link together", () => {
    const s = summarizeSteps(stepsOf("LL..L", "x.x.x"), 10, 0);
    expect(s.comms_ratio).toBeCloseTo(3 / 5, 12);
    expect(s.both_ratio).toBeCloseTo(2 / 5, 12);
  });
});

describe.each(sites)("getTimeline at $site.id over 2026", ({ loc }) => {
  const request = { location: loc, profile: DEFAULT_LANDER_PROFILE, ...YEAR };

  it("returns a valid, real timeline that cites the ephemeris and both DEMs", async () => {
    const t = await engine.getTimeline(request);
    expect(TimelineResponseSchema.safeParse(t).success).toBe(true);
    expect(t.simulated).toBe(false);
    expect(t.steps).toHaveLength(Math.floor((END_ET - START_ET) / HOUR) + 1);
    expect(t.statistics.step_count).toBe(t.steps.length);
    expect(t.provenance.data_sources).toContain("naif-spk-de440s");
    expect(t.provenance.data_sources).toContain("pgda90-ldem-80s-80m");
    expect(t.provenance.spice_kernels).toContain("de440s.bsp");
    expect(t.provenance.dem_citation).toContain("Barker");
    expect(t.steps[0]!.epoch_et).toBe(START_ET);
  });

  it("agrees with getSunEarth at every 50th step: the same lit, link and disk fraction", async () => {
    const t = await engine.getTimeline(request);
    const p = DEFAULT_LANDER_PROFILE;
    for (const step of t.steps.filter((_, i) => i % 50 === 0)) {
      const s = await engine.getSunEarth(step.epoch_et, loc, p.mast_height_m);
      expect(step.sun_disk_fraction).toBe(s.sun_disk_fraction);
      expect(step.dsn_visible).toBe(s.dsn_visible);
      expect(step.earth_visible).toBe(s.earth_visible);
      expect(step.lit).toBe(isLit(p, s.sun_elevation_rad, s.sun_disk_fraction));
      const kind = step.lit
        ? step.dsn_visible
          ? "both"
          : "sun"
        : step.dsn_visible
          ? "earth"
          : "dark";
      expect(step.kind).toBe(kind);
    }
  });

  it("has statistics that match a second count of the steps", async () => {
    const { steps, statistics: s } = await engine.getTimeline(request);
    const n = steps.length;
    expect(s.illuminated_ratio).toBeCloseTo(steps.filter((x) => x.lit).length / n, 12);
    expect(s.comms_ratio).toBeCloseTo(steps.filter((x) => x.dsn_visible).length / n, 12);
    expect(s.both_ratio).toBeCloseTo(steps.filter((x) => x.lit && x.dsn_visible).length / n, 12);
    expect(s.both_ratio).toBeLessThanOrEqual(Math.min(s.illuminated_ratio, s.comms_ratio));
    // Longest run, counted independently with a regular expression over a string of steps.
    const text = steps.map((x) => (x.lit ? "L" : ".")).join("");
    const longest = (re: RegExp) => Math.max(0, ...(text.match(re) ?? []).map((m) => m.length));
    expect(s.longest_night_s).toBe(longest(/\.+/g) * HOUR);
    expect(s.longest_day_s).toBe(longest(/L+/g) * HOUR);
    const at = (idx: number) => steps[idx]!.epoch_et;
    if (s.longest_night_s > 0) {
      const idx = (s.longest_night_start_et! - START_ET) / HOUR;
      expect(at(idx)).toBe(s.longest_night_start_et);
      expect(text.slice(idx, idx + s.longest_night_s / HOUR)).toBe(
        ".".repeat(s.longest_night_s / HOUR),
      );
    }
  });

  it("is a real mix of light and dark over a year", async () => {
    const { statistics: s } = await engine.getTimeline(request);
    expect(s.illuminated_ratio).toBeGreaterThan(0.05);
    expect(s.illuminated_ratio).toBeLessThan(0.95);
    expect(s.longest_night_s).toBeGreaterThan(0);
    expect(s.longest_day_s).toBeGreaterThan(0);
  });

  it("matches probeLit when the profile asks only for 'any part of the disk'", async () => {
    // probeLit's lit means any sliver above the mask; the default profile also wants the Sun's
    // centre above the horizontal. Relaxing that, the two must agree step for step.
    const anySliver: LanderProfile = { ...DEFAULT_LANDER_PROFILE, min_sun_elev_rad: -Math.PI / 2 };
    const t = await engine.getTimeline({ ...request, profile: anySliver });
    for (const step of t.steps.filter((_, i) => i % 37 === 0)) {
      const probe = await engine.probeLit(loc, step.epoch_et, anySliver.mast_height_m);
      expect(step.lit).toBe(probe.lit);
    }
  });

  it("only loses light when the profile gets stricter", async () => {
    const lit = async (p: Partial<LanderProfile>) =>
      (await engine.getTimeline({ ...request, profile: { ...DEFAULT_LANDER_PROFILE, ...p } }))
        .statistics.illuminated_ratio;
    const base = await lit({});
    expect(await lit({ min_sun_disk_fraction: 0.5 })).toBeLessThanOrEqual(base);
    expect(await lit({ min_sun_disk_fraction: 1 })).toBeLessThanOrEqual(base);
    expect(await lit({ min_sun_elev_rad: 0.5 * (Math.PI / 180) })).toBeLessThanOrEqual(base);
    expect(await lit({ min_sun_elev_rad: -Math.PI / 2 })).toBeGreaterThanOrEqual(base);
  });

  it("counts nights longer than the battery", async () => {
    const stats = async (battery_capacity_s: number) =>
      (
        await engine.getTimeline({
          ...request,
          profile: { ...DEFAULT_LANDER_PROFILE, battery_capacity_s },
        })
      ).statistics;
    const none = await stats(0);
    const many = await stats(Number.MAX_SAFE_INTEGER);
    expect(many.nights_over_battery).toBe(0);
    expect(none.nights_over_battery).toBeGreaterThan(0);
    // A battery that is just shorter than the longest night breaks at least that one.
    const longest = none.longest_night_s;
    expect((await stats(longest - 1)).nights_over_battery).toBeGreaterThanOrEqual(1);
    expect((await stats(longest)).nights_over_battery).toBe(0);
  });
});

describe("getTimeline requests", () => {
  const loc = sites[0]!.loc;

  it("refuses a place without a terrain horizon", async () => {
    const nowhere: Location = { ...loc, lat_rad: loc.lat_rad + 1e-3 };
    await expect(
      engine.getTimeline({ location: nowhere, profile: DEFAULT_LANDER_PROFILE, ...YEAR }),
    ).rejects.toBeInstanceOf(NotAvailableError);
  });

  it("rejects an invalid request and an epoch outside the ephemeris", async () => {
    const base = { location: loc, profile: DEFAULT_LANDER_PROFILE, ...YEAR };
    await expect(engine.getTimeline({ ...base, end_et: START_ET })).rejects.toThrow();
    await expect(engine.getTimeline({ ...base, step_s: 0 })).rejects.toThrow();
    await expect(
      engine.getTimeline({ ...base, profile: { ...DEFAULT_LANDER_PROFILE, mast_height_m: 25 } }),
    ).rejects.toThrow();
    await expect(engine.getTimeline({ ...base, end_et: END_ET + 10 * HOUR })).rejects.toThrow(
      RangeError,
    );
  });

  it("covers a one-day request with hourly steps, inclusive of both ends", async () => {
    const t = await engine.getTimeline({
      location: loc,
      profile: DEFAULT_LANDER_PROFILE,
      start_et: START_ET,
      end_et: START_ET + 24 * HOUR,
      step_s: HOUR,
    });
    expect(t.steps).toHaveLength(25);
    expect(t.steps.at(-1)!.epoch_et).toBe(START_ET + 24 * HOUR);
  });
});
