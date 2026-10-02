import { describe, it, expect } from "vitest";
import { locationToScenePosition, getLocalDirectionInScene, horizonRingPoints } from "../src/math";
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

describe("horizonRingPoints", () => {
  const lat = (-89.780403 * Math.PI) / 180;
  const lon = (203.803049 * Math.PI) / 180;
  const step = (0.25 * Math.PI) / 180;
  const flat = new Array<number>(1440).fill(0);

  it("starts at local north and closes the loop", () => {
    const pts = horizonRingPoints(flat, step, lat, lon, 400);
    expect(pts).toHaveLength(1441);
    const north = getLocalDirectionInScene(lat, lon, 0, 0).multiplyScalar(400);
    expect(pts[0]!.distanceTo(north)).toBeLessThan(1e-9);
    expect(pts[1440]!.distanceTo(pts[0]!)).toBeLessThan(1e-9);
  });

  it("puts azimuth 90 degrees at local east: the same direction the Sun would be drawn in", () => {
    const pts = horizonRingPoints(flat, step, lat, lon, 400);
    const sun = getLocalDirectionInScene(lat, lon, Math.PI / 2, 0).multiplyScalar(400);
    expect(pts[360]!.distanceTo(sun)).toBeLessThan(1e-9);
    // at Shackleton's longitude north is not scene -z (that holds only at longitude 180 degrees)
    expect(Math.abs(pts[0]!.x)).toBeGreaterThan(100);
  });

  it("raises a point by the mask elevation and keeps its distance", () => {
    const mask = flat.slice();
    mask[100] = 0.1;
    const p = horizonRingPoints(mask, step, lat, lon, 400)[100]!;
    expect(p.length()).toBeCloseTo(400, 6);
    expect(p.y).toBeCloseTo(400 * Math.sin(0.1), 6);
  });
});
