import { describe, expect, it } from "vitest";
import type { StepState } from "@sightline/contracts";
import { barcodeColumns, epochAtRatio } from "../lib/barcode";

const step = (i: number, lit: boolean, dsn: boolean): StepState => ({
  epoch_et: i * 3600,
  sun_disk_fraction: lit ? 1 : 0,
  lit,
  earth_visible: dsn,
  dsn_visible: dsn,
  kind: lit && dsn ? "both" : lit ? "sun" : dsn ? "earth" : "dark",
});

describe("barcodeColumns", () => {
  it("averages the steps under each column and keeps sun, link and both apart", () => {
    // 8 steps into 4 columns: pairs (lit,link) (lit,-) (-,link) (-,-) per column
    const steps = [
      step(0, true, true),
      step(1, true, true),
      step(2, true, false),
      step(3, false, false),
      step(4, false, true),
      step(5, false, true),
      step(6, false, false),
      step(7, false, false),
    ];
    const c = barcodeColumns(steps, 4);
    expect(Array.from(c.sun)).toEqual([1, 0.5, 0, 0]);
    expect(Array.from(c.link)).toEqual([1, 0, 1, 0]);
    expect(Array.from(c.both)).toEqual([1, 0, 0, 0]);
  });

  it("does not skip a step when the steps do not divide the width", () => {
    const steps = Array.from({ length: 10 }, (_, i) => step(i, i === 9, false));
    const c = barcodeColumns(steps, 3); // columns cover 3, 3 and 4 steps
    expect(c.sun[2]).toBeCloseTo(0.25, 6); // the last step is in the last column
    expect(c.sun[0]).toBe(0);
  });

  it("repeats steps when the timeline is shorter than the width, and survives empty input", () => {
    const c = barcodeColumns([step(0, true, false), step(1, false, false)], 6);
    expect(Array.from(c.sun)).toEqual([1, 1, 1, 0, 0, 0]);
    expect(barcodeColumns([], 5).sun).toHaveLength(5);
    expect(barcodeColumns([step(0, true, true)], 0).sun).toHaveLength(0);
  });
});

describe("epochAtRatio", () => {
  it("snaps to a step inside the range", () => {
    expect(epochAtRatio(1000, 1000 + 10 * 3600, 3600, 0)).toBe(1000);
    expect(epochAtRatio(1000, 1000 + 10 * 3600, 3600, 1)).toBe(1000 + 10 * 3600);
    expect(epochAtRatio(1000, 1000 + 10 * 3600, 3600, 0.52)).toBe(1000 + 5 * 3600);
    expect(epochAtRatio(1000, 1000 + 10 * 3600, 3600, -3)).toBe(1000);
    expect(epochAtRatio(1000, 1000 + 10 * 3600, 3600, 7)).toBe(1000 + 10 * 3600);
  });
});
