import type { Location } from "./common";
import type { SunEarthState } from "./ephemeris";
import type { HorizonMask } from "./horizon";
import type { ProvenanceRecord } from "./provenance";
import type { Site } from "./site";
import type { TileCoord, TileData, TileManifest } from "./tiles";
import type { ProbeLitResult, TimelineRequest, TimelineResponse } from "./timeline";
import type { WindowRequest, WindowSearchResponse } from "./windows";

/**
 * Seam S1. The app talks to the engine only through this interface (via a worker), so swapping
 * the mock for the real engine is a one-line change. Everything is async because the real one
 * runs behind Comlink.
 */
export interface EngineClient {
  /** What backs this client. The UI reads `provenance.simulated` to show the SIMULATED badge. */
  readonly provenance: ProvenanceRecord;
  listSites(): Promise<Site[]>;
  getHorizon(location: Location, mast_height_m: number): Promise<HorizonMask>;
  getSunEarth(epoch_et: number, location: Location, mast_height_m?: number): Promise<SunEarthState>;
  getTimeline(request: TimelineRequest): Promise<TimelineResponse>;
  findWindows(request: WindowRequest): Promise<WindowSearchResponse>;
  probeLit(location: Location, epoch_et: number, mast_height_m?: number): Promise<ProbeLitResult>;
}

/** Seam S2. The scene reads terrain only through this interface. */
export interface TileSource {
  getManifest(): Promise<TileManifest>;
  getTile(coord: TileCoord): Promise<TileData>;
}
