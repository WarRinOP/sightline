# REMAINING — Work Backlog by Phase

Legend: `[ ]` todo · `[~]` in progress · `[x]` done (add date) · `[!]` blocked (add reason) · `[-]` dropped (add reason in DECISIONS.md)

Zones: retired (D-010); all work is allowed from 2026-10-01. Written confirmation of the early start is tracked in P0-02.

Update this file at the end of every session (see `CLAUDE.md` §3).

---

## S1 — Stage 1 sprint (Oct 1 → Oct 7): GitHub link + 240-second video

Stage 1 decides whether we attend on Nov 13–14 (D-014). Plan and day-by-day schedule: MASTER_PLAN §4.3 and TEAM_WORK_SPLIT §7b. **Target: submit by Oct 6 night.**

- [ ] **S1-00** Ask the organizers (info@nasaspaceappsbd.com or the Local Lead): the exact Stage 1 deadline time; where and how to submit the link and video; video format and size; must the repo be public (or add them as collaborators); what the selectors judge and how many teams are chosen; whether teams that are not selected can still take part (for example the Universal Event). *Owner: team lead.*

- [x] **S1-01** Scaffold, contracts, mock engine, mock tiles, CI. *Dev 1, Oct 1–2.* *Done 2026-10-02: PR #1 merged, CI green (`web`, `pipeline`). Built on `dev1/S1-01-scaffold-and-contracts` (D-016); `pnpm verify` and the pipeline checks pass.* Covers M0-03, M0-04, M0-06 (partly: mock engine and tiles; no JSON export) and M0-05 (zod schemas only).
  - [ ] **S1-01a** Contracts: JSON Schema export and the pydantic mirror (rest of M0-05). *Dev 1.*
  - [x] **S1-01b** *(2026-10-02)* `web` and `pipeline` are required status checks on `main` (not strict: branches need not be up to date). *Dev 1.*
  - [x] **S1-01c** *(2026-10-03, D-029)* `three@0.186.1`, `@react-three/fiber@9.8.1`, `@react-three/drei@10.7.9`, `@types/three@0.186.0` (and `react-dom`, `@types/react-dom`, `vitest`) installed in `packages/scene`, exact-pinned; licences of the closure checked. `vite` not added (own entry needed). *Dev 1.*
  - [ ] **S1-01d** Favicon (the browser logs a 404 for it) and self-hosted IBM Plex / Instrument Serif subsets. *Dev 3 (S1-08).*

- [x] **S1-02** Start downloads: SPICE kernels first (62 MB), then one site DEM and the 80 m mid tier. Run overnight. *Dev 1, Oct 1–2.* *Done 2026-10-02 (D-018; PR #2 merged, PR #3 open): 8 SPICE kernels (65,010,769 B, PR #2) and `pgda78-site04-surf` plus `pgda90-ldem-80s-80m` (230,139,198 B, PR #3); `pgda78-site01-surf` and `pgda78-site11-surf` (81,961,616 B) added in S1-03, all size- and type-checked, SHA-256 pinned, strict re-run of all 10 datasets passes. Not downloaded: the other site DEMs, validation maps, the far tier.*
  - [x] **S1-02a** *(2026-10-02)* Option A chosen for D-019: the 3 presets are the centres of their PGDA #78 DEM tiles, heights sampled from the 5 m DEMs; `sightline sites` writes the catalog. *Dev 1.*

- [x] **S1-03** Real ephemeris for 3 sites, engine `time`/`frames`/`getSunEarth`. *Dev 1, Oct 2–4.* *Done 2026-10-02 (audit passed; PR #4; D-020), built on `dev1/S1-03-real-ephemeris`: `sightline sites`, `ephem`, `golden`; engine `time`, `frames`, `ephemeris`, `sky` and `SightlineEngineClient`; `pnpm verify` passes, parity with SPICE passes (worst Sun gap 2.1e-8°, Earth 2.7e-5°, DSN 0.189°). Open: merge of PR #4; the horizon is flat ground (terrain is M2-05), so timeline, windows and probe refuse to answer; the web app still uses the mock.*
  - [x] **S1-03a** *(2026-10-02, D-022; PR #6 merged)* `SightlineEngineClient` runs in a Comlink worker (`apps/web/workers/`: `engineApi`, `engine.worker`, `engineBridge`/`connectEngine`); `/` shows real Sun and Earth elevation and azimuth for the 3 sites with a data-driven badge, and "—" with a "Not computed yet" tag for Sun disk and Link to Earth (they need terrain). `pnpm verify` green (web 6 tests) and checked in a browser. *Dev 1; the page is Dev 3's from here.*
  - [ ] **S1-03c** Dev 3 takes over `live-readout.tsx` (time scrubber, site picker, design system) and imports `connectEngine`; M2-05 replaces the "not computed" tiles. *Dev 3.*
  - [ ] **S1-03b** Extend the ephemeris to 2026–2032 at 10-minute steps and publish it (R2, M1-05, M1-08); decide whether 1-hour steps with Hermite are enough (the parity says yes for Sun and Earth). *Dev 1.*

- [x] **S1-04** Horizons check: 3 sites × 50 epochs; residuals saved as JSON. *Dev 1, Oct 4–5.* *Done 2026-10-02 on `dev1/S1-04-horizons-validation` (D-021; PR #5):* `sightline horizons` queried JPL Horizons (12 requests, 6 answers per body and site, cached); `fixtures/golden/horizons_reference.json` and `horizons_residuals.json` written; `packages/engine/test/horizons.test.ts` asserts the 0.02° tolerance (largest gap 2.65e-5°, Sun 3.3e-8°, Earth 2.6e-5°) with two negative controls.
  - [-] **S1-04a** ~~Optional: apply stellar aberration along the site's line of sight in `computeSky`~~ Dropped 2026-10-02 (D-021 item 9): the Earth gap (2.65e-5°) is 755 times inside the 0.02° requirement; the time is kept for the Oct 6 delivery.

- [x] **S1-05** Horizon v0 on one real site. *Dev 1. Done 2026-10-02 (D-023; PR #7 merged).* `sightline horizon` ray-marches the 5 m tile plus the 80 m map to 300 km into a terrain mask; the engine's `getHorizon`, `probeLit` and `getSunEarth` use it. **Not validated** against published maps.
  - [x] **S1-05a** *(2026-10-02, D-024; PR #8)* The same for Connecting Ridge and de Gerlache Rim: `sightline horizon` runs over all three sites into `horizon_<site>.json`.
  - [~] **S1-05b** Tighten the known limits (METHODS §6). *Done 2026-10-02:* the mast dependence is exact (an envelope of lines per azimuth replaced a 13-height grid, D-024 item 3). *Open:* finer or per-bin-maximum rays; the Sun's disk against the mask across its width. *Dev 1, low priority.*
  - [x] **S1-05c** *(2026-10-02, D-024; PR #8)* Shackleton Rim moved to the crest of its rim ridge (highest 5 m pixel more than 1 km from the tile edge): 1739.1 m, 1.9 km from the old tile centre, which is on a steep wall.
  - [x] **S1-05d** *(2026-10-02, D-024; PR #8)* Real `getTimeline` for the three sites, with `longest_day_s` and `longest_day_start_et` added to the contract before the freeze. `findWindows` still refuses (M2-09).
  - [x] **S1-05e** *(2026-10-02, D-025; PR #9 merged)* Illumination benchmark. Method checked against Barker et al. (2021) Table 2 at its seven Site 1 regions (all pre-set criteria pass) and the pattern against the PDS AVGVISIB map (Spearman 0.95 over 900 points). The engine's illumination at the three sites is **not published**; cite it as "average visible fraction of the Sun's disk, computed with the method of Barker et al. (2021)". The 48.9 / 35.2 / 36.6 % are the lander profile's "lit", a different quantity. METHODS §7; `sightline benchmark`.
  - [ ] **S1-05g** Dev 3: the home page now shows "average disk visible" and "any part visible" next to the lander-profile "Lit"; keep both labelled in the barcode and Evidence work (S1-09, S1-10). *Dev 3.*
  - [ ] **S1-05h** Earth visibility and DSN link have no published reference compared yet (the AVGVISIB Earth map, `pds-avgvisib-85s-60m_earth`, is in the report but not fetched). Do before any link figure is cited. *Dev 1.*
  - [ ] **S1-05f** Dev 3: read `statistics.longest_day_s` and `longest_day_start_et` in the mission barcode (S1-09), and show what "lit" means (D-024 item 6). *Dev 3.*

- [~] **S1-06** Terrain scene, sun light from `getSunEarth`, pin, orbit camera, 20 s Hero capture. *Dev 2, Oct 1–5.* *PR #13 (18 commits) reviewed 2026-10-02: **not merged**; changes requested (CI lint fails; wrong pin/camera frame; missing-tile holes; border-blind mesh; invented overlays and horizon ring; no real Sun/Earth path; hex colours; deps and lockfile edited against D-017). Seam decision D-030.*
  - [x] **S1-06a** *(2026-10-03, PR #15 and Dev 1's fixes, D-031)* Dev 2: the fix list sent by the team lead (lint and Prettier green, `pnpm verify`; pin/`flyTo`/Hero in tile-plane coordinates; pole-centred frame; sparse-tile fallback with cache and disposal; border-aware mesh and UV; remove proxy overlays and fake ring; `sun_earth` and `horizon` per D-030; camera near/far; `palette.ts`; reduced motion; tests; filled PR template; take `main`'s `package.json` and lockfile). *Dev 2.*
  - [ ] **S1-06b** Write `sun_earth` into the scene `inputs` ref from `getSunEarth`, pass `horizon` from `getHorizon`, `tileSource` from `createLolaTileSource` (D-028, D-030) and the `sites` prop. *Reassigned from Dev 3 to Dev 1 on 2026-10-03 (D-031).*
  - [x] **S1-06c** *(2026-10-03)* Dev 1: re-review of PR #15 done (CI, `pnpm verify`, a real-browser run of the preview); fixes on `dev1/S1-06-scene-fixes`. (was: re-review PR #13 when pushed (lint, tests, a browser check of the pin, `flyTo` and tile fallback against `next start`). *Dev 1.*

- [ ] **S1-07** Lander's Eye fisheye. *Dev 2, Oct 4–6 (stretch).*

- [ ] **S1-08** App shell, tokens, landing page, Lab page: 3 sites, scrubber, readouts. *Dev 3, Oct 1–5.* *Reassigned to Dev 1 on 2026-10-03 (D-031): Dev 3 has not started.*

- [ ] **S1-09** Mission barcode from the timeline. *Dev 3, Oct 3–6.* *Reassigned to Dev 1 on 2026-10-03 (D-031): Dev 3 has not started.*

- [ ] **S1-10** Evidence page v0: validation table from Dev 1's JSON. *Dev 3, Oct 5–6.* *Source ready 2026-10-02: `fixtures/golden/horizons_residuals.json`; parse it with `HorizonsResidualsSchema` from `@sightline/contracts` (summary per body and site, 300 rows, tolerance 0.02°). Show it as Sun and Earth directions, not illumination.* *Reassigned to Dev 1 on 2026-10-03 (D-031): Dev 3 has not started.*

- [x] **S1-11** README: problem, concept, architecture, verified data sources, roadmap, team, "Use of AI" statement, data credits. *Dev 1 draft done 2026-10-02 (PR #10; D-026).* Every figure comes from the repo's generated files; unbuilt parts are listed as not built. Open: non-dev teammates' review, and a look at how GitHub renders the Mermaid diagram.

- [~] **S1-12** 240-second video: script (Oct 2), storyboard, screen captures (Oct 5–6), voice-over, edit, upload (Oct 6). *Script and storyboard drafted 2026-10-02 in `docs/submission/DEMO_SCRIPT.md` (PR #10): 474 words, about 190 s of narration. Open: the team's edits, captures, voice-over, edit, upload. Non-dev + Dev 2 captures.*

- [~] **S1-13** Repo hygiene. *Done 2026-10-01:* secrets audit clean, repo switched to **public**, `main` protected, no-reply commit email set for new commits. *Open:* tag `v0.1-stage1`; topics already set; confirm the README renders well. *Dev 1.*

- [ ] **S1-14** Submit the link and video; screenshot the confirmation. *Team lead, Oct 6 night.*

- [ ] **S1-15** 3D view, sky bodies as background and hidden below the horizon (the Earth sphere is cut by ridges; reproduced). See [UI_GRAPHICS_PLAN.md](UI_GRAPHICS_PLAN.md). *Dev 1, 1–2 h.*
  - [ ] **S1-16** Terrain look: smooth normals, no flat shading, a faint fill light, tone mapping. *Dev 1, 3–4 h.*
  - [ ] **S1-17** Sun glow (bloom; check `@react-three/postprocessing` first, D-entry), thinner ring, camera-facing labels. *Dev 1, 2–3 h.*
  - [ ] **S1-18** Shadows: no tile-edge patches or speckle; agree with `probeLit` (M3-09); labelled "visual only" until then. *Dev 1, 0.5–1 day, only if time remains.*
  - [ ] **S1-19** Earth texture (credit as text) and a real star catalogue. *Dev 1, low priority.*
  - [ ] **S1-20** Curvature drop for the far terrain. *Dev 1, low priority.*

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

- [ ] **P0-12** Network plan (D-009): create a Cloudflare R2 bucket (and a US-region cloud VM or CI runner if available). Run a throughput test from the team's usual network to NAIF, PDS, PGDA, GitHub, the npm registry and PyPI, and paste the results into PROGRESS.md. **High priority:** measured ~3–35 KB/s to US origins from the current network. *Update 2026-10-02 (D-018): NAIF about 1 MB/s and PGDA about 130 KB/s measured; the relay and R2 are not needed for Stage 1. Keep the R2 mirror for the final deploy (M1-08).*

- [ ] **P0-14** 🚨 **URGENT, by Oct 7 (same day as the Stage 1 submission):** register the team on https://www.nasaspaceappsbd.com/registration (team name, leader name/mobile/email, **region**, up to 6 members with name/email/mobile, **team group photo**). Pick the region where we will attend in person (nine regions; Dhaka's main venue is AIUB). Screenshot the confirmation into PROGRESS.md.

- [ ] **P0-15** Register every member on spaceappschallenge.org and join the **same Local Event** (the BD site says registration there happens on-site on Nov 13, but global judging needs everyone in the same Local Event, so do it early). Create the team on the NASA site.

- [x] **P0-16** *(2026-10-01)* Dev 2 (`rimonxyg`, Aktaruzzaman) and Dev 3 (`fuadhasandipro`, Fuad Hasan) have Write access; `CODEOWNERS` makes Dev 1 the reviewer of everything.

- [~] **P0-17** Root `AGENTS.md` + dedicated `AGENTS.md` in `packages/scene/`, `apps/web/`, `packages/engine/src/windows/` written *(2026-10-01)*. **Open:** each developer confirms their agent starts with the `Rules loaded: …` line.

- [ ] **P0-18** Turn the tasks into GitHub Issues with labels `owner:dev1|dev2|dev3`, `blocker`, `contract-change`; each with goal, files, inputs/outputs, acceptance test, "do not touch".

- [ ] **P0-19** Give Dev 3 deputy access to Vercel and Admin on the repo (bus factor).

- [ ] **P0-20** Set the daily 15-minute sync time.

- [~] **P0-13** GitHub setup (D-011). *Done 2026-10-01:* private repo `WarRinOP/sightline` with Apache-2.0, `.gitignore`, PR template, CODEOWNERS stub and the docs-only first commit. *Still open:* invite the other developers (needs their GitHub usernames), create the organization (web only) and transfer the repo, fill in `CODEOWNERS` usernames. Original scope: invite the 2 other developers with Write access and the non-dev teammates as needed; enable two-factor authentication; add `.gitignore`, `CODEOWNERS`, a PR template; make the first commit (docs only).

---

## P1 — Lock-in checkpoint (Oct 28 → Oct 30; plus Nov 13 submission guide)

- [ ] **P1-01** **Oct 28:** read the full CLPS Lunar Mission Browser statement. Write `docs/progress/STATEMENT_GAP_ANALYSIS.md`: requirements vs this plan, listed resources vs our dataset table, and anything we must add or drop.

- [ ] **P1-02** Also read the backup statement (*Interplanetary Survival Guide: Martian Map*). Make the final challenge decision (go/switch) and log it as DECISIONS D-002.

- [ ] **P1-03** Update MASTER_PLAN to v1.1 with the gap-analysis changes (datasets in the statement take priority).

- [x] **P1-04** 🟡 Verify (read-only, no code) that each dataset URL in MASTER_PLAN §1.4 resolves; note corrected names. *(Done 2026-10-01 → `docs/science/DATA_VERIFICATION_REPORT.md`. Re-check after the Oct 28 statement in case it lists other resources.)*

  - [ ] **P1-04a** `gdalinfo /vsicurl/…` on the PGDA #90/#78 files: confirm COG tiling, dtype, nodata, geotransform (needs GDAL installed).

  - [ ] **P1-04b** Verify the Oct-2024 Artemis III region list and coordinates from NASA's source; map each region to a DEM tier (Cabeus B, Mons Mouton, Mons Mouton Plateau and Slater Plain have no 5 m site DEM).

  - [~] **P1-04c** Extract the AVGVISIB simulation time span and observer height from Mazarico et al. 2011 / the PDS readme. *2026-10-02: not in the 2016 release's label or readme; the 2011 abstract says several 18.6-year cycles at 6 h for the original 240 m work (NTRS 20120010094). The paper's full text was not available. Open for the 2016 60 m release.*

  - [ ] **P1-04d** Verify the Barker et al. 2023 PSJ citation/DOI for PGDA #90.

  - [ ] **P1-04e** `HEAD`-check the Zenodo direct-file URL pattern for the #104 SfS DEMs.

- [ ] **P1-05** **Nov 13:** read the Project Submission Guide and the Judging & Awards Guide. Update M6 deliverables (video length, slide count, required fields, AI disclosure wording) to match exactly.

- [ ] **P1-06** Confirm the Local Event's exact closing time (UTC+6) and adjust the calendar (MASTER_PLAN §4.2) if needed.

- [ ] **P1-07** Team brief (1 h call, week 1): walk everyone through MASTER_PLAN §3–§4 and CLAUDE.md. Everyone knows their lane and their first 3 tasks.

---

## P2 — Build (starts Oct 1; after Oct 7 only if selected; Oct 1 → Nov 5 feature-complete; Nov 5 → Nov 11 hardening) — calendar in MASTER_PLAN §4.2; owner per task in `docs/TEAM_WORK_SPLIT.md` §5

### M0 — Kickoff & Contracts (Oct 1–3 · Dev 1)

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

- [~] **M1-01** `sources.yaml` with every dataset verified (HTTP check + SHA-256 + license + citation). *2026-10-02: the 8 SPICE kernels are in with pinned SHA-256; DEM, validation and stretch entries are still to add (draft in DATA_VERIFICATION_REPORT §5, which has no hashes).*

- [~] **M1-02** `sightline fetch`: resumable, checksum-verified downloads. *Built 2026-10-02 (S1-02, D-018); tested with a mocked transport (30 pipeline tests) and a real SPICE download. Still to try on PGDA/PDS hosts.*

- [ ] **M1-03** `sightline dem`: PDS3 LBL parser → `DemMeta` (pydantic) + memmap; test on a real label.

- [x] **M1-04** *(2026-10-02)* `sightline tiles`: polar-stereo pyramid, uint16 + offset (0.1 m), 1 px border, brotli; round-trip error ≤ 0.05 m. *Built 2026-10-02 on `dev1/M1-04-real-tiles` (PR #11; D-027, METHODS §8):* sparse pyramid of 12 levels (31,873 tiles, 262 MB in `data/processed/tiles/`), levels 0–7 from the 80 m map, 8–11 from the three 5 m DEMs; `LolaTileSource` in the engine; 100 tiles (833 KB) committed with the engine; 500 probes against the raw rasters. *Round-trip error is ≤ 0.05 m at levels 6–11; levels 0–5 carry a coarser per-tile scale (up to 0.21 m, error ≤ 0.105 m) because their relief exceeds uint16 at 0.1 m: accepted by the team lead 2026-10-02 (M1-04a). No brotli (moved to M1-04c). Merged as PR #11.*
  - [x] **M1-04a** *(2026-10-02)* Levels 0–5: the per-tile scale is accepted (error ≤ 0.105 m at level 0); no contract change. *Team lead.*
  - [x] **M1-04b** *(2026-10-02, D-028; PR #12)* The committed tiles are built into the site and any other tile is read from `data/processed/tiles/` when present: `/api/tiles/<level>/<x>/<y>.bin`, `/api/tiles/manifest.json`, `/api/tiles/coverage.json` (`apps/web/app/api/tiles/`); `createLolaTileSource()` fetches `/api/tiles` by default and `fetchTileCoverage()` reads the coverage. Not done: a deploy has only the 100 committed tiles until the pyramid is published (M1-08). *Dev 1.*
  - [ ] **M1-04c** Brotli (or R2 `Content-Encoding`) once the pyramid is published (M1-08); not done because the browser needs a decompressor and the raw pyramid is 262 MB. *Dev 1.*
  - [ ] **M1-04d** The pyramid stops at the 80 m map's ±304 km square and 5 m levels stop short of each DEM edge; the 5 m DEMs for the other candidate regions are not downloaded. *Dev 1, low priority.*

- [~] **M1-05** `sightline ephem`: Sun, Earth, 3 DSN complexes in MOON_ME, LT+S, 10-min step, 2026–2032 → binary + header. *Built 2026-10-02 (S1-03, D-020) with 1-hour steps, one year (2026-01-01T00:01:00 to 2027-01-01T00:01:00), 2.1 MB, committed under `packages/engine/src/data/`. The 2032, 10-minute, published file is S1-03b.*

- [~] **M1-06** `sightline sites`: Artemis III regions + CLPS sites, each with `source_url`. *Built 2026-10-02 (S1-03, D-019/D-020) for the 3 PGDA tile centres only, with the product-page `source_url`. Artemis III regions and CLPS sites are still open (P1-04b).*

- [~] **M1-07** `sightline golden`: reference az/el, reference horizons (slow numpy), Horizons API cross-check. *Built 2026-10-02: `time.json` (15 cases) and `sun_earth.json` (144 cases) from SPICE (S1-03); the Horizons cross-check is `sightline horizons` (S1-04). Reference horizons (terrain) are still open.*

- [ ] **M1-08** `sightline publish`: versioned upload to R2 + `manifest.json` (provenance).

- [ ] **M1-09** `sightline mock`: same contracts, `simulated: true`.

- [ ] **M1-10** CI rule: no URL literals outside `sources.yaml` / docs / env. *Note: `pipeline/tests/` uses synthetic `example.invalid` URLs on purpose; exempt it, or the rule fails on the fetch tests.* *Also exempt the generated data files (`packages/engine/src/data/sites.json` holds the PGDA product URL as the catalog's `source_url`, by design).*

**Acceptance:** real tiles for 85–90°S + 5 m tiles at ≥ 3 sites published; ephemeris 2026–2032 published; golden fixtures committed.

### M2 — Core Simulation & Math (Oct 1–28 · Dev 1; M2-09 `windows/` delegated to Dev 3)

- [~] **M2-01** `time/`: UTC ↔ ET with the leap-second table; tests vs SPICE epochs. *Built 2026-10-02 (S1-03): 15 SPICE cases agree to 1 µs including three leap seconds. Tick when merged.*

- [~] **M2-02** `frames/`: geodetic ↔ ME, ENU, az/el; pole convention test. *Built 2026-10-02 (S1-03): ENU basis, az/el, geodetic round trip, pole convention test. Tick when merged.*

- [~] **M2-03** `ephemeris/`: binary loader + Hermite interpolation (< 1e-4° error). *Built 2026-10-02 (S1-03): worst Sun gap 2.1e-8°, Earth 2.7e-5° over 144 cases. Tick when merged.*

- [ ] **M2-04** `dem/`: tile LRU cache, bilinear sampling, multi-res level selection.

- [~] **M2-05** `horizon/`: distance-adaptive ray-march with exact curvature; parity ≤ 0.05° RMS, ≤ 0.2° max vs golden. *Built 2026-10-02 as a Python pipeline step (`sightline horizon`, S1-05) whose masks the engine loads; the 3 sites only, exact curvature, analytic tests. Open: a TypeScript ray-marcher over tiles for arbitrary places and its parity against the Python one (needs M2-04).*

- [ ] **M2-06** `illumination/`: solar-disk fraction + Earth-shadow eclipse; analytic test cases.

- [ ] **M2-07** `comms/`: Earth visibility with margin; DSN visibility; golden DSN windows.

- [~] **M2-08** `timeline/`: per-step state, RLE, statistics. *Built 2026-10-02 (S1-05d): per-step state and statistics for the three sites, hourly steps over 2026 in about 13 ms. Open: run-length encoding for the 6-year range and the performance target (M2-12).*

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

### M4 — Command Center UI & State (Oct 8–Nov 4 · Dev 3)

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

### M5 — Story, Analyst & Polish (Oct 22–Nov 5 · Dev 3; M5-04 server side Dev 1; copy non-dev)

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

### M6 — Deploy, Verify, Deliverables (Nov 5–13 · Dev 1 + non-dev; both videos due Nov 13–14)

- [ ] **M6-01** Production deploy (Vercel) + R2 data with immutable caching + CORS; env vars set.

- [ ] **M6-02** Run the full verification checklist (MASTER_PLAN §M6) and paste the results into PROGRESS.md.

- [ ] **M6-03** Cross-browser/OS/phone test matrix.

- [ ] **M6-04** Regenerate VALIDATION_REPORT from the final data; reconcile the slide numbers.

- [ ] **M6-05** 7-slide deck (`docs/submission/PITCH_DECK.md` → slides).

- [ ] **M6-06** 30 s demo video (script in MASTER_PLAN; captions; no minors' likeness; no NASA logos).

- [ ] **M6-07** Final AI disclosure + NASA data text (`docs/submission/`).

- [ ] **M6-08** README: what, how to run, data credits, license, team.

- [ ] **M6-09** Upload the final 30-second video and complete the NASA project page **by 09:00 BD on Nov 14** (window closes 10:00); screenshot the confirmation.

- [ ] **M6-11** Record the **240-second video** (outline in MASTER_PLAN, "240-second local-judging presentation") and upload it to the Local Lead's Google Drive folder by **Nov 13, 18:30 BD**. Ask the Local Lead for the format, file size and whether a live Q&A follows.

- [ ] **M6-12** Rehearse the local judging ("240 Seconds of Glory", Nov 14, 11:00 BD) with a timer and 2 outside listeners.

- [ ] **M6-10** Tag `v1.0-submitted`; freeze production.

---

## P3 — Post-submission (→ Jan 2027)

- [ ] **P3-01** Uptime monitor on the production URL + R2; weekly check.

- [ ] **P3-02** No feature changes during judging; log any hotfix with approval.

- [ ] **P3-03** Prepare for possible judge questions: a 1-page FAQ on methods and limitations.

- [ ] **P3-04** Retro and post-event write-up.
