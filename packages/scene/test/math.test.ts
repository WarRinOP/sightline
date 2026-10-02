import { describe, it, expect } from "vitest";
import { locationToScenePosition, getLocalDirectionInScene } from "../src/math";
import * as THREE from "three";

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

describe("getLocalDirectionInScene", () => {
  it("for az = 0 and el = 0, gives a direction with dot(dir, siteUp) = 0", () => {
    const lat = -89 * (Math.PI / 180);
    const lon = 0;
    const dir = getLocalDirectionInScene(lat, lon, 0, 0);
    const siteUp = new THREE.Vector3(0, 1, 0); // In stereographic scene, up is +y
    expect(Math.abs(dir.dot(siteUp))).toBeLessThan(1e-6);
  });

  it("for az = 0, the ring point's horizontal direction equals local north in scene coordinates", () => {
    const lat = -89 * (Math.PI / 180);
    const lon = 0;
    const dir = getLocalDirectionInScene(lat, lon, 0, 0);

    // In our scene, south pole local North points toward the equator along the meridian.
    // For lon = 0, North points along the +Y axis of the stereographic projection, which is -Z in scene space.
    // Wait, let's just check it matches a known calculation for local North.
    // At lon = 0, the local North vector in scene (assuming flat stereographic plane for x,z) is (0, 0, -1)
    expect(dir.x).toBeCloseTo(0);
    expect(dir.y).toBeCloseTo(0);
    expect(dir.z).toBeCloseTo(-1);
  });
});
