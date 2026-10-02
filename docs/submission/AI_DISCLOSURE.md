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
| 2026-10-02 | Claude Code (Anthropic), model `claude-sonnet-5-5`, with the SPICE toolkit (`spiceypy`) | Dev 1 (team lead), supervising | S1-03 | The pipeline steps `sites`, `ephem` and `golden`; the engine's time, frames, ephemeris reader, sky geometry and real engine client; their unit and parity tests; `docs/science/METHODS.md`. It also found, by testing, that two of its own assertions were wrong and corrected them | Parity of every output with SPICE (Sun and Earth direction within 3e-5°, time within 1 µs, DSN elevation within 0.19°), regeneration tests that rebuild the committed data, `pnpm verify` and the pipeline checks; results in `docs/progress/PROGRESS.md` (session 013) and D-020 |
| 2026-10-02 | Claude Code (Anthropic), model `claude-sonnet-5-5`, querying the JPL Horizons web service | Dev 1 (team lead), supervising | S1-04 | The `sightline horizons` command (query, parser, cache, checks), its tests, the engine-versus-Horizons test and residuals file, the residuals schema, and the documentation. It found and corrected two bugs of its own: a separation formula that could not report angles below 8.5e-7 degrees, and a wrong first explanation of the Earth gap | Horizons' own echo of the site, Moon shape and orientation is checked on every request; 300 residuals against a tolerance written before any residual existed; two negative controls; results in `docs/progress/PROGRESS.md` (session 014), D-021 and `docs/science/METHODS.md` §5.1 |

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

### Real positions from S1-03 (2026-10-02)

The Sun and Earth positions in the engine now come from NASA/NAIF SPICE kernels, sampled by a
pipeline step, not from a model written by the AI. The AI wrote the code that samples, stores and
interpolates them, and its output is compared with SPICE's own answers (`docs/science/METHODS.md`
§5). The terrain horizon is not built, so no illumination or communication percentage exists yet;
the mock engine still answers those questions and is labelled SIMULATED.

**How the NAIF SPICE kernels are used (S1-03).** The pipeline loads eight kernels, each checked
against a pinned SHA-256 first: `naif0012.tls` (leap seconds), `de440s.bsp` (planets), 
`moon_pa_de440_200625.bpc`, `pck00011.tpc` and `moon_de440_250416.tf` (the Moon's orientation and
the `MOON_ME` frame), `earth_2026_260806_2126_predict.bpc` and `earth_topo_260814.tf` (Earth
orientation and station frames), and `earthstns_itrf93_260814.bsp` (DSN station positions). The
SPICE routines `spkezr` (states with light time and stellar aberration), `str2et`, `et2utc` and
`pckcov` build the ephemeris and the time tests. `spkcpo` and `spkcpt` produce the independent
reference values the engine is compared with. The AI chose which routines to call and wrote the
glue code; it did not write or alter any of the kernels or SPICE's own algorithms. The files the
pipeline produces (`ephemeris_2026_3600s.bin`, `leapseconds.json`, `sites.json`,
`fixtures/golden/*.json`) can be regenerated with `sightline ephem`, `sites` and `golden`, and the
tests rebuild them and compare.

### JPL Horizons as an independent check (S1-04, 2026-10-02)

The engine's Sun and Earth directions are compared with the answers of NASA/JPL's Horizons service,
which is a separate implementation (its own ephemeris version and lunar orientation model). The AI
wrote the code that asks, parses and compares; the numbers it compares come from Horizons and from
SPICE. The comparison file (`fixtures/golden/horizons_residuals.json`) is rebuilt by a command and
the tests fail if the committed copy differs from what the engine produces.

## AI inside the product

None yet. The optional Mission Analyst (M5-04) is not built. When it is, this section will list
the model, what it may do (call registered engine tools only, with every numeric claim checked
against tool output), its limits, and the kill switch.
