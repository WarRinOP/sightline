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
| Live URL | — |
| Repo | https://github.com/WarRinOP/sightline (private; move to an org later, D-011) |

### Milestone progress

| Phase / Milestone | Status | % |
|---|---|---|
| S1 Stage 1 sprint (Oct 1–7) | In progress | 5% |
| P0 Setup | Folded into S1 | — |
| P1 Lock-in | In progress (P1-04 data verification done early; follow-ups P1-04a–e open) | 15% |
| M0 Kickoff & Contracts | Not started | 0% |
| M1 Data Pipeline | Not started | 0% |
| M2 Engine | Not started | 0% |
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
