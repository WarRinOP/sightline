import { describe, expect, it } from "vitest";
import {
  AnalystClaimSchema,
  DEFAULT_LANDER_PROFILE,
  EphemerisHeaderSchema,
  HORIZON_AZIMUTH_SAMPLES,
  HorizonMaskSchema,
  LanderProfileSchema,
  MAX_TIMELINE_STEPS,
  MOON_REFERENCE_RADIUS_M,
  ProvenanceRecordSchema,
  SiteSchema,
  StepStateSchema,
  SunEarthStateSchema,
  TileCoordSchema,
  TileDataSchema,
  TileManifestSchema,
  TimelineRequestSchema,
  WindowResultSchema,
  isTileCoordInRange,
  siteLocation,
  tileGsdM,
  type LanderProfile,
  type ProvenanceRecord,
  type TileManifest,
} from "../src";

const simProvenance: ProvenanceRecord = {
  source: "SYNTHETIC_TEST",
  simulated: true,
  data_sources: [],
  spice_kernels: [],
  dem_citation: null,
  pipeline_version: null,
  data_version: null,
};

const location = { lat_rad: -1.5, lon_rad: 0.5 };

describe("ProvenanceRecord", () => {
  it("accepts a simulated record", () => {
    expect(ProvenanceRecordSchema.safeParse(simProvenance).success).toBe(true);
  });

  it("rejects a SYNTHETIC source that claims to be real", () => {
    const r = ProvenanceRecordSchema.safeParse({ ...simProvenance, simulated: false });
    expect(r.success).toBe(false);
  });

  it("rejects real data with no cited sources", () => {
    const r = ProvenanceRecordSchema.safeParse({
      ...simProvenance,
      source: "SIGHTLINE_PIPELINE",
      simulated: false,
    });
    expect(r.success).toBe(false);
  });

  it("accepts real data that cites sources and the pipeline version", () => {
    const r = ProvenanceRecordSchema.safeParse({
      source: "SIGHTLINE_PIPELINE",
      simulated: false,
      data_sources: ["naif-de440s"],
      spice_kernels: ["de440s.bsp"],
      dem_citation: "LOLA, example citation",
      pipeline_version: "0.1.0",
      data_version: "v1",
    });
    expect(r.success).toBe(true);
  });
});

describe("Site", () => {
  const site = {
    id: "shackleton-rim",
    name: "Shackleton Rim",
    lat_deg: -89.5,
    lon_deg: 10,
    elev_m: 0,
    description: "placeholder",
    simulated: true,
    source_url: null,
  };

  it("accepts a simulated site without a source", () => {
    expect(SiteSchema.safeParse(site).success).toBe(true);
  });

  it("rejects a real site without a source_url", () => {
    expect(SiteSchema.safeParse({ ...site, simulated: false }).success).toBe(false);
  });

  it("accepts a real site with a source_url", () => {
    const r = SiteSchema.safeParse({
      ...site,
      simulated: false,
      source_url: "https://example.org/x",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a bad id and out-of-range coordinates", () => {
    expect(SiteSchema.safeParse({ ...site, id: "Shackleton Rim" }).success).toBe(false);
    expect(SiteSchema.safeParse({ ...site, lat_deg: -91 }).success).toBe(false);
    expect(SiteSchema.safeParse({ ...site, lon_deg: 181 }).success).toBe(false);
  });

  it("converts degrees to radians", () => {
    const loc = siteLocation({ lat_deg: -90, lon_deg: 180 });
    expect(loc.lat_rad).toBeCloseTo(-Math.PI / 2, 12);
    expect(loc.lon_rad).toBeCloseTo(Math.PI, 12);
  });
});

describe("LanderProfile", () => {
  it("accepts the default profile", () => {
    expect(LanderProfileSchema.safeParse(DEFAULT_LANDER_PROFILE).success).toBe(true);
  });

  it("rejects a mast taller than 20 m and an efficiency above 1", () => {
    expect(
      LanderProfileSchema.safeParse({ ...DEFAULT_LANDER_PROFILE, mast_height_m: 21 }).success,
    ).toBe(false);
    expect(
      LanderProfileSchema.safeParse({ ...DEFAULT_LANDER_PROFILE, solar_efficiency: 1.1 }).success,
    ).toBe(false);
  });

  it("rejects a missing field", () => {
    const incomplete: Partial<LanderProfile> = { ...DEFAULT_LANDER_PROFILE };
    delete incomplete.battery_capacity_s;
    expect(LanderProfileSchema.safeParse(incomplete).success).toBe(false);
  });
});

describe("SunEarthState", () => {
  const state = {
    epoch_et: 8.2e8,
    sun_azimuth_rad: 1,
    sun_elevation_rad: 0.02,
    sun_disk_fraction: 0.5,
    earth_azimuth_rad: 3,
    earth_elevation_rad: -0.01,
    earth_visible: false,
    dsn_visible: false,
    simulated: true,
  };

  it("accepts a valid state", () => {
    expect(SunEarthStateSchema.safeParse(state).success).toBe(true);
  });

  it("rejects azimuth outside [0, 2π) and a fraction above 1", () => {
    expect(SunEarthStateSchema.safeParse({ ...state, sun_azimuth_rad: 2 * Math.PI }).success).toBe(
      false,
    );
    expect(SunEarthStateSchema.safeParse({ ...state, sun_azimuth_rad: -0.1 }).success).toBe(false);
    expect(SunEarthStateSchema.safeParse({ ...state, sun_disk_fraction: 1.2 }).success).toBe(false);
  });

  it("rejects DSN visible while Earth is below the horizon", () => {
    expect(SunEarthStateSchema.safeParse({ ...state, dsn_visible: true }).success).toBe(false);
  });

  it("rejects NaN and Infinity epochs", () => {
    expect(SunEarthStateSchema.safeParse({ ...state, epoch_et: Number.NaN }).success).toBe(false);
    expect(SunEarthStateSchema.safeParse({ ...state, epoch_et: Infinity }).success).toBe(false);
  });
});

describe("EphemerisHeader", () => {
  const header = {
    schema_version: 1,
    frame: "MOON_ME",
    aberration_correction: "LT+S",
    start_et: 0,
    end_et: 600 * 10,
    step_s: 600,
    record_count: 11,
    bodies: ["SUN", "EARTH"],
    spice_kernels: [],
    simulated: true,
    provenance: simProvenance,
  };

  it("accepts a consistent header", () => {
    expect(EphemerisHeaderSchema.safeParse(header).success).toBe(true);
  });

  it("rejects the wrong frame (MOON_PA is forbidden)", () => {
    expect(EphemerisHeaderSchema.safeParse({ ...header, frame: "MOON_PA" }).success).toBe(false);
  });

  it("rejects an inconsistent record count and a reversed range", () => {
    expect(EphemerisHeaderSchema.safeParse({ ...header, record_count: 10 }).success).toBe(false);
    expect(EphemerisHeaderSchema.safeParse({ ...header, end_et: -1 }).success).toBe(false);
  });

  it("rejects a simulated flag that disagrees with provenance", () => {
    expect(EphemerisHeaderSchema.safeParse({ ...header, simulated: false }).success).toBe(false);
  });
});

describe("Tiles", () => {
  const manifest: TileManifest = {
    schema_version: 1,
    data_version: "mock-1",
    projection: "polar_stereographic_south",
    moon_radius_m: MOON_REFERENCE_RADIUS_M,
    bounds_m: { x_min_m: -1000, y_min_m: -1000, x_max_m: 1000, y_max_m: 1000 },
    tile_size_px: 64,
    border_px: 1,
    level_count: 3,
    height_encoding: "uint16_offset",
    height_scale_m: 0.1,
    simulated: true,
    provenance: simProvenance,
  };

  it("accepts a valid manifest", () => {
    expect(TileManifestSchema.safeParse(manifest).success).toBe(true);
  });

  it("rejects a wrong moon radius, empty bounds and an over-large border", () => {
    expect(TileManifestSchema.safeParse({ ...manifest, moon_radius_m: 1737000 }).success).toBe(
      false,
    );
    const flat = { ...manifest, bounds_m: { ...manifest.bounds_m, x_max_m: -1000 } };
    expect(TileManifestSchema.safeParse(flat).success).toBe(false);
    expect(TileManifestSchema.safeParse({ ...manifest, border_px: 32 }).success).toBe(false);
  });

  it("checks tile coordinates against the pyramid", () => {
    expect(TileCoordSchema.safeParse({ level: 1, x: 1, y: 0 }).success).toBe(true);
    expect(TileCoordSchema.safeParse({ level: 1, x: -1, y: 0 }).success).toBe(false);
    expect(isTileCoordInRange(manifest, { level: 2, x: 3, y: 3 })).toBe(true);
    expect(isTileCoordInRange(manifest, { level: 2, x: 4, y: 0 })).toBe(false);
    expect(isTileCoordInRange(manifest, { level: 3, x: 0, y: 0 })).toBe(false);
  });

  it("computes the ground sample distance per level", () => {
    // 2000 m extent, 62 interior samples at level 0, halving each level.
    expect(tileGsdM(manifest, 0)).toBeCloseTo(2000 / 62, 12);
    expect(tileGsdM(manifest, 2)).toBeCloseTo(2000 / 4 / 62, 12);
  });

  it("validates tile data length", () => {
    const tile = {
      coord: { level: 0, x: 0, y: 0 },
      size_px: 4,
      offset_m: -5,
      scale_m: 0.1,
      heights: new Uint16Array(16),
      simulated: true,
    };
    expect(TileDataSchema.safeParse(tile).success).toBe(true);
    expect(TileDataSchema.safeParse({ ...tile, heights: new Uint16Array(15) }).success).toBe(false);
    expect(TileDataSchema.safeParse({ ...tile, heights: new Float32Array(16) }).success).toBe(
      false,
    );
  });
});

describe("HorizonMask", () => {
  const step = (2 * Math.PI) / HORIZON_AZIMUTH_SAMPLES;
  const mask = {
    location,
    mast_height_m: 2,
    azimuth_step_rad: step,
    mask_elevation_rad: new Array<number>(HORIZON_AZIMUTH_SAMPLES).fill(0.01),
    simulated: true,
    provenance: simProvenance,
  };

  it("accepts a full-circle mask", () => {
    expect(HorizonMaskSchema.safeParse(mask).success).toBe(true);
  });

  it("rejects a mask that does not cover the circle", () => {
    const short = { ...mask, mask_elevation_rad: mask.mask_elevation_rad.slice(0, 100) };
    expect(HorizonMaskSchema.safeParse(short).success).toBe(false);
  });

  it("rejects an elevation beyond ±π/2", () => {
    const bad = { ...mask, mask_elevation_rad: mask.mask_elevation_rad.map(() => 2) };
    expect(HorizonMaskSchema.safeParse(bad).success).toBe(false);
  });
});

describe("Timeline", () => {
  const request = {
    location,
    profile: DEFAULT_LANDER_PROFILE,
    start_et: 0,
    end_et: 3600,
    step_s: 600,
  };

  it("accepts a valid request", () => {
    expect(TimelineRequestSchema.safeParse(request).success).toBe(true);
  });

  it("rejects a reversed range, a zero step and an oversized request", () => {
    expect(TimelineRequestSchema.safeParse({ ...request, end_et: -10 }).success).toBe(false);
    expect(TimelineRequestSchema.safeParse({ ...request, step_s: 0 }).success).toBe(false);
    const huge = { ...request, end_et: (MAX_TIMELINE_STEPS + 1) * request.step_s };
    expect(TimelineRequestSchema.safeParse(huge).success).toBe(false);
  });

  it("accepts a step state and rejects an unknown kind", () => {
    const step = {
      epoch_et: 0,
      sun_disk_fraction: 1,
      lit: true,
      earth_visible: true,
      dsn_visible: true,
      kind: "both",
    };
    expect(StepStateSchema.safeParse(step).success).toBe(true);
    expect(StepStateSchema.safeParse({ ...step, kind: "twilight" }).success).toBe(false);
  });
});

describe("WindowResult", () => {
  const win = {
    start_et: 0,
    end_et: 100,
    duration_s: 100,
    score: 0.8,
    illuminated_ratio: 1,
    comms_ratio: 0.5,
  };

  it("accepts a valid window", () => {
    expect(WindowResultSchema.safeParse(win).success).toBe(true);
  });

  it("rejects an inverted window and a ratio above 1", () => {
    expect(WindowResultSchema.safeParse({ ...win, end_et: -1 }).success).toBe(false);
    expect(WindowResultSchema.safeParse({ ...win, comms_ratio: 2 }).success).toBe(false);
  });
});

describe("AnalystClaim", () => {
  const claim = {
    claim_text: "The longest night is X seconds.",
    tool_calls: [{ id: "t1", tool: "getTimeline", input: { any: "thing" } }],
    citations: [
      { tool_call_id: "t1", json_path: "$.statistics.longest_night_s", value: 5, unit: "s" },
    ],
    grounded: true,
  };

  it("accepts a grounded claim", () => {
    expect(AnalystClaimSchema.safeParse(claim).success).toBe(true);
  });

  it("rejects a tool the Analyst may not call", () => {
    const bad = { ...claim, tool_calls: [{ id: "t1", tool: "runShell", input: {} }] };
    expect(AnalystClaimSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a citation to an unknown tool call", () => {
    const bad = { ...claim, citations: [{ ...claim.citations[0], tool_call_id: "t9" }] };
    expect(AnalystClaimSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects grounded: true with no citations", () => {
    expect(AnalystClaimSchema.safeParse({ ...claim, citations: [] }).success).toBe(false);
  });
});
