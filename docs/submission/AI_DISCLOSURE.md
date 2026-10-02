# AI Disclosure — SIGHTLINE

NASA Space Apps Challenge 2026, Bangladesh. Challenge: CLPS Lunar Mission Browser.

This file records every use of AI in this project, as it happens (CLAUDE.md §2.5). Entries are
added by whoever used the tool. It covers AI used to build the project and AI that runs inside the
product.

**Principle (D-004):** AI never computes science results. Every number the product shows comes
from the deterministic engine or from a cited source. Where data is synthetic, it carries
`simulated: true` and the interface shows a SIMULATED badge.

---

## AI used to build the project

| Date | Tool | Who | Task | What it produced | How it was checked |
|---|---|---|---|---|---|
| 2026-10-02 | Claude Code (Anthropic), model `claude-sonnet-5-5` | Dev 1 (team lead), supervising | S1-01 | The monorepo scaffold and root tooling; the zod contracts in `packages/contracts`; the synthetic mock engine and mock tiles in `packages/engine`; the Next.js app shell with design tokens; the scene stub; the Python pipeline CLI skeleton; the GitHub Actions workflow; the unit tests; the progress documents | `pnpm verify` and the pipeline checks run locally and reviewed by Dev 1; results recorded in `docs/progress/PROGRESS.md` (session 010) and in the S1-01 pull request |
| 2026-10-02 | Claude Code (Anthropic), model `claude-sonnet-5-5` | Dev 1 (team lead), supervising | S1-02 | The `sightline fetch` downloader and the `sources.yaml` registry in `pipeline/`, with its tests; it also ran the download of the 8 NAIF SPICE kernels | Unit tests with a mocked network; a real download whose size, content type and NAIF-published MD5 were checked, then re-checked with system `md5` and `shasum`; results in `docs/progress/PROGRESS.md` (session 011) |
| 2026-10-02 | Claude Code (Anthropic), model `claude-sonnet-5-5` | Dev 1 (team lead), supervising | S1-02 (DEM part) | `sources.yaml` entries for two PGDA DEMs and their download; a read-only check of three site coordinates against the DEM files (the check found they do not match, so none were used) | Sizes and content types by `HEAD`; hashes by `shasum`; rasters opened and sampled with `rasterio` in a scratch environment; results in `docs/progress/PROGRESS.md` (session 012) and D-019 |

Earlier Claude Code sessions (2026-10-01) wrote planning and documentation only: the master plan,
the work split, the data-source verification report and the contributor rules. No application code.

**Dev 2 and Dev 3 use Antigravity.** Their sessions are recorded in their own logs
(`docs/progress/logs/DEV2_LOG.md`, `docs/progress/logs/DEV3_LOG.md`, "AI tool used" field) and
should be copied into the table above before each submission. No entries existed at the time of
writing.

### What the AI-written science code does and does not claim (S1-01)

- The S1-01 engine is a **mock**. Its terrain is two analytic bowls and its Sun and Earth follow
  circular orbits. **It is not a model of the Moon and none of its numbers are results.** It exists
  so the scene and the interface can be built before the real engine and data arrive.
- Constants taken from the project's physics table (CLAUDE.md §9): the synodic month, the 1.54°
  lunar axial tilt, the 0.2666° solar angular radius and the ±6.7° libration in latitude. The two
  orbital periods for the circular orbits (365.25 d for the sub-solar latitude, 27.32 d for Earth's
  libration) are nominal and used only by the mock. They are not drawn from the master plan or a
  cited source, and the real engine will read them from NASA/NAIF SPICE data.
- Every mock output is stamped `simulated: true` with provenance source `SYNTHETIC_MOCK_ENGINE`,
  and the schemas reject a synthetic source that claims to be real. The three preset sites carry
  nominal placeholder coordinates, not surveyed positions.
- Nothing from the mock may appear in the final demo as real. The interface labels it SIMULATED.

## AI inside the product

None yet. The optional Mission Analyst (M5-04) is not built. When it is, this section will list
the model, what it may do (call registered engine tools only, with every numeric claim checked
against tool output), its limits, and the kill switch.
