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
| 2026-10-02 | Antigravity (Google; "Gemini Pro 3.1" as written in Dev 2's log) | Dev 2 (Aktaruzzaman) | S1-06, S1-07, M3-03 to M3-10 (scene) | The 3D scene code in `packages/scene` (terrain quadtree, shading, shadows, overlays, sky, site pin, Hero camera, Fisheye preview). **Not merged:** under review in PR #13; the review found invented science (overlay proxies, a made-up horizon ring) and geometry errors, so the code is being reworked | `pnpm typecheck` run by Dev 2; the team lead's review on 2026-10-02 ran lint, typecheck and tests on the branch and read the code (D-029, D-030, PROGRESS session 022) |
| 2026-10-03 | Claude Code (Anthropic), model `claude-sonnet-5-5` | Dev 1 (team lead), supervising | S1-06, S1-06b, S1-09, S1-10 | Fixes on top of Dev 2's scene (SIMULATED badge, no-Sun lighting, tested tile cache and mesh); the web Lab's 3D view wiring, the timeline barcode, the Fisheye zoom, the Evidence page; tests and the records D-031, D-032 | `pnpm verify`; seven deliberate mutations against the scene tests; real-browser runs of the Lab (real tiles) and the Evidence page; results in `docs/progress/PROGRESS.md` (sessions 023 and 024) |

Earlier Claude Code sessions (2026-10-01) wrote planning and documentation only: the master plan,
the work split, the data-source verification report and the contributor rules. No application code.

**Dev 2 and Dev 3 use Antigravity.** Their sessions are recorded in their own logs
(`docs/progress/logs/DEV2_LOG.md`, `docs/progress/logs/DEV3_LOG.md`, "AI tool used" field) and
should be copied into the table above before each submission. Dev 2's entry above was copied by
Dev 1 from the log; Dev 3 had no entries at the time of writing.

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

### The engine in the browser (S1-03a, 2026-10-02)

The AI wrote the worker that runs the engine off the main thread and the page that shows the Sun
and Earth directions for the three preset sites. The numbers on the page are the engine's output
(the same code the SPICE and Horizons comparisons test); the AI chose the layout and the wording
of the labels, and a test checks that the worker returns exactly what the engine returns.

### The terrain horizon (S1-05, 2026-10-02)

The AI wrote the ray-marching code that turns NASA LOLA elevation data (the 5 m Site04 tile and the
80 m south-polar map) into a horizon mask for one site, the engine code that reads it, and the
tests. The elevation numbers are NASA's; the AI wrote none of them. The mask is a command's output
(`sightline horizon`) and the tests rebuild it and compare. The AI also made two physics mistakes
in its first tests and one wrong claim in a code comment about interpolation; tests exposed them
and they are recorded in `docs/progress/DECISIONS.md` (D-023). The result has not been validated
against published illumination maps.

### Terrain horizons for all sites, the crest, and the timeline (S1-05a, S1-05c, S1-05d, 2026-10-02)

The AI extended the horizon code to the other two sites, wrote the rule that finds the Shackleton
crest (the team lead asked for it), replaced a mast-height grid with an exact formulation after its
own tests showed an interpolation error, and wrote the timeline code and its tests. It also
regenerated the reference files with their commands and made a documentation mistake (it deleted two
sections of `METHODS.md` in an earlier edit) that it found and repaired. The elevation data and the
JPL Horizons answers are NASA's and JPL's. None of the results has been validated against published
illumination maps.

### The illumination benchmark (S1-05e, 2026-10-02)

The AI read the published paper (Barker et al. 2021, NTRS) and the PDS map documentation, found that
the "published percentages" a brief expected were not in the repository's report and that the
paper's Table 2 is narrower than described, wrote the benchmark code, fixed its pass criteria before
running it, transcribed Table 2 by hand (with consistency checks), and reported the results
including a finding that the headline "lit" figures were a different quantity from the published
"illumination". The paper's numbers are the authors'; the map is NASA's. The benchmark supports the
method, not a validation at the three sites, and the documents say so.

### README and video script (S1-11, S1-12, 2026-10-02)

The AI drafted the README and the 240-second video script from the repository's own results, at the
team lead's request. It kept the team lead's structure but replaced wording the results do not
support (for example "sub-milliarcsecond" for Earth, "validation" for a consistency check, and a
"100-kilometre shadows" claim with no source); the changes are listed in D-026. The script is a
draft for the team to edit and record; the voice-over and the screen captures are made by people.

### Terrain tile pyramid and loader (M1-04, 2026-10-02)

The AI wrote the tile builder (`pipeline/sightline_pipeline/tiles.py`), the TypeScript loader
(`packages/engine/src/real/lolaTiles.ts`) and their tests at the team lead's direction. Before
starting it checked the brief against the rasters and reported that the first layout (4 levels)
could not serve the sources; the team lead chose another. It found, by tests, that the 5 m DEMs
overlap and disagree by up to 10.7 m (its first build let the last file win) and that the coarsest
tiles do not fit 16 bits at 0.1 m; both are in D-027. It ran deliberate mutations against its own
tests. The elevation data are NASA's (LOLA, PGDA). The tiles are a derived format, not a new
measurement.

### 3D view graphics (S1-15 to S1-20, 2026-10-03)

The AI (Claude Code) rewrote parts of the 3D scene in `packages/scene` at the team lead's request:
the Sun and Earth drawing, the terrain shader (shading, soft shadows, curvature), the shadow height
field, the camera moves and the pin labels, with their tests. It checked library behaviour in the
three.js and React Three Fiber sources before relying on it, kept the scene to what the engine
returns, and checked each change in a browser against the production build. It introduced a bug of
its own (normals in the wrong row order), found it with a temporary debug view and added a test that
catches it. The light and shadows are a visualisation and are labelled visual only; no number shown
on the page comes from them. Details and limits: D-033.

## AI inside the product

None yet. The optional Mission Analyst (M5-04) is not built. When it is, this section will list
the model, what it may do (call registered engine tools only, with every numeric claim checked
against tool output), its limits, and the kill switch.
