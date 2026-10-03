import { describe, expect, it } from "vitest";
import { angleText, barkerRows, directionRows, sciText } from "../lib/evidence";
import { HORIZONS_RESIDUALS, ILLUMINATION_BENCHMARK } from "../lib/evidence-data";

describe("angleText", () => {
  it("chooses a unit a reader can picture", () => {
    expect(angleText(3.257e-8)).toBe("0.117 milliarcsec");
    expect(angleText(2.648e-5)).toMatch(/^95\.3 milliarcsec$/);
    expect(angleText(0.004)).toMatch(/arcsec$/);
    expect(angleText(0.02)).toBe("0.0200°");
  });
  it("writes powers of ten with a real minus sign", () => {
    expect(sciText(2.65e-5)).toBe("2.65e−5");
    expect(sciText(3e5)).toBe("3.00e5");
  });
});

describe("the Evidence tables come from the committed files", () => {
  it("shows the Sun and Earth gaps and how far inside the limit they are", () => {
    const [sun, earth] = directionRows(HORIZONS_RESIDUALS);
    expect(sun?.body).toBe("Sun");
    expect(earth?.body).toBe("Earth");
    // the files say 3.3e-8 and 2.65e-5 degrees against a 0.02 degree limit (METHODS 5.1, D-026)
    expect(sun!.max_deg).toBeLessThan(1e-7);
    expect(earth!.max_deg).toBeGreaterThan(2e-5);
    expect(earth!.max_deg).toBeLessThan(3e-5);
    expect(Math.round(earth!.margin)).toBe(755);
    expect(HORIZONS_RESIDUALS.passes).toBe(true);
  });

  it("lists the seven Barker regions with ours at least the paper's 1st percentile", () => {
    const rows = barkerRows(ILLUMINATION_BENCHMARK);
    expect(rows).toHaveLength(7);
    for (const r of rows) {
      expect(r.ours_1m).toBeGreaterThanOrEqual(r.paper_a_1m - 2.0); // criterion A1, D-025
      expect(r.ours_1m).toBeLessThanOrEqual(r.paper_c_1m + 5.0); // criterion A2
    }
  });

  it("reports the rank correlation the benchmark file holds", () => {
    expect(ILLUMINATION_BENCHMARK.avgvisib.all_tiles.spearman_2m).toBeCloseTo(0.95, 2);
    expect(Object.keys(ILLUMINATION_BENCHMARK.avgvisib.tiles)).toHaveLength(3);
  });

  it("refuses a benchmark row with a missing field instead of showing a blank", () => {
    const broken = structuredClone(ILLUMINATION_BENCHMARK);
    delete broken.barker_table2.rows[0]!["paper_dz1_A"];
    expect(() => barkerRows(broken)).toThrow(/paper_dz1_A/);
  });
});
