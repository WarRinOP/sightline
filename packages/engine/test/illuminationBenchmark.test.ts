import { describe, expect, it } from "vitest";
import { DEFAULT_LANDER_PROFILE, siteLocation } from "@sightline/contracts";
import { BUNDLED_SITES, createSightlineEngineClient } from "../src";
import { BUNDLED_BIN, GOLDEN_DIR, readArrayBuffer, readJson } from "./helpers";

// fixtures/golden/illumination_benchmark.json is written by `sightline benchmark` (S1-05e). Its
// "engine_cross_check" holds, for the three catalog sites, the mean visible fraction of the Sun's
// disk and the any-part-of-the-disk lit fraction over the engine's own epochs at a 2 m mast, found
// by the Python path the benchmark used (SPICE Sun, the pipeline's horizon masks, the same
// visible-fraction rule). The engine must reproduce them: that is what ties the benchmark against
// Barker et al. (2021) and the AVGVISIB map to the code that serves the app.
interface Check {
  first_et: number;
  steps: number;
  mast_m: number;
  [site: string]: number | { mean_disk_pct: number; lit_pct: number };
}
const bench = readJson(new URL("illumination_benchmark.json", GOLDEN_DIR)) as {
  engine_cross_check: Check;
};
const check = bench.engine_cross_check;
const engine = createSightlineEngineClient(readArrayBuffer(BUNDLED_BIN));

describe("engine against the benchmark's Python path (2026, hourly, 2 m mast)", () => {
  it.each(BUNDLED_SITES.map((s) => s.id))("%s", async (id) => {
    const want = check[id] as { mean_disk_pct: number; lit_pct: number };
    const site = BUNDLED_SITES.find((s) => s.id === id)!;
    const t = await engine.getTimeline({
      location: siteLocation(site),
      // Any part of the disk counts, as in the benchmark: no minimum Sun elevation.
      profile: {
        ...DEFAULT_LANDER_PROFILE,
        mast_height_m: check.mast_m,
        min_sun_elev_rad: -Math.PI / 2,
      },
      start_et: check.first_et,
      end_et: check.first_et + (check.steps - 1) * 3600,
      step_s: 3600,
    });
    expect(t.steps).toHaveLength(check.steps);
    const mean = (t.steps.reduce((a, s) => a + s.sun_disk_fraction, 0) / t.steps.length) * 100;
    const lit = t.statistics.illuminated_ratio * 100;
    // Within about one step in a thousand: the stored masks are rounded to 1e-7 rad, so a step
    // exactly on the edge of the horizon can fall either side.
    expect(Math.abs(mean - want.mean_disk_pct)).toBeLessThan(0.02);
    expect(Math.abs(lit - want.lit_pct)).toBeLessThan(0.05);
  });
});
