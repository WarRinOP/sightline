import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { Site, SunEarthState } from "@sightline/contracts";
import { createSkyState, earthLitFraction, skyBodyVisibility, updateSkyState } from "../src/sky";
import { getLocalDirectionInScene } from "../src/math";
import { SKY_RENDER_ORDER } from "../src/DeepSpaceSky";

const state = (over: Partial<SunEarthState> = {}): SunEarthState => ({
  epoch_et: 0,
  sun_azimuth_rad: 1.2,
  sun_elevation_rad: 0.02,
  sun_disk_fraction: 0.4,
  earth_azimuth_rad: 4.0,
  earth_elevation_rad: 0.05,
  earth_visible: true,
  dsn_visible: false,
  simulated: false,
  ...over,
});

const site: Site = {
  id: "test-site",
  name: "Test",
  lat_deg: -89.5,
  lon_deg: -150,
  elev_m: 1000,
  description: "test",
  simulated: true,
  source_url: null,
};

describe("skyBodyVisibility", () => {
  it("shows nothing without the engine's answer", () => {
    expect(skyBodyVisibility(null)).toEqual({ sun: false, earth: false });
    expect(skyBodyVisibility(undefined)).toEqual({ sun: false, earth: false });
  });

  it("follows sun_disk_fraction and earth_visible, not the geometric elevation", () => {
    // Above the flat horizontal but behind terrain: hidden.
    expect(skyBodyVisibility(state({ sun_elevation_rad: 0.03, sun_disk_fraction: 0 })).sun).toBe(
      false,
    );
    expect(
      skyBodyVisibility(state({ earth_elevation_rad: 0.05, earth_visible: false })).earth,
    ).toBe(false);
    // A sliver of the disk above the terrain is enough for the Sun.
    expect(skyBodyVisibility(state({ sun_disk_fraction: 0.01 })).sun).toBe(true);
    expect(skyBodyVisibility(state({ earth_visible: true })).earth).toBe(true);
  });
});

describe("earthLitFraction", () => {
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize();

  it("is new Earth when the Sun is behind the Earth and full Earth when opposite", () => {
    expect(earthLitFraction(v(1, 0, 0), v(1, 0, 0))).toBeCloseTo(0, 12);
    expect(earthLitFraction(v(1, 0, 0), v(-1, 0, 0))).toBeCloseTo(1, 12);
  });

  it("is half lit at 90° elongation and (1 - cos e) / 2 in general", () => {
    expect(earthLitFraction(v(1, 0, 0), v(0, 0, 1))).toBeCloseTo(0.5, 12);
    const e = (60 * Math.PI) / 180;
    expect(earthLitFraction(v(1, 0, 0), v(Math.cos(e), Math.sin(e), 0))).toBeCloseTo(
      (1 - Math.cos(e)) / 2,
      12,
    );
  });
});

describe("updateSkyState", () => {
  it("writes the same directions as the horizon ring and the visibility rule", () => {
    const sky = createSkyState();
    const answer = state();
    updateSkyState(sky, answer, site);
    const lat = (site.lat_deg * Math.PI) / 180;
    const lon = (site.lon_deg * Math.PI) / 180;
    const sun = getLocalDirectionInScene(
      lat,
      lon,
      answer.sun_azimuth_rad,
      answer.sun_elevation_rad,
    );
    const earth = getLocalDirectionInScene(
      lat,
      lon,
      answer.earth_azimuth_rad,
      answer.earth_elevation_rad,
    );
    expect(sky.hasSunEarth).toBe(true);
    expect(sky.sunDirection.distanceTo(sun)).toBeLessThan(1e-12);
    expect(sky.earthDirection.distanceTo(earth)).toBeLessThan(1e-12);
    expect(sky.sunVisible).toBe(true);
    expect(sky.earthVisible).toBe(true);
    expect(sky.earthLitFraction).toBeCloseTo(earthLitFraction(sun, earth), 12);
  });

  it("clears the sky when the answer or the site goes away", () => {
    const sky = createSkyState();
    updateSkyState(sky, state(), site);
    updateSkyState(sky, null, site);
    expect(sky).toMatchObject({ hasSunEarth: false, sunVisible: false, earthVisible: false });
    updateSkyState(sky, state(), site);
    updateSkyState(sky, state(), undefined);
    expect(sky).toMatchObject({ hasSunEarth: false, sunVisible: false, earthVisible: false });
  });
});

describe("sky draw order", () => {
  it("draws stars, Sun, Earth before anything at the default order 0", () => {
    expect(SKY_RENDER_ORDER.stars).toBeLessThan(SKY_RENDER_ORDER.sun);
    expect(SKY_RENDER_ORDER.sun).toBeLessThan(SKY_RENDER_ORDER.earth);
    expect(SKY_RENDER_ORDER.earth).toBeLessThan(0);
  });
});
