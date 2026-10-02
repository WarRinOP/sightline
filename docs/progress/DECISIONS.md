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

---

### D-009 · 2026-10-01 · Proposed (needs a team account decision)

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

**Update 2026-10-02 (PGDA benchmark):** the team lead measured PGDA live at about 130 KB/s with HTTP 206 supported (versus 2.7 KB/s on Oct 1). A separate probe from this session agrees: 4 MiB range reads returned 206 at 140 KB/s (`Site04_final_adj_5mpp_surf.tif`) and 102 KB/s (`LDEM_80S_80MPP_ADJ.TIF`). `HEAD` on 2026-10-02 gave exact sizes: Site04 40,980,806 B, Site01 40,980,810 B, Site11 40,980,806 B, `LDEM_80S_80MPP_ADJ.TIF` 189,158,392 B, all `image/tiff` with `Accept-Ranges: bytes`. Expected times: Site04 about 5 min, the 80 m LDEM about 22 to 31 min. **The cloud relay of D-009 is not required for Stage 1.** Single samples; re-measure if a download stalls. PDS and MIT speeds are still unmeasured (they carry only validation and fallback data).

---

### D-005 · _superseded by D-010_ · Local Lead compliance confirmations (P0-02)

_Record the Local Lead's written answers on: (a) pre-event concept docs, (b) pre-downloading raw public data, (c) generic templates._
