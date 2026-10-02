import { describe, expect, it } from "vitest";
import { etToUtcIso, utcIsoToEt } from "../src";
import { GOLDEN_DIR, readJson } from "../test/helpers";

// Tolerance fixed before the first run: one microsecond. SPICE and the engine use the same LSK
// formula, so any larger gap is a bug, not rounding.
const ET_TOL_S = 1e-6;

interface TimeCase {
  utc: string;
  et: number;
  utc_from_et: string;
}
const golden = readJson(new URL("time.json", GOLDEN_DIR)) as {
  cases: TimeCase[];
  kernels: string[];
};

describe("time parity with SPICE (fixtures/golden/time.json)", () => {
  it("uses the leap-second kernel", () => {
    expect(golden.kernels).toContain("naif0012.tls");
    expect(golden.cases.length).toBeGreaterThanOrEqual(10);
  });

  for (const c of golden.cases) {
    it(`UTC ${c.utc} -> ET`, () => {
      expect(Math.abs(utcIsoToEt(c.utc) - c.et)).toBeLessThan(ET_TOL_S);
    });
    it(`ET ${c.et} -> UTC ${c.utc_from_et}`, () => {
      expect(etToUtcIso(c.et)).toBe(c.utc_from_et);
    });
  }
});
