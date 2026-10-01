# REMAINING — Work Backlog by Phase

Legend: `[ ]` todo · `[~]` in progress · `[x]` done (add date) · `[!]` blocked (add reason) · `[-]` dropped (add reason in DECISIONS.md)

Zones: retired (D-010); all work is allowed from 2026-10-01. Written confirmation of the early start is tracked in P0-02.

Update this file at the end of every session (see `CLAUDE.md` §3).

---

## P0 — Setup (Oct 1 → Oct 7)

- [ ] **P0-01** Every member registers at spaceappschallenge.org in the **same Local Event** (Bangladesh). Record the event name and its **exact start/end times (UTC+6)** in PROGRESS.md.

- [ ] **P0-02** Get **written confirmation** from the Local Lead or organizers that teams in our event may start before Nov 14 (and the exact submission deadline). File the text in DECISIONS.md under D-010. If refused: stop and re-plan.

- [ ] **P0-03** Assign the 3 developer lanes (Dev 1 Science & Engine, Dev 2 Scene & Lab UI, Dev 3 Platform, Story & Analyst) and the non-dev roles (MASTER_PLAN §4.1); list names in PROGRESS.md.

- [ ] **P0-04** Create the team on the Space Apps site once team formation is available.

- [ ] **P0-05** Accounts ready for every member who needs them: GitHub (org/team), Vercel, Cloudflare (R2), Anthropic Console (API key + spend limit), NASA Earthdata Login, Figma (optional).

- [ ] **P0-06** Toolchains installed and checked on each laptop: Node 24 LTS, pnpm (corepack), Python 3.12, uv, GDAL/rasterio wheels, git, Claude Code CLI, Playwright browsers. Paste each laptop's version output into PROGRESS.md.

- [ ] **P0-07** Learning sprint, in parallel with building: SPICE tutorials (NAIF "Lessons"), spiceypy basics, R3F fundamentals, WebGL heightfield shading, PDS3 label format. Each developer keeps ≤ 1 page of notes.

- [-] **P0-08** ~~48 h rehearsal on an unrelated challenge~~ Dropped: the 6-week calendar replaces the 48-hour plan (D-010).

- [ ] **P0-09** Hardware/logistics plan: venue, power, 2 external monitors, a backup internet hotspot, sleep shifts, food.

- [ ] **P0-10** Claude Code setup on each machine: permissions allowlist for the read-only commands we'll use, worktree workflow practised, model selection agreed.

- [~] **P0-11** Read the reference papers in MASTER_PLAN Appendix C (learning only). The science lead reads all; others skim Mazarico 2011 and Barker 2021. *(2026-10-01: data products for these papers were located and documented in `docs/science/DATA_VERIFICATION_REPORT.md`; the papers themselves are still to read.)*

- [ ] **P0-12** Network plan (D-009): create a Cloudflare R2 bucket (and a US-region cloud VM or CI runner if available). Run a throughput test from the team's usual network to NAIF, PDS, PGDA, GitHub, the npm registry and PyPI, and paste the results into PROGRESS.md. **High priority:** measured ~3–35 KB/s to US origins from the current network.

- [~] **P0-13** GitHub setup (D-011). *Done 2026-10-01:* private repo `WarRinOP/sightline` with Apache-2.0, `.gitignore`, PR template, CODEOWNERS stub and the docs-only first commit. *Still open:* invite the other developers (needs their GitHub usernames), create the organization (web only) and transfer the repo, fill in `CODEOWNERS` usernames. Original scope: invite the 2 other developers with Write access and the non-dev teammates as needed; enable two-factor authentication; add `.gitignore`, `CODEOWNERS`, a PR template; make the first commit (docs only).

---

## P1 — Lock-in checkpoint (Oct 28 → Oct 30; plus Nov 13 submission guide)

- [ ] **P1-01** **Oct 28:** read the full CLPS Lunar Mission Browser statement. Write `docs/progress/STATEMENT_GAP_ANALYSIS.md`: requirements vs this plan, listed resources vs our dataset table, and anything we must add or drop.

- [ ] **P1-02** Also read the backup statement (*Interplanetary Survival Guide: Martian Map*). Make the final challenge decision (go/switch) and log it as DECISIONS D-002.

- [ ] **P1-03** Update MASTER_PLAN to v1.1 with the gap-analysis changes (datasets in the statement take priority).

- [x] **P1-04** 🟡 Verify (read-only, no code) that each dataset URL in MASTER_PLAN §1.4 resolves; note corrected names. *(Done 2026-10-01 → `docs/science/DATA_VERIFICATION_REPORT.md`. Re-check after the Oct 28 statement in case it lists other resources.)*

  - [ ] **P1-04a** `gdalinfo /vsicurl/…` on the PGDA #90/#78 files: confirm COG tiling, dtype, nodata, geotransform (needs GDAL installed).

  - [ ] **P1-04b** Verify the Oct-2024 Artemis III region list and coordinates from NASA's source; map each region to a DEM tier (Cabeus B, Mons Mouton, Mons Mouton Plateau and Slater Plain have no 5 m site DEM).

  - [ ] **P1-04c** Extract the AVGVISIB simulation time span and observer height from Mazarico et al. 2011 / the PDS readme.

  - [ ] **P1-04d** Verify the Barker et al. 2023 PSJ citation/DOI for PGDA #90.

  - [ ] **P1-04e** `HEAD`-check the Zenodo direct-file URL pattern for the #104 SfS DEMs.

- [ ] **P1-05** **Nov 13:** read the Project Submission Guide and the Judging & Awards Guide. Update M6 deliverables (video length, slide count, required fields, AI disclosure wording) to match exactly.

- [ ] **P1-06** Confirm the Local Event's exact closing time (UTC+6) and adjust the calendar (MASTER_PLAN §4.2) if needed.

- [ ] **P1-07** Team brief (1 h call, week 1): walk everyone through MASTER_PLAN §3–§4 and CLAUDE.md. Everyone knows their lane and their first 3 tasks.

---

## P2 — Build (Oct 1 → Nov 5 feature-complete; Nov 5 → Nov 13 hardening) — calendar in MASTER_PLAN §4.2

### M0 — Kickoff & Contracts (Oct 1–3 · Dev 3 + Dev 1)

- [ ] **M0-01** Re-read the CLPS challenge summary and the Oct 28 statement when released (gap analysis P1-01).

- [ ] **M0-02** Start the essential data downloads on day 1 (≈ 945 MB bundle in DATA_VERIFICATION_REPORT §5), mirrored to R2 (D-009). Run overnight.

- [ ] **M0-03** Repo setup (see P0-13); scaffold with `create-next-app`, `pnpm` workspaces, Turborepo, `uv init pipeline`; copy in `CLAUDE.md` and `docs/`.

- [ ] **M0-04** Implement the exact scripts listed in CLAUDE.md §4 (`pnpm verify` etc.).

- [ ] **M0-05** `packages/contracts`: zod schemas for Site, LanderProfile, EphemerisHeader, TileManifest, HorizonMask, StepState, WindowResult, ProvenanceRecord, AnalystClaim; export JSON Schema.

- [ ] **M0-06** Mock generators for every contract (synthetic crater DEM, analytic Sun/Earth), shown with the SIMULATED badge.

- [ ] **M0-07** GitHub Actions CI (lint, typecheck, test, parity, build); Vercel project linked; "Hello Moon" preview live.

- [ ] **M0-08** Create one Claude Code worktree per developer lane; each developer confirms their first task.

**Gate G1 (Oct 7):** `pnpm verify` + `uv run pytest` green; preview URL live; real tiles for one site rendered; Sun az/el from real SPICE kernels.

### M1 — Data Ingestion & Transformation (Oct 1–21 · Dev 1)

- [ ] **M1-01** `sources.yaml` with every dataset verified (HTTP check + SHA-256 + license + citation).

- [ ] **M1-02** `sightline fetch`: resumable, checksum-verified downloads.

- [ ] **M1-03** `sightline dem`: PDS3 LBL parser → `DemMeta` (pydantic) + memmap; test on a real label.

- [ ] **M1-04** `sightline tiles`: polar-stereo pyramid, uint16 + offset (0.1 m), 1 px border, brotli; round-trip error ≤ 0.05 m.

- [ ] **M1-05** `sightline ephem`: Sun, Earth, 3 DSN complexes in MOON_ME, LT+S, 10-min step, 2026–2032 → binary + header.

- [ ] **M1-06** `sightline sites`: Artemis III regions + CLPS sites, each with `source_url`.

- [ ] **M1-07** `sightline golden`: reference az/el, reference horizons (slow numpy), Horizons API cross-check.

- [ ] **M1-08** `sightline publish`: versioned upload to R2 + `manifest.json` (provenance).

- [ ] **M1-09** `sightline mock`: same contracts, `simulated: true`.

- [ ] **M1-10** CI rule: no URL literals outside `sources.yaml` / docs / env.

**Acceptance:** real tiles for 85–90°S + 5 m tiles at ≥ 3 sites published; ephemeris 2026–2032 published; golden fixtures committed.

### M2 — Core Simulation & Math (Oct 1–28 · Dev 1)

- [ ] **M2-01** `time/`: UTC ↔ ET with the leap-second table; tests vs SPICE epochs.

- [ ] **M2-02** `frames/`: geodetic ↔ ME, ENU, az/el; pole convention test.

- [ ] **M2-03** `ephemeris/`: binary loader + Hermite interpolation (< 1e-4° error).

- [ ] **M2-04** `dem/`: tile LRU cache, bilinear sampling, multi-res level selection.

- [ ] **M2-05** `horizon/`: distance-adaptive ray-march with exact curvature; parity ≤ 0.05° RMS, ≤ 0.2° max vs golden.

- [ ] **M2-06** `illumination/`: solar-disk fraction + Earth-shadow eclipse; analytic test cases.

- [ ] **M2-07** `comms/`: Earth visibility with margin; DSN visibility; golden DSN windows.

- [ ] **M2-08** `timeline/`: per-step state, RLE, statistics.

- [ ] **M2-09** `windows/`: constraint search, scoring, Pareto; property tests.

- [ ] **M2-10** Workers (`horizon.worker.ts`, `timeline.worker.ts`) with Comlink APIs.

- [ ] **M2-11** `uncertainty/`: horizon ensemble from **PGDA #78 DEM clones** (D-007; pipeline, overnight) + percentile bands (engine).

- [ ] **M2-14** Validation stats support the `any_fraction` lit definition, to match LOLA AVGVISIB (DATA_VERIFICATION_REPORT F7).

- [ ] **M2-12** Perf: custom pin < 1.5 s cold; 6-year × 4-site timeline < 800 ms.

- [ ] **M2-13** `sightline validate` → `docs/science/VALIDATION_REPORT.md` (Horizons residuals, map agreement, parity).

### M3 — Interactive Visual Canvas (Oct 3–Nov 4 · Dev 2)

- [ ] **M3-01** R3F canvas, camera rig (orbit + site fly-to on a great-circle arc), WebGPU → WebGL2 fallback.

- [ ] **M3-02** Quadtree LOD terrain from tiles; geomorphing; skirts.

- [ ] **M3-03** Lunar photometric shading (Lommel-Seeliger/Hapke-lite).

- [ ] **M3-04** Near-field heightfield shadow ray-march + far-field horizon-angle texture.

- [ ] **M3-05** Overlay layers (illum %, max-dark, DTE %, slope, PSR) + legends.

- [ ] **M3-06** Sky: J2000 star catalog, Sun sprite + bloom, Earth with computed phase (+ GIBS texture stretch).

- [ ] **M3-07** Lander's-Eye fisheye: horizon silhouette, Sun/Earth paths, libration loop, now-marker.

- [ ] **M3-08** Site pins with extruded horizon rings and masts.

- [ ] **M3-09** Shadow-vs-engine probe test (20 random probes agree).

- [ ] **M3-10** Hero sequence (20 s, no input) + poster-frame fallback.

- [ ] **M3-11** Perf pass: 60 FPS Lab, ≥ 45 FPS Hero on target hardware.

### M4 — Command Center UI & State (Oct 8–Nov 4 · Dev 2)

- [ ] **M4-01** Tokens in `globals.css`; fonts (IBM Plex Sans/Condensed/Mono, Instrument Serif); GlassPanel, HudReadout primitives.

- [ ] **M4-02** Zustand slices + URL sync (permalinks).

- [ ] **M4-03** Site list (presets, click-to-add custom pin, compare ≤ 4).

- [ ] **M4-04** Lander profile form (mast, battery, DTE min, DSN mask, disk min).

- [ ] **M4-05** Timeline scrubber (zoomable, play rates, jump-to-event).

- [ ] **M4-06** Mission barcode per site.

- [ ] **M4-07** Window Finder (constraints → ranked windows, Pareto badges).

- [ ] **M4-08** Evidence view: uPlot time series, darkness histogram, comparison radar, validation panels, uncertainty bands.

- [ ] **M4-09** Provenance Inspector drawer.

- [ ] **M4-10** Keyboard shortcuts, ARIA live region, chart table fallbacks.

- [ ] **M4-11** Playwright e2e: select site → profile → windows → export CSV.

### M5 — Story, Analyst & Polish (Oct 22–Nov 5 · Dev 3 + non-dev)

- [ ] **M5-01** Story engine (JSON steps driving real stores).

- [ ] **M5-02** "Light & Signal" chapter (7 steps, ≤ 90 s) + always-visible Judge Tour button.

- [ ] **M5-03** Story fact sheet with `source_url` for every claim (science lead sign-off).

- [ ] **M5-04** Mission Analyst: route handler, client tool loop, zod validation, grounding checker, Show-work drawer, recorded fallback, kill switch.

- [ ] **M5-05** Sonification (Tone.js) bound to time; toggle.

- [ ] **M5-06** Exports: CSV/JSON, PDF Site Brief, `.ics`, permalink.

- [ ] **M5-07** Responsive layouts (tablet sheets, phone story-first).

- [ ] **M5-08** Hallway test with 2 non-team users; fix the top 3 issues.

- [ ] **M5-09** Lighthouse a11y ≥ 95.

- [ ] Optional **M5-10** "Night of the Eclipse" chapter · **M5-11** mission-replay chapter (sourced facts only) · **M5-12** LROC Shadow-Truth IoU.

**Feature freeze: Nov 5.**

### M6 — Deploy, Verify, Deliverables (Nov 5–13 · Dev 3 + non-dev)

- [ ] **M6-01** Production deploy (Vercel) + R2 data with immutable caching + CORS; env vars set.

- [ ] **M6-02** Run the full verification checklist (MASTER_PLAN §M6) and paste the results into PROGRESS.md.

- [ ] **M6-03** Cross-browser/OS/phone test matrix.

- [ ] **M6-04** Regenerate VALIDATION_REPORT from the final data; reconcile the slide numbers.

- [ ] **M6-05** 7-slide deck (`docs/submission/PITCH_DECK.md` → slides).

- [ ] **M6-06** 30 s demo video (script in MASTER_PLAN; captions; no minors' likeness; no NASA logos).

- [ ] **M6-07** Final AI disclosure + NASA data text (`docs/submission/`).

- [ ] **M6-08** README: what, how to run, data credits, license, team.

- [ ] **M6-09** Submit on the team project page **≥ 2 h before the deadline**; screenshot the confirmation.

- [ ] **M6-10** Tag `v1.0-submitted`; freeze production.

---

## P3 — Post-submission (→ Jan 2027)

- [ ] **P3-01** Uptime monitor on the production URL + R2; weekly check.

- [ ] **P3-02** No feature changes during judging; log any hotfix with approval.

- [ ] **P3-03** Prepare for possible judge questions: a 1-page FAQ on methods and limitations.

- [ ] **P3-04** Retro and post-event write-up.
