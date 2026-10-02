# AGENTS.md — `packages/scene/` (Dev 2: Aktaruzzaman)

You own this folder and nothing else. The root `AGENTS.md` rules also apply (read it first). Your log: `docs/progress/logs/DEV2_LOG.md`. Your branch: `dev2/integration`. Every push is reviewed by the team lead before it reaches `main`.

## Public API (for Dev 3)
- `MoonScene`: `<MoonScene sites={Site[]} tileSource={TileSource} inputs={MutableRefObject<SceneInputs>} ref={Ref<CameraHandle>} onPickLocation={fn} onReady={fn} />`
- `FisheyeSky`: `<FisheyeSky inputs={MutableRefObject<SceneInputs>} location={Location} onReady={fn} />`
- Types: `SceneInputs`, `CameraHandle`, `MoonSceneProps`, `FisheyeSkyProps`.

## What you build

The whole 3D part of SIGHTLINE, as a self-contained React Three Fiber package:

- **Terrain** of the lunar south pole, from tiles, with level of detail, no cracks, smooth transitions.

- **Lunar shading** (matte, no shine) and **shadows**: ray-march toward the Sun in the shader.

- **Sky:** stars, the Sun with a glow, Earth with the correct phase.

- **Site pins** with a **horizon ring** and a **mast**.

- **Overlay layers** (illumination %, longest night, comms %, slope, permanently shadowed regions) with a legend.

- **Camera:** orbit, plus a smooth `flyTo(location)` along a great-circle arc.

- **Hero sequence:** a 20-second automatic fly-in with a still-image fallback.

- **`FisheyeSky`:** the round "Lander's Eye" view: the horizon silhouette, the Sun's path in gold, Earth's looping path in cyan, and a "now" marker.

## What you must not do

- No physics. You do not compute Sun/Earth positions, horizons or illumination. You **draw** what the engine returns.

- No data parsing, no downloads, no fetching NASA files.

- Do **not** import the app's stores or pages. Your package knows nothing about `apps/web`.

- Do not edit `packages/contracts`, `packages/engine`, `apps/web`, root configs, or the lockfile.

## The interface you must keep (frozen, "S3")

Your package exports components and a handle. Names are indicative; the real types come from `packages/contracts` once Dev 1 publishes it (target: Oct 2).

- `<MoonScene />` props: the list of sites, the selected site id, which layers are on, overlay rasters, and callbacks `onPickLocation(location)` and `onReady()`.

- **Per-frame values (time, selected site, layer toggles) are passed in one mutable `inputs` ref** that you read inside `useFrame`. **Do not trigger React re-renders every frame.**

- `<FisheyeSky />` props: a horizon mask, Sun and Earth paths, the "now" marker.

- A camera handle exposing `flyTo(location)`.

You receive terrain through a `TileSource` (from the contracts): a manifest plus `getTile(level, x, y)`. Build against the **mock tile source** first (marked SIMULATED), then the real tiles when they land.

## Palette

Keep the colours in one file, `src/palette.ts`, copied from `docs/MASTER_PLAN.md` §2.1: void `#05070A`, sun `#FFC857`, sun-hot `#FFE3A3`, earth `#4CC9F0`, mint `#B8F2A0`, dark `#4B3FC4`, SIMULATED purple `#C77DFF`. No other file may contain hex colours.

## Allowed packages

`three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `vitest`. Anything else: ask the team lead first.

## Targets

- 60 FPS in the Lab on a laptop, at least 45 FPS in the Hero.

- No console errors. Clean up GPU resources on unmount.

- 20 random probe points: lit/unlit in your shader must agree with the engine's `probeLit` answer (you write this test once the probe API exists).

## Your tasks (Stage 1, Oct 1–6) — see `docs/progress/REMAINING.md`

1. **S1-06** Terrain scene: synthetic heightfield → mock tiles → one real tile if it arrives; Sun light driven by `getSunEarth`; site pin; orbit camera; capture the 20-second Hero for the video.

2. **S1-07** (stretch) `FisheyeSky`.

Start today with the synthetic heightfield and an orbit camera. It needs nobody else.

## Done means

60 FPS, no console errors, a screenshot or short clip in every pull request, your log updated, and no files outside this folder changed.
