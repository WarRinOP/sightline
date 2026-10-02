import {
  HORIZON_AZIMUTH_SAMPLES,
  TimelineRequestSchema,
  WindowRequestSchema,
  type EngineClient,
  type HorizonMask,
  type LanderProfile,
  type Location,
  type ProbeLitResult,
  type ProvenanceRecord,
  type Site,
  type StepState,
  type SunEarthState,
  type TimelineResponse,
  type TimelineStatistics,
  type WindowResult,
  type WindowSearchResponse,
  type TimelineRequest,
  type WindowRequest,
} from "@sightline/contracts";
import { MOCK_PROVENANCE } from "./constants";
import { mockEarth, mockSun, solarDiskFraction } from "./mockSky";
import { MOCK_SITES } from "./mockSites";
import { mockHorizonElevationRad } from "./mockTerrain";

const TWO_PI = 2 * Math.PI;
const AZIMUTH_STEP_RAD = TWO_PI / HORIZON_AZIMUTH_SAMPLES;

/** Linear interpolation of a horizon mask at any azimuth. */
export function maskElevationAt(
  mask_elevation_rad: readonly number[],
  azimuth_rad: number,
): number {
  const n = mask_elevation_rad.length;
  const pos = (azimuth_rad / TWO_PI) * n;
  const i = Math.floor(pos);
  const frac = pos - i;
  const a = mask_elevation_rad[((i % n) + n) % n] ?? 0;
  const b = mask_elevation_rad[(((i + 1) % n) + n) % n] ?? 0;
  return a + (b - a) * frac;
}

/** Does this step count as sunlit for `profile`? "Any sliver" when the minimum fraction is 0. */
function isLit(profile: LanderProfile, sun_elevation_rad: number, disk_fraction: number): boolean {
  return (
    sun_elevation_rad >= profile.min_sun_elev_rad &&
    disk_fraction > 0 &&
    disk_fraction >= profile.min_sun_disk_fraction
  );
}

function stepKind(lit: boolean, link: boolean): StepState["kind"] {
  if (lit && link) return "both";
  if (lit) return "sun";
  return link ? "earth" : "dark";
}

/**
 * Statistics over a series of steps spaced `step_s` apart. A night is a maximal run of unlit
 * steps and lasts steps × step_s.
 */
export function summarizeSteps(
  steps: readonly StepState[],
  step_s: number,
  battery_capacity_s: number,
): TimelineStatistics {
  let lit = 0;
  let comms = 0;
  let both = 0;
  let longest_s = 0;
  let longest_start_et: number | null = null;
  let over_battery = 0;
  let run = 0;
  let run_start_et = 0;

  const closeRun = () => {
    if (run === 0) return;
    const run_s = run * step_s;
    if (run_s > longest_s) {
      longest_s = run_s;
      longest_start_et = run_start_et;
    }
    if (run_s > battery_capacity_s) over_battery += 1;
    run = 0;
  };

  for (const s of steps) {
    if (s.lit) lit += 1;
    if (s.dsn_visible) comms += 1;
    if (s.lit && s.dsn_visible) both += 1;
    if (s.lit) {
      closeRun();
    } else {
      if (run === 0) run_start_et = s.epoch_et;
      run += 1;
    }
  }
  closeRun();

  const n = steps.length;
  return {
    step_count: n,
    illuminated_ratio: lit / n,
    comms_ratio: comms / n,
    both_ratio: both / n,
    longest_night_s: longest_s,
    longest_night_start_et: longest_start_et,
    nights_over_battery: over_battery,
  };
}

/**
 * SIMULATED engine: analytic bowls for terrain, circular Sun and Earth orbits. Nothing here is a
 * measurement. It exists so the scene and the UI can be built before the real engine lands.
 */
export class MockEngineClient implements EngineClient {
  readonly provenance: ProvenanceRecord = MOCK_PROVENANCE;
  private readonly horizonCache = new Map<string, readonly number[]>();

  constructor(private readonly sites: readonly Site[] = MOCK_SITES) {}

  listSites(): Promise<Site[]> {
    return Promise.resolve(this.sites.map((s) => ({ ...s })));
  }

  getHorizon(location: Location, mast_height_m: number): Promise<HorizonMask> {
    return Promise.resolve({
      location: { ...location },
      mast_height_m,
      azimuth_step_rad: AZIMUTH_STEP_RAD,
      mask_elevation_rad: [...this.mask(location, mast_height_m)],
      simulated: true,
      provenance: this.provenance,
    });
  }

  getSunEarth(epoch_et: number, location: Location, mast_height_m = 0): Promise<SunEarthState> {
    return Promise.resolve(this.sunEarth(epoch_et, location, mast_height_m, 0));
  }

  probeLit(location: Location, epoch_et: number, mast_height_m = 0): Promise<ProbeLitResult> {
    const s = this.sunEarth(epoch_et, location, mast_height_m, 0);
    return Promise.resolve({
      epoch_et,
      lit: s.sun_disk_fraction > 0,
      sun_disk_fraction: s.sun_disk_fraction,
      simulated: true,
    });
  }

  // `async` so an invalid request becomes a rejected promise, as it will behind Comlink.
  async getTimeline(request: TimelineRequest): Promise<TimelineResponse> {
    const req = TimelineRequestSchema.parse(request);
    return this.timeline(req);
  }

  async findWindows(request: WindowRequest): Promise<WindowSearchResponse> {
    const req = WindowRequestSchema.parse(request);
    const { location, profile, start_et, end_et, step_s } = req;
    const { steps } = this.timeline({ location, profile, start_et, end_et, step_s });

    // Placeholder ranking: windows are runs of sunlight, weighted by how much of the run has a
    // link. The real scoring lives in the windows module (M2-09, Dev 3).
    const windows: WindowResult[] = [];
    let first = -1;
    const close = (last: number) => {
      if (first < 0) return;
      const run = steps.slice(first, last + 1);
      const duration_s = run.length * step_s;
      if (duration_s >= req.min_duration_s) {
        const comms_ratio = run.filter((s) => s.dsn_visible).length / run.length;
        windows.push({
          start_et: run[0]?.epoch_et ?? start_et,
          end_et: (run[run.length - 1]?.epoch_et ?? start_et) + step_s,
          duration_s,
          score: (comms_ratio * duration_s) / 86_400,
          illuminated_ratio: 1,
          comms_ratio,
        });
      }
      first = -1;
    };
    steps.forEach((s, i) => {
      if (s.lit) {
        if (first < 0) first = i;
      } else {
        close(i - 1);
      }
    });
    close(steps.length - 1);

    windows.sort((a, b) => b.score - a.score);
    return {
      request: req,
      windows: windows.slice(0, req.max_results),
      simulated: true,
      provenance: this.provenance,
    };
  }

  private mask(location: Location, mast_height_m: number): readonly number[] {
    const key = `${location.lat_rad}|${location.lon_rad}|${mast_height_m}`;
    let mask = this.horizonCache.get(key);
    if (!mask) {
      mask = Array.from({ length: HORIZON_AZIMUTH_SAMPLES }, (_, i) =>
        mockHorizonElevationRad(location, mast_height_m, i * AZIMUTH_STEP_RAD),
      );
      this.horizonCache.set(key, mask);
    }
    return mask;
  }

  private sunEarth(
    epoch_et: number,
    location: Location,
    mast_height_m: number,
    min_earth_elev_rad: number,
  ): SunEarthState {
    const mask = this.mask(location, mast_height_m);
    const sun = mockSun(epoch_et, location);
    const earth = mockEarth(epoch_et, location);
    const sunHorizon = maskElevationAt(mask, sun.azimuth_rad);
    const earthHorizon = maskElevationAt(mask, earth.azimuth_rad);
    const earth_visible = earth.elevation_rad > earthHorizon;
    const link_margin_rad = Math.max(min_earth_elev_rad, 0);
    return {
      epoch_et,
      sun_azimuth_rad: sun.azimuth_rad,
      sun_elevation_rad: sun.elevation_rad,
      sun_disk_fraction: solarDiskFraction(sun.elevation_rad, sunHorizon),
      earth_azimuth_rad: earth.azimuth_rad,
      earth_elevation_rad: earth.elevation_rad,
      earth_visible,
      // Mock: the three DSN complexes give continuous coverage, so a link exists whenever Earth
      // clears the horizon by the margin. `dsn_min_elev_rad` is ignored by the mock.
      dsn_visible: earth_visible && earth.elevation_rad - earthHorizon >= link_margin_rad,
      simulated: true,
    };
  }

  private timeline(req: TimelineRequest): TimelineResponse {
    const { location, profile, start_et, end_et, step_s } = req;
    const count = Math.floor((end_et - start_et) / step_s) + 1;
    const steps: StepState[] = [];
    for (let i = 0; i < count; i++) {
      const epoch_et = start_et + i * step_s;
      const s = this.sunEarth(
        epoch_et,
        location,
        profile.mast_height_m,
        profile.min_earth_elev_rad,
      );
      const lit = isLit(profile, s.sun_elevation_rad, s.sun_disk_fraction);
      steps.push({
        epoch_et,
        sun_disk_fraction: s.sun_disk_fraction,
        lit,
        earth_visible: s.earth_visible,
        dsn_visible: s.dsn_visible,
        kind: stepKind(lit, s.dsn_visible),
      });
    }
    return {
      request: req,
      steps,
      statistics: summarizeSteps(steps, step_s, profile.battery_capacity_s),
      simulated: true,
      provenance: this.provenance,
    };
  }
}

export function createMockEngineClient(sites: readonly Site[] = MOCK_SITES): EngineClient {
  return new MockEngineClient(sites);
}
