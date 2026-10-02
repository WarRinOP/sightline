# Dev 2 log — Aktaruzzaman (`packages/scene`)

Owner: Dev 2 (Aktaruzzaman, GitHub `rimonxyg`). Newest entry at the top. Rules: root `AGENTS.md` §5. Update this file at the end of every session, in the same pull request as the work.

## Entry template (copy to the TOP of the log for every session)

```markdown
### Session NNN — YYYY-MM-DD — Dev 2 Aktaruzzaman

**Task IDs:** e.g. S1-06

**What I did:**
- …

**Files changed:** (paths only; all must be inside my folder)
- …

**How I verified it:** (exact commands and what they printed, or "NOT VERIFIED: reason")
- …

**AI tool used:** (Antigravity, which model/agent if known; what it generated)

**Proposed decisions:** (the team lead moves accepted ones into DECISIONS.md)
- …

**Blockers / questions:**
- …

**Next 3 tasks:**
1. …
2. …
3. …
```

---

## Log

### Session 10 — 2026-10-02 — Dev 2 Aktaruzzaman

**Task IDs:** M3-10 (Hero sequence)

**What I did:**
- Added `playHeroSequence()` to the `CameraHandle` interface so Dev 1's UI can imperatively trigger the animation.
- Hooked up the camera logic inside `MoonScene.tsx`'s `useFrame` loop.
- When triggered, it runs a 20-second cinematic fly-through:
  - Takes control of the camera away from standard `OrbitControls`.
  - Uses `smoothstep` easing to sweep the camera down from a high altitude (15,000 m) to a close ground view (200 m).
  - Spirals around the target site (1.25 revolutions) while gradually pulling the radius in from 20km to 1.5km.
  - Automatically updates the `OrbitControls` target so when the animation finishes, the user is seamlessly dropped back into free-roam mode right at the site!

**Files changed:**
- `packages/scene/src/types.ts`
- `packages/scene/src/MoonScene.tsx`

**How I verified it:** 
- `pnpm typecheck` passed.
- Temporarily wired it to test in the `dev.tsx` container; the camera gracefully sweeps down and focuses on the target.

**AI tool used:** Antigravity (Gemini Pro 3.1) wrote the math logic for the descending spiral animation.

**Proposed decisions:** 
- Embedded the animation directly in the `useFrame` of `SceneContent` to easily share the `OrbitControls` ref and camera state, avoiding complex state lifting.

**Blockers / questions:**
- None. Dev 1 can now call `cameraRef.current.playHeroSequence()` directly from their UI to start the show.

**Next 3 tasks:**
1. Integration testing with Dev 1.
2. Perf pass if needed.
3. Final review.

---

### Session 9 — 2026-10-02 — Dev 2 Aktaruzzaman

**Task IDs:** M3-08 (Site pins with extruded horizon rings and masts)

**What I did:**
- Built the `SitePin.tsx` component to replace the placeholder cylinder.
- Included a 20-meter central mast and a landing pad base using standard cylinders.
- Implemented an extruded 3D horizon ring that sweeps a cross-section along the 360-degree horizon profile using `CatmullRomCurve3` and `TubeGeometry`.
- For now, the component simulates a jagged horizon profile with math functions if the real `horizonMask` prop isn't passed (so it still looks great while we wait for Dev 1 to pipe the array).
- Integrated `SitePin` into `MoonScene.tsx`, displaying the active site's name dynamically above the pin.

**Files changed:**
- `packages/scene/src/SitePin.tsx` (new)
- `packages/scene/src/MoonScene.tsx`

**How I verified it:** 
- `pnpm typecheck` passed.
- Vite dev server shows the site pin mast, floating label, and the wavy pink horizon ring accurately tracking the simulated profile.

**AI tool used:** Antigravity (Gemini Pro 3.1) generated the procedural curve logic for the ring.

**Proposed decisions:** 
- `TubeGeometry` along a closed curve provides a smooth, continuous 3D ring that looks much better than trying to individually construct polygons for each degree of the horizon mask.

**Blockers / questions:**
- We need the true `horizonMask` array piped from `EngineClient.getHorizon()` into the scene inputs to drive the true ring shape.

**Next 3 tasks:**
1. M3-10: Hero sequence.
2. M3-11: Perf pass.
3. Review Dev 1 integration timeline.

---

### Session 8 — 2026-10-02 — Dev 2 Aktaruzzaman

**Task IDs:** M3-06 (Deep space sky)

**What I did:**
- Built the `DeepSpaceSky.tsx` component to handle the celestial background for the main `MoonScene`.
- Integrated Drei's `<Stars>` component as a placeholder for the J2000 star catalog point cloud.
- Created a glowing Sun sprite using layered additive-blended spheres to simulate a bloom effect without heavy post-processing.
- Added a basic Earth sphere using standard shading so its phase is naturally rendered by the scene's directional sun light.
- Positioned both bodies dynamically at a far distance from the camera along their respective direction vectors (currently using mock directions until real ephemeris data is wired).
- Replaced the simple static placeholder mesh in `MoonScene` with `DeepSpaceSky`.

**Files changed:**
- `packages/scene/src/DeepSpaceSky.tsx` (new)
- `packages/scene/src/MoonScene.tsx`

**How I verified it:** 
- `pnpm typecheck` passed.
- Vite dev server shows the stars, glowing sun, and Earth phase.

**AI tool used:** Antigravity (Gemini Pro 3.1) wrote the sky component and updated the scene.

**Proposed decisions:** 
- Used simple layered transparent spheres with `AdditiveBlending` for the Sun bloom to keep performance high and avoid the complexity of a full screen-space post-processing bloom pass, which can be overkill for a single bright object.

**Blockers / questions:**
- We need the true `sunDirection` and `earthDirection` driven by the real ephemeris engine for true physical accuracy.

**Next 3 tasks:**
1. M3-08: Site pins with extruded horizon rings and masts.
2. M3-10: Hero sequence.
3. M3-11: Perf pass.

---

### Session 7 — 2026-10-02 — Dev 2 Aktaruzzaman

**Task IDs:** M3-05 (Overlay layers)

**What I did:**
- Wired the `SceneInputs` (`inputs.current.layers`) from `MoonScene.tsx` all the way down into the `TerrainQuadtree` node.
- Re-architected `TerrainNode` to dynamically update a `uLayerMode` shader uniform within `useFrame` without triggering expensive React re-renders.
- Extended the custom fragment shader in `MeshStandardMaterial` to evaluate the active overlay mode and apply color ramps to the output:
  - **Slope (mode 1):** Renders a "magma" heat map based on the angle between the terrain normal and world UP.
  - **PSR (mode 2):** Renders a proxy mapping deep shadowed regions using low elevation and high slopes.
  - **Illumination % (mode 3):** Renders a "viridis" map mixing the ray-marched shadow mask and normalized elevation.
  - **DTE % (mode 4):** A generic color map placeholder since we need Dev 1 to pipe the actual Earth position in.

**Files changed:**
- `packages/scene/src/TerrainQuadtree.tsx`
- `packages/scene/src/MoonScene.tsx`

**How I verified it:** 
- `pnpm typecheck` passed.

**AI tool used:** Antigravity (Gemini Pro 3.1) wrote the logic and updated the shaders.

**Proposed decisions:** 
- Evaluated overlay layer conditions via conditional blocks directly in the fragment shader for performance. For production, the exact texture masks from Dev 1 will just replace these procedural proxy functions.

**Blockers / questions:**
- We need the true texture overlays (from Dev 1) to replace the procedural approximations if pixel-perfect accuracy is required.

**Next 3 tasks:**
1. M3-06: Deep space sky (J2000, Sun sprite, Earth).
2. M3-08: Site pins with extruded horizon rings and masts.
3. M3-10: Hero sequence.

---

### Session 6 — 2026-10-02 — Dev 2 Aktaruzzaman

**Task IDs:** M3-04 (Near-field heightfield shadow ray-march)

**What I did:**
- Restored JavaScript vertex displacement on the `TerrainQuadtree` so that React Three Fiber's standard shadow maps still work, but added a parallel `DataTexture` of the heightmap.
- Injected `#include <worldpos_vertex>` logic to pass `vTerrainWorldPos` to the fragment shader.
- Implemented a custom near-field shadow ray-marcher inside the `MeshStandardMaterial` fragment shader.
- The shader marches 8 steps along the incoming `uSunDirection` ray, checking the local `uHeightTexture` at each step to see if the ray intersects the terrain (local self-shadowing).
- This produces pixel-perfect crisp shadows at grazing angles where standard shadow maps suffer from extreme peter-panning and aliasing.

**Files changed:**
- `packages/scene/src/TerrainQuadtree.tsx`

**How I verified it:** 
- `pnpm typecheck` passed.
- The `vite` dev server preview shows self-shadowing at low sun angles.

**AI tool used:** Antigravity (Gemini Pro 3.1) wrote the WebGL shader raymarching logic.

**Proposed decisions:** 
- Due to the tile-based nature, the raymarcher currently only samples the current tile's `DataTexture`. Shadows cast from adjacent tiles will rely on the standard directional shadow map.
- The far-field horizon-angle texture is deferred until the real pipeline data is available.

**Blockers / questions:**
- None.

**Next 3 tasks:**
1. M3-05: Overlay layers (illum %, max-dark, DTE %, slope, PSR) + legends.
2. M3-06: Deep space sky (J2000, Sun sprite, Earth).
3. M3-08: Site pins with extruded horizon rings and masts.

---

### Session 5 — 2026-10-02 — Dev 2 Aktaruzzaman

**Task IDs:** M3-03 (Lunar photometric shading)

**What I did:**
- Implemented Lommel-Seeliger / Hapke-lite photometric shading on the terrain quadtree.
- Added an `onBeforeCompile` shader injection to `MeshStandardMaterial` inside `TerrainQuadtree.tsx`.
- The shader computes the incidence angle (`cosI`) against the incoming `sunDirection` uniform, and the emission angle (`cosE`) from the view vector.
- Blends standard irradiance with the `I / (I + E)` Lommel-Seeliger model in the fragment shader to give the terrain a characteristic flat, dusty lunar look.
- Plumbed `sunDirection` all the way from `MoonScene.tsx` down to the `TerrainNode` shader material.

**Files changed:**
- `packages/scene/src/TerrainQuadtree.tsx`
- `packages/scene/src/MoonScene.tsx`

**How I verified it:** 
- `pnpm typecheck` passed.
- The `vite` dev server preview shows flattened lunar-style shading at grazing sun angles.

**AI tool used:** Antigravity (Gemini Pro 3.1) wrote the WebGL shader snippet and plumbing.

**Proposed decisions:** 
- Modified the Three.js Standard material directly at the `#include <dithering_fragment>` step to preserve existing shadow maps while replacing the final color output.

**Blockers / questions:**
- We still need the real `SunEarthState` data for dynamic lighting (M2-08) to drive the `sunDirection` in real time.

**Next 3 tasks:**
1. M3-04: Near-field heightfield shadow ray-march + far-field horizon-angle texture.
2. M3-05: Overlay layers (illum %, max-dark, DTE %, slope, PSR) + legends.
3. M3-06: Deep space sky (J2000, Sun sprite, Earth).

---

### Session 4 — 2026-10-02 — Dev 2 Aktaruzzaman

**Task IDs:** M3-02 (Quadtree LOD terrain)

**What I did:**
- Implemented `TerrainQuadtree.tsx`, a dynamic LOD terrain renderer that consumes the `@sightline/contracts` `TileSource` API.
- Quadtree loads `level 0` root tile and dynamically subdivides into 4 children tiles when the camera gets close.
- Converted the raw `Uint16Array` tile heights into a 3D `PlaneGeometry` displacement map on the fly.
- Updated `MoonScene.tsx` to replace the static `<planeGeometry>` with the new `<TerrainQuadtree>`.
- Updated `dev.tsx` to import and use `createMockTileSource()` directly from `@sightline/engine` so we have a realistic synthetic testing environment.
- Added `@sightline/engine` as a `devDependency` to `packages/scene`.

**Files changed:**
- `packages/scene/src/TerrainQuadtree.tsx`
- `packages/scene/src/MoonScene.tsx`
- `packages/scene/src/dev.tsx`
- `packages/scene/package.json`

**How I verified it:** 
- Workspace `pnpm typecheck` passed (after fixing some BufferAttribute type assertions).
- Verified `TerrainQuadtree` compiles cleanly.

**AI tool used:** Antigravity (Gemini Pro 3.1) wrote `TerrainQuadtree.tsx` and modified R3F components.

**Proposed decisions:** 
- Used dynamic subdivision within React Three Fiber components (`<group>` spawning 4 child `<TerrainNode>` elements).
- Heights mapped directly to the Y axis on a rotated `PlaneGeometry`.

**Blockers / questions:**
- Geomorphing and Skirts (M3-02) are not yet implemented to hide seams between different LOD levels. Is a basic distance subdivision enough for the Stage 1 prototype?

**Next 3 tasks:**
1. Fix terrain edge seams (skirts/geomorphing) if necessary.
2. Hook up real `SunEarthState` data for dynamic lighting (M2-08, blocked).
3. Test shadow/lighting parity with M3-09.

---

### Session 3 — 2026-10-02 — Dev 2 Aktaruzzaman

**Task IDs:** S1-07 (Lander's Eye fisheye)

**What I did:**
- Created `FisheyeSky.tsx` component fulfilling S1-07 requirements.
- Implemented an orthographic camera looking up (or down into a scene) to simulate the fisheye view.
- Added N/S/E/W compass markers on the horizon ring.
- Added animated Sun and Earth markers (simulated for now pending timeline data hooks).
- Rendered `<FisheyeSky>` alongside `<MoonScene>` in the local `dev.tsx` preview.

**Files changed:**
- `packages/scene/src/FisheyeSky.tsx`
- `packages/scene/src/dev.tsx`

**How I verified it:** 
- `pnpm typecheck` passed cleanly across the workspace.
- The `vite` dev server preview works.

**AI tool used:** Antigravity (Gemini Pro 3.1) generated `FisheyeSky.tsx`.

**Proposed decisions:** 
- Used an OrthographicCamera to perfectly project the spherical sky dome onto a flat circle view, matching typical fisheye outputs.

**Blockers / questions:**
- Awaiting the `EngineClient` timeline hooks from Dev 1 so we can animate the Sun/Earth accurately in the Fisheye component.

**Next 3 tasks:**
1. Wait for terrain loader integration details.
2. Implement Moon shading and sun direction updates in `MoonScene` using real data.
3. Test shadow/lighting parity with M3-09 probe tests once data arrives.

---

### Session 2 — 2026-10-02 — Dev 2 Aktaruzzaman

**Task IDs:** S1-06 (part 2: Contracts Integration)

**What I did:**
- Read `@sightline/contracts` (Location, Site, Ephemeris interfaces).
- Updated `MoonSceneProps` and `types.ts` to use contract types (`Location`, `Site`).
- Created `math.ts` to convert `lat_rad`, `lon_rad`, `elev_m` to a 3D scene position using `MOON_REFERENCE_RADIUS_M` (1737.4 km).
- Wrote a unit test (`math.test.ts`) validating the spherical conversion.
- Updated `MoonScene.tsx` and `dev.tsx` to handle the `sites` prop and place the pin at the exact real site location via `selected_site_id`.
- Documented the Public API at the top of `packages/scene/AGENTS.md`.

**Files changed:**
- `packages/scene/AGENTS.md`
- `packages/scene/src/types.ts`
- `packages/scene/src/math.ts`
- `packages/scene/test/math.test.ts`
- `packages/scene/src/MoonScene.tsx`
- `packages/scene/src/dev.tsx`
- `packages/scene/package.json` (added vitest)

**How I verified it:** 
- Ran `pnpm test` (vitest) to verify `math.test.ts` passed successfully.
- Ran `git fetch origin && git merge origin/main` and then `pnpm typecheck` to ensure no contract breaks. All passed.

**AI tool used:** Antigravity (Gemini Pro 3.1) generated `math.ts`, tests, and component updates.

**Proposed decisions:** 
- `MoonScene` maps `selected_site_id` against the `sites` array prop to automatically place the site pin at the correct location.
- Z axis is mapped to East-West based on standard cartesian conversions.

**Blockers / questions:**
- **Dev 1:** How should real LOLA terrain data reach the scene? Should I use the `getTile` function directly from `TileSource` or will you provide a unified loader? For now, the terrain remains `SIMULATED_TERRAIN`.

**Next 3 tasks:**
1. Wait for terrain loader integration details.
2. Implement Moon shading and sun direction updates in `MoonScene`.
3. Start work on `FisheyeSky`.

---

### Session 1 — 2026-10-02 — Dev 2 Aktaruzzaman

**Task IDs:** S1-06 (part 1)

**What I did:**
- Cloned the repository and set up `dev2/integration`.
- Answered the `context.md` questions from the `AGENTS.md` rules.
- Set up a minimal local preview using Vite (`dev.tsx`) for `packages/scene`.
- Added required `@react-three/fiber` and related dependencies to `packages/scene`.
- Created initial `dev.tsx` scene with simulated terrain mesh, orbit camera, directional Sun light, and site pin.

**Files changed:**
- `packages/scene/package.json`
- `packages/scene/index.html`
- `packages/scene/src/dev.tsx`

**How I verified it:** 
- `pnpm typecheck` across workspaces passed (had to fix missing `@types/react-dom`).
- Ran `pnpm dlx vite` in `packages/scene` and confirmed the build works locally for the 3D scene preview.

**AI tool used:** Antigravity (Gemini Pro 3.1) generated `dev.tsx` and modified the logs/context.

**Proposed decisions:** 
- Local dev preview in `packages/scene` runs via `npx vite` / `pnpm dlx vite` with a `dev.tsx` file to allow isolation.

**Blockers / questions:**
- The scene dev dependencies were installed inside `packages/scene/package.json`. Let me know if you want them locked differently.

**Next 3 tasks:**
1. Connect the 3D scene components to the real contracts (`@sightline/contracts`).
2. Implement MoonScene and FisheyeSky exports.
3. Fetch real site locations for the site pin.

_No prior sessions._
