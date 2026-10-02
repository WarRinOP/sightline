# DECISIONS — Architecture & Project Decision Log

Format: **D-### · date · status** (Proposed / Accepted / Superseded by D-###) → Context → Decision → Consequences. Add evidence links for anything involving external endpoints or dependencies (`CLAUDE.md` §7).

---

### D-001 · 2026-10-01 · Proposed (final lock at P1-02 after Oct 28)

**Context:** 14 official 2026 challenges. The goal is a top global award, with judging on impact, science, creativity, technical depth and storytelling.

**Decision:** Target **CLPS Lunar Mission Browser**, with **Best Use of Science** as the primary award and **Best Use of Technology** as the secondary. The backup is *Interplanetary Survival Guide: Martian Map*.

**Consequences:** The engine is designed to be body-agnostic so most of it ports to Mars. Re-check scope against the full statement on Oct 28.

---

### D-002 · _pending_ · Final challenge lock

_To be written after P1-01 / P1-02._

---

### D-003 · 2026-10-01 · Accepted

**Context:** All science data is static and versioned. Runtime queries are geometric computations over cached arrays.

**Decision:** No database. Use static binary tiles and tables on R2 + a JSON manifest; compute in Web Workers.

**Consequences:** Simpler ops, global CDN caching, and nothing to run during judging. Data changes require a new immutable version path.

---

### D-004 · 2026-10-01 · Accepted

**Context:** Judges value rigor. LLMs can produce plausible but wrong numbers.

**Decision:** The LLM layer explains and orchestrates only. It calls deterministic engine tools, and every numeric claim is grounding-checked. There is no ML in the science path.

**Consequences:** The AI disclosure is simple and strong, and the Analyst is optional (kill switch).

---

### D-006 · 2026-10-01 · Accepted

**Context:** Verification (docs/science/DATA_VERIFICATION_REPORT.md) found newer, track-adjusted LOLA south-polar DEMs as COGs on PGDA (#90, Barker et al. 2023), plus 5 m site DEMs (#78, Barker et al. 2021). Both are in the same frame as the PDS 2017 GDR products.

**Decision:** Terrain tiers are: N = PGDA #78 5 m site DEMs; M = `LDEM_80S_80MPP_ADJ`; M+ = COG windows of `LDEM_80S_20MPP_ADJ`; F = `LDEM_60S_240MPP_ADJ`. PDS GDR JP2 (lossless) is the fallback.

**Consequences:** One consistent product lineage. The essential bundle is ≈ 945 MB, versus 2.7 GB+ for a full 20 m download. Click-anywhere pins outside the #78 sites run at 20–80 m and must display effective resolution.

---

### D-007 · 2026-10-01 · Accepted

**Context:** PGDA #78 publishes 100 DEM error clones per site, plus `_toterr` height-σ maps (except Site23).

**Decision:** The DEM-uncertainty bands use **PGDA clones** (N = 16 for hero sites, run overnight) instead of our own synthetic perturbations. Sites without clones show "uncertainty unavailable".

**Consequences:** The uncertainty method is NASA-authored and citable. Supersedes MASTER_PLAN §3.2 "spatially correlated noise".

---

### D-008 · 2026-10-01 · Accepted

**Context:** DE442 (2025) exists, but no matching `moon_pa_de442` PCK is published. The DEM frame is DE421 ME, and NAIF's `moon_de440_250416.tf` defines `MOON_ME` = `MOON_ME_DE440_ME421` (≤ 3.07e-7 rad from DE421 ME, 2000–2040).

**Decision:** Kernel set = `naif0012.tls`, `de440s.bsp`, `moon_pa_de440_200625.bpc`, `moon_de440_250416.tf`, `pck00011.tpc`, `earth_2026_260806_2126_predict.bpc`, `earth_topo_260814.tf`, `earthstns_itrf93_260814.bsp` (62.0 MiB). Body-fixed frame = `MOON_ME`. `MOON_PA` and `IAU_MOON` are forbidden for terrain geometry.

**Consequences:** Ephemeris and orientation are self-consistent. Pin exact filenames + SHA-256 and mirror them, because NAIF re-dates the Earth/DSN kernels.

**Update 2026-10-02:** `earth_2026_260806_2126_predict.bpc` covers ITRF93 from 2026-01-01T00:00:00 UTC to 2126-11-03 (checked with `pckcov`); the first ephemeris sample is therefore one minute into 2026 (D-020).

---

### D-009 · 2026-10-01 · Proposed (needs a team account decision; the relay is not needed for Stage 1, see D-018)

**Context:** Measured ~3–35 KB/s from this network to US data origins, versus ~5 MB/s to Cloudflare.

**Decision:** On day 1 (now), start the essential downloads and mirror them to R2: from a US-region cloud VM or CI runner if available, otherwise from a laptop overnight with resumable range downloads. Laptops then pull from R2. (With D-010 no approval is needed to pre-download.)

**Consequences:** We need an R2 bucket (and a cloud VM if we use one) in week 1 (P0-12). The fetcher must check Content-Type, size and SHA-256 (PGDA soft-404s return HTTP 200 HTML).

---

### D-010 · 2026-10-01 · Accepted by the team lead; NOT confirmed in writing; not stated on the Bangladesh site

**Context:** The global Participant FAQ (2026-09-23) says teams may not begin working on challenges before the hackathon (Nov 14–15). The team reports that our Local Event (Space Apps Bangladesh) no longer has that restriction.

**Decision:** Start building now, with a 6-week calendar (MASTER_PLAN §4.2). See D-012 for the real Bangladesh deadlines.

**Update 2026-10-01 (after reading nasaspaceappsbd.com):** the Bangladesh site says nothing about starting early either way, and the global FAQ rule still stands. The team lead's statement is the only source. Treat this as an open risk until the Local Lead confirms in writing.

**Update (later 2026-10-01):** the team lead reports that Stage 1 requires a public GitHub link by Oct 7 (see D-014). That means work before Nov 13 is expected, which strongly supports the early start. Still ask for the written confirmation.

**Consequences:** The 48-hour schedule, the compliance-zone table and the rehearsal task are retired. **Open item P0-02:** obtain written confirmation from the Local Lead or organizers and paste it here (date, sender, text). If confirmation is refused, stop and re-plan. Also confirm the exact submission deadline for our Local Event.

---

### D-011 · 2026-10-01 · Accepted (org transfer pending)

**Context:** 3 developers plus non-dev teammates need one shared codebase and a simple flow for 6 weeks. GitHub Free organizations only get branch protection and rulesets on **public** repos (check Settings → Branches to confirm for our account).

**Decision:** One monorepo `sightline` (now `WarRinOP/sightline`; an organization transfer is optional), Apache-2.0, **public since 2026-10-01** (see D-015). All three developers get Write; the owner is Admin. Pull request per task, CI required via convention until the repo is public (or protection is enabled if a Pro/Education plan is available). CODEOWNERS for `packages/` and `pipeline/` (science correctness). Secrets live only in Vercel and GitHub Actions secrets.

**Update 2026-10-01:** GitHub cannot create an organization through its API or `gh`, so the repo was created as private `WarRinOP/sightline` (https://github.com/WarRinOP/sightline) with Apache-2.0 and a docs-only first commit. Transfer it to an organization later (Settings → Danger Zone → Transfer; history, issues and settings are kept).

**Consequences:** Repo creation is task P0-13. Organization creation is a web-only step. Branch protection is enforced by convention while private on the Free plan.

---

### D-012 · 2026-10-01 · Accepted

**Context:** nasaspaceappsbd.com (read 2026-10-01) shows: team registration closes **Oct 7, 2026**; the Bangladesh program runs **Fri Nov 13 (07:00 BD) → Sat Nov 14**; a **240-second video** goes to the Local Lead's Google Drive on Nov 13 (18:30–19:00); the NASA project page and **30-second video** are finalised on Nov 14 (final upload 09:00–10:00); local judging ("240 Seconds of Glory") runs Nov 14, 11:00–13:30; awards that evening. In 2024 and 2025, 27 and 26 Bangladeshi teams advanced to global judging. The global FAQ separately says submissions close 11:59 PM local on Nov 15.

**Decision:** Plan against the Bangladesh times: release candidate Nov 11, submit by Nov 14 at 09:00 BD, 240-second video ready by Nov 13 at 18:00. Treat local judging as the first gate. Teams register on the BD site and on the NASA site in the same Local Event.

**Consequences:** The calendar and deliverables in MASTER_PLAN changed. New tasks P0-14, P0-15, M6-11, M6-12. The Local Lead should confirm the exact deadline and the 240-second video format.

---

### D-013 · 2026-10-01 · Accepted

**Context:** Only the team lead has Claude Code; the other two developers have Antigravity. The team lead should take the hardest, most sensitive work, and the three developers must not edit each other's files.

**Decision:** Dev 1 (Claude Code) owns contracts, engine, pipeline, validation, workers, Analyst server side, CI/deploy and merges. Dev 2 owns `packages/scene` (3D). Dev 3 owns the app UI, state, Evidence, Story and the delegated `windows/` module. Lanes meet only at five frozen seams (EngineClient, TileSource, Scene API, app state/story steps, Analyst stream). The scene moves from `apps/web/scene` to its own package `packages/scene` so folders do not overlap. Full detail: `docs/TEAM_WORK_SPLIT.md`.

**Consequences:** Dev 1 is the bottleneck for the first 3 days (contracts and mocks) and for merges; mitigated by the mock engine, a delegated module, fixed merge windows and a cut list. Antigravity does not read CLAUDE.md, so an `AGENTS.md` is needed (P0-17). Supersedes the old lane split in MASTER_PLAN §4.1.

---

### D-014 · 2026-10-01 · Accepted (details to confirm with the organizers)

**Context:** The team lead reports that Bangladesh teams must submit a **GitHub link and a 240-second video by Oct 7, 2026**, and that selected teams become eligible for the on-site program on Nov 13–14. This is not stated on nasaspaceappsbd.com (checked 2026-10-01), so the details (time, format, repo rules, criteria) need confirming.

**Decision:** Add a **Stage 1 sprint** (Oct 1–7) before the main build. Stage 1 delivers a thin, honest vertical slice, a public repo and a prototype-stage 240-second video, submitted by **Oct 6 night**. All later work (Oct 8 onwards) is conditional on selection. Real vs simulated is labelled everywhere.

**Consequences:** The calendar, REMAINING (new S1 tasks), the work split and the video plan changed. The repo goes **public** around Oct 6 (or as the organizers require), so commit emails, secrets and personal notes must be checked first. The Oct 28 challenge statement arrives after Stage 1, so the Stage 1 pitch is built on the challenge summary only.

---

### D-015 · 2026-10-01 · Accepted

**Context:** The two Antigravity developers must work in their own folders on their own branches, every push must be reviewed by Dev 1 before it reaches `main`, and their agents must keep the same written records as ours. GitHub branch protection returned HTTP 403 ("Upgrade to GitHub Pro or make this repository public") on the private repo.

**Decision:** (1) Dev 2 (Aktaruzzaman, `rimonxyg`) and Dev 3 (Fuad Hasan, `fuadhasandipro`) have Write access and push only to `dev2/…` and `dev3/…` branches, with home branches `dev2/integration` and `dev3/integration`. (2) Dev 1 merges every pull request with a merge commit (repo settings allow merge commits only). (3) Enforcement until branch protection is possible: `CODEOWNERS` (`* @WarRinOP`) and a workflow, `main-push-audit`, that fails and notifies when anyone but `WarRinOP` updates `main`. (4) Records: root `AGENTS.md` plus a dedicated `AGENTS.md` per folder; Dev 2 and Dev 3 keep their own append-only logs (`docs/progress/logs/DEV2_LOG.md`, `DEV3_LOG.md`) and never edit PROGRESS, REMAINING or DECISIONS, which Dev 1 updates from the logs.

**Update 2026-10-01 (later):** the team lead asked to make the repo public and to require pull requests. Done: the repo is **public** and `main` is protected (pull request required, 1 code-owner approval, stale approvals dismissed, conversations resolved, no force-push, no deletion, admin bypass for the owner). A pre-flight audit found no secrets in the files or history. Future commits on the team lead's machine use the GitHub no-reply email; the 7 earlier commits still show the team lead's personal email in their metadata (rewriting history now would break the developers' branches).

**Consequences:** Review is now enforced by GitHub, not only by process. No required status checks yet: add them when CI exists (M0). Anything committed from now on is public, including logs and PR text. Separate logs avoid merge conflicts in shared files.

---

### D-016 · 2026-10-02 · Accepted

**Context:** S1-01 builds the scaffold, the contracts and the SIMULATED mock engine. The brief allowed only the CLAUDE.md §7 package list, did not name every tool the stack needs, and left several details open.

**Decision:**

1. **Packages added beyond the allowed list** (CLAUDE.md §7.5; `npm view` on 2026-10-02 showed each exists with the MIT license): `typescript-eslint` 8.71.0 and `@eslint/js` 10.0.1 (ESLint cannot parse TypeScript without them), `@tailwindcss/postcss` 4.3.3 (the official Tailwind v4 PostCSS plugin; `tailwindcss` is on the list), `@types/react` and `@types/react-dom` 19.3.0, `@types/node` 24.19.1 (matches Node 24). All versions are pinned exactly.
2. **TypeScript 6.0.3, not 7.0.2.** `typescript-eslint` 8.71.0 declares `typescript >=4.8.4 <6.1.0`. **pnpm 10.34.6** is pinned in `packageManager` (CLAUDE.md asks for ≥ 9; 12.8.1 is the newest, but 10 is the line we know).
3. **Workspace packages ship TypeScript source** (`exports` point at `src/index.ts`; Next uses `transpilePackages`). No build step for packages.
4. **Contracts go beyond the brief where the later tasks need it.** Added: `earth_visible` (SunEarthState); profile fields `min_sun_disk_fraction`, `min_earth_elev_rad`, `dsn_min_elev_rad` (M4-04 lists them); `both_ratio` and `nights_over_battery` (timeline statistics); `WindowRequest`, `WindowSearchResponse`, `ProbeLitResult`; `TileData` (uint16 + offset, 1-sample border, as M1-04); helpers `siteLocation`, `isTileCoordInRange`, `tileGsdM`. Every response carries `simulated` and, for datasets, a `ProvenanceRecord`. The schemas enforce that a `SYNTHETIC*` source is simulated, that real data cites sources and a pipeline version, and that a non-simulated site has a `source_url`. `EngineClient` also exposes `provenance`, so the UI can show the badge from data.
5. **The three preset sites are placeholders.** No verified coordinates exist yet (P1-04b, M1-06), so the mock catalog uses nominal round coordinates near the pole, `simulated: true`, `source_url: null`, and a description saying so. They carry real feature names because the brief asked for them; the UI says the coordinates are placeholders.
6. **Mock physics:** constants from CLAUDE.md §9 (synodic month, 1.54° tilt, 0.2666° Sun radius, ±6.7° libration); the Sun and Earth periods for the circular orbits (365.25 d, 27.32 d) are nominal and mock-only. The mock treats DSN visibility as Earth visibility and ignores `dsn_min_elev_rad`. Terrain is two analytic bowls; the horizon is a flat-plane ray-march (no curvature). The mock `findWindows` is a placeholder (runs of sunlight weighted by link share) and lives in `mock/`, not in Dev 3's `windows/`.
7. **Stubs that say so.** `test:parity` and `test:e2e` print `NOT RUN` and exit 0, so a green `pnpm verify` is not read as "parity passed". `dev:mock` equals `dev` until real data exists. The Python CLI uses `argparse` (no runtime dependencies) and every subcommand exits 2. Fonts are CSS stacks, not `next/font/google` (needs network at build; self-hosted subsets come with S1-08).
8. **CI** runs lint, typecheck, test, test:parity and build for the web workspace, and ruff, mypy and pytest for the pipeline. Action versions checked with `gh api`: `actions/checkout` v7, `actions/setup-node` v7, `astral-sh/setup-uv` v10.2.0 (no floating `v10` tag exists, so it is pinned exactly).

**Consequences:** Dev 2 and Dev 3 can build against `EngineClient` and `TileSource` now. The contracts freeze on Oct 3 with these additions included. Dev 2 will need `three`, `@react-three/*` and `@types/three` (the last is not on the allowed list yet; needs its own entry). The mock is not a model of the real Moon: none of its numbers may appear in the final demo (SIMULATED badge, CLAUDE.md §7.9).

---

### D-017 · 2026-10-02 · Accepted

**Context:** Dev 2 builds the 3D scene in `packages/scene` with `three`, `@react-three/fiber` and `@react-three/drei`, which are on the allowed list. `three` ships no TypeScript types, so `strict` TypeScript needs `@types/three`, which is not on the list (CLAUDE.md §7.5).

**Decision:** Approve `@types/three` for `packages/scene`. Evidence (`npm view`, 2026-10-02): `@types/three` 0.186.0, license MIT; `three` 0.186.1, license MIT. The types package tracks the `three` minor version, so install the pair `three@0.186.x` with `@types/three@0.186.0`, exact-pinned. Dev 1 edits `package.json` and the lockfile (AGENTS.md §4); Dev 2 asks in an issue when ready (S1-01c).

**Consequences:** No dependency is installed by this entry. Dev 2 may not install it themselves. Any other package for the scene still needs its own entry.

---

### D-018 · 2026-10-02 · Accepted

**Context:** S1-02 builds `sightline fetch` and downloads the SPICE kernels. The brief named four kernels and a "verified checksum" source; DATA_VERIFICATION_REPORT has exact byte sizes but **no SHA-256 values** (it says they are filled on first fetch), and two kernel names in the brief do not match the verified set.

**Decision:**

1. **Kernel names follow D-008, not the brief.** `moon_pa_de440_200650.bpc` does not exist (HTTP 404, checked 2026-10-02); the file is `moon_pa_de440_200625.bpc`. `pck00010.tpc` exists, but D-008 chose `pck00011.tpc`. The `spice` group is the full 8-kernel set of D-008 (65,010,769 B, 62.0 MiB), not 4 files: the Earth predict PCK, the Moon FK, the DSN topocentric FK and the DSN station SPK are needed too.
2. **Checksums are trust on first use, plus one independent check.** The 8 SHA-256 values were computed on the first download and pinned in `pipeline/sources.yaml`; from then on every fetch verifies them. NAIF publishes an MD5 only for `de440s.bsp` (`aa_checksums.txt` in the same directory; no such file exists for the other kernel directories); the fetcher checks it, and `md5` from the system tool agreed. All 8 files also carry the expected SPICE ID word (`DAF/SPK`, `DAF/PCK`, `KPL/LSK`, ...). The other 7 files rest on size, Content-Type, file header and the pin, not on a publisher checksum.
3. **Content-Type is checked exactly as the server sends it**, recorded in `sources.yaml`: `.bsp` files come as `model/vnd.valve.source.compiled-map`, `.bpc` files send no header (`null`), text kernels `text/plain`. Anything else, including `text/html`, is rejected. If NAIF changes its server mapping, the fetch fails loudly and the value is updated here.
4. **Fetcher behaviour:** one dataset at a time, at most one request per second, `User-Agent: sightline-spaceapps/<version>`, `Range` resume from `<file>.part`, backoff on transport errors, 429 and 5xx, a file only appears at its final path after size, Content-Type, SHA-256 and MD5 pass. A corrupt cached file is deleted and fetched again. Files live at `data/raw/<dataset id>/<original file name>` (gitignored) with a `fetch_log.jsonl` of throughput. `--only` takes a dataset id or a group (`spice`) and may repeat; `--strict` fails while any selected dataset has no pinned hash.
5. **Dependencies:** `httpx` 0.28.1 (BSD-3), `pydantic` 2.13.5 (MIT), `pyyaml` 6.0.3 (MIT), all on the CLAUDE.md §7 Python list (versions checked with `pip index versions`). `types-PyYAML` is not on the list, so mypy ignores missing stubs for `yaml` only. Pipeline version is now 0.1.0.

**Consequences:** A kernel that NAIF silently replaces under the same name will fail the pin; that is intended (D-008: pin and mirror). Throughput measured on 2026-10-02 from the team lead's network: **62.0 MiB in 68.8 s, 945 KB/s average** (large files 0.35 to 1.9 MB/s), about 27 times the 35 KB/s measured on 2026-10-01, so the NAIF part of D-009's relay is probably unnecessary.

**Update 2026-10-02 (DEM downloads):** `sightline fetch --only dem` fetched `pgda78-site04-surf` (40,980,806 B) and `pgda90-ldem-80s-80m` (189,158,392 B): 230,139,198 B in about 12 min, 314 KB/s overall (Site04 305 KB/s, LDEM 316 KB/s); sizes and Content-Type matched, SHA-256 pinned from this download (PGDA lists no checksum that we found). `rasterio` (scratch environment only) opens both: Site04 is 3200 x 3200 float32, 5 m, no gaps, -2848 to +1805 m; the LDEM is a tiled 7600 x 7600 float32 COG, 80 m, overviews 2 to 16, bounds +/-304 km, no gaps, -7295 to +7026 m.

**Update 2026-10-02 (PGDA benchmark):** the team lead measured PGDA live at about 130 KB/s with HTTP 206 supported (versus 2.7 KB/s on Oct 1). A separate probe from this session agrees: 4 MiB range reads returned 206 at 140 KB/s (`Site04_final_adj_5mpp_surf.tif`) and 102 KB/s (`LDEM_80S_80MPP_ADJ.TIF`). `HEAD` on 2026-10-02 gave exact sizes: Site04 40,980,806 B, Site01 40,980,810 B, Site11 40,980,806 B, `LDEM_80S_80MPP_ADJ.TIF` 189,158,392 B, all `image/tiff` with `Accept-Ranges: bytes`. Expected times: Site04 about 5 min, the 80 m LDEM about 22 to 31 min. **The cloud relay of D-009 is not required for Stage 1.** Single samples; re-measure if a download stalls. PDS and MIT speeds are still unmeasured (they carry only validation and fallback data).

---

### D-019 · 2026-10-02 · Accepted (option A, confirmed by the team lead the same day)

**Context:** The team lead asked to tag the three preset sites as surveyed (Barker et al. 2021, Mazarico 2011), with these values: Shackleton Rim (Site04) -89.78° / 129.5° / ~1200 m; Connecting Ridge (Site01) -89.44° / 222.6° / ~800 m; de Gerlache Rim (Site11) -88.50° / 271.8° / ~1500 m. CLAUDE.md §7.2 and §7.10 say a mission fact needs a source that was actually checked, and nothing in the repo or in the sources read so far lists these values.

**Check (2026-10-02, read-only):** the georeference of each PGDA #78 site DEM (GeoTIFF header, read over HTTP for Site01, Site04 and Site11; full file for Site04) and the full `LDEM_80S_80MPP_ADJ.TIF`, sampled at the given points (south-polar stereographic, sphere R = 1737.4 km, longitude east-positive):

| Site | DEM tile centre (lat / lon) | Given point inside its 5 m tile? | Height at the point, 5 m DEM | Height at the point, 80 m LDEM | Given elevation |
|---|---|---|---|---|---|
| Site04 | -89.767° / 188.130° | yes | -2490.2 m | -2501.5 m | ~1200 m |
| Site01 | -89.463° / 222.510° | yes (near the centre) | 1958.3 m | 1957.4 m | ~800 m |
| Site11 | -88.683° / 292.068° | **no** (x = -45,465 m against a tile x range of -45,000 to -29,000 m; y = 1,429 m against 7,000 to 23,000 m) | not covered | -1093.5 m | ~1500 m |

The 5 m and 80 m products agree with each other where both cover the point (about 11 m apart at Site04, about 1 m at Site01), so the terrain values are trustworthy. The given elevations are not: none is within hundreds of metres of the DEM, and the given Site04 point is on the Shackleton floor side, not a rim at ~1200 m (the Site04 tile spans -2848 m to +1805 m). The Site11 point is outside the Site11 DEM altogether.

**Decision:** Not applied. The three catalog sites stay `simulated: true` with placeholder coordinates, and the engine stays labelled SIMULATED. No coordinate or elevation from the brief enters the catalog or the UI.

**Options (need your choice):**

- **A (verifiable now):** define each site's location as the centre of its PGDA #78 DEM tile (Site04 -89.767° / 188.130°, Site01 -89.463° / 222.510°, Site11 -88.683° / 292.068°) and take `elev_m` from the 5 m DEM at that point. Source: the PGDA data file, by dataset id from `sources.yaml`. This is a fact we can reproduce from the file, but it is a tile centre, not a landing or rim point; the catalog must say so.
- **B:** you point me to the page or paper table that lists the coordinates, I read it, and then the values go in with that source.

**Constraint on either option:** CLAUDE.md §7.1 forbids URL literals in code, and the `Site.source_url` contract is a URL. So the real catalog must be a data file generated by the pipeline (`sightline sites`, M1-06) from `sources.yaml`, not constants in TypeScript. Only then can the mock sites be replaced.

**Consequences:** S1-03 (real Sun and Earth) can start on option A or B. Until then it can compute from placeholder coordinates, labelled SIMULATED.

**Update 2026-10-02 (later): Shackleton Rim moved to its ridge crest, see D-024; the other two stay at their tile centres.**

**Update 2026-10-02:** option A adopted. `sightline sites` computes the tile centres from the files: Site04 (-89.766811°, 188.130102°E, 769.7 m), Site01 (-89.463163°, 222.510447°E, 1944.8 m), Site11 (-88.683418°, 292.067900°E, 1793.7 m); they agree with the centres in the table above and with the values the team lead confirmed. The heights are the 5 m DEM's at the centre, not the brief's.

---

### D-020 · 2026-10-02 · Accepted

**Context:** S1-03 makes the Sun and Earth real: a site catalog from the pipeline, and the engine's `time`, `frames` and `getSunEarth`. The browser cannot run SPICE, and the brief offered a table, a polynomial evaluator, or a worker.

**Decision:**

1. **Catalog from the pipeline.** `sightline sites` writes `packages/engine/src/data/sites.json` (D-019, option A) with `simulated: false` and the PGDA #78 product page as `source_url`. The URL comes from `sources.yaml` (`product_url`), so no URL is written in TypeScript (CLAUDE.md §7.1).
2. **Precomputed table, hourly, Hermite.** `sightline ephem` samples SPICE (`spkezr`, `MOON_ME`, LT+S, observer the Moon) for the Sun, the Earth and the DSN complexes DSS-14, DSS-43 and DSS-63 (as station minus Earth), with velocities, once per hour from 2026-01-01T00:01:00 to 2027-01-01T00:01:00 UTC: 8,761 records, 2,102,640 B, committed. The engine interpolates with cubic Hermite. This replaces "10-minute steps, 2026 to 2032" for Stage 1 only (it is S1-03b); the parity results show hourly Hermite is far inside the tolerance for Sun and Earth. A binary file, not JSON (JSON would be about 8 MB).
3. **Start one minute into 2026.** `pckcov` shows `earth_2026_260806_2126_predict.bpc` covers ITRF93 from 2026-01-01T00:00:00 UTC (to 2126-11-03). An apparent state looks back by the light time, so a sample at exactly 00:00:00 failed with "PCK data required ... not found". The pinned kernel stays; the first sample moved.
4. **J2000 to MOON_ME happens in SPICE at pipeline time**, using `moon_pa_de440_200625.bpc`, `pck00011.tpc` and the FK `moon_de440_250416.tf` (the frame definition needs all three). The engine's `frames/` holds the lunar-local geometry (ENU, az/el, geodetic). The engine's `time/` reads the leap-second table and TDB constants from `naif0012.tls`, written to `leapseconds.json`.
5. **LT+S at the Moon's centre, then subtract the site vector.** Checked against SPICE with the observer fixed on the site (`spkcpo`): worst gap 2.7e-5° (Earth). **Correction (S1-04):** the cause is stellar aberration along a different line of sight, not light time; see D-021 and METHODS §3. The gap stays far inside the target, so per-site LT+S is not needed.
6. **Contract change before the Oct 3 freeze:** `Location` gains an optional `elev_m` (0 when omitted), and `siteLocation` carries it. A 2 km rim height moves Earth's direction by about 3e-4°, three times the 1e-4° target. Backward compatible: existing payloads still parse.
7. **Terrain is not modelled, and the client says so.** `SightlineEngineClient` answers `listSites` and `getSunEarth`; `getHorizon`, `getTimeline`, `findWindows` and `probeLit` reject with `NotAvailableError` (task M2-05) rather than return flat-ground percentages as if they were illumination. The horizon in `getSunEarth` is flat ground at the site's height, dipped by `acos(R/(R+mast))`. The sky state's `simulated` flag is copied from the ephemeris header.
8. **DSN vertical.** A station's vertical is its geocentric direction (up to 0.19° from the geodetic one). The parity tolerance for DSN elevation (0.25°) was set before the first run from that figure; the measured worst gap is 0.189°, so the gap is the known effect. M2-07 can store geodetic verticals if a 10° mask makes it matter.
9. **Parity tolerances, fixed before the first run** (never loosened, CLAUDE.md §7.8): time 1 µs; Sun and Earth direction 1e-4°; disk fraction (2/π)·1e-4°/r_sun; DSN elevation 0.25°. Measured over 144 cases: Sun 2.1e-8°, Earth 2.7e-5°, disk 6.4e-9, DSN 0.189°; all 15 time cases pass, including leap seconds.
10. **Dependencies** (all on the CLAUDE.md §7 Python list; `pip index versions` and licenses checked 2026-10-02): `spiceypy` 8.2.0 (MIT), `rasterio` 1.5.2 (BSD-3), `numpy` 2.5.3 (BSD-3 and others). They ship no type stubs and stub packages are not on the list, so mypy ignores missing stubs for `spiceypy` and `rasterio`. `@types/node` 24.19.1 (already approved for `apps/web`) is added to `packages/engine` so tests can read files.
11. **CI** now fetches the 8 SPICE kernels (62 MiB, verified against the pinned hashes) so the kernel-dependent tests run; tests that need the DEMs skip in CI because PGDA is slow.

**Consequences:** `pnpm test:parity` is real (34 tests). The committed ephemeris, catalog and fixtures are reproducible: pipeline tests regenerate them and compare. A fresh clone needs no download to run the engine tests. The browser wiring is S1-03a; the web app still uses the mock engine. Horizons validation is S1-04. The mock engine stays, labelled SIMULATED, for terrain-dependent features until M2-05.

---

### D-021 · 2026-10-02 · Accepted

**Context:** S1-04 compares the engine with JPL Horizons at the 3 sites and 50 epochs, and produces a residuals file for the Evidence page (S1-10).

**Decision:**

1. **Query design** (verified against the API docs, 2026-10-02): `EPHEM_TYPE='OBSERVER'`, `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'` with `SITE_COORD='east longitude, latitude, altitude km'`, `COMMAND='10'` (Sun) and `'399'` (Earth), `QUANTITIES='4'`, `TLIST` in calendar form with `TLIST_TYPE='CAL'` and `TIME_TYPE='UT'`, `ANG_FORMAT='DEG'`, `EXTRA_PREC='YES'`, `CSV_FORMAT='YES'`. Calendar UTC strings avoid Julian-date rounding and time-scale doubt. The Horizons URL and its pinned `signature.version` (1.2) are in a new `apis` section of `sources.yaml`; a changed version is refused.
2. **Check what Horizons understood.** Its header echoes the site, the Moon's radii, the orientation and the refraction setting. The command fails unless they match: geodetic coordinates equal ours, radii 1737.4 on all three axes (so geodetic is planetocentric; its `Center cylindric` line, Dxy 7.07418 km and Dz -1738.16 km, equals (1737.4+0.77)·cos and sin of the latitude), orientation `MEAN_ME`, no refraction. The first full run exposed two bugs in my own checks (the altitude is printed as `.7697`, and the radii line has no word "sphere"), both fixed.
3. **Batches of 25 times.** 25 times (URL 1,324 characters) is answered; 50 (2,249) gets an HTTP 502 HTML page every time. So each site and body takes two requests: 12 in all, serial, at least 1 s apart, cached under `data/raw/horizons/`.
4. **Who writes what.** `sightline horizons` (Python) writes `fixtures/golden/horizons_reference.json`: Horizons' answers plus the SPICE route's values for the same cases. The engine is TypeScript, which Python cannot run, so the engine-versus-Horizons residuals are computed by `packages/engine/test/horizons.test.ts` and written to `fixtures/golden/horizons_residuals.json` by `pnpm --filter @sightline/engine run residuals`. Every normal test run then checks that the committed file equals what the engine produces now (to 1e-9°), so it cannot go stale or be edited by hand. This departs from "implement the comparison in the Python pipeline"; the reference (the expectation) is still generated only by a `sightline` command (CLAUDE.md §7.8), and the residual report is an output, not an expectation.
5. **Tolerance 0.02° on every case**, taken from DATA_VERIFICATION_REPORT §4.1 (written 2026-10-01, before any residual existed). Not changed. Two negative controls in the test (a 10-minute time shift, a 0.01° longitude error) must break it.
6. **A bug in my own statistics, found and fixed.** Separation by `acos(u·v)` cannot return less than 8.5377e-7° (`acos(1−2⁻⁵³)`); the same "maximum" appeared in three comparisons, and identically for Sun and Earth in Horizons-versus-SPICE, which is what gave it away. All figures now use `atan2(|u×v|, u·v)`. The S1-03 parity numbers were not affected (they compare azimuth and elevation separately).
7. **Cause of the Earth gap, measured** (SPICE with the observer on the site versus the engine's method, at exact sample times so interpolation is excluded): geometry alone (no correction) is exactly 0; with light time only, Earth 3.1e-6° and Sun 1e-12°; with light time and stellar aberration, Earth 2.7e-5° and Sun 2.3e-8°. So aberration is responsible (measured). Its size matches an aberration shift of about 1e-4 rad applied along the Moon-centre line of sight instead of the site's, times Earth's parallax of 0.26° (4.5e-3 rad), which would also explain why the Sun is unaffected; that mechanism is consistent with the numbers but was not tested separately. Applying S along the site's line of sight is task S1-04a, optional.
8. **Contract addition (additive):** `HorizonsResidualsSchema` and its parts in `packages/contracts/src/validation.ts`, so the Evidence page parses the file with the same schema the test uses.

9. **S1-04a dropped (team lead, 2026-10-02).** Applying stellar aberration along the site's line of sight would cut the Earth gap from 2.65e-5° (0.095 arcsecond) to about 1e-6°. The gap is already 755 times inside the 0.02° requirement, so the refinement is dropped to protect the Oct 6 delivery. If it is ever reopened, the cost is the observer's velocity in the ephemeris file (or an equivalent) and a regenerated golden set.

**Results (300 rows, degrees, engine minus Horizons):** Sun separation max 3.3e-8, mean 1.0e-8, rms 1.4e-8; Earth separation max 2.6e-5, mean 1.6e-5, rms 1.8e-5 (all in elevation: 2.6e-5; azimuth on the sky 5.9e-7). Largest gap 2.65e-5°, 755 times inside the tolerance. Horizons versus SPICE: Sun at most 1.0e-8, Earth at most 4.8e-7.

**Consequences:** The engine's Sun and Earth directions agree with an independent implementation to about 1e-5° or better at all three sites over 2026. The residuals file is the Evidence page's validation table. This validates directions, not illumination: the horizon is still flat ground (M2-05).

---

### D-022 · 2026-10-02 · Accepted

**Context:** S1-03a puts the real engine behind the app. The team lead asked for a Comlink worker bridge in `apps/web/workers/` and for the readout on `/` to show real Sun and Earth positions, with the SIMULATED badge kept for anything not computed. The readout and page are Dev 3's files (`apps/web/app`); Dev 3 has no commits yet.

**Decision:**

1. **Edits to Dev 3's files, at the team lead's direction.** `apps/web/app/page.tsx` and `live-readout.tsx` change on this branch (the only files outside `workers/` and `test/`). Dev 3 owns them from here on; the worker bridge stays Dev 1's.
2. **Shape of the bridge.** `workers/engineApi.ts` (pure, testable in Node) builds the engine from the ephemeris bytes on first use; `workers/engine.worker.ts` supplies the loader (the `.bin` is emitted as a static asset by the bundler from `packages/engine/src/data/`, so there is one copy) and calls `Comlink.expose` before any await so no message is lost while the file loads; `workers/engineBridge.ts` exports `connectEngine()`, which resolves to an ordinary `EngineClient` (with `provenance` read once, because a property cannot be read synchronously across a worker) plus the ephemeris span and `terminate()`. Dev 3 should import `connectEngine`, not construct workers.
3. **Dependencies.** `comlink` 4.4.2 (on the CLAUDE.md §7.4 list; `pnpm view comlink version license` gave 4.4.2, Apache-2.0) in `apps/web`; `vitest` 5.0.3, the version the other workspaces use, as a dev dependency of `apps/web` for the bridge test.
4. **Deviation from the brief: the terrain-dependent tiles show "—", not mock values.** The brief said to keep the SIMULATED badge for uncalculated fields. I first did that (mock engine at the same epoch and site) and the browser showed "Link to Earth: yes" while the real Earth was at −1.25°, below the horizon: two contradicting numbers in one view. Showing no number for "Sun disk visible" and "Link to Earth" is the honest form of "uncalculated" (CLAUDE.md §7.7), and the tile carries a neutral "Not computed yet" tag. The badge is data-driven (`provenance.simulated`), so a simulated engine still gets the purple one. To bring mock values back, import `createMockEngineClient` in `live-readout.tsx` and render its `sun_disk_fraction` and `dsn_visible` under a `simulated` `Tag`; the team lead may reverse this.
5. **The opening epoch is the viewer's current UTC time** when the ephemeris covers it (2026), else its first sample. Play steps 2 h per tick and wraps at the end of the file.

**Consequences:** The home page no longer shows a page-wide SIMULATED badge, because nothing on it is simulated; it says what is real, what is not shown and that the sites are tile centres, not landing points (D-019). The ephemeris is fetched by the browser (2.1 MB, cached by hash). The terrain methods still reject with `NotAvailableError`, which keeps its `name` across Comlink (tested). M2-05 replaces the "not computed" tiles with real values.

---

### D-023 · 2026-10-02 · Accepted

**Context:** S1-05 gives the engine a terrain horizon for one site so that "lit" and "Earth visible" are no longer flat-ground answers. The team lead's brief proposed raymarching over the Site04 DEM at 360 azimuths with `atan((z − z_obs)/r) − r/(2R)` and a `probeLit` returning `{is_lit, sun_elevation_rad, mask_elevation_rad}`.

**Decision:**

1. **Computed in the pipeline, loaded by the engine.** `sightline horizon` (Python, `horizon.py`) writes `horizon_shackleton-rim.json`; `packages/engine/src/horizon/` loads and evaluates it. The engine has no DEM tile loader yet (M2-04) and a 41 MB tile does not belong in a browser, so the brief's "precomputed mask" is followed. The Python ray-marcher is the only implementation; a TypeScript one with parity against it is still M2-05.
2. **1440 azimuths (0.25°), not 360.** The contract exports `HORIZON_AZIMUTH_SAMPLES = 1440` and MASTER_PLAN says 0.25°; the brief said "e.g. 360". Contracts are unchanged.
3. **Exact sphere geometry in place of the brief's `− r/(2R)` form.** They agree to O((r/R)³) (a test compares them on random terrain, 5e-5 rad). M2-05's acceptance asks for "exact curvature".
4. **Two DEMs, not one.** The 5 m tile only reaches about 8 km (11 km at the corners), so a mask from it alone ignores terrain beyond. The 80 m map (already downloaded, same CRS, checked) supplies everything the tile does not cover out to 300 km. Terrain beyond that or outside both rasters is unseen (METHODS §6).
5. **Mast height is a grid, interpolated.** The mask depends on mast height, so the file holds 13 heights from 0 to 20 m (the contract's maximum). My first comment said linear interpolation "errs towards shadow"; that was wrong (the angle is concave in height for ground above the eye) and was removed. The measured error is in METHODS §6: at most 2.2e-5° wherever the mask is below 3°, up to 0.31° where it is above 3°.
6. **`probeLit` keeps the contract's result** `{epoch_et, lit, sun_disk_fraction, simulated}` rather than the brief's `{is_lit, sun_elevation_rad, mask_elevation_rad}`: `packages/contracts` freezes tomorrow, and `lit` is "any part of the Sun's disk above the mask". `getSunEarth` uses the mask at the Sun's and Earth's azimuths for the disk fraction and `earth_visible` (and so `dsn_visible`), for the one site that has a mask; every other site keeps the flat horizon.
7. **`getHorizon` and `probeLit` refuse other places** with `NotAvailableError` (a location matches if it is within 2 m and 1 m of height of the mask's site); `getTimeline` and `findWindows` refuse everywhere until M2-08. Two existing engine tests that assumed Shackleton Rim has a flat horizon were pointed at Connecting Ridge, which has none.
8. **UI (Dev 3's `live-readout.tsx`, at the team lead's direction as in D-022):** the two tiles show real values, tagged "Real terrain · not yet validated", when `getHorizon` resolves for the chosen site, and "—" otherwise. The note says the tile centre is on a steep crater wall.
9. **A numerical bug of mine, found by a test:** the first `elevation_angle` subtracted two numbers near 1.7e6 m, which cost 1.7e-12 rad at small angles; rewritten as `(z − h) − (R+z)·2 sin²(a/2)`. Two of my first tests were also wrong about the physics (from a mast the highest ground is at the horizon distance `√(2Rh)`, not the farthest sample) and were corrected, not the code.

**Consequences:** the Shackleton Rim tile centre now has terrain-aware light and Earth visibility. Measured for 2026, hourly, 2 m mast: Sun above the mask 11.0% of the time (58.0% to 60.1% on flat ground), Earth 0% (45% on flat ground), because the tile centre sits on a roughly 32° wall. Not validated against published maps (M2-13). A better demo observer (the crest, or a rim point from the Artemis III region list) is a catalog decision for the team lead (D-019, option B). Connecting Ridge and de Gerlache Rim need only the same command on their tiles (S1-05a).

---

### D-024 · 2026-10-02 · Accepted

**Context:** After PR #7 the engine had a terrain horizon for the Shackleton Rim tile centre only, and that centre is on a steep crater wall (Sun lit 10.95% of 2026 and Earth never visible there; D-023). The team lead asked for horizons for all three sites, Shackleton Rim moved to the rim crest (S1-05c), and a real `getTimeline` using them.

**Decision:**

1. **Shackleton Rim is the crest, found by a rule.** The highest 5 m pixel of the Site04 tile that is more than 1 km from every tile edge: lat -89.780403°, lon 203.803049°E (-156.196951° as stored), 1739.1 m, 1.9 km from the old centre (769.7 m). The highest pixel of the whole tile (1805.1 m) is on the tile's edge, where a ridge leaves the tile and the horizon cannot be computed from 5 m data; with a 1 km and with a 2 km margin the same interior pixel wins, so it is a real local peak. Name: "Shackleton Rim crest"; id unchanged (`shackleton-rim`). Connecting Ridge and de Gerlache Rim stay at their tile centres, so the catalog now mixes two placements; each description says which. None is a landing point.
2. **Consequences for the fixtures** (all regenerated by their commands, none edited): `sightline sites`, `sightline golden` (sun_earth.json), `sightline horizons` (4 new Horizons requests for the new position; the echo check of site, Moon radii and orientation passed), `pnpm --filter @sightline/engine run residuals`. Residuals are unchanged at the maximum (Sun 3.3e-8°, Earth 2.65e-5°, from another site) and the parity tolerances were not touched; parity worst gaps: Sun 2.07e-8°, Earth 2.68e-5°, disk 6.9e-9, DSN 0.189°.
3. **Horizons for all three sites** (`sightline horizon` runs over `SITE_SPECS`; the 231 MB 80 m map is read once). Supersedes D-023 item 5: the 13-mast-height grid with linear interpolation is replaced by the **exact envelope** of lines `tan θ = A − h·B`, one family per azimuth (METHODS §6). Cause: measured, the interpolation error between stored heights was 0.1° to 0.7° in the Sun's band at Connecting Ridge and de Gerlache Rim (my earlier "negligible where the Sun can be" held only for the old Shackleton centre). The new files are 83 to 256 KB, schema_version 2.
4. **`getTimeline` is real** where a terrain horizon exists (the three sites) and refuses elsewhere; `findWindows` still refuses (M2-09, Dev 3). It lives in `SightlineEngineClient` (`packages/engine/src/real/sightlineEngine.ts`; there is no `engineClient.ts`), with `isLit`, `stepKind` and `summarizeSteps` moved out of the mock into `packages/engine/src/timeline/` so both engines share one definition. Provenance of a timeline is the ephemeris's plus the horizon's (data sources, kernels, DEM citation, versions joined).
5. **Contract change before the Oct 3 freeze (additive):** `TimelineStatistics` gains `longest_day_s` and `longest_day_start_et`, the mirror of `longest_night_*`. The brief named `illumination_ratio`, `earth_comm_ratio` and `longest_day_s`; the contract already has `illuminated_ratio`, `comms_ratio`, `both_ratio`, `longest_night_s`, `longest_night_start_et` and `nights_over_battery`, so only the day pair was missing and the existing names were kept. Dev 3 must read the two new fields (S1-09).
6. **"Lit" in the timeline is the profile's, not `probeLit`'s.** With the default profile the Sun's centre must be above the local horizontal (`min_sun_elev_rad = 0`) as well as part of the disk clearing the mask; `probeLit` says lit for any sliver. They agree step for step when `min_sun_elev_rad` is −90° (tested). The UI says what "lit" means.
7. **UI (Dev 3's files, at the team lead's direction, as D-022/D-023):** all three sites show real Sun disk and Link tiles and a "whole of the ephemeris, hourly" row from `getTimeline` (lit, link, both, longest night and day) for the default profile (2 m mast); the "—" state remains for a place with no mask.
8. **A mistake of mine, found while updating the docs:** my PR #7 edit of METHODS replaced a slice that ran to the §5.1 heading and deleted §4 (the site catalog) and the §5 intro (the parity table and seasonal checks). Restored from git (`066811f`) and updated: §4 now describes the crest, and the parity table's disk-fraction figure was re-measured (6.9e-9).

**Results** (2026, hourly, default profile; engine output, **not validated**; METHODS §6): Shackleton Rim crest: lit 48.9%, link 49.9%, both 25.2%, longest night 185.8 d, longest day 115.8 d. Connecting Ridge: 35.2%, 39.8%, 11.8%, 146.3 d, 23.8 d. de Gerlache Rim: 36.6%, 53.8%, 21.4%, 114.7 d, 25.6 d. Mask at the crest (mast 0): -2.4° to +1.0°, mean -1.2° (the tile centre it replaced: 0.09° to 32.7°, mean 13°).

**Consequences:** All three sites answer `getHorizon`, `probeLit`, `getSunEarth` and `getTimeline` with terrain. Dev 3's mission barcode (S1-09) can use `getTimeline`. The results remain unvalidated and could be well off the published ones (nothing was compared): the first check to make is the published LOLA illumination (P1-04c, M2-13). Mast sensitivity at Connecting Ridge is large (lit 24.8% at 0 m, 35.2% at 2 m) because the 5 m DEM's nearest pixels set the mask there.

---

### D-025 · 2026-10-02 · Accepted (criteria fixed before the first run; results and decision below)

**Context:** S1-05e asks whether the engine's illumination can be cited. The brief said `DATA_VERIFICATION_REPORT.md` §4.2 holds published percentages and that Barker et al. (2021) Table 2 reports "average illumination for 2024–2026 at 1 m and 5 m". Checked: §4.2 holds **no** percentages (it lists the AVGVISIB map files and a second-hand note about Barker). Barker Table 2 is real (read from the NTRS accepted manuscript, SHA-256 pinned as `ntrs-barker2021-pdf`) but it is narrower than described: it is for seven Regions of Interest (RoIs) at Site 1 that were *selected* for nominal average illumination above 70% at 1 m, and its values are the **1st percentile over 100 DEM error clones**, not nominal values at a point. It gives no values for Shackleton or de Gerlache, and none at our Connecting Ridge tile centre. The other product, the PDS AVGVISIB map (`pds-avgvisib-85s-60m`), is a long-term average whose span and observer height for the 2016 release are not stated in its label or readme (the 2011 paper's abstract says several 18.6-year cycles at 6 h for the original 240 m work). So the 48.9 / 35.2 / 36.6 % figures cannot be compared with a published number for the same place; what can be compared is the method (at Barker's RoI centroids) and the spatial pattern (against AVGVISIB).

**Method match with Barker (section 5 of the paper):** hourly steps; Sun's disk divided horizontally at the horizon elevation at the disk centre's azimuth (ours does the same); 5 m DEM near, 80 m DEM beyond (theirs 5 m below 5 km, 80 m to 100 km, 240 m beyond; ours 5 m to 12 km, 80 m to 300 km); MOON_ME of DE421 (ours DE440's `MOON_ME`, within 3e-7 rad). Differences: they use 720 rays 0.5° apart (ours 1440), a limb-darkened Sun at 550 nm (ours a uniform disk), and 100 error clones.

**Criteria, fixed before any benchmark was computed.**

*Benchmark A (quantitative).* The engine's method, run over 2024-01-01T00:00:00 UTC to 2026-01-01T00:00:00 UTC (hourly, end excluded) with the Sun from SPICE, at the seven RoI centroids of Table 2, at Δz = 1 m and 5 m above the nominal 5 m DEM height, giving the mean visible fraction of the Sun's disk (%). Pass if all three hold:

- A1 (floor): ours is at least the paper's A value minus 2.0 percentage points, at 1 m and at 5 m, for every RoI. (A is a 1st percentile over clones; the paper says the nominal DEM "tends to be better than the mean/median of the clones". The 2 points allow for the Sun model and ray count.)
- A2 (ceiling): ours is at most the paper's C value plus 5.0 points for every RoI, at 1 m and 5 m. (C is the best pixel of the RoI at every hourly step.)
- A3 (the RoIs' own definition): the median over the seven centroids of ours at 1 m is at least 70.0%. (The RoIs are the connected pixels with nominal average illumination above 70% at 1 m.)

Reported, not pass or fail: our longest continuous illumination and shadow periods against the paper's LCIP-1 and LCSP-99 (expected direction: ours at least the LCIP-1 and at most the LCSP-99).

*Benchmark B (spatial).* 300 random points in each of the three site tiles (more than 1 km from the tile edge), the engine's any-part-of-the-disk lit fraction over the same two years against the AVGVISIB value at the 60 m pixel containing the point. The map's orientation is fixed independently of illumination (its zero-valued pixels must sit on low ground in the 80 m DEM), not by maximizing the correlation. Pass: Spearman rank correlation at least 0.8 over all 900 points for our 2 m mast, and at least 0.7 in each tile. The map's observer height is unknown, so 0 m and 2 m are both reported and the better is not chosen after the fact: 2 m is the pass criterion.

*Decision rule.* Cleared for the README and video only if A1 to A3 and B pass; the claim allowed is then "agrees with the published method's results at Barker's RoIs and with the published map's pattern", never "validated at the sites". If anything fails, the cause is found, not the tolerance changed.

**Results** (`fixtures/golden/illumination_benchmark.json`, deterministic across two runs; full tables in METHODS §7).

- **A passes all three criteria.** Ours at Barker's seven centroids: 74.4 to 84.8 % at 1 m and 83.2 to 91.2 % at 5 m; the paper's A (1st percentile over clones): 67.4 to 71.2 % and 82.8 to 89.3 %. Ours is at least A in every case (by 6.9 to 13.7 points at 1 m, 0.4 to 2.6 at 5 m) and below C in every case; the median at 1 m is 79.6 %. The 28 comparisons of longest illumination and shadow runs are all in the expected direction. A uniform disk against an assumed limb darkening: at most 0.02 point.
- **B passes.** Orientation of the AVGVISIB map chosen from terrain (`identity`, margin 672 m over the runner-up of eight). Spearman 0.950 over 900 points at 2 m (0.974, 0.895, 0.979 per tile), 0.922 at 0 m.
- **The engine and the benchmark's Python path agree to the printed digit** on 2026 at the three sites (an engine test recomputes them).
- **Added after the first run, informational:** the sites against the map's own pixel; the far-field range (cutting at 100 km instead of 300 km moves the Barker averages by up to 3.59 points, from 150 km by at most 0.27); the epoch window (2026 alone against 2024 to 2026 moves our sites by 0.2, 2.0 and 0.3 points).
- **The finding that matters most:** the figures 48.9, 35.2 and 36.6 % are the lander profile's "lit", which also needs the Sun's centre above the local horizontal. They are not "illumination" as the published studies define it. The comparable 2026 figures at 2 m (mean visible fraction of the disk; any part of the disk): Shackleton crest 85.8 and 90.7 %, Connecting Ridge 45.6 and 51.0 %, de Gerlache 54.0 and 59.5 %.

**Decision (what may be cited).** Cleared, with this wording: the method "reproduces the published Barker et al. (2021) Site 1 results within ranges set beforehand, and our lit map correlates with NASA's AVGVISIB map (Spearman 0.95)"; the three sites' illumination as "average visible fraction of the Sun's disk, 2026, 2 m mast, computed with the method of Barker et al. (2021); not published for these exact points". Not cleared: "validated at the three sites"; the 48.9 / 35.2 / 36.6 % as "illumination"; any comparison with a published number for the same place; any Earth-visibility or link statement (no published reference was used; the AVGVISIB Earth map was not compared). The UI shows both quantities, labelled (Dev 3's `live-readout.tsx`, as in D-022 to D-024). P1-04c stays open for the 2016 AVGVISIB release's span and observer height.

**Corrections to the brief:** `DATA_VERIFICATION_REPORT.md` §4.2 has no published percentages (a note added there); Barker Table 2 is for selected regions and is a clone percentile, not a nominal value at a point; "Barker (2021) reports 2024 to 2026" is right for the dates and the heights (1 m and 5 m).

**Honest limits.** The test at Barker's regions checks the method where the paper reports it, one-sidedly (their values are pessimistic percentiles; the nominal DEM is better by their own account). It cannot show that our values are right to a point or two. The map comparison is rank-based and its observer height and span are unknown. Both inherit the same DEM (the 5 m site tile is the paper's), so neither tests the DEM itself. Nothing here tests Earth visibility or the 2026 ephemeris beyond the SPICE and Horizons checks of S1-03 and S1-04.

---

### D-026 · 2026-10-02 · Accepted

**Context:** S1-11 (README) and S1-12 (video script) were briefed by the team lead with some wording that the repository's own results do not support.

**Decision:**

1. **Parity wording.** The brief said "sub-milliarcsecond parity" with Horizons. True for the Sun (3.3e-8° = 0.12 milliarcsecond); not for Earth (2.65e-5° = 0.095 arcsecond = 95 milliarcseconds). The README and script give the numbers in degrees and arcseconds, with the limit (0.02°, 755 times larger) and the reason for Earth's gap.
2. **"Validation" wording.** Barker et al. (2021) is described as a check "consistent with their published values, by criteria fixed before the run" (D-025), never "validated". The AVGVISIB result is "rank correlation 0.95", with the caveat that the map's span and height are unknown. Nothing is "validated at the sites".
3. **The architecture diagram** shows what exists: Python pipeline (where the ray-marching happens) to committed data files to the TypeScript engine in a Web Worker to a Next.js page. The brief's "React/R3F UI" and "1440-bin raymarcher in the engine" are not what is built; the 3D scene is a stub and the raymarching is in the pipeline. The diagram marks the 3D scene, Evidence page and window finder as not built.
4. **SIMULATED badge.** The README states that the mock engine exists and must carry the badge, and that the current page shows no simulated data, so it has none. It does not claim every unbuilt feature "carries a SIMULATED badge": unbuilt features are listed as not built and uncomputed values are blank.
5. **Script facts.** "100-kilometre shadows" has no source here and is replaced by arithmetic (1 km of relief at 1.5° casts 38 km). "Crater wall drop-offs" are shown from the decision log (the old Shackleton tile centre, D-023), labelled as not in the app. "115-day day" is the lander-profile day (Sun's centre above the horizontal) and is said as such. The Link figures are left out of the narration because no published reference has been compared (S1-05h).
6. **Structure.** The script follows the team lead's split (problem 0:00 to 0:40, engine to 1:30, demo to 2:30, evidence to 3:30, roadmap to 4:00), which differs from MASTER_PLAN §4.3's. The narration is counted: 474 words, about 190 seconds at 2.5 words a second.
7. **Public statements kept from the old README:** the early start is unconfirmed (D-010); team registration is still open (P0-14); the Stage 1 date and format are as reported by the team lead and unconfirmed (S1-00). The team may change these once the facts do.
8. **Folders.** `docs/submission/` belongs to the non-developer teammates; `DEMO_SCRIPT.md` is written there at the team lead's direction and is theirs to edit.
9. **Side effect noticed:** `next dev` (Next.js 16.3) appends a block to `apps/web/AGENTS.md` (Dev 3's rules file) on every start. It was not committed. Dev 3 should not commit it; `agentRules: false` in `apps/web/next.config.ts` would stop it (Dev 3's folder, so left alone).

**Consequences:** The README and script can be read against the data files line by line. Numbers stay in sync because they are copied from generated files; if a result changes, the README table and the script's number table must be updated together.

---

### D-027 · 2026-10-02 · Accepted

**Context:** Dev 2 asked for a real `TileSource` (M1-04). The team lead chose layout A: one sparse pyramid, levels 0 to 11, 64-sample tiles with a 1-sample border, levels 0 to 7 from the 80 m map and 8 to 11 from the three 5 m DEMs, `TileDataSchema` unchanged, the full pyramid under `data/processed/tiles/` (gitignored) and a small subset committed. The brief's first version said "levels 0..3" and "level 0 to 2 site tiles"; I checked it against the rasters before starting and the team lead replaced it with layout A (a 64-sample tile at level 3 is 1.2 km per sample, coarser than the 80 m map).

**Decision:**

1. **Geometry.** `bounds_m` is ±304,000 m, the extent of `LDEM_80S_80MPP_ADJ` (7600 x 7600 at 80 m, square, centred on the pole, no NaN). Interior spacing is 608 km / 2^L / 62: 76.61 m at level 7, 4.788 m at level 11. These are not the sources' spacings (80 m, 5 m), so a tile sample is a bilinear interpolation, not a pixel. I considered bounds of ±317,440 m, which would make levels 7 and 11 exactly 80 m and 5 m (no resampling), but the 80 m map then covers only 96% of the root's width and the level 0 to 6 tiles would be partly empty; the contract has no nodata, so I kept the map's own extent. Cost: a sample can differ from the nearest source pixel by the local slope times the offset; the checks below compare with the interpolated raster, not with pixels.
2. **Levels.** 0 to 7 from the 80 m map everywhere (level 7 resampled, coarser levels the mean of 2 x 2 samples). 8 to 11 from the 5 m DEMs (level 11 resampled, coarser the 2 x 2 mean), only where the tile's whole 64 x 64 window, border included, lies between the DEM's pixel centres; tiles on a DEM's edge are dropped. At the map's outer edge the border samples (and the half pixel outside the outermost pixel centres) repeat the nearest value; the 5 m levels never extrapolate.
3. **Heights.** `offset_m` is the tile's lowest sample (as the mock does); `height_scale_m` in the manifest stays 0.1 m. **Finding:** relief in one tile exceeds the uint16 range at 0.1 m (6,553.5 m) at the coarsest levels, where a sample is a mean over up to 10 km (the 80 m map spans -7,296 to +7,026 m). 62 of the 1,365 tiles at levels 0 to 5 therefore carry a larger `scale_m` in their header (level 0: 0.21 m; at most 0.17 m at levels 1 to 3, 0.14 m at level 4, 0.12 m at level 5); levels 6 to 11 are all 0.1 m. `TileData.scale_m` is per tile in the contract, so no contract change; the relief is never clipped. A consumer must use the tile's `scale_m`, not the manifest's. The error bound is half the scale: 0.105 m at level 0, 0.05 m at levels 6 to 11.
4. **File format.** `data/processed/tiles/{level}/{x}/{y}.bin`: 32 bytes of little-endian header (`SLT1`, level u16, size u16, x u32, y u32, offset f64, scale f64) then 64 x 64 uint16, row-major, row 0 at the lowest y. 8,224 bytes a tile. **No brotli** (REMAINING M1-04 mentioned it): the browser needs a decompressor for it and the pyramid is 262 MB raw; revisit with M1-08 (R2 serves with `Content-Encoding`). Also written: `manifest.json` (a valid `TileManifest`, `simulated: false`, provenance listing the four dataset ids) and `coverage.json` (rectangles of tiles that exist; not a contract, because the contract's manifest cannot say what is missing).
5. **The 5 m DEMs overlap, and disagree.** Site04 and Site01 overlap by 6 km x 11 km (x -9 to -3 km, y -15 to -4 km); in the overlap the two rasters differ by up to 10.7 m (99th percentile 1.3 m, mean -0.02 m; measured). A tile that two DEMs could build comes from the DEM whose centre is nearer to the tile's centre, so every tile is one file, from one DEM. My first build wrote those tiles twice and the last silently won; the pipeline test that compared file listing with coverage found it. Tiles from different DEMs next to each other can disagree on their shared border samples by that much. Site11 overlaps neither.
6. **Engine loader.** `LolaTileSource` / `createLolaTileSource()` in `packages/engine/src/real/lolaTiles.ts`, exported from the engine index. It needs a host reader (`readTile(path)` returning the bytes of `<level>/<x>/<y>.bin`); the default is `fetch` from `baseUrl` (default `/tiles`), because the engine has no file access and a browser bundle cannot read `packages/engine/src/data`. `getTile` rejects outside the pyramid (`RangeError`) and for a missing tile (`TileNotAvailableError`); `hasTile(coord)` says which. `tileHeightRange(tile)` computes the min and max (not in the contract). The header must match the requested coordinate, the manifest's size and the magic, so a wrong file, a truncated download or an HTML error page fails loudly.
7. **Committed subset (832,657 bytes in `packages/engine/src/data/tiles/`):** all 85 tiles of levels 0 to 3, the tile under each catalog site at levels 7 to 11 (15), `manifest.json` and a `coverage.json` listing exactly those 100. The full pyramid has 31,873 tiles (262,123,552 bytes: levels 0 to 7 21,845 tiles, levels 8 to 11 86 + 412 + 1,840 + 7,690).
8. **Check data.** `sightline tiles` also writes `fixtures/golden/tiles_probe.json`: 500 interior samples of the committed tiles (5 per tile) with the raw raster's bilinear height at the same place (averaged over the sample's cell for coarse levels), computed by `reference_height_m`, which shares no code with the builder. Tolerance, fixed before the first run: half the tile's scale plus 0.002 m, and 0.1 m wherever the scale is 0.1 m.

**Results (all from commands run).** Probe error against the raw rasters: at most 0.0484 m (level 7), 0.0459 to 0.0497 m (levels 8 to 11), 0.0757 m (level 3, scale up to 0.16), 0.1026 m at level 0 (scale 0.21, bound 0.105). The unit tests fail under deliberate mutations (offset ignored, rows flipped, big-endian, scale doubled in the decoder; reversed owner rule, flipped rows, transposed tiles in the builder). Rebuilding gives byte-identical files.

**Consequences:** Dev 2 can build against real tiles now: `createLolaTileSource({ readTile })` with a reader over the committed subset, or the full pyramid served somewhere (Dev 3 / M1-08). Until the full pyramid is served, only levels 0 to 3 and the tiles under the three sites exist for the app. **Limits:** the pyramid is not validated beyond the raster comparison above (no horizon or shading was computed from it; M2-04 and M2-05 will); the exact error of coarse levels is quantisation plus averaging, not a statement about the Moon; levels 0 to 5 do not meet the 0.05 m round-trip figure in REMAINING (see M1-04a).

---

### D-005 · _superseded by D-010_ · Local Lead compliance confirmations (P0-02)

_Record the Local Lead's written answers on: (a) pre-event concept docs, (b) pre-downloading raw public data, (c) generic templates._
