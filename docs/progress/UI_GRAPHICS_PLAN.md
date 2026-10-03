# 3D view: review and improvement plan

Written 2026-10-03 from a browser review of the Lab page on real LOLA tiles. Tasks are
S1-15 to S1-20 in [REMAINING.md](REMAINING.md). Nothing in this plan is built yet. Code: `packages/scene`
(Dev 2's, edited by Dev 1 under D-031) and `apps/web/app/scene-panel.tsx`.

## How it was reviewed

`pnpm --filter @sightline/web build` then `next start`, driven with `playwright-cli` in headless
Chromium (software rendering, so the frame rate of about 30 fps says nothing about a real GPU): the time
slider set to chosen days, the camera orbited by mouse drags at two pitches, the Hero flight run, about
150 screenshots, and pixel scans for the Earth's blue. The Earth's elevation at Shackleton over the
first 30 days of the ephemeris (read from the page): +6.1 deg on day 0, +0.3 deg on day 6, -7.2 deg on
day 14, +1.0 deg on day 22. The Sun stays between +0.6 and +1.3 deg.

Evidence images: [the Earth on the ridge](images/graphics-review-blue-earth-on-ridge.png) (day 22, the
camera low, four frames), [orbit views](images/graphics-review-orbit-views.png) (day 0).

## What was seen

1. **The blue planet that "goes inside the Moon" is the Earth.** `DeepSpaceSky.tsx` draws the Earth and
   the Sun as ordinary 3D spheres at `camera + direction x 100 km` and depth-tests them against the
   terrain. The terrain 100 km away has relief of kilometres, so a ridge cuts the sphere; as the time
   animation moves the Earth by about a degree a day, or the camera rotates, it sinks into the ridge.
   Reproduced on day 22 (Earth about +1 deg): the sphere sits on the crest, half hidden. A real Earth is
   384,000 km away and can only be hidden by the horizon. It is also a flat uniform blue ball about 18
   px across, with no texture. With the Earth below the horizon (tested on days 9 and 14, at -4 and -7 deg) no blue was seen in 44
   Hero frames and 18 orbit frames; the cause above is a reading of the code and the day-22 frames, not
   a measurement of every case.
2. **Very dark.** The polar Sun is 0 to 2 deg up, so most of the frame is black. The shader gives
   shadowed ground only a tiny ambient term.
3. **Faceted, uniform look.** The terrain material has `flatShading: true` and one grey colour.
4. **White speckled streaks** on sunlit slopes (from the 8-step shadow march) and **straight-edged lit
   and dark patches**. The patches may be tile boundaries: the march reads only its own tile's heights.
   Not confirmed.
5. **Pin label is mirrored** when seen from behind. The Sun is a dot of about 4 px with no glow.
6. **The far terrain is a flat plane**: no curvature (at 300 km the real Moon drops about 26 km), so
   the horizon is a ruler line.

## Plan

| ID | Change | Effort | Acceptance (checked in a browser, not by tests alone) |
|---|---|---|---|
| S1-15 | Sun and Earth drawn as background: first in the render order, no depth test or depth write; hidden when the engine says they are below the horizon (`earth_visible` false, `sun_disk_fraction` 0). Real angular sizes kept (Sun radius 0.2666 deg, Earth 0.95 deg). | 1 to 2 h | Day 22, camera low, orbit: the Earth never overlaps a ridge in 18 frames; day 14 shows no Earth. A unit test of the visibility rule. |
| S1-16 | Terrain look: smooth normals from the height data (no flat shading), a faint fill light standing for earthshine, tone mapping and exposure so shadowed ground is readable. | 3 to 4 h | Day 0 orbit frames: relief readable in lit and shadowed ground; no pitch-black areas except the true shadows; the SIMULATED and no-data paths unchanged. |
| S1-17 | Sun glow (bloom with `@react-three/postprocessing`, on the allowed list; check it exists, its licence and add a DECISIONS entry first), a thinner horizon ring, labels that always face the camera. | 2 to 3 h | The label is never mirrored; the Sun reads as a bright disc with a glow; frame rate not worse than before in the same browser. |
| S1-18 | Shadows: more march steps across tile edges (or use the engine's horizon mask for the far field). Needs a decision on cost. The shadows stay labelled "visual only" until `probeLit` agrees with them (M3-09). | 0.5 to 1 day | No tile-edge patches or speckle in the same views; 20 random probes agree with `probeLit`. |
| S1-19 | Earth texture (NASA imagery, credit as text only, no NASA logo; record the source in `pipeline/sources.yaml` and CITATIONS.md) and a real star catalogue. | 3 to 5 h | Credit line on screen and in the README; nothing fabricated. Low priority. |
| S1-20 | Curvature drop for the far terrain (`d^2 / 2R`) in the vertex shader. | 2 to 3 h | The horizon curves at 50 km view distance; the pin and ring are not displaced. Low priority. |

Recommended order for Stage 1: S1-15, S1-16, S1-17 (about half a day), then re-shoot the Hero capture
(S1-12). S1-18 to S1-20 only if time remains.

## Rules that still apply

The scene draws what the engine returns and says "no data" otherwise (D-030). The 3D light and shadows
are visual only and the page says so. The Sun is never lit by a default direction. No hex colours
outside `packages/scene/src/palette.ts` and `apps/web/app/globals.css`. Respect `prefers-reduced-motion`.
Check every visual change in a real browser against `next start`, on days 0, 14 and 22, before claiming
it works.
