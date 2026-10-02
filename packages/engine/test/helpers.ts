import { readFileSync } from "node:fs";
import type { EphemerisHeader } from "@sightline/contracts";
import { Ephemeris, parseEphemerisMeta, type EphemerisMeta, type Vec3 } from "../src";

/** Bytes of a file as the ArrayBuffer the engine takes (a Node Buffer may share a larger pool). */
export function readArrayBuffer(url: URL): ArrayBuffer {
  const b = readFileSync(url);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

export const BUNDLED_BIN = new URL("../src/data/ephemeris_2026_3600s.bin", import.meta.url);
export const GOLDEN_DIR = new URL("../../../fixtures/golden/", import.meta.url);

export function readJson(url: URL): unknown {
  return JSON.parse(readFileSync(url, "utf8"));
}

/**
 * A synthetic ephemeris over [0, 7200] s with three records: SUN, EARTH and one DSN complex at the
 * given fixed positions (km), zero velocity. Marked simulated, as a test file should be.
 */
export function syntheticEphemeris(
  sun: Vec3,
  earth: Vec3,
  station: Vec3,
  sun_radius_km = 695_700,
): Ephemeris {
  const header: EphemerisHeader = {
    schema_version: 1,
    frame: "MOON_ME",
    aberration_correction: "LT+S",
    start_et: 0,
    end_et: 7200,
    step_s: 3600,
    record_count: 3,
    bodies: ["SUN", "EARTH", "DSN_GOLDSTONE"],
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
  };
  const meta: EphemerisMeta = parseEphemerisMeta({
    ...header,
    sun_radius_km,
    moon_radius_km: 1737.4,
    layout: { dtype: "float64", endianness: "little", values_per_body: 6 },
  });
  const rec = [...sun, 0, 0, 0, ...earth, 0, 0, 0, ...station, 0, 0, 0];
  return new Ephemeris(meta, new Float64Array([...rec, ...rec, ...rec]).buffer);
}
