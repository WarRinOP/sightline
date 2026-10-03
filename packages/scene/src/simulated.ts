import { useEffect, useState, type MutableRefObject } from "react";
import type { HorizonMask, SunEarthState, TileManifest, TileSource } from "@sightline/contracts";
import type { SceneInputs } from "./types";

/** The scene shows the SIMULATED badge when any data it draws is simulated (D-030, CLAUDE.md 7.9). */
export function isSimulated(
  sunEarth: SunEarthState | null | undefined,
  horizon: HorizonMask | null | undefined,
  manifest: TileManifest | null | undefined,
): boolean {
  return (
    sunEarth?.simulated === true || horizon?.simulated === true || manifest?.simulated === true
  );
}

/** Re-reads the per-frame inputs a few times a second; the badge need not follow every frame. */
export function useSimulated(
  tileSource: TileSource,
  inputs: MutableRefObject<SceneInputs>,
  horizon: HorizonMask | null,
): boolean {
  const [manifest, setManifest] = useState<TileManifest | null>(null);
  const [simulated, setSimulated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    tileSource.getManifest().then(
      (m) => {
        if (!cancelled) setManifest(m);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [tileSource]);

  useEffect(() => {
    const read = () => setSimulated(isSimulated(inputs.current?.sun_earth, horizon, manifest));
    read();
    const id = setInterval(read, 250);
    return () => clearInterval(id);
  }, [inputs, horizon, manifest]);

  return simulated;
}
