import * as Comlink from "comlink";
import { createEngineApi } from "./engineApi";

// The bundler turns this into an asset URL, so the file is fetched once, off the main thread.
const EPHEMERIS_URL = new URL(
  "../../../packages/engine/src/data/ephemeris_2026_3600s.bin",
  import.meta.url,
);

async function loadEphemerisBytes(): Promise<ArrayBuffer> {
  const response = await fetch(EPHEMERIS_URL);
  if (!response.ok) throw new Error(`ephemeris download failed: HTTP ${response.status}`);
  return response.arrayBuffer();
}

// Expose before any await: a message that arrives while the file loads must not be dropped.
Comlink.expose(createEngineApi(loadEphemerisBytes));
