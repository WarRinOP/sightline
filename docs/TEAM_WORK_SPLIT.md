# Team Work Split — SIGHTLINE

Who builds what, so three developers can work in parallel without touching each other's files. Decision D-013.

**Tools:** Dev 1 (you) has Claude Code. Dev 2 and Dev 3 have Antigravity only. That shapes the split: Dev 1 takes everything where one wrong number or one broken contract hurts the whole project. Dev 2 and Dev 3 take work that is visible, testable on its own, and cheap to fix.

---

## 1. Principles

1. **One owner per folder.** Nobody edits another person's folder. If you need a change there, you open an issue or ask in the daily sync.

2. **Contracts first, then mocks, then real parts.** Dev 1 publishes the shared data definitions and a **mock engine** in the first 3 days. Dev 2 and Dev 3 build against the mock and never wait for real physics. Swapping mock for real is a one-line change.

3. **Sensitive work stays with Dev 1.** Physics, frames, data pipeline, validation, the AI assistant's server side, secrets, deployment and merges.

4. **Small tickets, written down.** Antigravity works best with a tight spec: goal, files to touch, inputs and outputs, a test that proves it works, and "do not touch". Every task in [REMAINING.md](progress/REMAINING.md) becomes one or more such tickets (GitHub Issues).

5. **Dev 1 merges everything.** Pull requests only, one merge window twice a day, CI must be green.

---

## 2. At a glance

| | **Dev 1 — Core** (you, Claude Code) | **Dev 2 — Scene** (Antigravity) | **Dev 3 — Product UI & Story** (Antigravity) |
|---|---|---|---|
| **One line** | The calculator, the data, the proof, and the glue | The 3D Moon and the sky views | The screens, timeline, charts and guided tour |
| **Hardest thing** | Exact horizon and Sun/Earth geometry that matches JPL | Fast, good-looking terrain and shadows at 60 FPS | A polished, accessible Lab that stays in sync with the URL |
| **Share of total effort (rough)** | ~45% | ~25% | ~30% |
| **Non-dev teammates** | Review the disclosure text | Supply screenshots/clips for the video | Supply story copy, fact-check numbers |

---

## 3. Folder ownership

| Path | Owner | Notes |
|---|---|---|
| `packages/contracts/` | **Dev 1** | **Frozen after Oct 3.** Changes only through an issue labelled `contract-change` |
| `packages/engine/` | **Dev 1** | Exception: `packages/engine/src/windows/` is delegated to **Dev 3** (see §5) |
| `pipeline/`, `fixtures/golden/`, `data/` | **Dev 1** | |
| `docs/science/` | **Dev 1** | |
| `apps/web/app/api/` (Analyst route) | **Dev 1** | Holds `ANTHROPIC_API_KEY` |
| `apps/web/workers/` | **Dev 1** | Worker wrappers around the engine |
| `.github/`, CI, Vercel, R2, root configs, lockfile | **Dev 1** | Nobody else edits `pnpm-lock.yaml`, `package.json` at the root, or `tsconfig` roots |
| `packages/scene/` | **Dev 2** | The whole 3D package: terrain, LOD, shaders, sky, pins, Fisheye, camera rig |
| `apps/web/app/` (pages), `apps/web/components/`, `apps/web/state/`, `apps/web/lib/` | **Dev 3** | Except `app/api/` (Dev 1) |
| `apps/web/components/story/`, story JSON | **Dev 3** | |
| `docs/submission/`, story copy | **Non-dev teammates** | Dev 1 signs off on numbers |

**New dependencies:** ask Dev 1 in an issue. Only packages on the allowed list in CLAUDE.md §7 may be installed, and only Dev 1 changes the lockfile.

---

## 4. The five seams (interfaces between lanes)

These are agreed in M0 and **do not change without Dev 1.** Names are indicative; the real types live in `packages/contracts`.

**S1 — `EngineClient`** (Dev 1 builds; Dev 2 and Dev 3 call it from the browser, through a web worker):

- `listSites()` returns the preset sites.
- `getHorizon(location, mast_m)` returns a horizon mask (angle per azimuth).
- `getSunEarth(epoch_et, location)` returns Sun/Earth azimuth, elevation, visible disk fraction and DSN visibility.
- `getTimeline(request)` returns per-step states plus statistics (illumination %, longest night, comms %).
- `findWindows(request)` returns ranked landing windows (implemented by Dev 3's delegated module).
- `probeLit(location, epoch_et)` answers "is this point lit right now?" (used to test the 3D shadows against the engine).
- A **mock** implementation ships with M0 (synthetic crater, analytic Sun path), marked `SIMULATED`.

**S2 — `TileSource`** (Dev 1 builds; Dev 2 consumes): a manifest plus `getTile(level, x, y)` returning heights and an offset. Mock first (synthetic terrain), then the real tiles from the pipeline.

**S3 — Scene API** (Dev 2 builds; Dev 3 consumes):

- Components: `MoonScene`, `FisheyeSky`.
- A camera handle with `flyTo(location)`.
- Inputs are passed as **props and one mutable `inputs` ref** for per-frame values (time, selected site, layers). The scene never imports the stores.
- Events out: `onPickLocation`, `onReady`.

**S4 — App state and story steps** (Dev 3 owns; shape lives in contracts): the URL/state schema (site, time, profile, layers) and the story-step JSON (camera, epoch, sites, profile, layers, caption, duration).

**S5 — Analyst stream** (Dev 1 server; Dev 3 chat UI): a stream of events: `text_delta`, `tool_call`, `tool_result`, `claim_check`, `final`, `error`. The UI shows the "Show work" drawer from these events.

---

## 5. Task assignment

Task IDs come from [REMAINING.md](progress/REMAINING.md).

| Milestone | Dev 1 (you) | Dev 2 (Scene) | Dev 3 (UI & Story) | Non-dev |
|---|---|---|---|---|
| **M0** Setup and contracts | All (M0-01 … M0-08), including mocks and CI | Sets up Antigravity and the worktree | Sets up Antigravity and the worktree | — |
| **M1** Data pipeline | All (M1-01 … M1-10) | — | — | — |
| **M2** Engine | All except `windows` (M2-01 … M2-08, M2-10 … M2-14) | — | **M2-09 `windows/`**: constraint search, scoring and Pareto ranking, with property tests | — |
| **M3** 3D canvas | M3-09: provides the probe API and reviews | **M3-01 … M3-08, M3-10, M3-11** (M3-09 test is written by Dev 2) | — | — |
| **M4** UI and state | Wires the workers; provides real data | Supplies the scene inside the Lab page | **M4-01 … M4-11** | — |
| **M5** Story, Analyst, polish | **M5-04** server route, tool layer, grounding checker, kill switch | M5-07 hero/phone fallbacks | **M5-01, M5-02** story engine and tour; **M5-04** chat UI; **M5-05** sonification (stretch); **M5-06** exports; **M5-09** Lighthouse | **M5-03** fact sheet; **M5-08** hallway test |
| **M6** Deploy and deliverables | **M6-01, 02, 04, 08, 09, 10** | Clips and screenshots for the videos; browser perf checks | Cross-browser and phone checks | **M6-05, 06, 07, 11, 12** (deck, 30 s and 240 s videos, disclosures, rehearsal) |
| **Setup tasks** | P0-02, P0-12, P0-13 | — | — | P0-14 (BD registration), P0-15 |

---

## 6. Per-person briefs

### Dev 1 — Core (you, Claude Code)

**You own:** contracts, mock engine, data pipeline, the physics engine, validation, workers, the Analyst server side, CI, deployment and all merges.

**Why you:** these are the parts where a silent mistake is fatal (a wrong frame puts shadows in the wrong place, a fake number loses the Science award).

**Order of work:**

1. **Oct 1–3:** repo scaffold, `packages/contracts`, mock engine and mock tiles, CI, start the overnight data downloads. This unblocks Dev 2 and Dev 3.
2. **Oct 3–14:** pipeline (tiles, ephemeris, golden fixtures) and engine (`time`, `frames`, `ephemeris`, `dem`, `horizon`) with parity tests.
3. **Oct 14–28:** `illumination`, `comms`, `timeline`, Horizons validation, uncertainty. Real data replaces the mocks.
4. **Oct 28:** gap analysis against the full challenge statement.
5. **Oct 29–Nov 5:** Analyst server side; support integration.
6. **Nov 5–13:** deploy, final validation report, submission.

**Use Claude Code for review too:** run a review on every incoming pull request from Dev 2 and Dev 3, so your time goes to the decisions, not to reading every line.

### Dev 2 — Scene (Antigravity)

**You own:** `packages/scene/`. Everything you see in 3D, plus the Lander's-Eye fisheye sky.

**Deliverables:**

- Terrain from tiles with level of detail, no cracks, smooth transitions.
- Lunar-style shading; shadows by ray-marching toward the Sun (near field) plus a far-field horizon texture.
- Star sky, Sun with glow, Earth with the correct phase.
- Site pins with a horizon ring and a mast.
- Overlay layers (illumination %, longest night, comms %, slope, permanently shadowed regions) with a legend.
- Camera: orbit and a smooth `flyTo` along a great-circle arc.
- The 20-second Hero sequence with a still-image fallback.
- `FisheyeSky`: horizon silhouette, Sun and Earth paths, "now" marker.

**Not yours:** any physics, any data parsing, any app state, any page layout.

**First three tickets (no waiting on anyone):**

1. A synthetic heightfield in React Three Fiber with an orbit camera and a directional "Sun" light.
2. A site pin with a horizon ring drawn from a fake horizon array.
3. A `TileSource` interface and a loader that renders from the mock tiles once Dev 1 publishes them (around Oct 3).

**Done means:** 60 FPS in the Lab on a laptop; 20 random probe points agree with `probeLit` (test written by you); no console errors; screenshots in each pull request.

### Dev 3 — Product UI & Story (Antigravity)

**You own:** the app pages, all panels, state, charts, the guided tour, and the delegated `windows/` engine module.

**Deliverables:**

- Design tokens and fonts, `GlassPanel`, `HudReadout`, app shell and routes.
- State slices and **URL sync** (every view is a shareable link).
- Site list with click-to-add custom pin; lander profile form (mast, battery, comms minimums).
- Timeline scrubber (zoom from years to hours, play, jump to next event) and the **mission barcode**.
- Window Finder UI, and the `windows/` module behind it.
- Evidence page: time series, histograms, comparison radar, validation panels, uncertainty bands, provenance drawer.
- Story engine and the 90-second "Light & Signal" tour (copy comes from the non-dev teammates).
- Analyst chat UI with the "Show work" drawer.
- Keyboard shortcuts, accessibility, responsive layouts, exports (CSV/JSON, calendar file; PDF and sonification are stretch).
- End-to-end tests.

**Not yours:** physics, data, 3D internals, API keys, root configs.

**First three tickets (no waiting on anyone):**

1. Tokens, fonts, `GlassPanel`, `HudReadout`, and the empty app shell with the four routes.
2. State slices with URL sync, typed against placeholders.
3. A timeline scrubber and barcode driven by fake timeline data.

**Done means:** the full Lab flow works by keyboard; the URL reproduces any view; Lighthouse accessibility ≥ 95; end-to-end test passes (select site → profile → windows → export).

---

## 7. Calendar by person

| Week | Dev 1 (Core) | Dev 2 (Scene) | Dev 3 (UI & Story) |
|---|---|---|---|
| **W1** Oct 1–7 | Scaffold, contracts, mocks, CI; downloads; `time`, `frames`, `ephemeris` | Synthetic terrain, pins, orbit camera; then mock tiles | Tokens, shell, stores, URL sync; scrubber with fake data |
| **G1 Oct 7** | CI green; real tiles of one site; Sun az/el from SPICE | Terrain renders mock tiles | App shell and stores run |
| **W2** Oct 8–14 | Tiles + ephemeris published; `horizon` + parity tests | LOD, shading, shadow ray-march | Site list, profile form, barcode; `windows/` module starts |
| **G2 Oct 14** | One site end to end, validated | Terrain with shadows on real tiles | Lab shows real horizon and timeline for one site |
| **W3** Oct 15–21 | `illumination`, `comms`, `timeline`, Horizons validation | Sky, Sun/Earth, fisheye, overlays | Window Finder UI, Evidence view start |
| **G3 Oct 21** | Validation report v1 | Lab scene complete on 3 real sites | Lab usable on 3 sites |
| **W4** Oct 22–28 | Uncertainty from NASA clones; **Oct 28 gap analysis** | Hero sequence, probe test | Evidence view, provenance drawer, story engine |
| **G4 Oct 28–30** | Plan v1.2, challenge locked | | |
| **W5** Oct 29–Nov 4 | Analyst server side, integration, perf | Perf pass, phone fallback | Story tour, Analyst chat UI, exports, a11y |
| **Freeze Nov 5** | | | |
| **W6** Nov 5–10 | Deploy, final validation, README | Browser checks, clips | Cross-browser, Lighthouse, e2e |
| **Nov 11** | Release candidate | | |
| **Nov 13–14** | Submit (09:00 BD, Nov 14) | | |

---

## 7b. Stage 1 sprint (Oct 1–7): who does what

The calendar above applies **after** Stage 1. For the first week, the day-by-day plan in MASTER_PLAN §4.3 applies. In short:

- **Dev 1:** scaffold, contracts, mock engine and CI by Oct 2 (this unblocks the others); real Sun/Earth geometry for 3 sites and the Horizons check by Oct 5; horizon v0 on one real site if the data arrives; repo clean-up and going public on Oct 6.

- **Dev 2:** a synthetic-terrain scene on day 1 (no dependencies), then mock tiles, the Sun light driven by the engine, the Hero capture, and the real tile if it arrives.

- **Dev 3:** tokens, app shell and Lab layout on day 1 (no dependencies), then the barcode, readouts, Evidence table, and wiring to the engine client.

- **Non-dev teammates:** BD registration, the video script, storyboard, voice-over and edit, README writing, and the Oct 6 submission with the team lead.

**Freeze Oct 6 at noon.** After that only bug fixes and the submission.

## 8. Working agreements

**Git flow**

- Branch names: `dev1/…`, `dev2/…`, `dev3/…` followed by the task ID, for example `dev2/M3-04-shadow-raymarch`.
- One pull request per ticket, small enough to review in 15 minutes. Use the pull-request template: it asks for the task ID and the exact verification commands and their results.
- Rebase on `main` every morning. If your pull request touches a file outside your folder, stop and ask.
- **Merge windows:** Dev 1 merges twice a day (around midday and in the evening). Urgent unblockers get the `blocker` label.

**Review levels**

| Level | What | Review |
|---|---|---|
| **L1** | `contracts`, `engine`, `pipeline`, Analyst route, anything that produces a number | Dev 1 reads carefully; parity and validation tests must pass |
| **L2** | `scene`, UI, state | Dev 1 skims with a Claude Code review; screenshot or short clip required in the pull request; Dev 2 and Dev 3 review each other's style |
| **L3** | Docs, copy, README text | Quick check; numbers must be verified by Dev 1 |

**Daily sync:** 15 minutes, same time every day. Each person says what merged, what's next, and what blocks them. Dev 1 updates PROGRESS.md and REMAINING.md afterwards.

**Rules every agent must follow** (they also live in CLAUDE.md §7; Antigravity does not read CLAUDE.md, see §10):

- Edit only files in your own folder.
- Never invent a package, URL, dataset file or API. Ask first.
- Never fabricate a number. Anything shown on screen comes from the engine or a cited source. Mock data shows the `SIMULATED` badge.
- Run `pnpm verify` before opening a pull request.
- Never commit secrets, `data/` or `.env*` files.
- Never add Claude or Anthropic as a co-author, and don't add any AI attribution to commits or pull requests (project rule).

---

## 9. Load check and what we cut first

**Where Dev 1 is a bottleneck:** the first three days (contracts and mocks) and every merge. Mitigations: the mock engine, delegating `windows/` to Dev 3, Claude Code reviews, fixed merge windows, and tickets that carry their own acceptance tests.

**Bus factor:** you hold the Vercel, R2 and Anthropic accounts. Give Dev 3 deputy access to the Vercel project and make them an Admin on the repo, so submission day doesn't depend on one person.

**Cut order if we fall behind** (cut from the top, keep the bottom): sonification, PDF Site Brief, Earth texture from GIBS, 20 m windows around presets, extra story chapters, uncertainty bands beyond 1–2 hero sites, `Mission Analyst` (kill switch). **Never cut:** the horizon engine, the validation against Horizons, the Lab flow, the mission barcode, and both videos.

---

## 10. Setup tasks (to add to REMAINING)

- [ ] **P0-16** Dev 2 and Dev 3 send their GitHub usernames; invite them with Write access; fill in `CODEOWNERS` (`/packages/`, `/pipeline/`, `/apps/web/app/api/` → Dev 1; `/packages/scene/` → Dev 2; `/apps/web/` → Dev 3).

- [ ] **P0-17** Write `AGENTS.md` at the repo root for Antigravity (a short version of CLAUDE.md §6–§7 plus the folder rules above). **Check whether Antigravity picks up `AGENTS.md` automatically; if it does not, paste the same text into Antigravity's workspace rules.**

- [ ] **P0-18** Turn the tasks in §5 into GitHub Issues with labels `owner:dev1`, `owner:dev2`, `owner:dev3`, `blocker`, `contract-change`; each with goal, files, inputs/outputs, acceptance test and "do not touch".

- [ ] **P0-19** Give Dev 3 deputy access to Vercel and Admin on the repo.

- [ ] **P0-20** Set the daily sync time.
