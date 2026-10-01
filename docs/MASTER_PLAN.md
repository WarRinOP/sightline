# SIGHTLINE — Master Plan

> **Know when the Sun shines and Earth listens — anywhere on the lunar south pole.**

NASA International Space Apps Challenge 2026 (Bangladesh) · Theme: *The Next Frontier*

Challenge: **CLPS Lunar Mission Browser** (Advanced / Intermediate)

Primary award target: **Best Use of Science** · Secondary: **Best Use of Technology**

Plan version 1.1 · Written 2026-10-01, revised the same day for an early start (D-010) · Team: 3 developers + non-dev teammates

---

## 0. Ground Truth: Dates and Rules

Everything in this plan is built around these facts (verified from the official site on 2026-10-01).

| Date (2026) | Official milestone | What it means for us |
|---|---|---|
| Aug 26 | Registration opened | Register all members **in the same Local Event** (required for global judging) |
| Sep 17 | Challenge **summaries** published (14 challenges) | Shortlist done (see Appendix A) |
| **Oct 28** | Full **challenge statements** published (requirements, resources) | Re-validate this plan against the real statement within 24 h |
| Nov 2 | Space Apps Connect opens | Final team confirmation |
| Nov 13 | Project Submission Guide + Judging & Awards Guide published | Update Milestone 6 deliverables to match exactly |
| **Nov 14–15** | **Official hackathon dates.** Submit by your Local Event's end time | Our build starts earlier (D-010); these days are for final checks and submission |
| Dec 2026 | Nominees / Finalists / Honorable Mentions announced | |
| Jan 2027 | Global Winners announced | |

### Pre-work rule: waived for our team (D-010)

The global Participant FAQ (2026-09-23) says teams may not begin working on challenges before the hackathon. We were told that this restriction does not apply to our Local Event (Space Apps Bangladesh), so **we start building now.**

- **Status: reported, not yet confirmed in writing.** Action P0-02: get written confirmation from the Local Lead or organizers (email or screenshot) and file it under D-010. If it cannot be confirmed, stop and re-plan: the downside is disqualification.

- **What does not change:** the submission deadline is still the close of the hackathon on Nov 15 (use our Local Event's exact closing time; Bangladesh is UTC+6). Full challenge statements arrive Oct 28, and the Submission and Judging guides arrive Nov 13. Teams have at most 6 members, work on one challenge, and must all be registered in the same Local Event.

- **Consequence:** we have about 6 weeks to build instead of 48 hours, but only **3 developers**. The schedule in §4.2 is rebuilt around weekly gates. The challenge statement arrives only on Oct 28, so the engine and data pipeline (needed for both CLPS and the Mars backup) come first, and everything is reconciled with the real statement on Oct 28.

---

## Phase Overview

| Phase | Window (2026) | Goal | Exit criteria |
|---|---|---|---|
| **P0 — Setup** | Oct 1 → Oct 7 | GitHub org + repo + CI, 3 lanes assigned, written waiver, network/data relay | CI green on an empty skeleton; waiver filed; essential data bundle mirrored |
| **P1 — Lock-in checkpoint** | Oct 28 → Oct 30 | Read the full CLPS statement, gap analysis, final challenge decision | Gap analysis written; plan v1.2; D-002 recorded |
| **P2 — Build** | Oct 1 → Nov 5 (feature-complete) · Nov 5 → Nov 13 (hardening + deliverables) | Execute milestones M0–M6 on the weekly calendar in §4.2 | Release candidate deployed by Nov 12; deliverables ready |
| **P3 — Submit & judging** | Nov 13 → Jan 2027 | Read the Submission Guide (Nov 13); submit early; freeze; keep the demo alive | Submitted at least 2 h before the local deadline; tag `v1.0-submitted`; uptime monitored |

Detailed checklists are in [progress/REMAINING.md](progress/REMAINING.md). Session history is in [progress/PROGRESS.md](progress/PROGRESS.md).

---

# SECTION 1 — The Winning Concept & Value Proposition

## 1.1 Name & Tagline

**SIGHTLINE** — *Know when the Sun shines and Earth listens — anywhere on the lunar south pole.*

Alternative taglines for slides:

- "Every sunrise and every signal, at every site on the lunar south pole."

- "The Moon's south pole, seen the way a lander sees it."

## 1.2 Targeted Challenge & Award Strategy

**Challenge (official summary):** *"Create an intuitive tool or application that lets mission planners, educators, and the public compare landing sites and dates quickly, visualizing Sun and Earth positions relative to the horizon to assess power generation potential and direct-to-Earth communication windows."*

**Primary award: Best Use of Science.** Most teams on this challenge will build a 3D globe that shows sun angles. Sightline goes further: it computes **physically exact horizon masks from LOLA laser altimetry**, propagates **DE440 ephemerides through the correct lunar body frame**, and **validates against peer-reviewed illumination maps and JPL Horizons**. The validation evidence is published inside the app. That is the gap between a pretty demo and science that judges can trust.

**Secondary: Best Use of Technology.** Users can click **any point** on the south pole and get a full 360° horizon plus a multi-year power and comm timeline in about a second, in the browser, with no server. The terrain shading uses the **same horizon data** as the numbers, so the visuals are the science.

**How the concept scores on the five judging pillars:**

| Pillar | How Sightline wins it |
|---|---|
| Impact & Relevance | Artemis and CLPS landing-site and date selection is a live, high-stakes NASA problem. Power and comm geometry decide whether a lander survives. |
| Scientific Rigor | SPICE-grade geometry, lunar curvature, solar-disk fraction, Earth-shadow eclipses, DSN visibility, DEM uncertainty bands, and a published validation report |
| Creativity | The "Lander's-Eye" fisheye sky with the Earth libration loop; the "mission barcode"; sonified telemetry |
| Technical Depth | Multi-resolution horizon engine in a Web Worker; WebGPU/WebGL2 terrain with ray-marched shadows; parity tests between Python and TS; deterministic LLM tool layer |
| Storytelling & UI/UX | A 20-second cinematic hero, guided Story Mode built around real missions, and museum-grade HUD design |

## 1.3 Core Problem Statement

The lunar south pole is the target of Artemis III and several CLPS deliveries. It is also the hardest place on the Moon to land and operate:

- **The Sun never rises high.** The lunar spin axis is tilted only ~1.54° to the ecliptic, so the Sun skims the horizon (≤ ~1.5° plus the disk radius). A 10 m crater rim 2 km away can mean the difference between days of power and a dead battery.

- **Earth wobbles on the horizon.** Optical libration in latitude (±~6.7°) moves Earth up and down by about its own width many times over. Direct-to-Earth (DTE) radio contact appears and disappears on a ~monthly cycle that depends on the site.

- **Darkness duration is what kills landers.** It matters more than average illumination. A site that is 80% lit but has a single 100-hour night can be worse than a 60% site whose nights are short.

- **The tools exist but are hard to use.** Expert tools (SPICE, custom illumination codes, GIS stacks) take specialist training. The challenge itself states that the current interfaces make quick evaluation difficult.

**The gap:** no public tool lets a planner, teacher or student pick a site and date range and see, honestly and quickly, the power and comm windows at that site, with the evidence behind every number.

## 1.4 The NASA Open Data Pipeline

> ✅ **Update 2026-10-01:** the sources in this section were verified and partly superseded. See [science/DATA_VERIFICATION_REPORT.md](science/DATA_VERIFICATION_REPORT.md) for exact URLs, sizes, the corrected kernel names, the tiered DEM plan (D-006) and the network risk (D-009). Where it disagrees with the table below, the report wins.
>
> ⚠️ Every URL and filename below **must be verified** in M1 and recorded in `pipeline/sources.yaml` with an HTTP check and a SHA-256 hash. Items marked *(verify)* are expected names from prior knowledge. Do not hard-code them without checking. The Oct 28 challenge statement may list preferred resources; those take priority.

### Core datasets (required)

| # | Dataset | Provider / endpoint | Format | Use | Preprocessing |
|---|---|---|---|---|---|
| D1 | **LOLA polar gridded DEMs** (e.g. 80–90°S at 20 m/px; higher-res 5–10 m site DEMs) | PDS Geosciences Node — `pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/` *(verify)* | PDS3 `.IMG` + `.LBL` (polar stereographic, heights relative to a 1737.4 km sphere) | Terrain, horizon masks, slopes | Parse LBL (sample type, scaling, offset, projection) → reproject-free tiling in native polar stereographic → quantize (per-tile float32 offset + uint16 at 0.1 m) → multi-res pyramid with 256² tiles and a 1 px border |
| D2 | **High-resolution south-pole site DEMs** (Barker et al. 2021) | NASA GSFC **PGDA** — `pgda.gsfc.nasa.gov/products/` *(verify product ID)* | GeoTIFF / IMG | 5 m near-field terrain at candidate sites | Clip to 10 km around each site → level-max tiles |
| D3 | **SPICE kernels** | NAIF generic kernels — `naif.jpl.nasa.gov/pub/naif/generic_kernels/` | Binary SPK/PCK, text FK/LSK | Sun/Earth geometry | See kernel list below |
| D4 | **JPL Horizons API** | `ssd.jpl.nasa.gov/api/horizons.api` | JSON/text | **Independent validation** of topocentric Sun/Earth az/el from lunar surface sites (`CENTER='coord@301'`, `SITE_COORD`) | Scripted cross-check, stored as golden fixtures |
| D5 | **LOLA / PGDA average-illumination & PSR products** (Mazarico et al. 2011 lineage) | PDS LOLA GDR polar *(verify `AVGVISIB_*` names)* / PGDA | IMG / GeoTIFF | Validation of our illumination statistics; PSR overlay | Resample to our grid; compute residuals at sites and on a random sample |
| D6 | **Candidate site catalog** | NASA Artemis III region announcement (Oct 2024: Peak near Cabeus B, Haworth, Malapert Massif, Mons Mouton Plateau, Mons Mouton, Nobile Rim 1, Nobile Rim 2, de Gerlache Rim 2, Slater Plain) *(verify)*; CLPS mission pages and press kits for landing coordinates | HTML/PDF → hand-curated JSON | Preset sites | Each site entry carries a `source_url` and `retrieved_at`. **No coordinate without a source.** |

**SPICE kernel set (verify exact current filenames on NAIF):**

- `lsk/naif0012.tls` — leap seconds

- `spk/planets/de440s.bsp` (or `de440.bsp`) — planetary ephemeris

- `pck/moon_pa_de440_200625.bpc` — high-precision lunar orientation (PA frame)

- `fk/satellites/moon_de440_*.tf` — defines `MOON_PA` / `MOON_ME`. **LOLA DEMs use MOON_ME. Geometry must be expressed in MOON_ME, or terrain and Sun disagree by ~0.01–0.03°.**

- `pck/pck00011.tpc` — body radii

- `spk/stations/earthstns_itrf93_*.bsp`, `fk/stations/earth_topo_*.tf`, `pck/earth_latest_high_prec.bpc` — DSN station positions (for "DSN can see the Moon" windows)

### Enrichment datasets (should-have / stretch)

| # | Dataset | Endpoint | Use |
|---|---|---|---|
| E1 | LROC WAC/NAC south-pole mosaics; LROC PSR products | LROC data portal / PDS Imaging (`pds.lroc.asu.edu`) *(verify)* | Photoreal albedo drape; PSR outlines |
| E2 | Map-projected LROC NAC frames | PDS ODE REST API `oderest.rsl.wustl.edu/live2/` | **Shadow-Truth**: compare simulated shadows with real images at the same timestamp (IoU) |
| E3 | LRO Diviner polar temperature products | PDS Geosciences (Diviner) *(verify)* | Thermal / cold-trap context layer |
| E4 | NASA Moon Trek WMTS tiles | `trek.nasa.gov` *(verify polar endpoints)* | Fallback basemap if E1 ingestion slips |
| E5 | NASA GIBS true-color Earth imagery | `gibs.earthdata.nasa.gov` WMTS | Earth texture in the lunar sky for past dates (*"the Earth you would actually have seen"*) |

### Derived products (what we generate)

| Product | Format | Size budget | Consumer |
|---|---|---|---|
| Terrain tile pyramid | `tiles/{z}/{x}/{y}.bin` (uint16 + header), brotli | Lazy-loaded; ≤ 60 MB total for the demo region | Scene + horizon worker |
| Ephemeris tables | `ephem/{body}_{year}.bin`: Float32 xyz km in MOON_ME, 10-min step, 2026–2032 | ~4 MB total | Engine |
| Site horizon masks | Float32[1440] (0.25° azimuth) per site and per mast height | < 1 MB | Engine (fast path) |
| Statistic rasters (illum %, max-dark h, DTE %, slope) | 16-bit PNG tiles | ≤ 20 MB | Overlay layers |
| Golden fixtures | JSON | < 2 MB | Parity tests |
| Provenance manifest | `manifest.json` (dataset IDs, URLs, SHA-256, kernel versions, pipeline git SHA) | tiny | Evidence view |

## 1.5 The "Unfair Advantage"

1. **The visuals are the science.** One horizon engine feeds the terrain shadows, the fisheye sky, the timeline and the statistics. A judge who sees a shadow edge is seeing the same computation that produced "72% illuminated".

2. **Click anywhere → exact horizon in ~1 s, in the browser.** A **distance-adaptive multi-resolution ray-march** samples 5–20 m tiles nearby and coarser tiles further out, to ~200 km. It includes exact lunar curvature (true 3D vectors, not a flat-earth approximation). Any point works, not just preset sites.

3. **The full link budget geometry, not only "Earth above horizon".** DTE availability is Earth visible from the site **AND** at least one DSN complex (Goldstone / Madrid / Canberra) seeing the Moon above its elevation mask. Few tools do this.

4. **Physics edge cases handled.** Fractional solar disk (0.53°) behind ridges; Earth-shadow eclipses (lunar eclipses blackout even "eternal light" peaks); topocentric parallax of Earth (~0.26° at the pole); light-time and aberration corrections; ME vs PA frames.

5. **Evidence by default.** An in-app **Validation Report**: our Sun az/el vs JPL Horizons, our illumination vs published LOLA maps, our horizon vs an independent Python reference, plus DEM-uncertainty bands ("72% ± 3%").

6. **An honest AI layer.** The LLM "Mission Analyst" **cannot compute physics**. It calls deterministic engine tools. Every number in its answer is machine-checked against a tool result before display.

7. **Body-agnostic engine (hedge).** Radius, frame and ephemeris are parameters. If the Oct 28 statement changes the scope, ~70% of the system ports to the backup challenge *Interplanetary Survival Guide: Martian Map* (MOLA/HiRISE DTMs + Mars SPICE).

---

# SECTION 2 — UI/UX & Visual Experience Design

## 2.1 Design System: "Regolith & Sunline"

The look is a dark, quiet instrument panel where light means something. Gold always means **sunlight / power**. Cyan always means **Earth / signal**. Indigo always means **darkness**. Judges learn the code in seconds, and it never changes.

### Color tokens

| Token | Hex | Meaning / usage |
|---|---|---|
| `--void` | `#05070A` | App background (deep space) |
| `--surface-0` | `#0B0F14` | Base panels |
| `--surface-glass` | `rgba(16,22,30,0.62)` + `backdrop-filter: blur(18px) saturate(140%)` | HUD glass panels |
| `--hairline` | `rgba(232,236,241,0.10)` | 1 px panel borders, grid lines |
| `--text-1` | `#E8ECF1` | Primary text |
| `--text-2` | `#9AA4B2` | Secondary text, axis labels |
| `--text-3` | `#5E6875` | Disabled, tertiary |
| `--regolith` | `#8A8F98` | Terrain neutral, unlit UI |
| `--sun` | `#FFC857` | **Sunlight / power** (lit %, Sun icon, power windows) |
| `--sun-hot` | `#FFE3A3` | Sun highlight, glow core |
| `--earth` | `#4CC9F0` | **Earth / DTE comm** (Earth icon, link windows) |
| `--earth-deep` | `#1B6F9A` | Earth secondary, DSN tracks |
| `--both` | `#B8F2A0` | Sun **and** Earth simultaneously (the "golden windows") |
| `--dark` | `#4B3FC4` | **Darkness / PSR** |
| `--dark-deep` | `#1E1A4D` | Long nights, PSR fill |
| `--alert` | `#FF6B4A` | Constraint violation (night longer than battery) |
| `--ok` | `#3DDC97` | Constraint satisfied |
| `--sim` | `#C77DFF` | Badge for **SIMULATED / mock** data, which must never appear in the final demo |

Check every pairing for WCAG AA contrast (≥ 4.5:1 text, ≥ 3:1 graphics) and for color-vision deficiency. The `--sun`/`--earth`/`--dark` triplet is distinguishable under deuteranopia and protanopia. Never encode meaning in color alone: the Sun, Earth and night glyphs always accompany the color.

### Typography

| Role | Font | Size / weight | Notes |
|---|---|---|---|
| Story headlines | **Instrument Serif** | 48–72 px / 400 | Cinematic contrast against the technical UI |
| Display / view titles | **IBM Plex Sans Condensed** | 28–40 px / 600, tracking +2% | Aerospace HUD voice |
| UI body | **IBM Plex Sans** | 14–16 px / 400–500 | |
| Labels / HUD caps | IBM Plex Sans Condensed | 11–12 px / 600, UPPERCASE, tracking +8% | |
| Telemetry & numbers | **IBM Plex Mono** | 12–14 px, `font-variant-numeric: tabular-nums` | Every live number |

Type scale: 11 · 12 · 14 · 16 · 20 · 28 · 40 · 56 · 72. Load via `next/font/google` with self-hosted subsets.

### HUD design language

- **Glass panels** with a 1 px hairline, 12 px radius, and an inner top highlight (`inset 0 1px 0 rgba(255,255,255,.06)`).

- **Corner brackets** on focused panels (4 L-shaped 8 px strokes) instead of heavy borders.

- **Instrument readouts:** label (caps, `--text-2`) above value (mono, `--text-1`) with the unit in `--text-3`. Example: `SUN ELEV` / `+1.27°`.

- **Grid:** 8 px base. Panel gutters 16 px. Page margins 24 px (16 px on mobile).

- **Icons:** Lucide (stroke 1.5). Custom glyphs for Sun disk, Earth with phase, and mast.

### Micro-interactions and motion

| Interaction | Behavior | Duration / easing |
|---|---|---|
| Hover on readout | Value brightens; sparkline appears beneath | 120 ms ease-out |
| Panel open | Fade + 8 px rise; content stagger 30 ms | 240 ms `cubic-bezier(.2,.8,.2,1)` |
| Site select | Camera flies on a great-circle arc; horizon ring "draws" around the pin | 1100 ms ease-in-out |
| Time scrub | Shadows update every frame; the Sun/Earth glyphs on the sky dome leave 2 s trails | real time |
| Constraint violated | Barcode segment pulses `--alert` once; screen-reader announcement | 400 ms |
| Earth rises above horizon | Soft cyan ring pulse on the Earth glyph, plus a sonified carrier tone | 600 ms |

All motion respects `prefers-reduced-motion`: camera flights become cuts and pulses become static outlines.

## 2.2 Viewports & Spatial Experience

### View 1 — Hero ("Orbit") `/`

**The hook (first 20 seconds, no clicks needed):**

1. Black. A thin gold line appears on the limb: sunlight grazing the south pole.

2. The camera drifts in from 400 km. Time runs at one lunation per 20 s. Shadows hundreds of km long sweep around the pole like a clock hand. Shackleton's interior stays black. Its rim flickers in and out of light.

3. Earth bobs on the horizon, partly lit, with the correct phase.

4. Title fades in: **SIGHTLINE** · *Know when the Sun shines and Earth listens.*

5. Two CTAs: **Explore the Pole** (→ Lab) and **Take the 90-second Tour** (→ Story Mode).

**Rendering:** React Three Fiber terrain from the LOD tile pyramid (L0–L3 for orbit altitude). A real ephemeris drives the directional light. Ray-marched heightfield shadows. A starfield from the Yale Bright Star Catalog in J2000, rotated correctly. While WebGL warms up, show a **poster frame** (pre-rendered still) so first paint is under 1.5 s.

### View 2 — Site Lab (Simulation & Diagnostic Workspace) `/lab`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ SIGHTLINE   [Lab] [Evidence] [Story]          UTC 2028-03-14 06:00  ▶ ×1h/s │
├───────────────┬──────────────────────────────────────────────┬───────────────┤
│ SITES         │                                              │ LANDER'S EYE  │
│ ● Nobile R1   │           3D SOUTH-POLE TERRAIN              │  (fisheye     │
│ ● Shackleton  │   – live ray-marched shadows                 │   sky dome:   │
│   ridge       │   – site pins with horizon rings             │   horizon     │
│ ● Custom pin  │   – overlay: illum % / max-dark / DTE % /    │   silhouette, │
│ [+ click map] │     slope / PSR                              │   Sun path,   │
│               │                                              │   Earth loop) │
│ LANDER PROFILE│                                              ├───────────────┤
│ Mast  [2 m ▾] │                                              │ NOW @ SITE    │
│ Battery 50 h  │                                              │ SUN  +0.84°   │
│ Min DTE el 2° │                                              │ DISK 63% vis  │
│ DSN mask 10°  │                                              │ EARTH +3.10°  │
│ LAYERS ☐☑☐    │                                              │ DSN  Madrid ✓ │
├───────────────┴──────────────────────────────────────────────┴───────────────┤
│ TIMELINE  2026 ━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2032   │
│ Nobile R1  ▇▇▇▇▇░░▇▇▇▇▇▇▇▒▒▒▇▇▇▇░░░░░░▇▇▇▇▇▇▇  ← mission barcode per site      │
│ Shackleton ▇▇▇▇▇▇▇▇▇▇▇▇▒▒▇▇▇▇▇▇▇▇▇▇░▇▇▇▇▇▇▇▇▇                                 │
│ [window finder: ≥14 d sunlight, nights ≤ battery, DTE ≥ 50% → 7 windows ▸]   │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Controls:**

- **Time:** a scrubber (2026–2032) with zoom (year → lunation → day → hour). Play at ×1 min/s up to ×1 lunation/10 s. Jump buttons: next sunrise, next Earth-rise, next golden window, next eclipse.

- **Sites:** presets (Artemis III regions, CLPS sites), **click-anywhere custom pins**, and compare up to 4.

- **Lander profile:** mast or panel height (0–20 m: this slider is the "wow" moment), battery survival hours, minimum DTE elevation, DSN elevation mask, minimum solar-disk fraction for power.

- **Layers:** illumination %, max darkness duration, DTE %, slope (with ≤ 8° safe threshold), PSRs, LROC albedo drape, graticule, Earth-direction ray.

- **Window Finder:** constraint form → ranked list of landing windows with Pareto badges.

**Barcode legend:** gold = Sun only · cyan = Earth only · mint = both · indigo = neither. This is the signature visual and goes on the slides.

### View 3 — Evidence (Analytical & Data Transparency) `/evidence`

| Panel | Content |
|---|---|
| **Time series** | Sun elevation and visible-disk %, Earth elevation, DSN coverage, for the selected site and range (uPlot for 100k+ points) |
| **Distributions** | Histogram of darkness durations vs battery limit; illumination % by month |
| **Site comparison** | Table plus a radar chart: illum %, longest night, DTE %, golden-window hours, slope |
| **Validation Report** | (1) Our Sun/Earth az/el vs JPL Horizons at 200 random epochs × 9 sites (residual histogram, max error). (2) Our illumination % vs published LOLA maps (scatter + RMSE). (3) TS engine vs Python reference (parity). (4) Stretch: Shadow-Truth IoU vs LROC NAC frames. |
| **Uncertainty** | DEM error Monte Carlo (N = 32 perturbed horizons) → error bars on every statistic |
| **Provenance Inspector** | For every number: dataset ID, URL, SHA-256, retrieval date, SPICE kernel list, pipeline commit SHA, algorithm version. One click opens the method note. |
| **Exports** | CSV/JSON of windows, a one-page PDF "Site Brief", `.ics` calendar of comm windows, a permalink |

### View 4 — Story Mode (Impact walkthrough) `/story/[slug]`

A scroll-driven or auto-advancing narrative. Each step drives the real app state (camera, time, layers, sites), so the story is the product and not a slideshow.

**Chapter "Light & Signal" (the 90-second judge tour):**

1. **"The Sun never rises high here."** Camera at the pole; the Sun skims the horizon over one lunation. A readout shows max elevation ~1.5°.

2. **"A ridge 2 km away decides your fate."** Fly to a crater rim. The fisheye shows a ridge clipping the Sun. The barcode turns indigo.

3. **"Raise the mast."** The mast slider animates 2 m → 10 m. The longest night shrinks (numbers from the engine, not scripted). *This is the emotional peak of the demo.*

4. **"Earth is a moving target."** Earth's libration loop is drawn on the sky dome. DTE windows appear in cyan. DSN complexes hand off.

5. **"Pick the day."** The Window Finder runs live for a CLPS-class lander profile. The golden windows light up in mint.

6. **"Trust, but verify."** Cut to the Evidence view: Horizons residuals under 0.02°, and agreement with published maps.

7. **"Now you try."** Hand control to the user.

**Optional chapters (if time allows):** "Night of the Eclipse" (a 2028–2029 lunar eclipse blacks out a peak of near-eternal light); "Mission replay" (a real CLPS landing replayed with its actual Sun geometry. **Facts must be sourced in the provenance file.**)

## 2.3 Sound & Feedback (Data Sonification)

Use Tone.js, off by default, with a toggle in the HUD. The sound is a real **accessible data channel**, not decoration:

- **Sun drone:** pitch tracks Sun elevation; loudness tracks the visible-disk fraction; silence means darkness.

- **Earth carrier:** a soft sine "carrier" fades in when DTE is possible, with a short chirp at each DSN handoff.

- **Night rumble:** a low filtered noise whose depth grows with the hours since sunset, so users "hear" the battery draining.

- **Haptics:** `navigator.vibrate` pulses on mobile at sunrise and Earth-rise during playback.

---

# SECTION 3 — Full-Stack Systems Architecture

## 3.1 Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Monorepo | **pnpm workspaces** + Turborepo | Parallel lanes, cached builds |
| Web | **Next.js (latest stable at scaffold time), App Router**, React, **TypeScript strict** | Static-first pages + one API route for the LLM proxy; Vercel-native |
| Styling | **Tailwind CSS** + CSS variables (tokens above) + Radix primitives | Fast, accessible, consistent |
| 3D | **three.js + React Three Fiber + drei**; WebGPU renderer with automatic WebGL2 fallback | Ecosystem, performance |
| Charts | **uPlot** (dense time series) + **visx** (custom: barcode, radar) | 60 FPS with 100k points |
| State | **Zustand** slices + URL-synced state (permalinks) | Simple, predictable, shareable |
| Compute | **Web Workers** (Comlink); engine in pure TS with typed arrays | Keeps the main thread at 60 FPS |
| Engine tests | **Vitest** + golden fixtures from Python | Cross-language parity |
| E2E | **Playwright** (smoke + visual snapshots) | Prevents demo-breaking regressions |
| Pipeline | **Python 3.12 + uv**: numpy, numba, rasterio/GDAL, spiceypy, pydantic, httpx, typer; pytest, ruff, mypy | The standard scientific stack |
| Data hosting | **Cloudflare R2** (or Vercel Blob) for tiles; Vercel for the app | Cheap egress, range requests, CORS |
| LLM | **Anthropic Claude API** via server-side Route Handler (`claude-sonnet-5-5`; `claude-haiku-4-5-20251001` for cheap intent parsing) | Tool use, strong reasoning |
| Audio | Tone.js | Sonification |
| CI | GitHub Actions: lint → typecheck → unit → parity → build → e2e smoke | Every merge stays shippable |

**Deliberately excluded:** a database (all data is static, versioned and cacheable), a Python server at runtime (Python is offline only), and black-box ML in the science path (a judging asset, not a gap).

## 3.2 End-to-End Data Flow

```
            ┌───────────────────────── OFFLINE (pipeline/, Python) ─────────────────────────┐
 PDS LOLA ─▶│ fetch (sources.yaml, SHA-256) ─▶ parse LBL/IMG ─▶ validate (pydantic) ─▶     │
 PGDA     ─▶│   tile pyramid (polar stereo, uint16+offset, brotli)                          │
 NAIF     ─▶│ spiceypy: Sun/Earth/DSN vectors in MOON_ME, LT+S, 10-min step ─▶ ephem/*.bin  │
 Horizons ─▶│ reference horizon (slow numpy) ─▶ site masks + stat rasters ─▶ golden/*.json  │
 LOLA maps─▶│ validate: Horizons residuals · published illum maps · DEM Monte Carlo        │
            │ export manifest.json (provenance) ─▶ publish to R2 (+ immutable version path) │
            └───────────────────────────────────────────────────────────────────────────────┘
                                              │ HTTPS (brotli, range, CDN cache)
            ┌──────────────────────────────── BROWSER ─────────────────────────────────────┐
            │ Main thread: Next.js UI · Zustand · R3F scene (tiles → GPU textures)           │
            │      │ Comlink                                                                 │
            │ Horizon Worker: multi-res ray-march → HorizonMask (Float32[1440])              │
            │ Timeline Worker: ephemeris interp → topocentric az/el → disk fraction,         │
            │   Earth vis, DSN vis, eclipse → per-step state → barcode, stats, windows       │
            │ GPU: heightfield shadow ray-march (near) + horizon-angle texture (far)         │
            └───────────────────────────────────────────────────────────────────────────────┘
                                              │ /api/analyst (server: key + rate limit only)
                                       Claude API ⇄ client-executed engine tools
```

### Key algorithms (engine contracts)

**Frames and time.** Internal time is **TDB seconds past J2000 (ET), float64**. UTC appears only at the UI boundary, through a leap-second table exported from `naif0012.tls`. Positions are in **MOON_ME**, meters internally.

**Topocentric geometry.** Site (lat, lon, h) → ME Cartesian on a 1737.4 km sphere plus the DEM height. ENU basis at the site. `v = r_body_ME − r_site_ME` (includes the parallax of Earth, ~0.26° at the pole). Then `az = atan2(E, N)` and `el = asin(U/|v|)`. Ephemeris is stored at a 10-min step and interpolated with cubic Hermite. Target interpolation error is < 1e-4°.

**Horizon mask.** For each of 1440 azimuths (0.25°), march outward along the surface (on the sphere) with step size growing with distance (5 m → 1 km), out to 200 km. At each sample, compute the exact elevation angle of the terrain point as seen from the observer (observer height = DEM + mast). Horizon(az) = max elevation. Use the finest available tile level whose ground sample distance is ≤ (distance × 0.0005 rad). Budget ≈ 1440 × ~1500 samples ≈ 2.2 M bilinear samples, about 30–80 ms in a worker.

**Illumination.** Visible solar-disk fraction = area of the Sun disk (radius 0.2665° × distance scaling) above the local horizon line, assuming the horizon is linear across the disk width (within 0.53°). Earth-shadow eclipse: subtract the overlap area of the Earth disk and the Sun disk as seen from the site.

**Communication.** `DTE_geom = earth_el − horizon(earth_az) ≥ min_margin`. `DSN_ok = any(complex: moon_el_at_complex ≥ mask)`. `link = DTE_geom ∧ DSN_ok`.

**Windows.** Run-length encode the per-step state. Constraints include: max darkness ≤ battery hours, min continuous sunlight ≥ X, DTE% ≥ Y over a window, and slope ≤ S. Rank by a weighted score and mark Pareto-optimal windows.

**Uncertainty.** Precompute N = 32 horizon masks per preset site, each perturbing the DEM with spatially correlated noise matched to Barker et al. 2021. The UI shows the median and the 5–95% range.

### Performance budgets (enforced in CI where possible)

| Metric | Budget |
|---|---|
| First contentful paint (poster) | < 1.5 s on broadband |
| Interactive 3D | < 4 s |
| Frame rate (M1/M2 MacBook, mid-range Windows laptop) | 60 FPS Lab, ≥ 45 FPS Hero |
| Custom-pin horizon | < 1.5 s incl. tile fetch (warm cache < 200 ms) |
| 6-year timeline for 4 sites | < 800 ms |
| Initial JS (gzipped) | < 350 KB excluding three.js chunk |

## 3.3 Machine Learning & Agentic Layer

**Principle: AI explains, the engine computes.** No AI-generated number ever reaches the user unchecked.

### "Mission Analyst" (LLM agent)

- **Use cases:** natural-language queries (*"Find a 14-day window in 2028 at Nobile Rim 1 with no night longer than 50 hours"*), plain-language explanations for educators, and auto-written Site Briefs.

- **Architecture:** `/api/analyst` is a thin server proxy. It holds `ANTHROPIC_API_KEY`, applies per-IP rate limits, enforces a max of 6 tool rounds and a 30 s timeout, and streams the response. **Tools execute on the client** against the same engine the UI uses:

  - `list_sites`, `get_site_summary(site_id, range)`, `find_windows(site_ids, range, constraints)`, `compare_sites(site_ids, range, profile)`, `explain_metric(metric_id)` (from a curated glossary), `get_provenance(metric_id)`.

- **Input validation:** every tool input is parsed with **zod** schemas from `packages/contracts`. Invalid calls return a structured error to the model and are never guessed.

- **Output validation:** the model must return `{answer_markdown, claims: [{text, value, unit, tool_call_id}]}`. A **grounding checker** verifies that each claim value matches the referenced tool output within rounding. If any claim fails, the answer is regenerated once; on a second failure, the user sees only the raw tool results.

- **Transparency:** a "Show work" drawer displays the tool calls and raw results.

- **Fallback:** with no key or when offline, canned example queries come from a recorded cache, labelled *Recorded example*.

### Analytical (non-LLM) computation

Classical, explainable methods only: geometric ray-marching, run-length window search, Pareto ranking, and Monte Carlo uncertainty. Stretch: shadow-mask IoU vs LROC NAC frames (threshold + morphological cleanup). There is no neural model in the science path, and the AI disclosure says so explicitly.

### AI in development (disclosed)

Claude Code (Opus/Sonnet models) writes and reviews code in parallel lanes under the repository `CLAUDE.md` rules. Humans review every merge. Correctness is established by tests and external validation, not by trusting the model.

---

# SECTION 4 — Deep Implementation Blueprint (Hackathon Execution)

## 4.1 Team Lanes (3 developers + non-dev teammates; each developer drives 1–2 Claude Code sessions)

| Lane | Owner | Owns | Claude Code worktree |
|---|---|---|---|
| **Dev 1 — Science & Engine** (old lanes A + B) | _TBD_ | `pipeline/`, `packages/engine`, `packages/contracts`, validation, `docs/science/` | `wt-engine` |
| **Dev 2 — Scene & Lab UI** (old lanes C + D) | _TBD_ | `apps/web/scene`, shaders, LOD, panels, timeline, state, Evidence charts | `wt-ui` |
| **Dev 3 — Platform, Story & Analyst** (old lanes E-code + F) | _TBD_ | repo/CI/deploy, URL state sync, Story engine, Mission Analyst, sonification, exports, e2e tests, merges | `wt-platform` |
| **Non-dev teammates** (old lane E, non-code) | _TBD_ | Story copy, fact-checking against citations, slides, demo video, AI/NASA-data disclosure text, hallway tests | docs only |

**Load balancing:** Dev 1 carries the heaviest early load (data + physics). Dev 3 starts with repo/CI and the data relay, then helps Dev 1 with pipeline tasks in weeks 1–2. Dev 1 and Dev 3 write `packages/contracts` together on day 1 so all three lanes can build against mocks immediately.

**Integration cadence:** open a pull request per task and merge to `main` at least daily. Integration builds must stay green. Never merge a red CI.

## 4.2 Calendar (6 weeks; replaces the original 48-hour plan)

Heavy downloads and checks run overnight. Hour-based "H+" labels from the original plan no longer apply; dates below are the targets.

| Week | Dates | Focus | Gate at end of week |
|---|---|---|---|
| **W1** | Oct 1 → Oct 7 | **M0** repo, CI, contracts, mocks. **M1** essential data mirrored (relay) and `fetch`/`dem`/`tiles` started. **M2** `time`, `frames`, `ephemeris`. **M3** terrain from the mock DEM. Design tokens | **G1 (Oct 7):** CI green; real tiles for one site rendered; Sun az/el from real SPICE kernels |
| **W2** | Oct 8 → Oct 14 | M1 tiles + ephemeris published. M2 `horizon` + parity tests. M3 LOD + shadows. M4 Lab shell and stores | **G2 (Oct 14):** one site end-to-end (horizon → timeline → barcode), within 0.05° RMS of the Python reference |
| **W3** | Oct 15 → Oct 21 | M2 `illumination`, `comms`, `timeline`, Horizons validation. M3 sky dome, fisheye, overlays. M4 site list, profile form, scrubber | **G3 (Oct 21):** Lab works on 3 real sites; validation report v1 |
| **W4** | Oct 22 → Oct 28 | M2 `windows`, uncertainty from PGDA clones. M4 Window Finder, Evidence view. Start M5 Story engine. **Oct 28: full challenge statement released → gap analysis** | **G4 (Oct 28–30):** gap analysis done; plan v1.2; D-002 (challenge lock) |
| **W5** | Oct 29 → Nov 4 | M5 Story Mode chapter, Mission Analyst, sonification, exports. M3 perf pass. M4 a11y + keyboard | **Feature freeze (Nov 5)** |
| **W6** | Nov 5 → Nov 11 | **M6** deploy, cross-browser test, Lighthouse, hallway test, slides, 30 s video, disclosures | **Release candidate (Nov 12)** |
| **Submit** | Nov 12 → Nov 15 | Read the Submission Guide (Nov 13). Submit as soon as the portal opens; final submission at least 2 h before the local deadline | Tag `v1.0-submitted` |

**Risks specific to this calendar:** (1) the statement may change scope on Oct 28, so keep the engine body-agnostic and keep slack in W4–W5; (2) three developers means a single illness can move a gate, so every gate has a "minimum viable" version listed in REMAINING.md; (3) the deadline is still hard, so cut features before cutting validation, and protect W6 for hardening.

## Milestone M0 — Setup & Contracts (Dev 3 + Dev 1 · Oct 1 → Oct 3)

**Goal:** all three developers can start in parallel without blocking each other.

- Create the GitHub organization and the `sightline` repo (license **Apache-2.0**; **private** until about Nov 10, then public before submission). Add `CLAUDE.md` and `docs/`. See D-011.

- Scaffold with the official generators: `create-next-app`, `pnpm init`, `uv init`.

- `packages/contracts`: zod schemas and TS types for `Site`, `LanderProfile`, `EphemerisHeader`, `TileManifest`, `HorizonMask`, `StepState`, `WindowResult`, `ProvenanceRecord`, `AnalystClaim`. Export JSON Schema for Python (pydantic models generated or mirrored).

- Write a **mock generator** for every contract (synthetic crater DEM, analytic Sun path). Lanes build against mocks immediately. Every mock is badged `SIMULATED` in the UI.

- **Start the essential data downloads on day 1** (about 945 MB; see DATA_VERIFICATION_REPORT §1.3 and D-009) and let them run overnight.

- **Acceptance:** `pnpm verify` and `uv run pytest` pass; CI is configured; the Vercel preview deploys "Hello Moon".

## Milestone M1 — Data Ingestion & Transformation Engine (Dev 1 · Oct 1 → Oct 21)

**Deliverables:**

1. `pipeline/sources.yaml` lists every dataset with id, URL, expected size, SHA-256 (filled on first fetch), license, citation, and `verified_at`.

2. `sightline fetch` performs resumable downloads (httpx with range requests), verifies checksums, and writes to `data/raw/`.

3. `sightline dem` parses the PDS3 LBL (sample type, scaling factor, offset, map projection, center lat, scale) → pydantic-validated `DemMeta`. It also produces a numpy memmap.

4. `sightline tiles` builds the pyramid: polar stereographic native grid, 256² tiles + 1 px border, uint16 + float32 offset per tile at 0.1 m, brotli → `data/processed/tiles/` + `tile_manifest.json`.

5. `sightline ephem` uses spiceypy to compute Sun, Earth and the 3 DSN complexes in MOON_ME, with LT+S, 2026-01-01 → 2032-12-31, 10-min step → `ephem/*.bin` + header JSON.

6. `sightline sites` builds the curated site catalog (Artemis III regions and CLPS sites), each with `source_url`.

7. `sightline golden` writes reference values: Sun/Earth az/el at 200 epochs × sites, reference horizon masks (slow numpy), and Horizons cross-check results.

8. `sightline publish` uploads to R2 under the immutable path `v{pipeline_version}/` and writes `manifest.json`.

**Mock fallbacks:** if a download fails, `sightline mock` generates synthetic terrain and analytic ephemeris with the **same contracts**, and the manifest flag `simulated: true` makes the UI show a banner.

**Tests:** LBL parsing on a real header; tile round-trip error ≤ 0.05 m; ephemeris spot checks vs Horizons ≤ 0.02°; manifest schema validation; a lint rule that no URL appears outside `sources.yaml`.

**Acceptance:** real tiles for 85–90°S plus 5 m tiles at ≥ 3 sites are published, and the ephemeris covers 2026–2032.

## Milestone M2 — Core Simulation & Mathematical Modeling (Dev 1 · Oct 1 → Oct 28)

**Modules in `packages/engine/src`:**

| Module | Responsibility | Key tests |
|---|---|---|
| `time/` | UTC ↔ ET (leap seconds), formatting | Known epochs vs SPICE |
| `frames/` | Geodetic ↔ ME Cartesian, ENU basis, az/el | Pole singularity handling at exactly −90° |
| `ephemeris/` | Binary chunk loader, Hermite interpolation | Interp error < 1e-4° vs dense table |
| `dem/` | Tile cache (LRU), bilinear sampling, multi-res selection | Matches Python sample values |
| `horizon/` | Multi-res ray-march, curvature-exact elevation | Parity vs Python golden ≤ 0.05° RMS, ≤ 0.2° max |
| `illumination/` | Solar disk fraction, Earth-shadow eclipse | Analytic cases: flat horizon, half disk, full eclipse |
| `comms/` | Earth visibility with margin, DSN visibility | Golden DSN windows from SPICE |
| `timeline/` | Per-step state, RLE, stats (illum %, longest night, DTE %) | Golden stats per site |
| `windows/` | Constraint search, scoring, Pareto | Property tests (fast-check) |
| `uncertainty/` | Aggregate Monte Carlo masks → percentile bands | Bands contain the median |

**Rules:** pure functions only, no DOM, SI units with suffixes (`_m`, `_rad`, `_s`, `_et`), and typed arrays on hot paths. Both workers (`horizon.worker.ts`, `timeline.worker.ts`) expose Comlink APIs.

**Acceptance:** all parity tests pass; a custom pin produces a horizon in < 1.5 s cold; a 6-year timeline for 4 sites takes < 800 ms; the validation numbers are exported to `docs/science/VALIDATION_REPORT.md`.

## Milestone M3 — Interactive Visual Canvas (Dev 2 · Oct 3 → Nov 4)

- **Terrain:** a quadtree LOD over the tile pyramid with screen-space-error splitting, geomorphing to avoid popping, and tile textures streamed via the worker. Skirts hide cracks.

- **Shading:** Lommel-Seeliger/Hapke-lite lunar photometry (no specular), plus the optional LROC albedo drape.

- **Shadows:** a near-field **heightfield ray-march toward the Sun** in the fragment shader (32–64 steps), plus a far-field **horizon-angle texture** (32 azimuth bins per texel, precomputed coarse) so ridges 100 km away still cast correct shadows. The same physics as the engine.

- **Overlays:** colormapped stat rasters (illum %, max-dark, DTE %, slope, PSR) with an opacity slider and a legend.

- **Sky:** a star catalog in J2000 rotated into the local frame; the Sun as an HDR sprite with bloom; Earth as a sphere with **computed phase** and a GIBS texture when available.

- **Lander's-Eye fisheye:** an orthographic polar projection. Horizon silhouette from the mask; Sun and Earth paths over the chosen range (Earth's libration Lissajous loop); a current-time marker.

- **Site pins:** an extruded horizon ring (a 3D silhouette at a fixed radius) and a mast.

- **Performance:** instanced pins, frustum culling, `frameloop="demand"` when idle, adaptive DPR, and a GPU timer HUD in dev mode.

- **Acceptance:** 60 FPS in the Lab on target hardware. Shadow edges match the engine's lit/unlit result at 20 random probes (automated test: render-to-texture readback vs engine).

## Milestone M4 — Command Center UI & State Management (Dev 2 · Oct 8 → Nov 4)

- **Stores (Zustand slices):** `timeStore` (epoch, rate, range, playing), `siteStore` (presets, custom pins, selection ≤ 4), `profileStore` (mast, battery, DTE min, DSN mask, disk min), `layerStore`, `analysisStore` (results cache keyed by hash(site, profile, range, dataVersion)), `uiStore` (mode, panels), `storyStore`.

- **URL sync:** encode site, time, profile and layers in the query string. Every view is a shareable permalink.

- **Components:** `HudReadout`, `GlassPanel`, `SiteList`, `ProfileForm`, `LayerDock`, `TimelineScrubber` (canvas-rendered, zoomable), `MissionBarcode`, `WindowFinder`, `FisheyeSky`, `EvidenceCharts`, `ProvenanceDrawer`, `SimulatedBadge`.

- **Keyboard:** Space (play/pause), ←/→ (step), Shift+←/→ (jump to next event), 1–4 (select site), L (layers), ? (help).

- **Accessibility:** WCAG 2.2 AA; ARIA live region for state changes ("Sun set at Nobile Rim 1, 06:40 UTC"); focus rings; all charts have table fallbacks.

- **Acceptance:** the full Lab flow works by keyboard only; Playwright e2e covers select site → set profile → find windows → export CSV.

## Milestone M5 — Storytelling, Analyst & Presentation Polish (Dev 3 + non-dev teammates · Oct 22 → Nov 5)

- **Story engine:** steps are JSON (`camera`, `epoch`, `sites`, `profile`, `layers`, `caption`, `durationMs`) and are interpolated with the app's own stores. Ship the "Light & Signal" chapter (7 steps, ≤ 90 s). Add optional chapters only if time permits.

- **Judge Tour button:** always visible in the top-right; it auto-plays the chapter and can be interrupted at any step.

- **Mission Analyst:** the route handler, client tool loop, zod validation, grounding checker, "Show work" drawer, and recorded fallback.

- **Sonification:** Tone.js engine bound to `timeStore`; toggle; volume.

- **Exports:** CSV/JSON windows, a PDF Site Brief (client-side, react-pdf), an `.ics` of comm windows, and a permalink copy.

- **Responsive:** desktop first; tablet layout (panels as sheets); phone gets the Story Mode + fisheye focus (the 3D Lab degrades gracefully).

- **Acceptance:** a first-time user completes the tour without help (hallway test with 2 people outside the team); Lighthouse a11y ≥ 95.

## Milestone M6 — Deployment, Verification & Judge Deliverables (Dev 3 + non-dev teammates · Nov 5 → Nov 13)

### Deployment

- Web on **Vercel** (production + preview per PR). Data on **R2** with an immutable versioned path, `Cache-Control: public, max-age=31536000, immutable`, and CORS for the app origin.

- Environment: `ANTHROPIC_API_KEY` (server only), `NEXT_PUBLIC_DATA_BASE_URL`, and `ANALYST_ENABLED` as a kill switch.

- Uptime check on the production URL through January 2027 (judging period).

### Verification checklist (all must pass before submission)

- [ ] `pnpm verify` and `uv run pytest` green on `main`.

- [ ] Validation report regenerated from the final data version; numbers in the slides match it.

- [ ] No `SIMULATED` badge appears anywhere in production (automated e2e check).

- [ ] Tested on Chrome, Safari and Firefox (latest), on macOS and Windows, and on one phone.

- [ ] Cold load on throttled "Fast 4G" < 6 s to the interactive Hero.

- [ ] Analyst kill switch tested; the app is fully functional with the Analyst off.

- [ ] Every dataset cited with a URL; every image credited.

- [ ] **No NASA logos or insignia** anywhere (Space Apps branding rule); data credit text only.

- [ ] If any team member is under 18: no likeness or voice of a minor in the video (official rule).

### 7-slide pitch deck (structure)

| # | Slide | Content |
|---|---|---|
| 1 | **Title** | SIGHTLINE wordmark over the Hero still · tagline · team · challenge name |
| 2 | **The problem** | "The Sun never rises above ~1.5°." One fisheye image; three stat callouts (grazing Sun, wobbling Earth, nights that kill landers) |
| 3 | **What Sightline does** | Lab screenshot with 3 annotations: click anywhere → horizon; barcode; window finder |
| 4 | **The science** | Pipeline diagram (LOLA + SPICE + DSN → horizon → windows) and the validation numbers (Horizons Δ, map agreement, parity) |
| 5 | **The "aha"** | Mast 2 m → 10 m: longest night before/after (live numbers); golden windows in mint |
| 6 | **Impact** | Users (CLPS/Artemis planners, educators, public); what changes for them; how it extends (any body, relays, rovers) |
| 7 | **Built honestly** | NASA data list, AI disclosure summary, open-source repo QR, live URL |

### 30-second demo video script

| Time | Visual | Voice-over (≈ 75 words) |
|---|---|---|
| 0–5 s | Hero: shadows sweep the pole; Earth bobs on the horizon | "At the Moon's south pole, the Sun never climbs higher than a finger's width above the horizon." |
| 5–12 s | Click a crater rim → horizon ring draws → fisheye shows the Sun clipped by a ridge | "Sightline computes the true horizon anywhere, from NASA laser altimetry, in a second." |
| 12–19 s | Barcode for 4 sites; mast slider 2 m → 10 m; the longest night shrinks | "See exactly when each site has power and a line to Earth, and how a taller mast changes everything." |
| 19–25 s | Window finder lights mint windows; Evidence view with validation residuals | "Find landing windows that survive the night, every number validated against JPL." |
| 25–30 s | Pull back to the Hero; title + URL | "Sightline. Know when the Sun shines and Earth listens." |

### Draft: "Use of Artificial Intelligence (AI)" disclosure

> Sightline uses AI in two clearly separated ways. **(1) Development:** our team used Anthropic's Claude Code (Claude Opus and Sonnet models) as a coding assistant to write, refactor and review software under written project rules. Team members reviewed all AI-generated code. Scientific correctness was established independently through automated tests: cross-checks against JPL Horizons, comparison with published LOLA illumination maps, and parity between two independent implementations (Python and TypeScript). **(2) In the product:** an optional "Mission Analyst" uses the Claude API (claude-sonnet-5-5) to answer natural-language questions. It cannot compute science itself. It may only call our deterministic physics engine, and every number in its answers is automatically checked against the engine's output before display, with the full tool log visible to the user. No machine-learning model is used to produce any illumination, communication or ephemeris value. [List any AI-generated images, voice or music here, labelled as such; if none, state "No AI-generated imagery, audio or video is used."]

### Draft: "NASA Data / Space Agency Partner Data" text

> Sightline is built on NASA open data. Lunar topography comes from the **Lunar Reconnaissance Orbiter's Lunar Orbiter Laser Altimeter (LOLA)** gridded polar DEMs, obtained from the NASA PDS Geosciences Node, and high-resolution south-pole DEMs from NASA GSFC's Planetary Geodesy Data Archive. Sun, Earth and Deep Space Network geometry is computed with **NASA/JPL NAIF SPICE** kernels (DE440 planetary ephemeris, high-precision lunar orientation, DSN station kernels) and independently validated against the **JPL Horizons** system. Illumination results are compared with published LOLA-derived illumination products. Candidate sites come from NASA's Artemis III landing-region announcements and CLPS mission information. [Add LROC, Diviner and GIBS if used.] Full URLs, versions and checksums are listed in the in-app Provenance Inspector and in our repository.

---

# SECTION 5 — The Production `CLAUDE.md`

The production `CLAUDE.md` is at the repository root: [../CLAUDE.md](../CLAUDE.md). It contains the operating rules, exact commands, conventions, directory structure, state patterns, safety boundaries and the session protocol that keeps the progress files current.

---

# Appendix A — Challenge Selection (all 14 official 2026 challenges)

Each challenge is scored 1–5 on five criteria: **Cin**ematic 3D potential · **Sci**ence depth · **Data** availability/maturity · **Room** (low crowding, advanced difficulty) · **Fit** to the team's ambition.

| Challenge | Cin | Sci | Data | Room | Fit | Total | Verdict |
|---|---|---|---|---|---|---|---|
| **CLPS Lunar Mission Browser** | 5 | 5 | 5 | 4 | 5 | **24** | ✅ **Primary** |
| Interplanetary Survival Guide: Martian Map | 5 | 4 | 5 | 2 | 5 | 21 | 🟨 **Backup** (engine ports) |
| Harmonization of MODIS and VIIRS Hot Spots | 3 | 5 | 5 | 4 | 3 | 20 | Strong data science, less visual |
| Be An Earth System Trend Detective! | 3 | 5 | 5 | 4 | 3 | 20 | Rigor-heavy, harder to make cinematic |
| Dancing with the SARs (NISAR) | 4 | 4 | 3 | 4 | 4 | 19 | NISAR data maturity risk |
| Planet X and SPHEREx | 4 | 5 | 3 | 4 | 3 | 19 | Very large data; risky in 48 h |
| Identify Earth Analogs for Moon/Mars bases | 4 | 4 | 4 | 3 | 4 | 19 | Good, but analog criteria are subjective |
| Field Shift: Adapting Farms with NASA Data | 3 | 4 | 4 | 2 | 3 | 16 | Crowded; domain expertise needed |
| The Earth Information Jukebox | 3 | 2 | 4 | 3 | 3 | 15 | Art-led |
| Flame in Freefall (microgravity combustion AI) | 2 | 4 | 3 | 3 | 3 | 15 | Dashboard-shaped |
| Abandoned but not Forgotten (storytelling) | 4 | 2 | 4 | 2 | 3 | 15 | Storytelling award only |
| Space Mission Design Game | 4 | 2 | 2 | 2 | 3 | 13 | Crowded, youth-oriented |
| Build a Junior Astronaut Mission Trainer | 4 | 2 | 2 | 2 | 3 | 13 | Crowded, youth-oriented |
| Create Health Monitoring Software for Astronauts | 2 | 3 | 2 | 3 | 2 | 12 | Limited open data |

**Decision rule:** if the Oct 28 statement for CLPS asks for something we cannot meet (for example a mandated proprietary tool), switch to the backup within 24 h and log it in DECISIONS.md.

# Appendix B — Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Full statement (Oct 28) changes scope | Med | High | Re-plan session within 24 h; body-agnostic engine; backup challenge |
| R2 | DEM downloads slow (measured 3–35 KB/s to US origins) | High | High | Start downloads **now** (overnight relay or cloud VM → R2); essential bundle is ~945 MB; mock fallback (D-009) |
| R3 | ME vs PA frame mismatch → wrong shadows | Med | High | Explicit frame test; Horizons cross-check; documented in CLAUDE.md |
| R4 | Only 3 developers; one absence moves a gate | Med | High | Weekly gates with a minimum-viable fallback each; shared contracts; daily merges |
| R5 | WebGPU/driver issues on a judge's machine | Med | High | WebGL2 fallback; recorded video; static poster |
| R6 | LLM cost, outage or abuse | Med | Low | Kill switch; rate limit; recorded fallback; app is complete without it |
| R7 | Agents hallucinate APIs, filenames or deps | High | High | `sources.yaml` registry; dependency allowlist; `pnpm view`/`pip index` checks; CI fails on unknown URLs |
| R8 | Merge conflicts across 6 lanes | Med | Med | Contracts-first; directory ownership; 3-hourly integration |
| R9 | Fatigue errors late in the event | High | Med | Shift sleep; feature freeze on Nov 5; checklists |
| R10 | The pre-work waiver (D-010) is wrong or not confirmed in writing | Low–Med | **Fatal** | Get written confirmation from the Local Lead now (P0-02); stop and re-plan if refused |
| R11 | Site coordinates or mission facts wrong | Med | Med | Every fact has a `source_url`; the Story Mode fact sheet is checked by the science lead |

# Appendix C — Key References (verify DOIs in M6)

- Mazarico, E., Neumann, G. A., Smith, D. E., Zuber, M. T., & Torrence, M. H. (2011). Illumination conditions of the lunar polar regions using LOLA topography. *Icarus*, 211(2), 1066–1081.

- Gläser, P., et al. (2014). Illumination conditions at the lunar south pole using high resolution Digital Terrain Models from LOLA. *Icarus*, 243, 78–90.

- Gläser, P., et al. (2018). Illumination conditions at the lunar poles: Implications for future exploration. *Planetary and Space Science*, 162, 170–178.

- Barker, M. K., et al. (2021). Improved LOLA elevation maps for south pole landing sites: Error estimates and their impact on illumination conditions. *Planetary and Space Science*, 203, 105119.

- Speyerer, E. J., & Robinson, M. S. (2013). Persistently illuminated regions at the lunar poles: Ideal sites for future exploration. *Icarus*, 222(1), 122–136.

- Bussey, D. B. J., et al. (2010). Illumination conditions of the south pole of the Moon derived using Kaguya topography. *Icarus*, 208(2), 558–564.

- Smith, D. E., et al. (2010). The Lunar Orbiter Laser Altimeter investigation on the Lunar Reconnaissance Orbiter mission. *Space Science Reviews*, 150, 209–241.

- Park, R. S., Folkner, W. M., Williams, J. G., & Boggs, D. H. (2021). The JPL Planetary and Lunar Ephemerides DE440 and DE441. *The Astronomical Journal*, 161(3), 105.

- Acton, C. H. (1996). Ancillary data services of NASA's Navigation and Ancillary Information Facility. *Planetary and Space Science*, 44(1), 65–70.

- Paige, D. A., et al. (2010). Diviner Lunar Radiometer observations of cold traps in the Moon's south polar region. *Science*, 330(6003), 479–482.
