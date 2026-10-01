# AGENTS.md — rules for every AI agent working in this repository

This file applies to **Antigravity** (used by Dev 2 and Dev 3) and any other agent except Claude Code, which reads `CLAUDE.md`. Humans: read it too. These rules are strict. If a task conflicts with a rule, stop and ask the team lead (Dev 1, GitHub `WarRinOP`).

A rules file inside your own folder adds to this one (`packages/scene/AGENTS.md`, `apps/web/AGENTS.md`, `packages/engine/src/windows/AGENTS.md`). The more specific file wins if they conflict.

---

## 1. The project in 60 seconds

SIGHTLINE is a web app that shows, for any spot near the Moon's south pole, **when it gets sunlight and when it can talk to Earth**. It is our entry to NASA Space Apps Challenge 2026, Bangladesh (challenge: CLPS Lunar Mission Browser).

- **Stage 1 deadline: Oct 7, 2026.** We must submit a **public GitHub link and a 240-second video**. We aim to submit on the **night of Oct 6**. **Code freeze: Oct 6, noon.** Only selected teams continue to Nov 13–14.

- Read: `docs/WHAT_WE_ARE_BUILDING.md` (plain language) → `docs/MASTER_PLAN.md` §4.3 (Stage 1 sprint) → `docs/TEAM_WORK_SPLIT.md` (who owns what, interfaces).

- Colours have fixed meanings everywhere: **gold = sunlight**, **cyan = Earth/signal**, **mint = both**, **indigo = darkness**, **purple badge = SIMULATED**.

---

## 2. Who owns what

| Path | Owner |
|---|---|
| `packages/contracts/`, `packages/engine/` (except `src/windows/`), `pipeline/`, `fixtures/`, `docs/science/`, `apps/web/app/api/`, `apps/web/workers/`, `.github/`, root config files, `pnpm-lock.yaml` | **Dev 1** (team lead, Claude Code) |
| `packages/scene/` | **Dev 2** (Aktaruzzaman) |
| `apps/web/` (except `app/api/` and `workers/`) and `packages/engine/src/windows/` | **Dev 3** (Fuad Hasan) |
| `docs/submission/`, story copy | Non-dev teammates |
| `docs/progress/PROGRESS.md`, `REMAINING.md`, `DECISIONS.md` | **Dev 1 only** (you use your own log, see §5) |

**Never edit a file you do not own.** Not even "a small fix". Write the problem in your log, open a GitHub issue, and tell the team lead. `packages/contracts` is **frozen**: use its types as they are; ask for changes with an issue labelled `contract-change`.

---

## 3. Start of every session

1. **Your first line of the session must be:** `Rules loaded: AGENTS.md (root) + <your folder>/AGENTS.md` and then list the other files you read. (This lets the team lead check that the rules were actually loaded.)

2. Read, in this order: your folder's `AGENTS.md` and `README.md`, your log in `docs/progress/logs/`, and the tasks assigned to you in `docs/progress/REMAINING.md` (read only).

3. Say in one line which task ID(s) you will work on (for example `S1-06`). Work on one task at a time.

4. `git fetch` and merge `origin/main` into your branch before you start, so you build on the latest work.

---

## 4. Hard rules

1. **Stay in your folder** (see §2).

2. **Never invent anything external.** No made-up packages, URLs, dataset file names, product IDs, API endpoints or parameters. If you are not sure it exists, stop and ask. Only install packages from this list (and only with the team lead's approval for anything not yet in `package.json`): `next react react-dom three @react-three/fiber @react-three/drei @react-three/postprocessing zustand zod comlink uplot @visx/* @radix-ui/* tailwindcss lucide-react tone vitest @playwright/test fast-check eslint prettier typescript`. **Do not edit `package.json` at the repo root or `pnpm-lock.yaml`.**

3. **Never fabricate a number.** Every number the user sees comes from the engine (`EngineClient`) or a cited source. If you use made-up data, it must come from the mock engine and show the **SIMULATED** badge. Never write science numbers (angles, percentages, durations) by hand into the UI.

4. **Never claim a feature that does not exist.** README text, UI copy and demo captures must show what is real and label what is simulated. This is Stage 1: honesty is how we get selected.

5. **No secrets and no data.** Never commit `.env*` files, API keys, tokens, anything under `data/`, or files larger than 5 MB.

6. **No NASA logos, meatball or worm.** Text credit only. No people's photos or voices without approval.

7. **No AI attribution in git.** Do **not** add `Co-Authored-By`, "Generated with" or any AI-tool credit to commit messages or pull requests. (AI use is still recorded, in your log, see §5.)

8. **No destructive git.** No `git push --force`, no `git reset --hard` on shared branches, no deleting other people's branches, no rewriting history.

9. **Accessibility and motion.** Keyboard-reachable controls, visible focus, respect `prefers-reduced-motion`, and never show meaning by colour alone.

10. **When unsure, stop and ask.** A question costs minutes; a wrong guess can cost the whole submission.

---

## 5. Logging — how we keep records (mandatory)

We keep written records so the team always knows what is done and what is next.

**At the end of every session** (even a short one):

1. Open your log: **Dev 2** → `docs/progress/logs/DEV2_LOG.md`, **Dev 3** → `docs/progress/logs/DEV3_LOG.md`.

2. Add a new entry **at the top** using the template at the top of that file: date, task IDs, what you did, files changed, **how you verified it (the exact commands you ran and what they printed)**, the AI tool and model you used, decisions you propose, blockers, and your next three tasks.

3. If something was not verified, write `NOT VERIFIED` and why. Never write "done" without evidence.

4. **Commit the log update in the same pull request as the work.**

You do **not** edit `PROGRESS.md`, `REMAINING.md` or `DECISIONS.md`. The team lead reads your log and updates those files. Put proposed decisions under "Proposed decisions" in your log entry.

---

## 6. Git workflow — your push is always reviewed

- **You cannot push to `main`.** Not directly, not "just this once". Every change goes through a **pull request that the team lead reviews and merges**. Do not merge your own pull request.

- **Your home branch:** Dev 2 → `dev2/integration`, Dev 3 → `dev3/integration`. Work there, or on a short branch named `dev2/<task-id>-<slug>` or `dev3/<task-id>-<slug>`.

- **When a task is done:** push your branch and open a pull request **into `main`**. Use the pull-request template completely: task ID, what changed, **how it was verified**, and a **screenshot or short clip for anything visual**.

- **After the team lead merges:** `git fetch`, then merge `origin/main` into your branch, and carry on. Never use `reset --hard` or `--force`.

- **Commit messages:** short and in this style: `feat(scene): add terrain from mock tiles` / `fix(ui): keyboard focus on scrubber` / `docs(log): dev2 session 003`. No trailers.

- **Size:** one task per pull request, small enough to review in about 15 minutes.

- **The team lead merges twice a day** (around midday and in the evening). If you are blocked, label the pull request `blocker`.

- Direct pushes to `main` by anyone but the team lead make an automatic check fail and alert the team lead.

---

## 7. Definition of done (every task)

- [ ] The task's acceptance criteria are met and **you ran the verification** (commands and output in the pull request).

- [ ] Once the scaffold exists (team lead, day 1): `pnpm verify` passes. Until then, run the commands in your folder's `README.md` and say so in the pull request.

- [ ] Nothing outside your folder was edited.

- [ ] Mock data is labelled **SIMULATED**; no invented numbers.

- [ ] Keyboard, focus and reduced-motion are handled.

- [ ] Your log is updated in the same pull request.

---

## 8. Questions and blockers

Write the question in your log, open a GitHub issue (label `question` or `blocker`), and message the team lead. Do not work around a blocker by editing someone else's files.
