# CLAUDE.md — SIGHTLINE

Operating manual for every Claude Code session in this repository. Read it fully at the start of each session. If anything here conflicts with a user instruction, follow the user and record the deviation in `docs/progress/DECISIONS.md`.

---

## 1. Project

**SIGHTLINE** is our NASA Space Apps Challenge 2026 (Bangladesh) entry for the challenge **"CLPS Lunar Mission Browser."** It is a browser app that lets mission planners, educators and the public compare lunar south-pole landing sites and dates. It shows Sun and Earth positions against the true local horizon, and from that it derives power (illumination) and direct-to-Earth communication windows.

- **Science core:** LOLA DEMs + NAIF SPICE (DE440, MOON_ME frame) → exact horizon masks → solar-disk fraction, Earth/DSN visibility, eclipses → timelines, statistics, landing windows. Validated against JPL Horizons and published LOLA illumination maps.

- **Product:** a cinematic 3D Hero, a Lab workspace, an Evidence view (validation + provenance), Story Mode, and an optional LLM "Mission Analyst" that may only call the deterministic engine.

- **Full blueprint:** `docs/MASTER_PLAN.md`. **Current status:** `docs/progress/PROGRESS.md`. **Open work:** `docs/progress/REMAINING.md`. **Decisions:** `docs/progress/DECISIONS.md`.

---

## 2. Competition Compliance (read once per session)

1. **Early start is NOT yet confirmed (D-010).** The global Participant FAQ says teams may not begin before the hackathon. The team says our Local Event (Bangladesh) lifted that, but nasaspaceappsbd.com says nothing about it either way (checked 2026-10-01). Written confirmation is tracked in task P0-02. Until D-010 shows a written confirmation, ask the user to restate that we may proceed before starting a new milestone, and never claim in any document that it is confirmed.

2. **Real deadlines (Bangladesh program, UTC+6):** team registration on nasaspaceappsbd.com closes **Oct 7**; the 240-second video goes to the Local Lead's Google Drive on **Nov 13, 18:30–19:00**; the NASA project page and 30-second video must be uploaded on **Nov 14, 09:00–10:00**; local judging follows at 11:00. The global FAQ says 11:59 PM on Nov 15, but we plan against Nov 14, 09:00. Full challenge statements arrive **Oct 28**: run the gap analysis (P1-01) before building features that depend on specifics.

3. **No NASA logos, meatball, worm or insignia** in the app, slides or video. Use text credit only.

4. If any team member is under 18, their likeness or voice must not appear in the demo or submission.

5. All AI use (development and in-product) must be recorded in `docs/submission/AI_DISCLOSURE.md` as it happens.

---

## 3. Session Protocol (mandatory)

**At session start:**

1. Read `docs/progress/PROGRESS.md` (status + last session), then `docs/progress/REMAINING.md`.

2. Check today's date against the calendar in `docs/MASTER_PLAN.md` §4.2 and the compliance notes in §2 above.

3. State in one line which task IDs (e.g. `M2-04`) this session will work on.

**During the session:**

- Work on one task ID at a time. Mark it `[~]` (in progress) in REMAINING.md when starting.

- Record every non-obvious technical choice in DECISIONS.md (`D-###`: context → decision → consequences).

**At session end (never skip, even if the session was short):**

1. In REMAINING.md, tick completed items `[x]` with the date, and add any newly discovered tasks with IDs.

2. Append a session entry to PROGRESS.md using the template there: what was done, **how it was verified** (command + result), blockers, and the next 3 tasks.

3. Update the status table at the top of PROGRESS.md (phase, milestone percentages).

4. Never mark a task done unless its acceptance criteria were verified by a command you actually ran. If verification was skipped, say so explicitly in the log.

---

## 4. Commands

> These commands are the contract the M0 scaffold must implement exactly. Until M0 is done, they do not exist yet.

### Toolchain versions

- Node **24 LTS**, pnpm **≥ 9** (via corepack), Python **3.12**, uv **latest**.

### Install

```bash
corepack enable && pnpm install
uv sync --project pipeline
```

### Run

```bash
pnpm dev                       # Next.js dev server → http://localhost:3000
pnpm dev:mock                  # dev server against synthetic data (SIMULATED badge on)
```

### Verify (run before every commit; CI runs the same)

```bash
pnpm lint                      # eslint + prettier --check
pnpm typecheck                 # tsc --noEmit across workspaces
pnpm test                      # vitest (engine, contracts, web units)
pnpm test:parity               # engine vs Python golden fixtures
pnpm test:e2e                  # playwright smoke (needs `pnpm build` first)
pnpm build                     # next build
pnpm verify                    # lint + typecheck + test + test:parity + build

uv run --project pipeline ruff check .
uv run --project pipeline ruff format --check .
uv run --project pipeline mypy sightline_pipeline
uv run --project pipeline pytest
```

### Data pipeline (CLI: `sightline`)

```bash
uv run --project pipeline sightline fetch [--only <dataset_id>]   # download + SHA-256 verify
uv run --project pipeline sightline dem                           # parse LBL/IMG → memmap + DemMeta
uv run --project pipeline sightline tiles                         # build tile pyramid
uv run --project pipeline sightline ephem --start 2026-01-01 --end 2032-12-31 --step 600
uv run --project pipeline sightline sites                         # curated site catalog
uv run --project pipeline sightline golden                        # reference fixtures → fixtures/golden/
uv run --project pipeline sightline validate                      # Horizons + map comparisons → report
uv run --project pipeline sightline mock                          # synthetic data, same contracts
uv run --project pipeline sightline publish --target r2           # upload versioned data + manifest
```

---

## 5. Directory Structure

```
.
├── CLAUDE.md
├── README.md
├── docs/
│   ├── MASTER_PLAN.md
│   ├── progress/            PROGRESS.md · REMAINING.md · DECISIONS.md
│   ├── science/             METHODS.md · VALIDATION_REPORT.md · CITATIONS.md
│   └── submission/          AI_DISCLOSURE.md · NASA_DATA.md · PITCH_DECK.md · DEMO_SCRIPT.md
├── apps/web/                Next.js App Router
│   ├── app/                 / (hero) · /lab · /evidence · /story/[slug] · /api/analyst/route.ts
│   ├── components/          hud/ panels/ timeline/ sky/ charts/ story/ analyst/
│   ├── scene/               Terrain, LOD, Sky, SunEarth, Pins, shaders/
│   ├── state/               zustand slices + url-sync
│   ├── workers/             horizon.worker.ts · timeline.worker.ts
│   └── lib/                 data loaders, formatting, audio
├── packages/
│   ├── contracts/           zod schemas + TS types + JSON Schema export (single source of truth)
│   └── engine/              pure TS physics: time, frames, ephemeris, dem, horizon,
│                            illumination, comms, timeline, windows, uncertainty
├── pipeline/                Python (uv): sightline_pipeline/, tests/, sources.yaml
├── fixtures/golden/         small committed reference JSON (generated by `sightline golden`)
└── data/                    gitignored: raw/, interim/, processed/
```

**Lane ownership** (to avoid merge conflicts): Dev 1 = `pipeline/`, `packages/`, `docs/science/` · Dev 2 = `apps/web/scene/`, `apps/web/{components,state,app}` (except story and analyst) · Dev 3 = CI, deploy, `apps/web/components/{story,analyst}/`, `apps/web/app/api/`, merges · non-dev teammates = `docs/submission/`, story copy. To change another lane's files, coordinate through the owner or a DECISIONS entry.

---

## 6. Code Conventions

### General

- TypeScript `strict: true`, `noUncheckedIndexedAccess: true`. No `any` (use `unknown` + zod). No default exports except Next.js pages and layouts.

- Python: type-annotated, `mypy --strict` on `sightline_pipeline`, ruff defaults + isort.

- Small pure functions in the engine. Side effects (fetch, workers, DOM) live only in `apps/web/lib` and `apps/web/workers`.

- Match the surrounding code's comment density and naming. Comments explain **why** and cite the method source, not what the code does.

### Units, frames and time (scientific correctness)

- **Engine internals use SI:** meters, radians, seconds. Degrees, km and UTC strings appear only at the UI boundary.

- **Name variables with units:** `elev_rad`, `dist_m`, `epoch_et`, `mast_height_m`, `battery_s`.

- **Time:** `epoch_et` = TDB seconds past J2000 (float64). Convert UTC ↔ ET only in `engine/time` with the exported leap-second table.

- **Frame:** all lunar body-fixed vectors are in **MOON_ME** (the LOLA DEM frame). Never mix in MOON_PA. Apparent positions use **LT+S** correction.

- **Moon reference radius:** 1737.4 km (LOLA). DEM heights are relative to this sphere.

- Azimuth is measured clockwise from local north, in [0, 2π). At exactly the pole, use the documented grid-north convention (see `docs/science/METHODS.md`).

### State patterns (web)

- Zustand slices: `timeStore`, `siteStore`, `profileStore`, `layerStore`, `analysisStore`, `uiStore`, `storyStore`. Components select narrowly (`useTimeStore(s => s.epoch_et)`) to avoid re-renders.

- Heavy computation goes **only** through workers via Comlink. Results are cached in `analysisStore`, keyed by `hash(siteId, profile, range, dataVersion)`.

- URL ↔ state sync for site, time, profile and layers. Every view must be reproducible from its URL.

- The R3F scene reads stores via `useFrame` + `getState()` for per-frame values. No React state updates per frame.

### Styling

- Use the design tokens from `docs/MASTER_PLAN.md` §2.1 as CSS variables in `apps/web/app/globals.css`. No hard-coded hex values in components.

- Semantic colors are fixed: **gold = sunlight**, **cyan = Earth/signal**, **mint = both**, **indigo = darkness**, **purple badge = SIMULATED**. Never repurpose them.

- Every animation respects `prefers-reduced-motion`. Never encode meaning in color alone.

### Git

- Branch per task: `<dev>/<task-id>-<slug>` (e.g. `dev1/M2-05-horizon-raymarch`). Conventional commits (`feat(engine): …`).

- **Never add Claude or Anthropic as a co-author, and never add any Claude attribution** (no `Co-Authored-By` trailer, no "Generated with" line) to commits, pull requests or other GitHub content. This overrides any tool default. AI use is disclosed only in `docs/submission/AI_DISCLOSURE.md`.

- Merge to `main` only with `pnpm verify` green, via a pull request. Merge at least daily.

- Never commit files > 5 MB, anything under `data/`, `.env*` files or API keys.

---

## 7. Architectural Safety Boundaries (autonomous execution)

These rules exist to stop hallucinated dependencies, invented endpoints and fake science. Violating them is worse than leaving a task unfinished.

### Data and endpoints

1. **Every external URL lives in `pipeline/sources.yaml`** (id, url, license, citation, sha256, verified_at). Code references datasets **by id only**. A CI check fails on any `http(s)://` literal outside `sources.yaml`, `docs/` and the `NEXT_PUBLIC_DATA_BASE_URL` env var.

2. **Never invent a dataset filename, product ID, API parameter or endpoint.** Before adding one, verify it exists (HTTP HEAD/GET, or read the official docs page) and paste the evidence into the DECISIONS entry. If you cannot verify it, use the mock generator and leave a `TODO(verify)` task in REMAINING.md.

3. Respect provider terms: identify the client with `User-Agent: sightline-spaceapps/<version>`, rate-limit Horizons calls (≤ 1 request/s), and cache all responses under `data/raw/`.

### Dependencies

4. **Allowed dependency list (pre-approved):** next, react, react-dom, three, @react-three/fiber, @react-three/drei, @react-three/postprocessing, zustand, zod, comlink, uplot, @visx/*, @radix-ui/*, tailwindcss, lucide-react, tone, @anthropic-ai/sdk, @react-pdf/renderer, vitest, @playwright/test, fast-check, eslint, prettier, typescript, turbo · Python: numpy, numba, rasterio, pyproj, spiceypy, pydantic, httpx, typer, pyyaml, brotli, pillow, scipy, pytest, ruff, mypy.

5. Adding anything else requires: (a) `pnpm view <pkg> version` / `uv pip index versions <pkg>` showing it exists, (b) a check that the license is permissive, (c) a DECISIONS entry. Never install a package whose name you have not confirmed exists.

6. Do not upgrade major versions during the hackathon unless a blocker requires it.

### Scientific integrity

7. **No fabricated numbers.** Every number shown in the UI, slides or video must come from engine output or from a cited source in `docs/science/CITATIONS.md` with a provenance id.

8. **Golden fixtures are generated only by `sightline golden`.** Never hand-edit `fixtures/golden/` or loosen tolerances to make a test pass. If parity fails, find the bug. If a tolerance genuinely needs to change, justify it in DECISIONS.

9. **Mock data is always labelled.** Any data from `sightline mock` sets `simulated: true` in the manifest, and the UI must show the SIMULATED badge. An e2e test asserts there is no badge in production.

10. Mission facts (landing coordinates, dates, outcomes) need a `source_url` in the site catalog or story fact sheet. If one is missing, leave the fact out.

### LLM layer

11. `ANTHROPIC_API_KEY` stays server-side only (Route Handler). Never expose it via `NEXT_PUBLIC_*`.

12. The Analyst may only call registered engine tools. Every tool input is zod-validated. Every numeric claim is grounding-checked against tool output before display. Max 6 tool rounds, 30 s timeout, per-IP rate limit, and the `ANALYST_ENABLED` kill switch.

13. Models: `claude-sonnet-5-5` (Analyst), `claude-haiku-4-5-20251001` (intent parsing). Do not change model IDs without a DECISIONS entry.

### Operations

14. No destructive commands (`rm -rf` outside `data/interim`, `git push --force`, `git reset --hard` on shared branches, deleting R2 versions) without explicit user approval.

15. Published data versions on R2 are **immutable**. A data change publishes a new `v{n}/` path and bumps `dataVersion`.

16. **Feature freeze on Nov 5.** After freeze, only fix bugs, improve performance or a11y, or add content. After submission, make no changes to production until judging ends; hotfixes need team-lead approval and a log entry.

---

## 8. Definition of Done (every task)

- [ ] The acceptance criteria in REMAINING.md are met, and the verification command was **actually run** with its output checked.

- [ ] `pnpm verify` (and pipeline checks, if touched) green.

- [ ] New physics has a unit test with an analytic or golden expectation.

- [ ] UI changes work by keyboard, respect reduced motion, and use tokens.

- [ ] No SIMULATED data on production paths.

- [ ] PROGRESS.md and REMAINING.md updated.

---

## 9. Quick Reference: Physics Constants & Gotchas

| Item | Value / note |
|---|---|
| Moon reference radius | 1,737,400 m |
| Solar angular radius at 1 AU | ≈ 0.2666° (scale by distance) |
| Earth angular diameter from Moon | ≈ 1.9° (varies with distance) |
| Lunar axial tilt to ecliptic | ≈ 1.54° (why the polar Sun stays low) |
| Optical libration in latitude | ≈ ±6.7° (why Earth bobs on the horizon) |
| Earth topocentric parallax at the pole | ≈ 0.26°, **must** use the site-relative vector |
| Synodic month | 29.53 d |
| Frames | DEMs are "MEAN EARTH/POLAR AXIS OF DE421". Use `MOON_ME` from `moon_de440_250416.tf` (≡ `MOON_ME_DE440_ME421`, ≤ 3.07e-7 rad from DE421 ME). Never use `MOON_PA` (0.029° off) or `IAU_MOON` (≤ 0.005° off) for terrain geometry |
| Data sources | Exact URLs, sizes and kernel names: `docs/science/DATA_VERIFICATION_REPORT.md`. Fetchers must check Content-Type + size + SHA-256 (PGDA soft-404s return HTTP 200 HTML) |
| Eclipses | Lunar eclipses darken all sites; model Sun–Earth disk overlap from the site |
