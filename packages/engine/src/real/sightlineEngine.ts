import {
  ProvenanceRecordSchema,
  SiteSchema,
  type EngineClient,
  type HorizonMask,
  type Location,
  type ProbeLitResult,
  type ProvenanceRecord,
  type Site,
  type SunEarthState,
  type TimelineResponse,
  type WindowSearchResponse,
} from "@sightline/contracts";
import sitesJson from "../data/sites.json";
import headerJson from "../data/ephemeris_2026_3600s.json";
import horizonJson from "../data/horizon_shackleton-rim.json";
import { Ephemeris, parseEphemerisMeta, type EphemerisMeta } from "../ephemeris";
import { HorizonProfile, parseHorizonFile } from "../horizon";
import { computeSky } from "../sky";

/** Thrown by the methods that need the terrain horizon, which is not built yet (M2-05). */
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

/** The catalog written by `sightline sites`: tile centres of the PGDA #78 site DEMs. */
export const BUNDLED_SITES: readonly Site[] = Object.freeze(parseSiteCatalog(sitesJson));

/** Header of the bundled one-year ephemeris; the matching `.bin` is loaded by the host. */
export const BUNDLED_EPHEMERIS_META: EphemerisMeta = parseEphemerisMeta(headerJson);

/** Terrain horizons written by `sightline horizon`: today only the Shackleton Rim tile centre. */
export const BUNDLED_HORIZONS: readonly HorizonProfile[] = Object.freeze([
  new HorizonProfile(parseHorizonFile(horizonJson)),
]);

const noTerrain = (what: string) =>
  new NotAvailableError(
    `${what} needs a terrain horizon, which exists only for the Shackleton Rim tile centre so far (task S1-05)`,
  );
const notBuilt = (what: string) =>
  new NotAvailableError(
    `${what} needs the full timeline engine, which is not built yet (task M2-08)`,
  );

/**
 * The engine on real SPICE-derived positions. `getSunEarth` is real everywhere; its disk fraction
 * and Earth visibility use the terrain horizon where one exists (the Shackleton Rim tile centre)
 * and flat ground elsewhere. `getHorizon` and `probeLit` answer only where a terrain horizon
 * exists; the timeline and window search are refused until M2-08.
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

  getTimeline(): Promise<TimelineResponse> {
    return Promise.reject(notBuilt("getTimeline"));
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
