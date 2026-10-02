import {
  ProvenanceRecordSchema,
  SiteSchema,
  TimelineRequestSchema,
  type EngineClient,
  type HorizonMask,
  type Location,
  type ProbeLitResult,
  type ProvenanceRecord,
  type Site,
  type StepState,
  type SunEarthState,
  type TimelineRequest,
  type TimelineResponse,
  type WindowSearchResponse,
} from "@sightline/contracts";
import sitesJson from "../data/sites.json";
import headerJson from "../data/ephemeris_2026_3600s.json";
import horizonConnectingRidge from "../data/horizon_connecting-ridge.json";
import horizonDeGerlache from "../data/horizon_de-gerlache-rim.json";
import horizonShackleton from "../data/horizon_shackleton-rim.json";
import { Ephemeris, parseEphemerisMeta, type EphemerisMeta } from "../ephemeris";
import { HorizonProfile, parseHorizonFile } from "../horizon";
import { computeSky } from "../sky";
import { isLit, stepKind, summarizeSteps } from "../timeline";

/** Thrown when a method needs data or a module that does not exist for this request yet. */
export class NotAvailableError extends Error {
  override readonly name = "NotAvailableError";
}

export function parseSiteCatalog(raw: unknown): Site[] {
  const doc = raw as { schema_version?: unknown; sites?: unknown } | null;
  if (doc?.schema_version !== 1 || !Array.isArray(doc.sites)) {
    throw new TypeError("site catalog: expected { schema_version: 1, sites: [...] }");
  }
  return doc.sites.map((s) => SiteSchema.parse(s));
}

/** The catalog written by `sightline sites`: sites in the PGDA #78 site DEMs (D-019, D-024). */
export const BUNDLED_SITES: readonly Site[] = Object.freeze(parseSiteCatalog(sitesJson));

/** Header of the bundled one-year ephemeris; the matching `.bin` is loaded by the host. */
export const BUNDLED_EPHEMERIS_META: EphemerisMeta = parseEphemerisMeta(headerJson);

/** Terrain horizons written by `sightline horizon`, one per catalog site. */
export const BUNDLED_HORIZONS: readonly HorizonProfile[] = Object.freeze(
  [horizonShackleton, horizonConnectingRidge, horizonDeGerlache].map(
    (doc) => new HorizonProfile(parseHorizonFile(doc)),
  ),
);

const noTerrain = (what: string) =>
  new NotAvailableError(
    `${what} needs a terrain horizon, which exists only for the three catalog sites (task S1-05)`,
  );
const notBuilt = (what: string) =>
  new NotAvailableError(`${what} needs the window search, which is not built yet (task M2-09)`);

/** One record for an answer that rests on both the ephemeris and a terrain horizon. */
function combineProvenance(a: ProvenanceRecord, b: ProvenanceRecord): ProvenanceRecord {
  return ProvenanceRecordSchema.parse({
    source: a.source,
    simulated: a.simulated || b.simulated,
    data_sources: [...new Set([...a.data_sources, ...b.data_sources])],
    spice_kernels: [...new Set([...a.spice_kernels, ...b.spice_kernels])],
    dem_citation: b.dem_citation ?? a.dem_citation,
    pipeline_version: a.pipeline_version ?? b.pipeline_version,
    data_version: [a.data_version, b.data_version].filter(Boolean).join("+") || null,
  });
}

/**
 * The engine on real SPICE-derived positions. `getSunEarth` is real everywhere; its disk fraction
 * and Earth visibility use the terrain horizon where one exists (the three catalog sites) and
 * flat ground elsewhere. `getHorizon`, `probeLit` and `getTimeline` answer only where a terrain
 * horizon exists; the window search is refused until M2-09.
 */
export class SightlineEngineClient implements EngineClient {
  readonly provenance: ProvenanceRecord;

  constructor(
    private readonly ephemeris: Ephemeris,
    private readonly sites: readonly Site[] = BUNDLED_SITES,
    private readonly horizons: readonly HorizonProfile[] = BUNDLED_HORIZONS,
  ) {
    this.provenance = ProvenanceRecordSchema.parse(ephemeris.meta.header.provenance);
  }

  listSites(): Promise<Site[]> {
    return Promise.resolve(this.sites.map((s) => ({ ...s })));
  }

  /** The terrain horizon of `location`, or undefined when none is bundled for it. */
  private terrainAt(location: Location): HorizonProfile | undefined {
    return this.horizons.find((h) => h.matches(location));
  }

  async getSunEarth(
    epoch_et: number,
    location: Location,
    mast_height_m = 0,
  ): Promise<SunEarthState> {
    const terrain = this.terrainAt(location);
    return computeSky(this.ephemeris, epoch_et, location, {
      mast_height_m,
      ...(terrain ? { terrain_horizon: (az: number) => terrain.maskAt(az, mast_height_m) } : {}),
    }).state;
  }

  getHorizon(location: Location, mast_height_m: number): Promise<HorizonMask> {
    const terrain = this.terrainAt(location);
    if (!terrain) return Promise.reject(noTerrain("getHorizon"));
    return Promise.resolve().then(() => terrain.toHorizonMask(mast_height_m));
  }

  /**
   * Sun and Earth against the terrain horizon at every step from `start_et` to `end_et`
   * inclusive. Lit, link and the statistics follow the profile; see `isLit` and `summarizeSteps`.
   */
  async getTimeline(request: TimelineRequest): Promise<TimelineResponse> {
    const req = TimelineRequestSchema.parse(request);
    const { location, profile, start_et, end_et, step_s } = req;
    const terrain = this.terrainAt(location);
    if (!terrain) throw noTerrain("getTimeline");

    const options = {
      mast_height_m: profile.mast_height_m,
      min_earth_elev_rad: profile.min_earth_elev_rad,
      dsn_min_elev_rad: profile.dsn_min_elev_rad,
      terrain_horizon: (az: number) => terrain.maskAt(az, profile.mast_height_m),
    };
    const count = Math.floor((end_et - start_et) / step_s) + 1;
    const steps: StepState[] = [];
    for (let i = 0; i < count; i++) {
      const epoch_et = start_et + i * step_s;
      const s = computeSky(this.ephemeris, epoch_et, location, options).state;
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
    const provenance = combineProvenance(this.provenance, terrain.provenance);
    return {
      request: req,
      steps,
      statistics: summarizeSteps(steps, step_s, profile.battery_capacity_s),
      simulated: provenance.simulated,
      provenance,
    };
  }

  findWindows(): Promise<WindowSearchResponse> {
    return Promise.reject(notBuilt("findWindows"));
  }

  /** Lit means any part of the Sun's disk is above the terrain horizon at the Sun's azimuth. */
  async probeLit(location: Location, epoch_et: number, mast_height_m = 0): Promise<ProbeLitResult> {
    if (!this.terrainAt(location)) throw noTerrain("probeLit");
    const state = await this.getSunEarth(epoch_et, location, mast_height_m);
    return {
      epoch_et,
      lit: state.sun_disk_fraction > 0,
      sun_disk_fraction: state.sun_disk_fraction,
      simulated: state.simulated,
    };
  }
}

/** Build the client from the bytes of the bundled `ephemeris_2026_3600s.bin`. */
export function createSightlineEngineClient(
  ephemerisBytes: ArrayBuffer,
  options: {
    meta?: EphemerisMeta;
    sites?: readonly Site[];
    horizons?: readonly HorizonProfile[];
  } = {},
): EngineClient {
  const eph = new Ephemeris(options.meta ?? BUNDLED_EPHEMERIS_META, ephemerisBytes);
  return new SightlineEngineClient(
    eph,
    options.sites ?? BUNDLED_SITES,
    options.horizons ?? BUNDLED_HORIZONS,
  );
}
