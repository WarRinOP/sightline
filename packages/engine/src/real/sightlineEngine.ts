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
import { Ephemeris, parseEphemerisMeta, type EphemerisMeta } from "../ephemeris";
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

const needsTerrain = (what: string) =>
  new NotAvailableError(`${what} needs the terrain horizon, which is not built yet (task M2-05)`);

/**
 * The engine on real SPICE-derived positions. `getSunEarth` is real; the horizon is flat ground,
 * so anything that would turn that into a lit/dark verdict (horizon, timeline, windows, probe)
 * is refused rather than answered with a number that ignores the terrain.
 */
export class SightlineEngineClient implements EngineClient {
  readonly provenance: ProvenanceRecord;

  constructor(
    private readonly ephemeris: Ephemeris,
    private readonly sites: readonly Site[] = BUNDLED_SITES,
  ) {
    this.provenance = ProvenanceRecordSchema.parse(ephemeris.meta.header.provenance);
  }

  listSites(): Promise<Site[]> {
    return Promise.resolve(this.sites.map((s) => ({ ...s })));
  }

  async getSunEarth(
    epoch_et: number,
    location: Location,
    mast_height_m = 0,
  ): Promise<SunEarthState> {
    return computeSky(this.ephemeris, epoch_et, location, { mast_height_m }).state;
  }

  getHorizon(): Promise<HorizonMask> {
    return Promise.reject(needsTerrain("getHorizon"));
  }

  getTimeline(): Promise<TimelineResponse> {
    return Promise.reject(needsTerrain("getTimeline"));
  }

  findWindows(): Promise<WindowSearchResponse> {
    return Promise.reject(needsTerrain("findWindows"));
  }

  probeLit(): Promise<ProbeLitResult> {
    return Promise.reject(needsTerrain("probeLit"));
  }
}

/** Build the client from the bytes of the bundled `ephemeris_2026_3600s.bin`. */
export function createSightlineEngineClient(
  ephemerisBytes: ArrayBuffer,
  options: { meta?: EphemerisMeta; sites?: readonly Site[] } = {},
): EngineClient {
  const eph = new Ephemeris(options.meta ?? BUNDLED_EPHEMERIS_META, ephemerisBytes);
  return new SightlineEngineClient(eph, options.sites ?? BUNDLED_SITES);
}
