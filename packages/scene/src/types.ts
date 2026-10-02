import type { MutableRefObject, Ref } from "react";
import type { Location, SiteId, TileSource } from "@sightline/contracts";

/** Per-frame values the app writes and the scene reads inside `useFrame` (no React state). */
export interface SceneInputs {
  epoch_et: number;
  selected_site_id: SiteId | null;
  layers: Readonly<Record<string, boolean>>;
}

/** Imperative camera control (seam S3). */
export interface CameraHandle {
  flyTo(location: Location): void;
}

export interface MoonSceneProps {
  tileSource: TileSource;
  inputs: MutableRefObject<SceneInputs>;
  ref?: Ref<CameraHandle>;
  onPickLocation?: (location: Location) => void;
  onReady?: () => void;
}

export interface FisheyeSkyProps {
  inputs: MutableRefObject<SceneInputs>;
  location: Location | null;
  onReady?: () => void;
}
