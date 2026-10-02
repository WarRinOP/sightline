import { describe, it, expect } from "vitest";
import { locationToScenePosition } from "../src/math";

describe("locationToScenePosition", () => {
  it("converts lat/lon to scene coordinates using polar-stereographic projection", () => {
    // Shackleton crest
    const lat = -89.7804 * (Math.PI / 180);
    const lon = (203.803 - 360) * (Math.PI / 180);
    const [x, y, z] = locationToScenePosition(lat, lon, 100);

    // Scene y should be the elevation
    expect(y).toBe(100);

    // Scene x and -z (which is stereographic y) should match expected coordinates within 1m
    expect(x).toBeGreaterThan(-2689);
    expect(x).toBeLessThan(-2687);

    // Remember z = -stereographic_y
    const stereoY = -z;
    expect(stereoY).toBeGreaterThan(-6094);
    expect(stereoY).toBeLessThan(-6092);
  });
});
