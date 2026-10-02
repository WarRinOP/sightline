import { describe, expect, it } from "vitest";
import { Ephemeris, parseEphemerisMeta } from "../src";

const STEP = 100;
const RECORDS = 6;
// Position of each (body, axis) is a cubic in t, so cubic Hermite must reproduce it exactly.
const coeffs = (body: number, axis: number): [number, number, number, number] => [
  1000 * (body + 1) + 10 * axis,
  3 + body - axis,
  -0.002 * (axis + 1),
  1e-6 * (body + 2),
];
const pos = (c: number[], t: number) => c[0]! + c[1]! * t + c[2]! * t * t + c[3]! * t * t * t;
const vel = (c: number[], t: number) => c[1]! + 2 * c[2]! * t + 3 * c[3]! * t * t;

function cubicFile(): { eph: Ephemeris; bodies: string[] } {
  const bodies = ["SUN", "EARTH", "DSN_GOLDSTONE", "DSN_CANBERRA"];
  const data: number[] = [];
  for (let r = 0; r < RECORDS; r++) {
    for (let b = 0; b < bodies.length; b++) {
      const t = r * STEP;
      for (let a = 0; a < 3; a++) data.push(pos(coeffs(b, a), t));
      for (let a = 0; a < 3; a++) data.push(vel(coeffs(b, a), t));
    }
  }
  const meta = parseEphemerisMeta({
    schema_version: 1,
    frame: "MOON_ME",
    aberration_correction: "LT+S",
    start_et: 0,
    end_et: (RECORDS - 1) * STEP,
    step_s: STEP,
    record_count: RECORDS,
    bodies,
    spice_kernels: [],
    simulated: true,
    provenance: {
      source: "SYNTHETIC_TEST",
      simulated: true,
      data_sources: [],
      spice_kernels: [],
      dem_citation: null,
      pipeline_version: null,
      data_version: null,
    },
    sun_radius_km: 695_700,
    moon_radius_km: 1737.4,
    layout: { dtype: "float64", endianness: "little", values_per_body: 6 },
  });
  return { eph: new Ephemeris(meta, new Float64Array(data).buffer), bodies };
}

describe("Ephemeris", () => {
  it("reproduces a cubic exactly between records and at the nodes", () => {
    const { eph, bodies } = cubicFile();
    for (const t of [0, 17.3, 100, 150.5, 333.333, 499.999, 500]) {
      for (let b = 0; b < bodies.length; b++) {
        const p = eph.position(b, t);
        for (let a = 0; a < 3; a++) {
          const want = pos(coeffs(b, a), t);
          expect(Math.abs(p[a]! - want)).toBeLessThan(1e-9 * Math.max(1, Math.abs(want)));
        }
      }
    }
  });

  it("returns the Sun, the Earth and the stations in file order", () => {
    const { eph } = cubicFile();
    const at = eph.at(250);
    expect(at.sun).toEqual(eph.position(0, 250));
    expect(at.earth).toEqual(eph.position(1, 250));
    expect(at.stations).toHaveLength(2);
    expect(at.stations[1]).toEqual(eph.position(3, 250));
  });

  it("refuses an ET outside the file", () => {
    const { eph } = cubicFile();
    expect(eph.covers(-0.001)).toBe(false);
    expect(() => eph.position(0, -0.001)).toThrow(RangeError);
    expect(() => eph.position(0, 500.001)).toThrow(RangeError);
  });

  it("refuses a file of the wrong size", () => {
    const { eph } = cubicFile();
    expect(() => new Ephemeris(eph.meta, new ArrayBuffer(100))).toThrow(RangeError);
  });
});

describe("parseEphemerisMeta", () => {
  const base = {
    schema_version: 1,
    frame: "MOON_ME",
    aberration_correction: "LT+S",
    start_et: 0,
    end_et: 200,
    step_s: 100,
    record_count: 3,
    bodies: ["SUN", "EARTH"],
    spice_kernels: [],
    simulated: true,
    provenance: {
      source: "SYNTHETIC_TEST",
      simulated: true,
      data_sources: [],
      spice_kernels: [],
      dem_citation: null,
      pipeline_version: null,
      data_version: null,
    },
    sun_radius_km: 695_700,
    moon_radius_km: 1737.4,
    layout: { dtype: "float64", endianness: "little", values_per_body: 6 },
  };

  it("accepts a good header", () => {
    expect(parseEphemerisMeta(base).header.record_count).toBe(3);
  });

  it("rejects a layout the reader cannot read", () => {
    expect(() =>
      parseEphemerisMeta({ ...base, layout: { ...base.layout, dtype: "float32" } }),
    ).toThrow(TypeError);
    expect(() => parseEphemerisMeta({ ...base, layout: undefined })).toThrow(TypeError);
  });

  it("rejects wrong body order, a missing radius and a contract violation", () => {
    expect(() => parseEphemerisMeta({ ...base, bodies: ["EARTH", "SUN"] })).toThrow(TypeError);
    expect(() => parseEphemerisMeta({ ...base, sun_radius_km: undefined })).toThrow(TypeError);
    expect(() => parseEphemerisMeta({ ...base, frame: "MOON_PA" })).toThrow();
    expect(() => parseEphemerisMeta({ ...base, record_count: 9 })).toThrow();
  });
});
