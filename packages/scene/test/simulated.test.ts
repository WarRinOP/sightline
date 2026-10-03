import { describe, expect, it } from "vitest";
import type { HorizonMask, SunEarthState, TileManifest } from "@sightline/contracts";
import { MOCK_TILE_MANIFEST } from "@sightline/engine";
import { isSimulated } from "../src/simulated";

const sunEarth = (simulated: boolean): SunEarthState => ({
  epoch_et: 0,
  sun_azimuth_rad: 0,
  sun_elevation_rad: 0.01,
  sun_disk_fraction: 1,
  earth_azimuth_rad: 1,
  earth_elevation_rad: 0.1,
  earth_visible: true,
  dsn_visible: true,
  simulated,
});
const horizon = (simulated: boolean) => ({ simulated }) as HorizonMask;
const manifest = (simulated: boolean) => ({ simulated }) as TileManifest;

describe("isSimulated", () => {
  it("is true if any of the Sun/Earth state, the horizon or the tile manifest is simulated", () => {
    expect(isSimulated(sunEarth(true), horizon(false), manifest(false))).toBe(true);
    expect(isSimulated(sunEarth(false), horizon(true), manifest(false))).toBe(true);
    expect(isSimulated(sunEarth(false), horizon(false), manifest(true))).toBe(true);
    expect(isSimulated(null, null, MOCK_TILE_MANIFEST)).toBe(true);
  });

  it("is false when everything present is real, and when nothing is present", () => {
    expect(isSimulated(sunEarth(false), horizon(false), manifest(false))).toBe(false);
    expect(isSimulated(null, null, null)).toBe(false);
    expect(isSimulated(undefined, undefined, undefined)).toBe(false);
  });
});
