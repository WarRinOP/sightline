import type {
  EngineClient,
  HorizonMask,
  Location,
  ProbeLitResult,
  ProvenanceRecord,
  Site,
  SunEarthState,
  TimelineResponse,
  WindowSearchResponse,
} from "@sightline/contracts";
import { createSightlineEngineClient, BUNDLED_EPHEMERIS_META } from "@sightline/engine";

/** What the UI needs to know before it asks for a state: what backs the engine and its time span. */
export interface EngineInfo {
  provenance: ProvenanceRecord;
  /** The ephemeris covers [start_et, end_et]; `getSunEarth` throws outside it. */
  start_et: number;
  end_et: number;
}

/**
 * The surface exposed over Comlink. It mirrors `EngineClient`, except that `provenance` becomes
 * the async `info()` (a property cannot be read synchronously across a worker boundary).
 */
export interface EngineApi {
  info(): Promise<EngineInfo>;
  listSites(): Promise<Site[]>;
  getSunEarth(epoch_et: number, location: Location, mast_height_m?: number): Promise<SunEarthState>;
  getHorizon(location: Location, mast_height_m: number): Promise<HorizonMask>;
  getTimeline(request: Parameters<EngineClient["getTimeline"]>[0]): Promise<TimelineResponse>;
  findWindows(request: Parameters<EngineClient["findWindows"]>[0]): Promise<WindowSearchResponse>;
  probeLit(location: Location, epoch_et: number, mast_height_m?: number): Promise<ProbeLitResult>;
}

/**
 * Builds the engine on first use from the bytes of `ephemeris_2026_3600s.bin`. Kept free of worker
 * globals so Node tests can drive it; `engine.worker.ts` only supplies the loader and exposes it.
 */
export function createEngineApi(loadEphemerisBytes: () => Promise<ArrayBuffer>): EngineApi {
  let client: Promise<EngineClient> | undefined;
  const engine = (): Promise<EngineClient> => {
    client ??= loadEphemerisBytes().then((bytes) => createSightlineEngineClient(bytes));
    return client;
  };

  return {
    info: async () => {
      const c = await engine();
      const { start_et, end_et } = BUNDLED_EPHEMERIS_META.header;
      return { provenance: c.provenance, start_et, end_et };
    },
    listSites: async () => (await engine()).listSites(),
    getSunEarth: async (epoch_et, location, mast_height_m) =>
      (await engine()).getSunEarth(epoch_et, location, mast_height_m),
    getHorizon: async (location, mast_height_m) =>
      (await engine()).getHorizon(location, mast_height_m),
    getTimeline: async (request) => (await engine()).getTimeline(request),
    findWindows: async (request) => (await engine()).findWindows(request),
    probeLit: async (location, epoch_et, mast_height_m) =>
      (await engine()).probeLit(location, epoch_et, mast_height_m),
  };
}
