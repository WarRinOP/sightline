import type { MutableRefObject, Ref } from "react";
import type { Location, SiteId, TileSource } from "@sightline/contracts";

/** Per-frame values the app writes and the scene reads inside `useFrame` (no React state). */
export interface SceneInputs {
  epoch_et: number;
  selected_site_id: SiteId | null;
  layers: Readonly<Record<string, boolean>>;
  sun_earth: import("@sightline/contracts").SunEarthState | null;
}

/** Imperative camera control (seam S3). */
export interface CameraHandle {
  flyTo(location: Location): void;
  playHeroSequence(): void;
}

export interface MoonSceneProps {
  sites: import("@sightline/contracts").Site[];
  tileSource: TileSource;
  inputs: MutableRefObject<SceneInputs>;
  horizon: import("@sightline/contracts").HorizonMask | null;
  ref?: Ref<CameraHandle>;
  onPickLocation?: (location: Location) => void;
  onReady?: () => void;
}

export interface FisheyeSkyProps {
  inputs: MutableRefObject<SceneInputs>;
  tileSource: TileSource;
  location: Location | null;
  horizon: import("@sightline/contracts").HorizonMask | null;
  onReady?: () => void;
}
