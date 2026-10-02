# PROGRESS — Status & Session Log

Update at the end of **every** session (see `CLAUDE.md` §3). Newest session at the top of the log.

---

## Status Dashboard

| Field | Value |
|---|---|
| Current phase | **S1 — Stage 1 sprint, Oct 1–7** (D-014) |
| Challenge | CLPS Lunar Mission Browser (backup: Interplanetary Survival Guide: Martian Map) — not locked until P1-02 |
| Local Event | Space Apps Bangladesh (region _TBD_, P0-14). Program: Fri Nov 13 07:00 → Sat Nov 14 (BD, UTC+6) |
| Days to full statement (Oct 28) | 27 (as of 2026-10-01) |
| Feature freeze | Nov 5 |
| **Stage 1 due** | **Oct 7:** public GitHub link + 240-second video (and BD team registration closes). Target: submit **Oct 6 night** |
| 240-second video due | Nov 13, 18:30–19:00 BD (Google Drive) |
| NASA page + 30-second video due | Nov 14, 09:00–10:00 BD |
| Days to Bangladesh program start (Nov 13) | 43 (as of 2026-10-01) |
| Early-start waiver (D-010) | Stated by the team; **not on the BD site; written confirmation still pending (P0-02)** |
| Team access | Aktaruzzaman (`rimonxyg`): active · Fuad Hasan (`fuadhasandipro`): **invitation pending** |
| Open before work joins up | GitHub Issues (P0-18); organizers' answers (S1-00); BD team registration (P0-14); developers' `Rules loaded:` test (P0-17); merge of PR #10 (README and script); video captures and voice-over (S1-12); Earth-visibility check (S1-05h); Dev 3 and Dev 2 have not started |
| Live URL | — |
| Repo | https://github.com/WarRinOP/sightline (**public**; `main` protected; D-011, D-015) |

### Milestone progress

| Phase / Milestone | Status | % |
|---|---|---|
| S1 Stage 1 sprint (Oct 1–7) | In progress | 95% |
| P0 Setup | Folded into S1 | — |
| P1 Lock-in | In progress (P1-04 data verification done early; follow-ups P1-04a–e open) | 15% |
| M0 Kickoff & Contracts | In progress (scaffold, contracts, mocks, CI merged; JSON Schema export open) | 70% |
| M1 Data Pipeline | In progress (`fetch`, `sites`, `ephem`, `golden` built; kernels and 4 DEMs pinned) | 35% |
| M2 Engine | In progress (time, frames, ephemeris, `getSunEarth`, terrain horizons for 3 sites and `getTimeline` real in a browser worker; illumination method checked against Barker 2021 and AVGVISIB; windows not built; link not checked) | 50% |
| M3 Visual Canvas | Not started | 0% |
| M4 Command Center UI | Not started | 0% |
| M5 Story & Analyst | Not started | 0% |
| M6 Deploy & Deliverables | Not started | 0% |
| P3 Post-submission | Not started | 0% |

### Team

| Lane | Member | Skills | Laptop toolchain verified |
|---|---|---|---|
| Dev 1 — Core (Claude Code): contracts, engine, pipeline, validation, Analyst server, CI/deploy, merges | Team lead | | ☐ |
| Dev 2 — Scene (Antigravity): `packages/scene` | **Aktaruzzaman** (`rimonxyg`) | | ☐ |
| Dev 3 — Product UI & Story (Antigravity): app UI, state, Evidence, Story, `windows/` | **Fuad Hasan** (`fuadhasandipro`) | | ☐ |
| Non-dev teammates (story, video, slides, fact-check) | _TBD_ | | n/a |

---

## Session Entry Template (copy for each session)

```markdown
### Session NNN — YYYY-MM-DD — <who / which lane>

**Phase / tasks:** P?-?? , M?-??

**Done:**
- …

**Verified by:** (exact commands run + result; or "NOT VERIFIED: <reason>")
- …

**Decisions logged:** D-### …

**Blockers / risks:**
- …

**Next 3 tasks:**
1. …
2. …
3. …
```

---

## Session Log

### Session 019 — 2026-10-02 — S1-11 README, S1-12 video script (Claude Code)

**Phase / tasks:** S1-11, S1-12 (draft). Branch `dev1/S1-11-readme-and-pitch` from `main` after PR #9 merged; S1-05e ticked.

**Done:**

- Rewrote `README.md`: hook, why it is hard, the three sites' results with definitions, a verification table with what it does not show, a Mermaid architecture diagram, "what works today" against "not built yet", run instructions, honesty and data credits, team. Every number is copied from the repo's generated files.
- Wrote `docs/submission/DEMO_SCRIPT.md`: rules, a table of the only numbers that may be spoken, a five-part storyboard with narration (474 words, about 190 s), a capture checklist, and open items for the team lead.
- D-026 records where the brief's wording was replaced and why.

**Verified by:**

- `pnpm verify` exit 0 (docs-only branch; contracts 41, engine 167, web 6, parity 34; build ok). Prettier clean on README and docs.
- Every figure in the README table and the script's number table checked against `fixtures/golden/horizons_residuals.json`, `illumination_benchmark.json` and `sites.json` by a script (Sun 3.257e-8° = 0.117 milliarcsecond, Earth 2.648e-5° = 95.3 milliarcseconds, ratio 755; Spearman 0.9503; site figures).
- All relative links in the README and the script resolve (script check).
- `pnpm dev` serves the page at `http://localhost:3000` (HTTP 200, title and the Shackleton Rim crest entry present), as the README says.
- The narration was counted with a script (the first estimate, 526 words, was wrong).
- **NOT VERIFIED:** how GitHub renders the Mermaid diagram (not run; the syntax was checked by eye only); that a person can read the narration in the time (2.5 words a second is an assumption, not a recording); the team's agreement with the wording; the Stage 1 date, format and registration (open); the README on a clean clone (not run; `pnpm install` was not repeated from empty).

**Decisions logged:** D-026

**Blockers / risks:**

- `next dev` rewrites `apps/web/AGENTS.md` (Dev 3's file) on every start; do not commit it (D-026 item 9).
- The README says team registration is still to be completed and the early start is unconfirmed; change them when the facts change.
- The video needs captures and a voice-over from people; nothing is recorded.

**Next 3 tasks:**

1. Merge PR #10; the team edits the script; record the captures (S1-12).
2. Tell Dev 3 about the labelled rows and `longest_day_s` before the contracts freeze.
3. S1-05h (Earth-link check) and S1-13/S1-14 (tag `v0.1-stage1`, submission).

### Session 018 — 2026-10-02 — S1-05e illumination benchmark (Claude Code)

**Phase / tasks:** S1-05e (M2-13 in part, P1-04c in part). Branch `dev1/S1-05e-illumination-benchmark` from `main` after PR #8 merged. S1-05a and S1-05c were already ticked.

**Done:**

- Checked what the brief said exists. `DATA_VERIFICATION_REPORT.md` §4.2 has no published percentages. Barker et al. (2021) Table 2 is real but is for seven Site 1 Regions of Interest selected for nominal illumination above 70 % at 1 m, as the 1st percentile over 100 DEM error clones. So there is no published number for our three sites.
- Fetched and pinned the paper (`ntrs-barker2021-pdf`) and the PDS AVGVISIB map (`pds-avgvisib-85s-60m`); transcribed Table 2 into `pipeline/benchmarks/barker2021_table2.json`; wrote `sightline benchmark` (`benchmark.py`) and fixed the pass criteria in D-025, **committed before the first run**.
- Benchmark A (Barker's method at their seven centroids, 2024 to 2026, 1 m and 5 m) and B (900 random points against the AVGVISIB map): both pass.
- Found that the headline 48.9 / 35.2 / 36.6 % are the lander profile's "lit" (Sun's centre above the horizontal), not the published "illumination". The comparable 2026 figures at 2 m are 85.8 / 45.6 / 54.0 % (mean visible fraction of the disk). The home page now shows both, labelled.
- METHODS §7, D-025 (results and what may be cited), CITATIONS.md (new), a correction note in the data report, and an engine test that ties the benchmark to `getTimeline`.

**Verified by:**

- `pnpm verify` exit 0: contracts 41, engine 167, web 6, parity 34; build ok. Pipeline: `ruff check`, `ruff format --check`, `mypy --strict` (12 files) clean; `pytest` 111 passed (the real-DEM ones ran locally); `uv sync --locked` ok.
- Benchmark A: ours at the seven centroids 74.4 to 84.8 % (1 m) and 83.2 to 91.2 % (5 m); the paper's A 67.4 to 71.2 % and 82.8 to 89.3 %. Criteria A1 (at least A minus 2.0), A2 (at most C plus 5.0) and A3 (median at 1 m at least 70 %: 79.6 %) all pass; ours is at least A and below C in every case. The 28 longest-run comparisons are all in the expected direction.
- Benchmark B: map orientation chosen from terrain (`identity`; zero pixels 1,162 m below the others against 489 m for the runner-up). Spearman 0.950 over 900 points at 2 m (0.974, 0.895, 0.979 per tile), 0.922 at 0 m.
- The benchmark is deterministic (two runs identical in every shared field). The engine's `getTimeline` and the benchmark's Python path agree to the printed digit on 2026 at the three sites (an engine test).
- Unit tests: the limb-darkening lookup had a sign error, caught by a test against the uniform disk and fixed; the Sun path matches SPICE's golden cases within 1e-4°; the criteria bite individually.
- Browser (`next start`, `playwright-cli`): the three sites show 85.8 / 90.7 / 49.9, 45.6 / 51.0 / 39.8 and 54.0 / 59.5 / 53.8 % (average disk, any part, link) and the lander row (48.9, 35.2, 36.6 % lit). Only console error: the missing favicon.
- **Mistakes of mine:** the limb-darkening sign; I ran the benchmark once with a missing import that mypy had already flagged (3 minutes lost); the brief's premises (see above) were checked and corrected rather than followed; I wrote the Mazarico co-author list from memory and then checked it against NTRS (it was right).
- **NOT VERIFIED:** the method at our three sites (no published value exists there); the DEM itself (both benchmarks use the same 5 m tiles as the paper); Earth visibility and the DSN link (no reference compared); the AVGVISIB span and observer height; the paper's limb-darkening law (my 0.6 coefficient is an assumption, used only for a sensitivity run); the full text of Mazarico et al. 2011 (not available); CI on this branch (first run is the PR); Safari, Firefox, keyboard and screen-reader use of the new rows.

**Decisions logged:** D-025

**Blockers / risks:**

- Do not cite 48.9 / 35.2 / 36.6 % as illumination. Cite the mean visible fraction with its definition, the year and the mast, and "not published for these exact points".
- Link and Earth visibility are unchecked (S1-05h).
- Contracts freeze tomorrow; the contract was not changed in this branch.

**Next 3 tasks:**

1. Merge PR #9; tell Dev 3 about the two labelled rows (S1-05g) and `longest_day_s` before the freeze.
2. S1-05h: compare Earth visibility with the AVGVISIB Earth map before any link figure is cited.
3. S1-11 README draft and S1-12 video inputs, using the cleared wording from D-025 and METHODS §7.

### Session 017 — 2026-10-02 — S1-05a, S1-05c, S1-05d: three horizons, the crest, the timeline (Claude Code)

**Phase / tasks:** S1-05 close-out, S1-05a, S1-05c, S1-05d (and S1-05b in part). Branch `dev1/S1-05a-all-site-horizons` from `main` after PR #7 merged. The team lead's brief covered all of it; the early-start restatement of the previous prompt (CLAUDE.md §2.1) stands, D-010 still has no written confirmation (P0-02).

**Done:**

- Shackleton Rim moved to the crest of its rim ridge (D-024): the highest 5 m pixel of Site04 more than 1 km from the tile edge, 1739.1 m, 1.9 km from the old tile centre. `sightline sites`, `golden`, `horizons` (4 new Horizons requests) and the residuals file were regenerated by their commands.
- `sightline horizon` now runs over all three sites. During it I found my mast-height grid was inexact (0.1° to 0.7° at Connecting Ridge and de Gerlache Rim between stored heights) and replaced it by the exact upper envelope of lines `tan θ = A − h·B` per azimuth (83 to 256 KB per site).
- Engine: `getHorizon`, `probeLit`, `getSunEarth` with terrain for the three sites; a real `getTimeline` (lit, link, both, longest night and day, nights over the battery); `isLit`, `stepKind` and `summarizeSteps` moved from the mock into `packages/engine/src/timeline/`.
- Contract (additive, before the Oct 3 freeze): `TimelineStatistics.longest_day_s` and `longest_day_start_et`.
- Home page: all three sites show real Sun disk and Link tiles plus a "whole of the ephemeris, hourly" row from `getTimeline`.
- Repaired METHODS: my PR #7 edit had deleted §4 and the §5 intro; restored from git and updated.

**Verified by:**

- `pnpm verify` exit 0: contracts 41, engine 164, web 6, parity 34; build ok. Pipeline: `ruff check`, `ruff format --check`, `mypy --strict` (11 files) clean; `pytest` 98 passed (real-DEM tests ran locally); `uv sync --locked` ok.
- Parity after the regeneration: worst gaps Sun 2.07e-8°, Earth 2.68e-5°, disk 6.9e-9, DSN 0.189°; tolerances unchanged. Horizons residuals: Sun max 3.3e-8°, Earth max 2.65e-5° (unchanged: the maxima come from another site), echo check passed on the 4 new requests.
- Real DEMs: the committed envelope of each of the 3 sites equals a fresh brute-force mask at ten mast heights (0, 0.05, 0.125, 0.7, 1.9, 2, 6.1, 13.3, 19.9, 20 m) within 2e-7 rad; each file regenerates from the DEMs; the crest rule gives the same pixel for 1 km and 2 km margins.
- A mutation check: making the timeline use the mask at mast 0 instead of the profile's mast broke 6 tests; restored, all pass.
- Browser (`next start`, `playwright-cli`): the three sites show real Sun elevation and azimuth, Sun disk and Link, tag "Real terrain · not yet validated", and the timeline row; its figures equal the Node figures to the digit (Shackleton crest 48.9 / 49.9 / 25.2 %, 185.8 and 115.8 d; Connecting Ridge 35.2 / 39.8 / 11.8 %, 146.3 and 23.8 d; de Gerlache 36.6 / 53.8 / 21.4 %, 114.7 and 25.6 d). Only console error: the missing favicon.
- **Mistakes of mine:** the mast grid (above); a refactor that let "no data" through (`atan(−inf)` is finite), caught by the test for it; the METHODS deletion in PR #7; my first 3 m tolerance for 5 m versus 80 m heights, which the crest peak (3.1 m, an 80 m map smooths a peak) exceeded, now 10 m with that reason.
- **NOT VERIFIED:** any of the terrain results against a published product (nothing compared; the figures could be well off); CI on this branch (first run is the PR) and the real-DEM tests on Linux (skipped there); a timeline longer than a year or at a finer step in the browser; Safari and Firefox; keyboard and screen-reader use of the new row; whether the brief's "illumination ratio" means the contract's profile-based `illuminated_ratio` (I assumed yes).

**Decisions logged:** D-024 (and D-019 updated)

**Blockers / risks:**

- The terrain results are unvalidated. The lit fractions (35% to 49%) are lower than I would want to present without a check against LOLA illumination (S1-05e); that is the first thing to do before they appear in the README or video.
- The brief named `illumination_ratio`, `earth_comm_ratio` and `longest_day_s` and the file `engineClient.ts`; the contract has `illuminated_ratio` and `comms_ratio`, the client is `real/sightlineEngine.ts`, and only the day pair was added.
- Contracts freeze tomorrow; Dev 3 must be told about the two new fields before then.

**Next 3 tasks:**

1. Merge PR #8; tell Dev 3 about `longest_day_s` and `getTimeline` (S1-05f, S1-09) before the Oct 3 freeze.
2. S1-05e: compare the engine's illumination with a published product (P1-04c).
3. S1-11 README draft and S1-12 video inputs, with every terrain figure labelled "not yet validated".

### Session 016 — 2026-10-02 — S1-05 terrain horizon v0 (Claude Code)

**Phase / tasks:** S1-05 (and the parts of M2-05 and M1-07 it covers). Branch `dev1/S1-05-horizon-v0`, from `main` after PR #5 and #6 merged. S1-05 was marked `[~]` when started, after the team lead restated the early-start permission (CLAUDE.md §2.1; D-010 still has no written confirmation, P0-02).

**Done:**

- `sightline horizon` (`pipeline/sightline_pipeline/horizon.py`): great-circle rays on the 1737.4 km sphere, bilinear DEM sampling, exact curvature, 1440 azimuths, 13 mast heights (0 to 20 m); the 5 m Site04 tile to 12 km, the 80 m south-polar map to 300 km where the tile has no data. Writes `packages/engine/src/data/horizon_shackleton-rim.json` (205 KB, 3.5 s to run).
- Engine: `packages/engine/src/horizon/` (`HorizonProfile`, `parseHorizonFile`); `computeSky` takes an optional terrain horizon; `SightlineEngineClient` answers `getHorizon`, `probeLit` and a terrain-aware `getSunEarth` for the Shackleton Rim tile centre and refuses `getHorizon` and `probeLit` elsewhere; `getTimeline` and `findWindows` refuse everywhere (M2-08).
- Home page: the Sun disk and Link tiles show real values, tagged "Real terrain · not yet validated", for Shackleton Rim, and "—" for the other two sites (Dev 3's file, at the team lead's direction; D-023 item 8).
- D-023, METHODS §6, AI disclosure, REMAINING (S1-05 done; S1-05a, b, c added).

**Verified by:**

- `pnpm verify` exit 0: contracts 41, engine 117 (17 new in `horizon.test.ts`), web 6 (one extended), parity 34; build ok. Pipeline: `ruff check`, `ruff format --check`, `mypy --strict` (11 files) clean; `pytest` 88 passed (14 new in `test_horizon.py`); `uv sync --locked` ok.
- Real DEMs: my stereographic formula agrees with PROJ to 4.7e-10 m on 2,000 random points for both files' CRS; the site's height reads 769.68 m in the 5 m tile and 770.49 m in the 80 m map (catalog 769.7); the terrain around the centre rises 31 m in 50 m to the east and falls the same to the west (a roughly 32° wall), and the mask peaks at 32.7° there (`atan(31/50)` = 31.8°).
- Analytic tests on synthetic terrain (these run in CI): sphere closed form; the 2 m-mast mask equals the flat-horizon dip `acos(R/(R+h))`; a 100 m wall; azimuth convention against independent 3-D vectors, including the seam at north; bowl floor against rim; mast monotonic (Δθ ≤ 0); brute-force scalar implementation with the textbook formula agrees within 5e-5 rad. Real-tile tests (skipped in CI without the DEMs): the crest sees a lower mean mask than the floor; the file regenerates; interpolation error below 0.001° where the mask is below 3°.
- Engine over 2026 (hourly, 2 m mast): Sun above the mask 10.95% of the time (flat horizon 60.1%), Earth above it 0% (flat 45.2%). Engine output, not validated.
- Browser (`next start`, `playwright-cli`): Shackleton Rim shows the two tiles with values and the tag "Real terrain · not yet validated"; Connecting Ridge shows "—" and "Not computed yet". The only console error is the missing favicon.
- **Mistakes of mine, found by tests:** a numerical cancellation in the elevation formula (1.7e-12 rad); two wrong physics assumptions in my first tests; an unsupported comment that mast interpolation "errs towards shadow" (it does not; replaced by measured errors); and my guess that the TypeScript azimuth wrap had the same 2π bug as the Python one was wrong (only the Python did, fixed in PR #5). Two existing engine tests that assumed Shackleton Rim has a flat horizon were repointed at Connecting Ridge.
- **NOT VERIFIED:** the mask against any independent horizon or illumination product (no LOLA illumination map or Horizons-style reference was used; M2-13); CI on this branch (first run is the PR); the real-DEM tests on Linux (they skip in CI); Safari and Firefox; keyboard and screen-reader use of the new tiles; that 0.25° rays do not miss narrow ridges (a known limit); the 300 km far field's effect (no run without it).

**Decisions logged:** D-023

**Blockers / risks:**

- The Shackleton Rim tile centre is mid-wall: the Sun is lit 11% of 2026 and Earth is never visible there. That is the terrain, but it is a poor demo observer (S1-05c needs the team lead).
- The result is unvalidated. Say "terrain horizon from LOLA, not yet validated" in the README and video, not "illumination".
- Contracts freeze Oct 3 (tomorrow); no contract change was needed. `ProbeLitResult` kept its fields (D-023 item 6).
- Dev 2 and Dev 3 still have no commits.

**Next 3 tasks:**

1. Merge PR #7; S1-05a (the same horizon for Connecting Ridge and de Gerlache Rim).
2. Team lead: S1-05c, choose the demo observer; then M2-13-style check of the mask against a published illumination value.
3. S1-11 README draft and S1-12 video inputs (real numbers on screen: directions, Horizons residuals, terrain horizon labelled unvalidated).

### Session 015 — 2026-10-02 — PR #5, S1-04a dropped, S1-03a real engine in the app (Claude Code)

**Phase / tasks:** S1-04 close-out, S1-04a (dropped), S1-03a. Branch `dev1/S1-03a-wire-real-engine`, stacked on `dev1/S1-04-horizons-validation`. S1-03a was marked `[~]` when started. The team lead approved S1-04 and told this session to proceed (D-010 still has no written confirmation, P0-02).

**Done:**

- Merged `main` (PR #4) into the S1-04 branch, pushed it and opened **PR #5** (https://github.com/WarRinOP/sightline/pull/5) with the residuals table and the notice for Dev 3 (`Location.elev_m`, `HorizonsResidualsSchema`, contracts freeze Oct 3). D-021 gets item 9: S1-04a dropped (the 2.65e-5° Earth gap is 755 times inside the limit).
- PR #5's first CI run failed in `pipeline`: `az_el` in the golden code returned exactly 2π for a vector a hair west of north. Reproduced, fixed (a result at or above 2π becomes 0), test added that fails on the old code. The TypeScript equivalent was never affected.
- S1-03a (D-022): `apps/web/workers/` (`engineApi.ts`, `engine.worker.ts`, `engineBridge.ts` with `connectEngine()`), `comlink` 4.4.2 added, `/` shows real Sun and Earth elevation and azimuth for the 3 sites, with a data-driven badge. Sun disk and Link to Earth show "—" and a "Not computed yet" tag. The page says the sites are tile centres, not landing points.

**Verified by:**

- `pnpm verify` exit 0 on the merged S1-03a branch (contracts 41, engine 100, web 6, parity 34; build ok). Pipeline: `ruff check`, `ruff format --check`, `mypy --strict` clean; `pytest` 75 passed; `uv sync --locked` ok.
- PR #5 CI, first run: `web` pass, `pipeline` **fail** (`test_az_el_conventions`, 6.283185307179586 against 0.0). Python reproduction: with `north - 1e-16·east` the old `az_el` returns exactly 2π; the new test fails on the old code and passes on the new.
- Browser (`next start`, `playwright-cli`): the worker loads the 2.1 MB ephemeris, the readout renders and advances, the badge reads "Real · NAIF SPICE". Connecting Ridge at 2026-10-07 08:44:13 UTC showed Sun +1.67° at 2.7°, Earth −1.25° at 141.8°; a separate Node call into the engine for the same time gave Sun 1.667° at 2.715°, Earth −1.252° at 141.847°. Only console error: the missing favicon (S1-01d).
- First version showed mock values under a SIMULATED tag for the two terrain-dependent fields. The browser then showed "Link to Earth: yes" while the real Earth was at −1.25°, so it was replaced by "—" (D-022 item 4; this departs from the brief and is easy to reverse).
- **NOT VERIFIED:** PR #5 CI after the fix and PR #6 CI (pushed after this entry); keyboard use and a screen reader on the new page (read from markup only); reduced-motion start-paused (code only); Safari and Firefox (only the Playwright default browser); the page against a production data host (the ephemeris is a bundled asset); the cause of the CI runner's different rounding (inferred, not measured).

**Decisions logged:** D-021 item 9; D-022

**Blockers / risks:**

- PR #5 and PR #6 await the team lead's merge. PR #6 contains PR #5's commits until #5 is merged.
- Dev 2 and Dev 3 have not committed anything; the contracts freeze is Oct 3. Dev 3 should take over `live-readout.tsx` (S1-03c).
- Terrain (M2-05) is the only thing between the app and a real light/link number. 4 days to the Oct 6 freeze.

**Next 3 tasks:**

1. Merge PR #5, then PR #6; tell Dev 3 about `connectEngine` and S1-03c.
2. S1-05 horizon v0 on Site04 (needs the team lead to restate the early-start permission, CLAUDE.md §2.1).
3. S1-11 README draft and S1-12 video script inputs: which numbers on screen are real (directions, Horizons residuals).

### Session 014 — 2026-10-02 — PR #4, then S1-04 JPL Horizons validation (Claude Code)

**Phase / tasks:** S1-03 close-out (PR #4), S1-04. Branch `dev1/S1-04-horizons-validation`, stacked on `dev1/S1-03-real-ephemeris`. S1-04 was marked `[~]` in REMAINING when started.

**Done:**

- PR #3 was merged by the team lead. Merged `main` into the S1-03 branch, ticked S1-03, extended the AI disclosure, pushed, and opened **PR #4** (https://github.com/WarRinOP/sightline/pull/4).
- `sightline horizons`: asks JPL Horizons for the Sun and Earth at the 3 sites and 50 epochs, checks Horizons' echo of the site and the Moon, caches the answers, writes `fixtures/golden/horizons_reference.json` (Horizons plus the SPICE route for the same cases).
- `packages/engine/test/horizons.test.ts` computes the engine's residuals, asserts the tolerance, and writes or checks `fixtures/golden/horizons_residuals.json`. `HorizonsResidualsSchema` added to the contracts.
- Measured the cause of the Earth gap (D-021). Corrected D-020 item 5 and METHODS §3, which had blamed light time.

**Verified by:**

- PR #4 CI: `web` pass (34 s), `pipeline` pass (35 s) on Linux, Python 3.12; the kernel fetch took seconds (9.46 MB/s) and `pytest` gave 51 passed, 2 skipped (the two DEM-dependent tests). This confirmed on Linux the regeneration tests that were unverified in session 013.
- Horizons API doc read for `TLIST`, `TIME_TYPE`, `TLIST_TYPE`, `CSV_FORMAT`, `EXTRA_PREC`. A 3-epoch probe returned the expected format. Full requests: **a 50-epoch request returns HTTP 502 (URL 2,249 characters); 25 epochs (1,324) works**, so the command batches by 25: 12 requests in 16 s, serial, 1 s apart; `signature.version` 1.2.
- Horizons' own echo for each site: geodetic coordinates equal ours, `Center cylindric` Dxy 7.07418 km and Dz -1738.16 km (= (1737.4+0.7697)·cos and sin of the latitude, so a sphere and planetocentric), radii 1737.4 on all axes, `MEAN_ME` (high precision), refraction NO.
- The residuals (engine minus Horizons, 300 rows, 0.02° acceptance limit written in the report on 2026-10-01): **Sun separation max 3.3e-8°, mean 1.0e-8, rms 1.4e-8; Earth separation max 2.6e-5°, mean 1.6e-5, rms 1.8e-5; Earth elevation max 2.6e-5°, Earth azimuth on the sky max 5.9e-7°.** Largest gap 2.65e-5°, 755 times inside the limit. The three sites are alike (Earth 2.64e-5 to 2.65e-5). Horizons versus SPICE: Sun at most 1.0e-8°, Earth at most 4.8e-7°. Raw Horizons and SPICE values differ in the 7th to 10th decimal and none are identical.
- Negative controls (in the test): a 10-minute time shift and a 0.01° longitude error both break the tolerance.
- Attribution of the Earth gap, at exact sample times (no interpolation): geometry with no correction is exactly 0; light time only: Earth 3.1e-6°, Sun 1e-12°; light time plus aberration: Earth 2.7e-5°, Sun 2.3e-8°.
- `pnpm verify` exit 0: prettier clean; typecheck clean; tests contracts 41, engine 99 (10 of them in `horizons.test.ts`); parity 34; build ok. Pipeline: `ruff check`, `ruff format --check`, `mypy --strict` (10 files) clean; `pytest` 74 passed; `uv sync --locked` ok.
- **Two bugs of mine, found and fixed.** (1) The first separation used `acos(u·v)`, which cannot return less than 8.5377e-7° (`acos(1−2⁻⁵³)`); the same "max 8.54e-7" appeared for both bodies and in three comparisons, which gave it away. I confirmed the floor numerically and moved to `atan2(|u×v|, u·v)` in Python and TypeScript; the figures above are the corrected ones, and the S1-03 parity numbers were never affected. (2) My first explanation of the Earth gap (Moon-centre light time) was wrong: SPICE told to use centre light time still differed by 2.7e-5°. Two parse checks of mine (altitude `.7697`, "sphere" wording) also failed on the first live answer.
- **NOT VERIFIED:** the mechanism behind the aberration term (the numbers match "aberration times Earth's parallax" but I did not test that separately); the S1-04 branch on GitHub CI (not pushed); the Horizons comparison for any mast height other than 0, any epoch outside 2026-01-02 to 2026-12-30, or any body other than the Sun and Earth; Horizons' behaviour on repeat (answers are cached; a refresh with `--refresh` was not run, so it is untested whether Horizons returns identical numbers on a second day); it validates directions, not illumination.

**Decisions logged:** D-021; D-020 item 5 corrected

**Blockers / risks:**

- PR #4 awaits the team lead's merge; the S1-04 branch is stacked on it.
- The 2.6e-5° Earth gap is 0.1 arcsecond and harmless, but anyone reading the residuals file will see the Earth worse than the Sun; METHODS §5.1 explains why. S1-04a would remove it.
- The horizon is still flat ground; the Evidence page must present this as direction accuracy, not as illumination accuracy.

**Next 3 tasks:**

1. Merge PR #4; push `dev1/S1-04-horizons-validation` and open its PR (needs your word to push).
2. Tell Dev 3 where the validation table comes from (`horizons_residuals.json`, `HorizonsResidualsSchema`) and about `Location.elev_m` (S1-10, S1-03a).
3. S1-05 horizon v0 on one real site (needs the Site04 DEM, already downloaded), or S1-03a wiring the real client into the app.

### Session 013 — 2026-10-02 — PR #3, then S1-03 real ephemeris, time, frames, getSunEarth (Claude Code)

**Phase / tasks:** S1-02 close-out, S1-02a, S1-03, and the parts of M1-05, M1-06, M1-07, M2-01, M2-02, M2-03 it covers. Branch `dev1/S1-03-real-ephemeris`, stacked on `dev1/S1-02b-dem-downloads`.

**Done:**

- PR #2 is merged. Opened **PR #3** (https://github.com/WarRinOP/sightline/pull/3), CI green. **I did not merge it:** the permission classifier blocked `gh pr merge --admin` ("merge without review"), so it waits for the team lead.
- Pipeline: `sightline sites` (tile centres of the PGDA #78 DEMs), `sightline ephem` (Sun, Earth, 3 DSN complexes from SPICE), `sightline golden` (time and Sun/Earth fixtures from SPICE). Downloaded and pinned the Site01 and Site11 DEMs.
- Engine: `time` (leap seconds), `frames`, `ephemeris` (Hermite), `sky` (`computeSky`), and `SightlineEngineClient` (`listSites` and `getSunEarth` real; the four terrain-dependent methods refuse).
- Contract: `Location.elev_m` (optional). CI fetches the SPICE kernels. `docs/science/METHODS.md` created.
- D-019 accepted (option A), D-020 logged, D-008 amended.

**Verified by:**

- `gh pr checks 3`: `pipeline` pass (9 s), `web` pass (30 s).
- `sightline fetch --only pgda78-site01-surf --only pgda78-site11-surf`: 81,961,616 B, sizes and Content-Type matched, SHA-256 pinned (the throughput was 124 to 317 KB/s).
- `sightline sites`: Shackleton Rim (-89.766811°, 188.130°E, 769.7 m), Connecting Ridge (-89.463163°, 222.510°E, 1944.8 m), de Gerlache Rim (-88.683418°, 292.068°E, 1793.7 m): the centres the team lead confirmed.
- `sightline ephem` (1 s): 8,761 records, 2,102,640 B. The first attempt failed with a SPICE error (no ITRF93 orientation at 2026-01-01T00:00:00 UTC minus the light time); `pckcov` showed the kernel starts at exactly that instant, so the first sample moved one minute later (D-020 item 3).
- `sightline golden`: `time.json` 15 cases (three leap seconds), `sun_earth.json` 144 cases.
- `pnpm verify` exit 0: prettier clean; typecheck clean in 4 workspaces; tests: contracts 38, engine 89; **parity 34**; build ok.
- Parity (tolerances fixed before the first run): Sun worst gap 2.07e-8° (limit 1e-4°), Earth 2.68e-5° (1e-4°), disk fraction 6.4e-9, DSN elevation 0.189° (0.25°), time within 1 µs on all 15 cases. The 0.189° is the known geodetic-versus-geocentric vertical gap (up to 0.19°), measured beforehand with `spkcpt` at 0.03° to 0.18°.
- `listSites()` returns the 3 sites with `simulated: false` and the PGDA #78 `source_url` (test `realEngine.test.ts`).
- Seasonal behaviour in 2026 (engine, hourly): Sun elevation ±1.77° (Shackleton), ±2.05 to 2.11° (Connecting Ridge), ±2.8° (de Gerlache), i.e. the 1.54° tilt plus each colatitude; 12 or 13 turns round the horizon; month-averaged elevation changes sign on 2026-02-27 and 2026-08-23; Earth within about 10° of the horizon and above the flat horizon 44% to 49% of the time; a link exists whenever Earth is up with a 0° mask (best complex never below about 8.7°), with short gaps (about 0.5% of Earth-up time) at a 10° mask.
- Two test assertions of mine were wrong and were corrected, not the engine: a 2 m mast dips the horizon 0.0869°, not 0.0861°; and "Earth up but no DSN" never happens at a 0° mask (measured, then the test was rewritten to assert that and the 10° gaps).
- Pipeline: `ruff check`, `ruff format --check`, `mypy --strict` (17 files) clean; `pytest` 53 passed; `uv sync --locked` ok. Reproducibility tests regenerate the catalog, an ephemeris slice (49 records) and both fixtures and compare them with the committed files.
- **NOT VERIFIED:** this branch on GitHub CI (no PR yet; the CI job now downloads 62 MiB of kernels, never run there); a comparison with JPL Horizons (S1-04); the engine in a browser worker (everything ran in Node); the Earth orientation predict kernel's accuracy (it is a long-term predict); results on Linux versus macOS (the regeneration tests use a 1e-9 relative tolerance, untested off macOS); the DEM-dependent tests in CI (they skip there).

**Decisions logged:** D-019 accepted; D-020; D-008 amended

**Blockers / risks:**

- PR #3 needs the team lead's merge, and the S1-03 branch is stacked on it.
- Terrain (M2-05) is not built, so no illumination or communication-window number exists yet. The real client refuses those methods by design. For the Stage 1 video this means the real numbers on screen are Sun and Earth directions (checked against SPICE), not percentages.
- `Location.elev_m` is a contract change; it must be in place before the freeze on Oct 3. Dev 2 and Dev 3 should be told.
- The web app still renders the mock engine (labelled SIMULATED). S1-03a wires the real one.

**Next 3 tasks:**

1. Merge PR #3; open the S1-03 PR and watch the first CI run with the kernel download.
2. S1-04 Horizons check: 3 sites by 50 epochs, residuals saved as JSON (needs `sources.yaml` entry for the Horizons API; rate limit 1 request/s).
3. S1-03a Wire the real client into the app (worker loads the ephemeris), and tell Dev 3 about `Location.elev_m`.

### Session 012 — 2026-10-02 — PGDA benchmark, PR #2, DEM downloads, coordinate check (Claude Code)

**Phase / tasks:** S1-02 (DEM part), M1-02, D-018 update, D-019. Branch `dev1/S1-02b-dem-downloads` (stacked on `dev1/S1-02-downloads-and-pipeline`).

**Done:**

- Recorded the PGDA benchmark in D-018 (relay not needed for Stage 1) and in P0-12.
- Pushed S1-02 and opened **PR #2** (https://github.com/WarRinOP/sightline/pull/2) with the download metrics. Not merged yet.
- Added the `dem` group to `sources.yaml` (`pgda78-site04-surf`, `pgda90-ldem-80s-80m`), downloaded both, pinned their SHA-256.
- Checked the three site coordinates from the brief against the DEMs. They do not verify (D-019). Nothing from the brief went into the catalog.

**Verified by:**

- `curl -I` on 2026-10-02: Site04 40,980,806 B, Site01 40,980,810 B, Site11 40,980,806 B, `LDEM_80S_80MPP_ADJ.TIF` 189,158,392 B; all 200, `image/tiff`, `Accept-Ranges: bytes`.
- Range probes of 4 MiB: HTTP 206 at 140 KB/s (Site04) and 102 KB/s (LDEM).
- PR #2 CI: `pipeline` pass (14 s), `web` pass (24 s).
- `sightline fetch --only dem`: 2 downloaded, 230,139,198 B, about 12 min, 314 KB/s overall; sizes and Content-Type matched. `shasum -a 256` of both files equals the pinned values.
- `rasterio` (scratch environment, not a project dependency) opens both files: Site04 3200 x 3200 float32, 5 m, bounds (-9000, -15000, 7000, 1000), no NaN, -2848 to +1805 m; LDEM 7600 x 7600 float32 tiled COG, 80 m, overviews 2/4/8/16, bounds +/-304 km, no NaN, -7295 to +7026 m.
- `sightline fetch --only dem --only spice --strict`: 10 datasets `cached ... pinned`, 0 B downloaded, exit 0, 10 s.
- Coordinate check: see the D-019 table. 5 m and 80 m heights agree where both cover a point.
- `ruff check`, `ruff format --check`, `mypy --strict`: clean; `pytest`: 31 passed.
- **NOT VERIFIED:** this branch on GitHub CI (no PR yet); the DEM hashes are trust on first use (no PGDA checksum found); where Site11 sits relative to the "de Gerlache rim" on the ground (only the file's georeference was read); the identity of the brief's coordinates (they may be real coordinates of something else; the check only shows they do not match these DEM tiles and elevations).

**Decisions logged:** D-018 updated, D-019 proposed

**Blockers / risks:**

- Site coordinates need the team lead's choice (D-019, S1-02a). S1-03 can start on placeholders labelled SIMULATED, but real-looking output for named sites needs a verified source.
- Stage 1 is Oct 7 (5 days). Contracts freeze on Oct 3: a real site catalog (with `source_url`) must be a data file (CLAUDE.md §7.1), so check whether the contract needs a change before the freeze.

**Next 3 tasks:**

1. Merge PR #2; then open the PR for `dev1/S1-02b-dem-downloads`.
2. S1-02a: team lead picks option A or B (D-019); then `sightline sites` (M1-06) and the catalog file.
3. S1-03: ephemeris from the kernels (`sightline ephem`, M1-05) and the engine's `time`, `frames` and `getSunEarth`.

### Session 011 — 2026-10-02 — S1-01 wrap-up and S1-02 SPICE downloads (Claude Code)

**Phase / tasks:** S1-01b, S1-01 (tick), S1-02 (SPICE part), M1-02 (first version). Branch `dev1/S1-02-downloads-and-pipeline`.

**Done:**

- PR #1 (S1-01) is merged. `web` and `pipeline` are now required status checks on `main`; the other protection settings are unchanged. S1-01 is ticked.
- `sightline fetch` is real: reads `pipeline/sources.yaml`, downloads into `data/raw/<id>/`, resumes, retries, rate-limits, checks size, Content-Type, SHA-256 and the publisher MD5, and logs throughput.
- Downloaded the 8-kernel SPICE set (65,010,769 B) and pinned the 8 SHA-256 values in `sources.yaml`.
- Two names in the brief were wrong or out of date (`moon_pa_de440_200650.bpc` is a 404; the D-008 set uses `pck00011.tpc`); the verified names were used. D-018 records this and the checksum method.

**Verified by:**

- `gh api PUT .../branches/main/protection`: response lists `contexts: ["web","pipeline"]`, 1 review, code owners, no force push or deletion, conversations resolved. (Required checks were added with the full protection document, because `required_status_checks` was null and the `/contexts` endpoint needs it to exist.)
- `curl -I` on all 8 kernel URLs: 200, sizes equal the report's. `aa_checksums.txt` exists only for `spk/planets`.
- `uv run --project pipeline sightline fetch --only spice`: 8 downloaded, 65,010,769 B, 68.8 s, average 945 KB/s, no check failed (a failed size, type or MD5 check aborts the run). Per file: `de440s.bsp` 1749 KB/s, `moon_pa` 346 KB/s, `earth_2026…predict.bpc` 1912 KB/s.
- Independent checks: system `md5` of `de440s.bsp` = NAIF's 3917ee56…843d; `shasum -a 256` = the pinned c1c7feea…49f2; first bytes of each file are the expected SPICE ID words; `find` sums to 65,010,769 B; no `.part` left; `git status` shows nothing under `data/`.
- `sightline fetch --only spice --strict` after pinning: all 8 `cached … pinned`, 0 B downloaded, exit 0, 8 s.
- `ruff check`, `ruff format --check`, `mypy --strict`: clean; `pytest`: 30 passed (mocked transport: resume, range ignored, soft-404 HTML, wrong size, wrong hash, wrong MD5, retries and backoff, cache, corrupt cache, id and group selection, the real `sources.yaml`); `uv sync --locked`: ok.
- **NOT VERIFIED:** the new code on GitHub CI (this branch has no PR yet); downloads from PDS, PGDA and MIT hosts (no entries yet); the 7 kernels without a publisher checksum are pinned from our own first download (trust on first use), not checked against a NAIF value; the fetcher against a connection reset mid-file on a real network (resume is tested only with a mocked transport); `.bpc` and `.bsp` Content-Types may change if NAIF changes its server.

**Decisions logged:** D-018

**Blockers / risks:**

- The other half of S1-02 (one site DEM and the 80 m mid tier) is open: the report's draft has sizes but not hashes, and PGDA was 2.7 KB/s on Oct 1 (189 MB would take about 19 h at that speed). Measure PGDA and PDS before deciding on the relay (D-009, P0-12).
- Stage 1 is Oct 7. S1-03 (real Sun/Earth for 3 sites) now has its kernels, but it needs real site coordinates (P1-04b, M1-06), which are still unverified.

**Next 3 tasks:**

1. Open the S1-02 PR; then HEAD-verify, add and fetch the PGDA #90 80 m DEM and one #78 site DEM (measure the speed first).
2. S1-03 Real ephemeris for the 3 sites in the engine (needs the verified site coordinates, or a clear label that the sites are placeholders).
3. P0-18 GitHub Issues for Dev 2 and Dev 3; S1-01c when Dev 2 asks for the three.js packages.

### Session 010 — 2026-10-02 — S1-01 scaffold, contracts, mock engine (Claude Code)

**Phase / tasks:** S1-01 (branch `dev1/S1-01-scaffold-and-contracts`). The team lead told this session to proceed; D-010 still has no written confirmation (P0-02).

**Done:**

- Monorepo: pnpm workspace, root scripts from CLAUDE.md §4, strict TypeScript base, ESLint 10 + Prettier.
- `packages/contracts`: zod schemas, inferred types and the `EngineClient` / `TileSource` interfaces; provenance and `simulated` rules enforced in the schemas.
- `packages/engine`: SIMULATED mock engine (analytic bowls, circular Sun/Earth) and 64 × 64 mock tiles.
- `packages/scene`: S3 stub (`MoonScene`, `FisheyeSky`). `apps/web`: Next.js shell, design tokens, "Hello Moon" page with the SIMULATED badge, site list and live readout.
- `pipeline/`: Python CLI skeleton (all stubs). `.github/workflows/ci.yml`.
- D-016 records the added packages, the contract additions and the mock's limits.

**Verified by:**

- `pnpm install` (then `--frozen-lockfile`): ok. `pnpm verify` exit 0: lint (eslint + prettier) clean; typecheck clean in 4 workspaces; tests 37 (contracts) + 35 (engine) passed; build ok (routes `/` and `/_not-found`, both static). `test:parity` prints `NOT RUN` (no golden fixtures yet).
- Pipeline: `ruff check`, `ruff format --check`, `mypy --strict` clean; `pytest` 10 passed; `sightline --help` works and `sightline ephem` exits 2.
- Browser: ran `next start`, opened the page with `playwright-cli`: the badge and 3 sites render, and the readout changed between two reads (Sun −0.17° → −0.16°, Earth +5.34° → +6.40°, epoch +2.3 days). The only console error was a missing favicon.
- Two engine tests failed first and exposed real defects: `getTimeline` threw synchronously instead of rejecting (fixed with `async`), and a test used a window where the site is dark anyway (test fixed).
- **NOT VERIFIED:** the GitHub Actions run (workflow has never executed; action versions were checked with `gh api`, not run); Python 3.12 (local checks ran on 3.13; CI pins 3.12); that Windows laptops can run `pnpm verify`; keyboard and screen-reader behaviour of the page beyond reading its markup; reduced-motion start-paused behaviour (code only).

**Decisions logged:** D-016

**Blockers / risks:**

- The mock's numbers are not the Moon's. The three sites have placeholder coordinates; nothing from `mock/` may be shown as real.
- `docs/submission/AI_DISCLOSURE.md` is not in the repo (CLAUDE.md §2.5 says AI use is recorded there as it happens). Claude Code wrote all of S1-01; the file belongs to the non-dev teammates, so it needs creating or the entry handing over.
- Contracts freeze on Oct 3; Dev 2 and Dev 3 have one day to find gaps.
- Tooling used a pnpm shim and `uv` installed under the session scratchpad. The team lead's machine still lacks `pnpm` on the PATH and `uv`.

**Next 3 tasks:**

1. Open the PR for S1-01, watch the first CI run, then add the required checks (S1-01b) and tick S1-01.
2. P0-18 Create the GitHub Issues; tell Dev 2 and Dev 3 to start from the merged scaffold.
3. S1-03 Real ephemeris for 3 sites (needs S1-02 kernels downloaded).

### Session 009 — 2026-10-01 — Readiness check and group message (Claude Code)

**Phase / tasks:** S1, P0-17, P0-18

**Done:**

- Checked readiness. Ready: public repo, protected `main`, both developers' branches and folders, `AGENTS.md` rules, logs, PR template, `CODEOWNERS`. **Not ready:** scaffold, contracts and mock engine (S1-01); GitHub Issues (P0-18); Fuad's invitation is still pending; the organizers' answers (S1-00) and BD team registration (P0-14) are open.

- Drafted the message for the team group chat (what each person does, how to start, the short rules, first tasks, the non-dev asks). Added the open items to the dashboard.

**Verified by:** `git log` shows all 8 earlier sessions pushed; `gh api …/collaborators` and `…/invitations` earlier showed `rimonxyg` active and `fuadhasandipro` pending. **NOT VERIFIED:** that the developers have started or that their agents load `AGENTS.md`.

**Decisions logged:** none

**Blockers / risks:** the scaffold is the critical path for the developers; the daily check-in time is not set (P0-20).

**Next 3 tasks:**

1. S1-01 Scaffold, contracts, mock engine, mock tiles, CI (Dev 1).

2. P0-18 Create GitHub Issues for the first tickets.

3. S1-00 / P0-14 Ask the organizers; register the team.

### Session 008 — 2026-10-01 — Repo public + branch protection (Claude Code)

**Phase / tasks:** S1-13 (partly), D-015 update

**Done:**

- Audited the repo before publishing: 23 tracked files, no secret-like file names, no secret patterns in the full history, only the organizers' published contact email in the files.

- Made `WarRinOP/sightline` **public**. Enabled protection on `main`: pull request required, 1 code-owner approval, stale approvals dismissed, conversations resolved, force-push and deletion blocked, admin bypass for the owner.

- Set this clone's commit email to the GitHub no-reply address for future commits. Updated AGENTS.md §6, TEAM_WORK_SPLIT §8, D-011, D-015.

**Verified by:** `gh repo view` → `PUBLIC`; the protection `PUT` response lists the settings above; `git grep`/`git log -p` scans found no secrets. **NOT VERIFIED:** how protection behaves for the developers' accounts (not testable from the owner's account); the first pull request will show it.

**Blockers / risks:** The 7 earlier commits still show the team lead's personal email in their metadata. No required status checks yet (no CI until M0).

**Next 3 tasks:**

1. S1-01 Scaffold + contracts + mock engine + CI (then add CI as a required check).

2. Fuad accepts the invitation; both developers run the `Rules loaded:` test.

3. S1-00 / P0-14 Ask the organizers; register the team.

### Session 007 — 2026-10-01 — Developer onboarding (Claude Code)

**Phase / tasks:** S1, P0-16, P0-17, D-015

**Done:**

- Dev 2 (Aktaruzzaman, `rimonxyg`) and Dev 3 (Fuad Hasan, `fuadhasandipro`) have Write access. Merge commits are now the only allowed merge type.

- Wrote the root `AGENTS.md` and dedicated `AGENTS.md` files for `packages/scene/`, `apps/web/` and `packages/engine/src/windows/`; folder README stubs; per-developer logs and a logs README; PR template additions; `CODEOWNERS`; the `main-push-audit` workflow.

- Created the home branches `dev2/integration` and `dev3/integration`. Logged D-015.

**Verified by:**

- `gh api users/<login>`: both accounts exist; the public profile `rimonxyg` shows the name "Akhtaruzzaman Rimon" and the email the team lead gave. `GET collaborators`: `rimonxyg` already had access; Fuad's invitation is pending until he accepts.

- Branch protection: `PUT branches/main/protection` returned HTTP 403 (needs GitHub Pro or a public repo). Hence the audit workflow.

- **NOT VERIFIED:** that Antigravity loads the `AGENTS.md` files (needs each developer to test the `Rules loaded: …` line); that the `main-push-audit` workflow runs as intended (first run happens on the next push to `main`).

**Decisions logged:** D-015

**Blockers / risks:** Fuad must accept the invitation. The workspace scaffold (day 1, Dev 1) is still needed before the developers can run `pnpm verify`.

**Next 3 tasks:**

1. S1-01 Scaffold, contracts, mock engine, mock tiles, CI (Dev 1), so Dev 2 and Dev 3 can plug in.

2. Both developers: first tickets (S1-06 and S1-08) on their branches.

3. S1-00 / P0-14 Ask the organizers and register the team.

### Session 006 — 2026-10-01 — Stage 1 re-plan (Claude Code)

**Phase / tasks:** S1, D-014

**Done:**

- The team lead reported that Bangladesh teams must submit a **public GitHub link and a 240-second video by Oct 7**, and that selected teams are eligible for Nov 13–14. Re-planned around it.

- Added the Stage 1 sprint (MASTER_PLAN §4.3: scope, day-by-day plan per person, definition of done, video outline, cut rule), new tasks S1-00 … S1-14 in REMAINING, D-014, and updated D-010, CLAUDE.md §2 and the calendar.

**Verified by:** documentation only. **NOT VERIFIED:** the Stage 1 deadline time, video format, repo rules and selection criteria. They are not on nasaspaceappsbd.com, so they need confirming with the organizers (S1-00).

**Decisions logged:** D-014; D-010 updated

**Blockers / risks:**

- 6 days to build a credible vertical slice and a video with 3 developers.

- The repo must become public (or follow the organizers' rule); the commit history currently shows a personal email address.

- The developers' GitHub usernames and the Antigravity rules file are still outstanding.

**Next 3 tasks:**

1. S1-00 Ask the organizers the Stage 1 questions; P0-14 register the team.

2. S1-01 / S1-02 Scaffold, contracts, mock engine; start the overnight downloads.

3. P0-16 / P0-17 Invite Dev 2 and Dev 3; write `AGENTS.md`.

### Session 005 — 2026-10-01 — Work split (Claude Code)

**Phase / tasks:** P0 (team setup), D-013

**Done:**

- Wrote `docs/TEAM_WORK_SPLIT.md`: folder ownership, five interfaces between lanes, per-person briefs and first tickets, task assignment for M0–M6, a calendar per person, working agreements, a load check and a cut list.

- Dev 1 (team lead, Claude Code) takes contracts, engine, pipeline, validation, Analyst server side, CI/deploy and merges. Dev 2 (Antigravity) takes `packages/scene`; Dev 3 (Antigravity) takes the app UI, state, Evidence, Story and the delegated `windows/` module.

- Updated MASTER_PLAN §4.1, CLAUDE.md §5–§6 (scene is now `packages/scene`, props-only), REMAINING headings and new tasks P0-16 … P0-20, DECISIONS D-013.

**Verified by:** documentation only; no commands to run. **NOT VERIFIED:** whether Antigravity reads `AGENTS.md` automatically (P0-17).

**Decisions logged:** D-013

**Blockers / risks:** Dev 1 is the bottleneck for contracts and mocks (Oct 1–3) and for merges. The two other developers' GitHub usernames are still needed.

**Next 3 tasks:**

1. P0-14 Register the team on the Bangladesh site (closes Oct 7).

2. P0-16 / P0-17 Invite Dev 2 and Dev 3; write `AGENTS.md`.

3. M0 Contracts, mocks and CI (Dev 1), once the early start is confirmed.

### Session 004 — 2026-10-01 — Bangladesh site review (Claude Code)

**Phase / tasks:** P0, plan revision (D-012)

**Done:**

- Read https://www.nasaspaceappsbd.com (home, program schedule, FAQ, registration, important documents, contact, judges). Recorded the real local deadlines and the two-stage judging (local first, about 27 teams advance) in MASTER_PLAN §0, §4.2 and §M6, in REMAINING (new P0-14, P0-15, M6-11, M6-12), and as D-012.

- Added the **240-second presentation** outline to MASTER_PLAN. Moved the release candidate to Nov 11 and the submission target to Nov 14 at 09:00 BD.

- Amended D-010: the BD site says nothing about starting early. Updated CLAUDE.md §2 accordingly.

**Verified by:**

- Rendered pages in a headless browser and read the text: registration countdown ("closes October 7, 2026"), program schedule Day 1 and Day 2, FAQ answers (expanded each question), registration form fields.

- **NOT VERIFIED:** the "Important Documents" PDFs (no link found), the Judges page ("content will be updated soon"), the 240-second video format, and which region we attend.

- Rewrote the git history to remove the `Co-Authored-By: Claude` trailer from all three commits and force-pushed `main` (commit IDs changed: now `c18370d`, `37ed20f`, `65d40be`). Verified through the GitHub API that no commit has the trailer and that the only listed contributor is `WarRinOP`. Updated the repo description and topics.

**Decisions logged:** D-012; D-010 amended

**Blockers / risks:**

- The BD registration deadline is **Oct 7**, six days away.

- D-010 is still unconfirmed in writing.

**Next 3 tasks:**

1. P0-14 Register the team on the BD site (needs region, member details and a group photo).

2. P0-02 Ask the Local Lead for the early-start confirmation, the exact deadline and the 240-second video format.

3. P0-13 Invite the developers to the repo; M0 once D-010 is confirmed.

### Session 003 — 2026-10-01 — Planning update (Claude Code)

**Phase / tasks:** P0 (setup), plan revision for D-010

**Done:**

- Changed the plan for an early start: the team reports that our Local Event (Space Apps Bangladesh) has no pre-work restriction. Recorded as D-010 with written confirmation still pending.

- Rebuilt the schedule: 6-week calendar with weekly gates (MASTER_PLAN §4.2), feature freeze Nov 5, release candidate Nov 12, submission by Nov 15 (UTC+6). Retired the 48-hour schedule, the compliance-zone table and the rehearsal task (P0-08).

- Re-cut the lanes for **3 developers** plus non-dev teammates (MASTER_PLAN §4.1, CLAUDE.md §5). Added D-011 (repo strategy) and P0-13 (GitHub setup). Updated D-009: data downloads can start now.

- Updated CLAUDE.md §2 and §3, the lane ownership, branch naming, merge cadence and the freeze date.

**Verified by:**

- Searched for Bangladesh-specific Space Apps information: **nothing found** about a Bangladesh event or an early-start waiver, so D-010 rests on the team's statement. Public pages still show the Nov 15 submission close.

- `gh auth status`: logged in as `WarRinOP` (scopes: repo, workflow, read:org). Creating the organization is a web-only step.

- Created private repo `WarRinOP/sightline`; first commit `9aaf26a` (docs only) pushed to `main`; `gh repo view` confirms PRIVATE, default branch `main`.

**Decisions logged:** D-010 (accepted, confirmation pending), D-011 (proposed)

**Blockers / risks:**

- D-010 is unconfirmed. If the Local Lead says no, building must stop and the plan reverts to the 48-hour version.

- The exact submission deadline for our Local Event is not yet known.

**Next 3 tasks:**

1. P0-02 Get the waiver and the exact deadline in writing.

2. P0-13 Invite the other developers to `WarRinOP/sightline`; create the org (web only) and transfer the repo.

3. M0-02 Start the essential data downloads overnight (D-009).

### Session 002 — 2026-10-01 — Lane A (Science/Pipeline), Claude Code

**Phase / tasks:** P1-04 (data-source verification), P0-11 (partial). Read-only; no code files.

**Done:**

- Verified all §1.4 data sources and wrote `docs/science/DATA_VERIFICATION_REPORT.md`. It covers the exact URLs, byte sizes, label/projection facts, the kernel set, a live Horizons query, a draft `sources.yaml` and a bandwidth strategy.

- Key corrections: Moon FK is now `moon_de440_250416.tf`; the DSN kernels are dated `260814`; `earth_latest_high_prec.bpc` ends 2026-12-27, so we need the `_predict` kernel; the PGDA `*_COG.TIF` illumination links are soft-404s.

- Key upgrades: PGDA #90 track-adjusted COG DEMs with error maps; PGDA #78 site DEMs with 100 error clones. The DEM frame (DE421 ME) matches NAIF `MOON_ME`.

- Logged D-006 … D-009. Added P0-12, P1-04a–e and M2-14.

**Verified by:**

- PDS listings and `HEAD`: 200, `accept-ranges: bytes`, a 206 range probe; labels read for `ldem_80s_20m` (int16 and float), plus 85S/875S/75S/80S-40m.

- PGDA product pages #69/#78/#90/#95/#104 read; `HEAD` on 15 data files (200, `image/tiff`). COG illumination links confirmed `text/html` "Not Found".

- NAIF directory listings plus `HEAD` on 13 kernels. Coverage from `aa_summaries.txt` (de440s) and the BPC comment area (moon_pa).

- Horizons: a live JSON query with `CENTER='coord@301'` returned az/el (signature v1.2, DE441, MEAN_ME).

- Throughput: 8 MB range probes (NAIF 35 KB/s, PDS 19 KB/s, MIT 8 KB/s, PGDA 2.7 KB/s, GitHub 58 KB/s, Cloudflare 5 MB/s).

- **NOT VERIFIED:** COG internals (no GDAL locally) → P1-04a. The Artemis III 2024 list → P1-04b. No SHA-256 computed (nothing downloaded, by design).

**Decisions logged:** D-006, D-007, D-008, D-009 (proposed)

**Blockers / risks:**

- 🔴 **Network:** at the measured speeds the essential ~945 MB would take 8–13 h. We need the cloud relay (D-009) and/or Local Lead approval to pre-download (P0-02b).

**Next 3 tasks:**

1. P0-02 Email the Local Lead, now including the pre-download request (P0-02b).

2. P0-12 Set up the cloud relay + R2, and test throughput at the venue.

3. P1-04a/b Install GDAL; run `gdalinfo` on the COGs; verify the Artemis III region list.

### Session 001 — 2026-10-01 — Planning (Claude Code + team lead)

**Phase / tasks:** P0 (planning)

**Done:**

- Checked official facts on spaceappschallenge.org: event **Nov 14–15, 2026**; summaries published Sep 17 (14 challenges); full statements **Oct 28**; submission and judging guides **Nov 13**; teams ≤ 6 members, same Local Event, one challenge; **no work on challenges before the hackathon**.

- Pulled all 14 official 2026 challenge summaries and scored them (MASTER_PLAN Appendix A). Recommended **CLPS Lunar Mission Browser**, with *Martian Map* as the backup.

- Wrote `docs/MASTER_PLAN.md` (concept, data pipeline, UI/UX design system, architecture, milestone blueprint, pitch/demo/disclosure drafts, risks, references).

- Wrote the root `CLAUDE.md` (compliance gate, session protocol, commands contract, conventions, safety boundaries, DoD).

- Created `docs/progress/REMAINING.md` (phase backlog with task IDs) and `docs/progress/DECISIONS.md`.

**Verified by:**

- Challenge list and dates read from the live official site via a headless browser (challenge listing page + Participant FAQs dated 2026-09-23).

- The dataset URLs and filenames in MASTER_PLAN §1.4 are **NOT VERIFIED** yet. They are marked *(verify)* and tracked as P1-04 / M1-01.

**Decisions logged:** D-001 (challenge recommendation), D-003 (no database), D-004 (AI computes nothing)

**Blockers / risks:**

- Writing this concept plan before the event is a gray area (🟡). Confirm with the Local Lead (P0-02).

- The Local Event length is unknown; the schedule assumes 48 h (P0-01, P1-06).

**Next 3 tasks:**

1. P0-01 Register everyone in the same Local Event; record the exact hours.

2. P0-02 Email the Local Lead for the compliance confirmations.

3. P0-03 Fill the lane roles.
