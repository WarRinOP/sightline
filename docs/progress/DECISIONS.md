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

### D-010 · 2026-10-01 · Accepted (written confirmation pending)

**Context:** The global Participant FAQ (2026-09-23) says teams may not begin working on challenges before the hackathon (Nov 14–15). The team reports that our Local Event (Space Apps Bangladesh) no longer has that restriction.

**Decision:** Start building now, with a 6-week calendar (MASTER_PLAN §4.2). The submission deadline stays at the close of the hackathon (Nov 15, Bangladesh UTC+6), because nothing we found says it moved.

**Consequences:** The 48-hour schedule, the compliance-zone table and the rehearsal task are retired. **Open item P0-02:** obtain written confirmation from the Local Lead or organizers and paste it here (date, sender, text). If confirmation is refused, stop and re-plan. Also confirm the exact submission deadline for our Local Event.

---

### D-011 · 2026-10-01 · Proposed

**Context:** 3 developers plus non-dev teammates need one shared codebase and a simple flow for 6 weeks. GitHub Free organizations only get branch protection and rulesets on **public** repos (check Settings → Branches to confirm for our account).

**Decision:** One monorepo `sightline` under a free GitHub Organization (for example `sightline-spaceapps`), Apache-2.0, **private** until about Nov 10 then public before submission. All three developers get Write; the owner is Admin. Pull request per task, CI required via convention until the repo is public (or protection is enabled if a Pro/Education plan is available). CODEOWNERS for `packages/` and `pipeline/` (science correctness). Secrets live only in Vercel and GitHub Actions secrets.

**Consequences:** Repo creation is task P0-13. Organization creation is a web-only step. Branch protection is enforced by convention while private on the Free plan.

---

### D-005 · _superseded by D-010_ · Local Lead compliance confirmations (P0-02)

_Record the Local Lead's written answers on: (a) pre-event concept docs, (b) pre-downloading raw public data, (c) generic templates._
