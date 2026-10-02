import * as Comlink from "comlink";
import type { EngineClient } from "@sightline/contracts";
import type { EngineApi } from "./engineApi";

export interface EngineConnection {
  /** A normal `EngineClient`; every call runs in the worker. */
  client: EngineClient;
  /** The span of the bundled ephemeris, in ET seconds. */
  coverage: { start_et: number; end_et: number };
  terminate(): void;
}

/**
 * Starts the engine worker and resolves once it has loaded the ephemeris. Browser only: call it
 * from an effect, never during render. Rejects if the worker or the file fails to load.
 */
export async function connectEngine(): Promise<EngineConnection> {
  const worker = new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" });
  const api = Comlink.wrap<EngineApi>(worker);
  const terminate = (): void => {
    api[Comlink.releaseProxy]();
    worker.terminate();
  };

  try {
    const { provenance, start_et, end_et } = await api.info();
    const client: EngineClient = {
      provenance,
      listSites: () => api.listSites(),
      getSunEarth: (epoch_et, location, mast_height_m) =>
        api.getSunEarth(epoch_et, location, mast_height_m),
      getHorizon: (location, mast_height_m) => api.getHorizon(location, mast_height_m),
      getTimeline: (request) => api.getTimeline(request),
      findWindows: (request) => api.findWindows(request),
      probeLit: (location, epoch_et, mast_height_m) =>
        api.probeLit(location, epoch_et, mast_height_m),
    };
    return { client, coverage: { start_et, end_et }, terminate };
  } catch (error) {
    terminate();
    throw error;
  }
}
