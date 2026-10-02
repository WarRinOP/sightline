import type { ProvenanceRecord } from "@sightline/contracts";

/** Every mock response carries this source id; contracts force `simulated: true` for it. */
export const SYNTHETIC_SOURCE = "SYNTHETIC_MOCK_ENGINE";

export const MOCK_PROVENANCE: Readonly<ProvenanceRecord> = Object.freeze({
  source: SYNTHETIC_SOURCE,
  simulated: true,
  data_sources: [],
  spice_kernels: [],
  dem_citation: null,
  pipeline_version: null,
  data_version: "mock-1",
});

/**
 * A default epoch near 2026-01-01T00:00 UTC (9497 days after 2000-01-01 minus the half day to
 * J2000 noon). It ignores the ~69 s TDB offset, which is fine only because this is mock data.
 */
export const MOCK_EPOCH_ET = 820_497_600;

const DEG = Math.PI / 180;

// Constants from the project's physics table (CLAUDE.md §9).
export const SYNODIC_PERIOD_S = 29.53 * 86_400;
export const AXIAL_TILT_RAD = 1.54 * DEG;
export const SUN_ANGULAR_RADIUS_RAD = 0.2666 * DEG;
export const EARTH_LIBRATION_LAT_AMPLITUDE_RAD = 6.7 * DEG;

// Nominal periods for the circular mock orbits. Mock only: the real engine reads SPICE.
export const SUBSOLAR_LATITUDE_PERIOD_S = 365.25 * 86_400;
export const EARTH_LIBRATION_PERIOD_S = 27.32 * 86_400;
