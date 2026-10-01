# AGENTS.md — `apps/web/` (Dev 3: Fuad Hasan)

You own this folder, **except** `app/api/` and `workers/` (those are Dev 1's). The root `AGENTS.md` rules also apply (read it first). Your log: `docs/progress/logs/DEV3_LOG.md`. Your branch: `dev3/integration`. Every push is reviewed by the team lead before it reaches `main`.

## What you build

The product screens, around the 3D scene and the engine:

- **Design system:** tokens in `app/globals.css`, fonts via `next/font` (IBM Plex Sans, Condensed, Mono; Instrument Serif for story headlines), `GlassPanel`, `HudReadout`, `SimulatedBadge`.

- **App shell and routes:** `/` (Hero and landing), `/lab`, `/evidence`, `/story/[slug]`.

- **State:** Zustand slices (`timeStore`, `siteStore`, `profileStore`, `layerStore`, `analysisStore`, `uiStore`, `storyStore`) and **URL sync**, so every view is a shareable link.

- **Lab:** site list with click-to-add custom pin; lander profile form (mast, battery hours, minimum Earth elevation, DSN elevation mask); **timeline scrubber** (zoom years → hours, play, jump to next event); the **mission barcode**; readouts.

- **Window Finder UI** (the logic is the `windows/` module, see below).

- **Evidence page:** time series (uPlot), histograms, comparison radar, validation table, provenance drawer.

- **Story engine and tour** (steps are JSON that drive the real stores), the **Analyst chat UI** with a "Show work" drawer, keyboard shortcuts, accessibility, responsive layouts, exports, end-to-end tests.

## What you must not do

- No physics and no NASA data handling. Every number comes from the **`EngineClient`** (real or mock). Never type a science number into the UI by hand.

- Do not edit `apps/web/app/api/`, `apps/web/workers/`, `packages/contracts`, `packages/engine` (except `src/windows/`), `packages/scene`, root configs, or the lockfile.

- Never put an API key anywhere. The AI assistant is called only through the server route that Dev 1 builds.

- Do not write story facts yourself. Story copy and facts come from the non-dev teammates' fact sheet.

## Interfaces you use (frozen)

- **`EngineClient`** (from `packages/contracts`): `listSites`, `getHorizon`, `getSunEarth`, `getTimeline`, `findWindows`, `probeLit`. Build against the **mock engine** first (it is marked SIMULATED); Dev 1 swaps in the real engine without changing your code. Target for the mock: Oct 2.

- **Scene API** (from Dev 2's `packages/scene`): `<MoonScene />`, `<FisheyeSky />`, a camera handle with `flyTo`. You pass inputs as props plus one mutable `inputs` ref. The scene never imports your stores.

- **State and story-step schemas** (in contracts).

- **Analyst stream** (Dev 1 server → your chat UI): events `text_delta`, `tool_call`, `tool_result`, `claim_check`, `final`, `error`.

## Styling rules

- Hex colours live **only** in `app/globals.css` as CSS variables. Components use the variables.

- Semantic colours never change: gold = sunlight, cyan = Earth/signal, mint = both, indigo = darkness, purple badge = SIMULATED.

- Every animation respects `prefers-reduced-motion`. Keyboard for everything (Space play/pause, ←/→ step, Shift+←/→ jump to next event, 1–4 select site, L layers, ? help).

## Allowed packages

`next`, `react`, `react-dom`, `zustand`, `zod`, `comlink`, `uplot`, `@visx/*`, `@radix-ui/*`, `tailwindcss`, `lucide-react`, `tone`, `vitest`, `@playwright/test`, `fast-check`. Anything else: ask the team lead first.

## The delegated module: `packages/engine/src/windows/`

You also own this one folder inside Dev 1's package (it has its own `AGENTS.md`): pure functions that find and rank landing windows from the engine's per-step states. No UI code in there.

## Your tasks (Stage 1, Oct 1–6) — see `docs/progress/REMAINING.md`

1. **S1-08** App shell, tokens, landing page, Lab page with 3 preset sites, scrubber and readouts.

2. **S1-09** Mission barcode from the timeline.

3. **S1-10** Evidence page v0: a validation table fed by the JSON that Dev 1 produces.

Start today with the tokens, fonts, `GlassPanel`, `HudReadout` and the empty shell with the four routes. They need nobody else.

## Done means

Keyboard works, no console errors, a screenshot or clip in every pull request, your log updated, and no files outside this folder changed.
