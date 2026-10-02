import { describe, it, expect } from "vitest";
import { locationToScenePosition } from "../src/math";

describe("locationToScenePosition", () => {
  it("converts lat/lon to scene coordinates using reference radius", () => {
    // Equator, prime meridian
    const [x1, y1, z1] = locationToScenePosition(0, 0, 0);
    expect(x1).toBeCloseTo(1737400);
    expect(y1).toBeCloseTo(0);
    expect(z1).toBeCloseTo(0);

    // North pole
    const [x2, y2, z2] = locationToScenePosition(Math.PI / 2, 0, 100);
    expect(x2).toBeCloseTo(0);
    expect(y2).toBeCloseTo(1737500);
    expect(z2).toBeCloseTo(0);
  });
});
