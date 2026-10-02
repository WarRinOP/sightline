import { useEffect } from "react";
import type { FisheyeSkyProps } from "./types";

/** STUB (S1-01). Dev 2 replaces this with the Lander's Eye fisheye (S1-07). */
export function FisheyeSky({ onReady }: FisheyeSkyProps) {
  useEffect(() => {
    onReady?.();
  }, [onReady]);
  return <div role="img" aria-label="Fisheye sky (stub, not built yet)" data-stub="fisheye-sky" />;
}
