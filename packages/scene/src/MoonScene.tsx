import { useEffect, useImperativeHandle } from "react";
import type { MoonSceneProps } from "./types";

/** STUB (S1-01). Dev 2 replaces this with the real terrain scene (S1-06). */
export function MoonScene({ ref, onReady }: MoonSceneProps) {
  useImperativeHandle(ref, () => ({ flyTo: () => undefined }), []);
  useEffect(() => {
    onReady?.();
  }, [onReady]);
  return <div role="img" aria-label="Moon scene (stub, not built yet)" data-stub="moon-scene" />;
}
