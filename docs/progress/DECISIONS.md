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

### D-005 · _superseded by D-010_ · Local Lead compliance confirmations (P0-02)

_Record the Local Lead's written answers on: (a) pre-event concept docs, (b) pre-downloading raw public data, (c) generic templates._
