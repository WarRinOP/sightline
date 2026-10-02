import { describe, expect, it } from "vitest";
import {
  MOON_REFERENCE_RADIUS_KM,
  azElFromVector,
  enuBasis,
  geodeticFromMoonFixed,
  moonFixedPosition_km,
  type Vec3,
} from "../src";

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const close = (a: Vec3, b: Vec3, digits = 12) =>
  a.forEach((x, i) => expect(x).toBeCloseTo(b[i]!, digits));

describe("enuBasis", () => {
  it("points up along x, east along y and north along z at 0° N 0° E", () => {
    const b = enuBasis(0, 0);
    close(b.up, [1, 0, 0]);
    close(b.east, [0, 1, 0]);
    close(b.north, [0, 0, 1]);
  });

  it("is orthonormal and right-handed (east × north = up) everywhere, poles included", () => {
    for (const lat of [-Math.PI / 2, -1.5, -0.3, 0, 0.7, Math.PI / 2]) {
      for (const lon of [-3, -1, 0, 0.4, 2.5, Math.PI]) {
        const { up, east, north } = enuBasis(lat, lon);
        expect(dot(up, up)).toBeCloseTo(1, 12);
        expect(dot(east, east)).toBeCloseTo(1, 12);
        expect(dot(north, north)).toBeCloseTo(1, 12);
        expect(dot(up, east)).toBeCloseTo(0, 12);
        expect(dot(up, north)).toBeCloseTo(0, 12);
        expect(dot(east, north)).toBeCloseTo(0, 12);
        close(cross(east, north), up);
      }
    }
  });
});

describe("azElFromVector", () => {
  const lat = -1.2;
  const lon = 2.1;
  const { up, east, north } = enuBasis(lat, lon);
  const neg = (v: Vec3): Vec3 => [-v[0], -v[1], -v[2]];

  it("measures azimuth clockwise from north: N 0, E 90°, S 180°, W 270°", () => {
    expect(azElFromVector(north, lat, lon).azimuth_rad).toBeCloseTo(0, 12);
    expect(azElFromVector(east, lat, lon).azimuth_rad).toBeCloseTo(Math.PI / 2, 12);
    expect(azElFromVector(neg(north), lat, lon).azimuth_rad).toBeCloseTo(Math.PI, 12);
    expect(azElFromVector(neg(east), lat, lon).azimuth_rad).toBeCloseTo((3 * Math.PI) / 2, 12);
  });

  it("keeps azimuth below 2π for a vector a hair west of north", () => {
    // East component of about -1e-16: atan2 gives -1e-16, and a single `% 2π` would round that up
    // to exactly 2π (the Python golden code did, see test_golden.py). The double wrap avoids it.
    const hairWest: Vec3 = [
      north[0] - 1e-16 * east[0],
      north[1] - 1e-16 * east[1],
      north[2] - 1e-16 * east[2],
    ];
    const az = azElFromVector(hairWest, lat, lon).azimuth_rad;
    expect(az).toBeGreaterThanOrEqual(0);
    expect(az).toBeLessThan(2 * Math.PI);
  });

  it("measures elevation above the tangent plane", () => {
    expect(azElFromVector(north, lat, lon).elevation_rad).toBeCloseTo(0, 12);
    expect(azElFromVector(up, lat, lon).elevation_rad).toBeCloseTo(Math.PI / 2, 12);
    expect(azElFromVector(neg(up), lat, lon).elevation_rad).toBeCloseTo(-Math.PI / 2, 12);
    const half: Vec3 = [
      Math.SQRT1_2 * (north[0] + up[0]),
      Math.SQRT1_2 * (north[1] + up[1]),
      Math.SQRT1_2 * (north[2] + up[2]),
    ];
    expect(azElFromVector(half, lat, lon).elevation_rad).toBeCloseTo(Math.PI / 4, 12);
  });

  it("keeps azimuth in [0, 2π) and ignores the vector's length", () => {
    for (let k = 0; k < 360; k++) {
      const a = (k * Math.PI) / 180;
      const v: Vec3 = [
        1e6 * (Math.cos(a) * north[0] + Math.sin(a) * east[0]),
        1e6 * (Math.cos(a) * north[1] + Math.sin(a) * east[1]),
        1e6 * (Math.cos(a) * north[2] + Math.sin(a) * east[2]),
      ];
      const r = azElFromVector(v, lat, lon);
      expect(r.azimuth_rad).toBeGreaterThanOrEqual(0);
      expect(r.azimuth_rad).toBeLessThan(2 * Math.PI);
      expect(r.azimuth_rad).toBeCloseTo(a, 9);
    }
  });

  it("uses the given longitude for grid north at the exact pole", () => {
    // At -90° the local up is -z, and "north" is the horizontal direction along the given meridian.
    const x: Vec3 = [1, 0, 0];
    expect(azElFromVector(x, -Math.PI / 2, 0).azimuth_rad).toBeCloseTo(0, 12);
    expect(azElFromVector(x, -Math.PI / 2, Math.PI / 2).azimuth_rad).toBeCloseTo(
      (3 * Math.PI) / 2,
      12,
    );
    expect(azElFromVector(x, -Math.PI / 2, Math.PI).azimuth_rad).toBeCloseTo(Math.PI, 12);
    expect(azElFromVector(x, -Math.PI / 2, 0).elevation_rad).toBeCloseTo(0, 12);
  });
});

describe("moonFixedPosition_km", () => {
  it("sits on the 1737.4 km sphere plus the height", () => {
    const p = moonFixedPosition_km(-1.3, 0.8, 1500);
    expect(Math.hypot(...p)).toBeCloseTo(MOON_REFERENCE_RADIUS_KM + 1.5, 9);
  });

  it("puts the south pole on -z", () => {
    close(moonFixedPosition_km(-Math.PI / 2, 0, 0), [0, 0, -MOON_REFERENCE_RADIUS_KM]);
  });

  it("round-trips through geodeticFromMoonFixed", () => {
    const g = geodeticFromMoonFixed(moonFixedPosition_km(-1.5, -2.4, 1958.3));
    expect(g.lat_rad).toBeCloseTo(-1.5, 12);
    expect(g.lon_rad).toBeCloseTo(-2.4, 12);
    expect(g.height_m).toBeCloseTo(1958.3, 6);
  });
});
