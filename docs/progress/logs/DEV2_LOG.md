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
