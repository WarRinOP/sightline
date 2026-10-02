# Data Verification Report — SIGHTLINE (Lane A)

**Tasks:** P0-11 / P1-04 · **Verified:** 2026-10-01 (UTC) · **Method:** read-only. Directory listings, HTTP `HEAD`, small byte-range probes (≤ 8 MB), PDS label reads, one live Horizons query. **No datasets were bulk-downloaded and no code files were created.**

Supersedes the *(verify)* entries in `docs/MASTER_PLAN.md` §1.4.

---

## TL;DR — What changed vs. the plan

| # | Finding | Impact | Action |
|---|---|---|---|
| F1 | **Better DEM source exists:** PGDA product #90 (Barker et al. 2023) ships *track-adjusted* south-polar DEMs as **Cloud-Optimized GeoTIFFs**, with per-pixel **height-error maps**. They are newer than the 2017 PDS GDR products. | Higher accuracy; COGs allow windowed range reads; error maps feed our uncertainty bands | Use PGDA #90 for regional tiers; keep PDS GDR as an archival fallback |
| F2 | **PGDA #78 site DEMs confirmed** (5 m/px), and they include **100 Monte Carlo DEM clones per site** made by the LOLA team | Our "DEM uncertainty" feature can use NASA's own error ensemble instead of noise we invent | Replace our planned synthetic perturbation with PGDA clones (DECISIONS D-007) |
| F3 | **Frame match confirmed.** All DEMs are in "MEAN EARTH/POLAR AXIS OF DE421". In the current NAIF FK `moon_de440_250416.tf`, `MOON_ME` ≡ `MOON_ME_DE440_ME421`, which differs from DE421 ME by ≤ 3.07×10⁻⁷ rad (~53 cm) over 2000–2040. | Terrain and ephemeris are consistent | Use `MOON_ME` from that FK. **Never** `MOON_PA` (0.029° / ~875 m off) or `IAU_MOON` (up to 0.005° / ~155 m off) |
| F4 | **Kernel names were stale in the plan:** the Moon FK is now `moon_de440_250416.tf`, and the DSN kernels are `earth_topo_260814.tf` / `earthstns_itrf93_260814.bsp` | The plan's names would 404 | Corrected below. NAIF re-dates these files, so pin exact names + SHA-256 and mirror them |
| F5 | **`earth_latest_high_prec.bpc` only covers to 2026-12-27.** Our window is 2026–2032. | DSN visibility after Dec 2026 would fail | Use `earth_2026_260806_2126_predict.bpc` (or `_combined`) for future epochs |
| F6 | **Soft-404 trap:** the PGDA `*_COG.TIF` illumination links return **HTTP 200 with an HTML "Not Found" page** (3,789 B, `text/html`) | A naive fetcher would save HTML as data | Fetcher must check `Content-Type`, the expected size and SHA-256. Use the PDS `release_2016` IMGs (verified) instead |
| F7 | **Validation-definition match:** LOLA `AVGVISIB` counts a timestep as lit if **any fraction** of the solar disk is visible | Our comparison metric must use the same definition, or the residuals are meaningless | Add an `any_fraction` mode to the validation stats |
| F8 | **Network bottleneck (critical):** from this machine, US-hosted origins delivered **3–35 KB/s**, while Cloudflare delivered **~5 MB/s** | Even a lean ~0.95 GB dataset would take **8–13 h** at H+0 | **Cloud relay** (US VM → R2) at H+0, and/or Local-Lead-approved pre-download. See §6 |
| F9 | **Horizons verified** for lunar surface observers; it uses **DE441** and the **"MEAN_ME (high precision)"** frame with a 1737.4 km sphere | Independent validation is possible as planned | Expect sub-0.001° DE440/DE441 differences. Tolerance stays 0.02° |
| F10 | **New in 2025/26:** PGDA #104 / Zenodo `10.5281/zenodo.17954508`, 5 m **Shape-from-Shading** DEMs for the 13 *2022* Artemis III regions (CC-BY-4.0, **25.3 GB** total) | Highest-fidelity terrain available, but far too large for 48 h | Stretch goal only: one hero region (smallest: Peak Near Shackleton, 1.36 GB) |

---

## 1. LOLA Polar DEMs

### 1.1 Option A — PDS Geosciences Node (archival LOLA GDR, 2017 release)

**Base URL (verified 200):** `https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/`

Subfolders: `img/` (16-bit integer), `float_img/` (32-bit float), `jp2/` (JPEG2000, **confirmed lossless** per `document/jp2info.txt`).

**Naming convention:** `ldem_{LAT}{N|S}_{SCALE}m[_float].{img|lbl|xml}` · JP2 label = `ldem_{…}_jp2.lbl`. `LAT` ∈ {45, 60, 75, 80, 85, 875 (= 87.5°)}.

| Product | Grid (px) | Coverage | int16 `.img` | float32 `.img` | `.jp2` (lossless) |
|---|---|---|---|---|---|
| `ldem_80s_20m` | 30400² | 80–90°S | 1,848,320,000 B (1.85 GB) | 3,696,640,000 B | 267,689,172 B |
| `ldem_80s_40m` | 15200² | 80–90°S | 462,080,000 B | 924,160,000 B | 91,722,831 B |
| `ldem_80s_80m` | 7600² | 80–90°S | 115,520,000 B | 231,040,000 B | 29,837,992 B |
| `ldem_85s_10m` | 30336² | 85–90°S | 1,840,545,792 B | 3,681,091,584 B | 231,368,857 B |
| `ldem_85s_20m` | 15168² | 85–90°S | 460,136,448 B | 920,272,896 B | 79,150,148 B |
| `ldem_85s_40m` | 7584² | 85–90°S | 115,034,112 B | 230,068,224 B | 24,960,972 B |
| `ldem_875s_5m` | 30336² | 87.5–90°S | 1,840,545,792 B | 3,681,091,584 B | 185,186,696 B |
| `ldem_75s_60m` | 15248² | 75–90°S | 465,003,008 B | 930,006,016 B | 103,313,776 B |
| `ldem_75s_120m` | 7624² | 75–90°S | 116,250,752 B | 232,501,504 B | 33,948,010 B |
| `ldem_75s_240m` | 3812² | 75–90°S | 29,062,688 B | 58,125,376 B | 10,766,928 B |

**Label facts (read from `ldem_80s_20m.lbl` / `_float.lbl`):**

| Field | int16 (`img/`) | float (`float_img/`) |
|---|---|---|
| `SAMPLE_TYPE` / `BITS` | `LSB_INTEGER` / 16 | `PC_REAL` / 32 |
| Unit / scaling | meters, `SCALING_FACTOR = 0.5` | kilometers, `SCALING_FACTOR = 1` |
| `OFFSET` (reference sphere) | 1737400 m | 1737.4 km |
| Height range (80S 20m) | DN −14594…14054 → −7297 m…+7027 m | −7.297…+7.027 km |
| `PRODUCT_VERSION_ID` | V2.0 | V2.1 |
| Data span | 2009-07-13 → 2017-02-02 (LOLA tracks through LRO_ES_54) | same |

**Projection (identical for all products):** `POLAR STEREOGRAPHIC`, spherical, `A=B=C=1737.4 km`, `CENTER_LATITUDE = −90`, `CENTER_LONGITUDE = 0`, `MAP_PROJECTION_ROTATION = 0`, `POSITIVE_LONGITUDE_DIRECTION = EAST`, planetocentric latitude, scale true at the pole. Pixel-registered. `LINE/SAMPLE_PROJECTION_OFFSET = (N/2 − 0.5)` (e.g. 15199.5 for 30400²). **Frame: "MEAN EARTH/POLAR AXIS OF DE421".**

> Conversion: `height_m = DN × 0.5` (int16); `radius_m = height_m + 1737400`.

**HTTP:** `accept-ranges: bytes` confirmed (206 Partial Content on a range probe). Raw row-major IMGs can therefore be **window-read with byte ranges**.

### 1.2 Option B — PGDA #90 "A New View of the Lunar South Pole from LOLA" (Barker et al. 2023) ✅ recommended

**Product page:** `https://pgda.gsfc.nasa.gov/products/90` · **Data base:** `https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/`

- **Format:** Cloud-Optimized GeoTIFF, south-polar stereographic X/Y in meters, **MOON_ME of DE421** (same frame as PDS).

- **Naming:** `PREFIX_LAT_PIX_STEMS.TIF`. Prefixes: `LDEM` (height, m), `LDEC` (LOLA spot count), `LDSM` (slope), `LDRM` (roughness), `LPSR` (PSR). Stems: `ADJ`, `ADJ_ERR` (height σ), `ADJ_EFFRES` (effective resolution), `ADJ_HILL`, …

- **Why prefer it:** the LOLA tracks are co-registered ("ADJ"), the error and effective-resolution layers are included, and it's the same lineage as the #78 site DEMs. Everything is in one consistent product family.

| File (verified 200, `image/tiff`, ranges OK) | Bytes | Note |
|---|---|---|
| `LDEM_80S_80MPP_ADJ.TIF` | 189,158,392 | **Mid tier, full download** |
| `LDEM_80S_80MPP_ADJ_ERR.TIF` | 254,808,965 | Regional height σ (optional) |
| `LDEM_80S_40MPP_ADJ.TIF` | ≈ 716 MB (683.1 MiB) | Optional |
| `LDEM_80S_20MPP_ADJ.TIF` | 2,696,082,051 | **Too big to fetch whole: COG windows only** |
| `LDEM_83S_10MPP_ADJ.TIF` | 5,116,709,568 | Avoid (windows only, stretch) |
| `LDEM_75S_30MPP_ADJ.TIF` | ≈ 2.80 GB | Avoid |
| `LDEM_60S_240MPP_ADJ.TIF` | 218,961,039 | **Far tier** (or a COG window, ~25% of the file) |
| `LDEM_60S_120MPP_ADJ.TIF` | ≈ 821 MB | Optional far tier, higher res |
| `LPSR_80S_20MPP_ADJ.TIF` | ≈ 154 MB | PSR overlay (newer than the 2016 maps) |

> ⚠️ **Not yet verified (needs GDAL, which isn't installed on this machine):** internal COG tiling and overviews, `nodata` value, data type (likely Float32), exact geotransform. Run `gdalinfo /vsicurl/<url>` in M1-01 and record the output.

### 1.3 Bandwidth-safe ingestion strategy

**Geometry check.** Candidate sites lie roughly 84–90°S, so up to ~180 km from the pole (1° ≈ 30.32 km). A 200 km horizon radius therefore needs terrain out to ~380 km from the pole (~77.5°S). The 80S products (half-width 304 km) do **not** fully cover that radius for outer sites, so a 75S/60S product is required for the far field.

**Angular-error budget per tier** (horizontal pixel subtense ≈ pixel / distance):

| Tier | Distance from observer | Source | Pixel | Worst-case subtense |
|---|---|---|---|---|
| **N** — near | 0 – ~8 km | PGDA #78 site DEM | 5 m | ≤ 0.06° at 5 km |
| **M** — mid | ~8 – 100 km | PGDA #90 `LDEM_80S_80MPP_ADJ` (full) | 80 m | 0.57° at 8 km → 0.05° at 100 km* |
| **M+** — mid (optional) | ~8 – 30 km at presets | COG window of `LDEM_80S_20MPP_ADJ`, ±30 km per site | 20 m | 0.14° at 8 km |
| **F** — far | 100 – 200 km | PGDA #90 `LDEM_60S_240MPP_ADJ` (window ≤ ±460 km) | 240 m | ≤ 0.14° at 100 km |

\* At 8–30 km the 80 m tier is the weak link, which is why we add the M+ 20 m windows around presets. For click-anywhere pins, the UI must show an "effective resolution" badge (use `ADJ_EFFRES`) rather than imply 5 m everywhere.

**Download budget.**

| Bundle | Contents | Size |
|---|---|---|
| **Essential (H+0)** | SPICE kernels (62.0 MB) · 6 site DEMs: Site01, Site04, Site06, Site07, Site23, DM2 (321.6 MB) · `LDEM_80S_80MPP_ADJ` (189.2 MB) · `LDEM_60S_240MPP_ADJ` (219.0 MB) · validation: PDS `avgvisib_85s_060m_201608` + `_earth` + `lpsr_85s_060m_201608` (153.5 MB) | **≈ 945 MB** (≈ 781 MB if the far tier is windowed) |
| **Overnight / optional** | M+ 20 m windows (~150 MB est.) · Haworth 5 m (142.1 MB) · `_toterr` per site (~322 MB) · 16 clones for 1–2 hero sites (~41 MB each) · `LDEM_80S_80MPP_ADJ_ERR` (254.8 MB) | ≈ 0.9–1.6 GB |
| **Avoid in 48 h** | Full `LDEM_80S_20MPP_ADJ` (2.70 GB), `LDEM_83S_10MPP_ADJ` (5.12 GB), PDS float 5–20 m (3.7 GB each), Zenodo SfS set (25.3 GB) | — |

**Fallback if PGDA is down:** the PDS GDR JP2s (lossless, ~7× smaller than int16 IMG): `ldem_80s_80m.jp2` (29.8 MB), `ldem_75s_240m.jp2` (10.8 MB), `ldem_85s_20m.jp2` (79.2 MB). Note: this is the 2017 non-adjusted lineage, so tag it in provenance.

---

## 2. High-Resolution Site DEMs — PGDA #78 (Barker et al. 2021)

**Product page:** `https://pgda.gsfc.nasa.gov/products/78` · **Data:** `https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/` · **README:** `…/LOLA_5mpp/README` (read)

- **Format:** 5 m/px GeoTIFF, south-polar stereographic X/Y (m), pixel-registered (GMT convention), **MOON_ME of DE421**.

- **Per-site files:** `{Site}/{Site}_final_adj_5mpp_surf.tif` (height, m), `_toterr.tif` (height σ, m), `_slp.tif`, `_slperr.tif`, `_ldec.tif`, `{Site}_final_adj.xyzi` (point cloud), `{Site}_ROIs.tgz`, and `Clones/{Site}_final_adj_5mpp_{0001..0100}_err.tif`.

- **Accuracy (per page):** track geolocation ~10–20 cm horizontal and ~2–4 cm vertical; median RMS height error ~0.30–0.50 m; median RMS slope error ~1.5–2.5°. About 90% of 5 m pixels are interpolated.

- **Caveat:** Site23 (Malapert) has **no error estimates or clones** (per the data directory page).

| Site ID | Name (per PGDA) | `_surf.tif` bytes (verified) | Inferred grid → extent* | Relevance |
|---|---|---|---|---|
| Site01 | Connecting ridge | 40,980,810 | 3200² → 16 km | Top illumination site |
| Site04 | Shackleton rim | 40,980,806 | 3200² → 16 km | Iconic |
| Site06 | Nobile rim 1 | 64,025,603 | 4000² → 20 km | Artemis III region (2024) |
| Site07 | Peak near Shackleton | 40,980,808 | 3200² → 16 km | Artemis III region (2022) |
| Site11 | de Gerlache rim | ≈ 40,980,8xx | 3200² → 16 km | Artemis III region family |
| Site23 | Malapert massif | 70,586,804 | 4200² → 21 km | Artemis III region (2024); IM-1 vicinity |
| DM2 | Nobile rim 2 | 64,025,607 | 4000² → 20 km | Artemis III region (2024) |
| Haworth | Haworth | 142,123,767 | ~5960² → 30 km | Artemis III region (2024) |
| Shoemaker | Shoemaker | ≈ 64.0 MB | 4000² → 20 km | Science context |
| Site42 | de Gerlache–Kocher massif | ≈ 64.0 MB | 4000² → 20 km | Artemis III region (2022) |

\* Inferred from byte count ÷ 4 (uncompressed Float32). Confirm with `gdalinfo` in M1.

Also listed on #78: Site20/20v2 (Leibnitz β), DM1 (Amundsen rim), SL2 (de Gerlache rim), SL3 (connecting ridge ext.), NPA–NPD, LM1–LM8.

**Coverage gap vs the Oct-2024 Artemis III list** (list itself still to be verified, task P1-04b). No #78 site DEM for **Peak near Cabeus B, Mons Mouton, Mons Mouton Plateau, Slater Plain**. Those fall back to Tier M/M+ (20–80 m), plus optional `LDEM_83S_10MPP_ADJ` windows. The UI must show their lower effective resolution.

**Related products found:**

- **#104 (Bertone et al., PSJ, doi `10.3847/PSJ/ae5b70`)**: 5 m Shape-from-Shading DEMs for the 13 Artemis III regions *announced in 2022*. Zenodo `10.5281/zenodo.17954508`, v1.0.0, 2025-12-16, CC-BY-4.0, 13 zips, 1.0–4.2 GB each (25.3 GB total). Stretch goal only.

- **#69 Lunar Polar Illumination (Mazarico)** → validation maps (§4.2).

- **#95 LOLA MOON_PA gridded**: not needed (we stay in ME).

---

## 3. NAIF SPICE Generic Kernels

**Base:** `https://naif.jpl.nasa.gov/pub/naif/generic_kernels/` (all verified 200 via `HEAD`, 2026-10-01)

| Role | Path | Bytes | Last-Modified | Coverage / notes |
|---|---|---|---|---|
| LSK | `lsk/naif0012.tls` | 5,257 | 2016-07-15 | Still current |
| SPK (planets) | `spk/planets/de440s.bsp` | 32,726,016 | 2020-12-21 | **1849-12-26 → 2150-01-22** (from `aa_summaries.txt`) |
| SPK (alt, full) | `spk/planets/de440.bsp` | 119,799,808 | 2020-12-21 | 1549-12-31 → 2650-01-25 |
| PCK (Moon orientation) | `pck/moon_pa_de440_200625.bpc` | 12,863,488 | 2021-06-26 | **1549-12-31 → 2650-01-25** (from the file's comment area) |
| PCK (constants) | `pck/pck00011.tpc` | 131,226 | 2022-12-27 | Radii, GM, etc. |
| FK (Moon frames) | `fk/satellites/moon_de440_250416.tf` | 19,478 | 2025-04-16 | ⚠️ replaces the plan's `moon_de440_*` guess. `MOON_ME` ≡ `MOON_ME_DE440_ME421` |
| PCK (Earth, future) | `pck/earth_2026_260806_2126_predict.bpc` | 19,169,280 | 2026-08-08 | Low-accuracy long-term predict to 2126; fine for 10° DSN masks |
| PCK (Earth, alt) | `pck/earth_1962_260806_2126_combined.bpc` | 31,318,016 | 2026-08-08 | Historical high-accuracy + predict |
| PCK (Earth, latest) | `pck/earth_latest_high_prec.bpc` | 5,140,480 | 2026-10-01 | ⚠️ coverage ends **2026-12-27**: not sufficient alone |
| FK (DSN topo frames) | `fk/stations/earth_topo_260814.tf` | 69,400 | 2026-08-15 | ⚠️ replaces `earth_topo_201023.tf` |
| SPK (DSN stations) | `spk/stations/earthstns_itrf93_260814.bsp` | 26,624 | 2026-08-14 | ⚠️ replaces `earthstns_itrf93_201023.bsp` |

**Minimal kernel set** (LSK + de440s + moon_pa + pck00011 + moon FK + topo FK + stations SPK + Earth predict): **65,010,769 B ≈ 62.0 MiB**. With `_combined` instead of `_predict`: 77,159,505 B ≈ 73.6 MiB.

**Notes:**

- `de442.bsp` / `de442s.bsp` (2025-02) exist, but **no matching `moon_pa_de442` PCK** is published. Stay on **DE440** so the planetary ephemeris and the lunar orientation come from the same integration. Log as D-008.

- NAIF re-issues the Earth/DSN kernels with new date stamps. Pin exact filenames + SHA-256 at M1 and mirror them to our R2; never fetch the "latest" by pattern during the event.

- Frame chain for the engine: `MOON_PA_DE440` (from BPC) → fixed rotation → `MOON_ME_DE440_ME421` (alias `MOON_ME`). Load FK + BPC together.

---

## 4. Validation Sources

### 4.1 JPL Horizons API ✅ live-tested

- **Endpoint:** `https://ssd.jpl.nasa.gov/api/horizons.api` (GET). Docs: `https://ssd-api.jpl.nasa.gov/doc/horizons.html` (doc v1.3, 2025-06; the live response signature reports **`"version":"1.2"`**, so pin and check the signature as the docs instruct).

**Verified request** (the Sun from a lunar south-pole surface point):

```
format=json
COMMAND='10'                 # Sun (Earth = '399')
OBJ_DATA='NO'
MAKE_EPHEM='YES'
EPHEM_TYPE='OBSERVER'
CENTER='coord@301'           # user-defined site on the Moon
COORD_TYPE='GEODETIC'
SITE_COORD='0,-89.5,0'       # 'E-lon deg, lat deg, alt km' (alt above 1737.4 km sphere = DEM height)
START_TIME='2028-03-14 00:00'
STOP_TIME='2028-03-14 03:00'
STEP_SIZE='1 h'
QUANTITIES='4,20'            # 4 = apparent Az/El ; 20 = observer range & range-rate
ANG_FORMAT='DEG'
EXTRA_PREC='YES'
TIME_TYPE='UT'               # set explicitly (observer tables: UT or TT)
```

All values must be URL-encoded (quotes included).

**Returned header (key lines):** `Target: Sun (10) {source: DE441}` · `Center geodetic: 0.0, -89.5, 0.0` · `Center pole/equ: MEAN_ME (high precision)` · `Center radii: 1737.4 km sphere` · `Vis. interferer: EARTH` · `Rel. light bend: Sun, EARTH` · `Atmos refraction: NO (AIRLESS)`.

**Sample output:** `2028-Mar-14 00:00  Az 325.375719503°  El −0.851865315°  Δ 0.99602651 au`.

**Behavior and limits:**

- **No numeric rate limit is published.** The docs list HTTP 503 for "temporary overloading". **Our policy:** serial requests only, ≤ 1 req/s, exponential backoff on 503, and batch with `STEP_SIZE`/`TLIST` instead of one request per epoch.

- **Errors can come back as HTTP 200** (e.g. a bad `START_TIME`), with the error text in the payload. The validator must parse `$$SOE…$$EOE` and treat a missing block as failure.

- Horizons apparent positions include light time, stellar aberration and **gravitational light bending** (≤ ~0.0005° near the Sun's limb). It uses DE441, while we use DE440. Expected residuals are ≪ 0.02°. Keep the 0.02° tolerance and report the observed max.

- Horizons flags **Earth as a visibility interferer**, which we can use to cross-check our Earth-shadow eclipse model.

### 4.2 LOLA average illumination & PSR maps (Mazarico et al. 2011 lineage, 2016 release)

**Authoritative (PDS extras, verified):** `https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/`

| File | Bytes |
|---|---|
| `avgvisib_85s_060m_201608.img` (+ `.lbl`) | 51,166,728 |
| `avgvisib_85s_060m_201608_earth.img` | 51,166,728 |
| `lpsr_85s_060m_201608.img` | 51,166,728 |
| `avgvisib_65s_240m_201608.img` | 82,432,800 |

The `75s_120m` variants exist in `…/extras/illumination/img/` (116,250,752 B each).

**Mirrors:** MIT `https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/` (verified 200, same size). PGDA non-COG TIFs work (`AVGVISIB_85S_060M_201608.TIF` = 33,994,464 B). **PGDA `*_COG.TIF` links are broken (soft 404).**

**Label facts (`AVGVISIB_85S_060M_201608`):** int16, `SCALING_FACTOR = 0.00004` (DN 25000 → 1.0), 60 m/px, 5058² px, covers 85°S fully and partially to ~82.9°S, frame DE421 ME. Derived from `LDEM_85S_060M`. The value is the **fraction of timesteps sunlit by any fraction of the solar disc**.

- ⚠️ The **simulated time span and observer height are not in the label.** Science lead: extract them from Mazarico et al. (2011) §2 / the PDS extras readme before comparing (task P1-04c).

- Also, Barker et al. (2021) report site illumination for **2024-01-01 → 2026-01-01 at 1 m and 5 m above the surface** (Site01 ROIs 4–6 best). That's a second, recent validation target that matches our mast-height feature.

- **Update 2026-10-02 (S1-05e, D-025):** this section holds no published percentages. Barker et al. (2021) Table 2 was read from the NTRS accepted manuscript: it is for seven Site 1 Regions of Interest chosen for nominal average illumination above 70 % at 1 m, and its values are the 1st percentile over 100 DEM error clones. It has no values for Shackleton or de Gerlache. The AVGVISIB label and readme do not give the simulation span or the observer height of the 2016 release (the 2011 paper's abstract says several 18.6-year cycles at 6 h for the original 240 m work). Comparison: `docs/science/METHODS.md` §7.

---

## 5. Draft `pipeline/sources.yaml`

> Draft for M1-01. `sha256` is filled on first fetch. `expected_bytes` is exact where `HEAD` returned it. The fetcher must reject a response whose `Content-Type` ≠ `expected_content_type` or whose size ≠ `expected_bytes` (see F6).

```yaml
schema_version: 1
user_agent: "sightline-spaceapps/0.1 (+repo-url)"
defaults:
  verified_at: "2026-10-01T05:30:00Z"
  license_nasa: "US Government work; no copyright in the US. NASA data use policy: credit requested."

datasets:
  # ---------------- Terrain: near tier (PGDA #78, Barker et al. 2021) ----------------
  - id: pgda78-site01-surf
    url: https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Site01_final_adj_5mpp_surf.tif
    role: terrain-near
    format: geotiff
    frame: MOON_ME_DE421
    projection: polar-stereographic-south, sphere 1737.4 km, pixel-registered
    resolution_m: 5
    expected_bytes: 40980810
    expected_size_mb: 41.0
    expected_content_type: image/tiff
    sha256: TBD
    license: ${license_nasa}
    citation: "Barker, M.K., et al. (2021) PSS 203:105119, doi:10.1016/j.pss.2020.105119"
    verified_at: ${verified_at}
    bundle: essential
  - id: pgda78-site04-surf
    url: https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/Site04_final_adj_5mpp_surf.tif
    expected_bytes: 40980806
    expected_size_mb: 41.0
    <<: &pgda78 {role: terrain-near, format: geotiff, frame: MOON_ME_DE421, resolution_m: 5, expected_content_type: image/tiff, sha256: TBD, bundle: essential, citation: "Barker et al. (2021) doi:10.1016/j.pss.2020.105119"}
  - id: pgda78-site06-surf      # Nobile rim 1
    url: https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site06/Site06_final_adj_5mpp_surf.tif
    expected_bytes: 64025603
    expected_size_mb: 64.0
    <<: *pgda78
  - id: pgda78-site07-surf      # Peak near Shackleton
    url: https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site07/Site07_final_adj_5mpp_surf.tif
    expected_bytes: 40980808
    expected_size_mb: 41.0
    <<: *pgda78
  - id: pgda78-site23-surf      # Malapert massif (no error maps/clones)
    url: https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site23/Site23_final_adj_5mpp_surf.tif
    expected_bytes: 70586804
    expected_size_mb: 70.6
    <<: *pgda78
  - id: pgda78-dm2-surf         # Nobile rim 2
    url: https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/DM2/DM2_final_adj_5mpp_surf.tif
    expected_bytes: 64025607
    expected_size_mb: 64.0
    <<: *pgda78
  - id: pgda78-haworth-surf
    url: https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Haworth/Haworth_final_adj_5mpp_surf.tif
    expected_bytes: 142123767
    expected_size_mb: 142.1
    <<: *pgda78
    bundle: optional
  - id: pgda78-site01-toterr
    url: https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Site01_final_adj_5mpp_toterr.tif
    role: terrain-uncertainty
    expected_bytes: 40980810
    expected_size_mb: 41.0
    <<: *pgda78
    bundle: optional
  - id: pgda78-site01-clones
    url_template: https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Clones/Site01_final_adj_5mpp_{n:04d}_err.tif
    n_range: [1, 16]            # of 100 available
    role: terrain-uncertainty-ensemble
    expected_size_mb_each: 41.0
    <<: *pgda78
    bundle: overnight

  # ---------------- Terrain: mid / far tiers (PGDA #90, Barker et al. 2023) ----------------
  - id: pgda90-ldem-80s-80m
    url: https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF
    role: terrain-mid
    format: cog
    frame: MOON_ME_DE421
    resolution_m: 80
    expected_bytes: 189158392
    expected_size_mb: 189.2
    expected_content_type: image/tiff
    access: full
    sha256: TBD
    license: ${license_nasa}
    citation: "Barker, M.K., et al. (2023) 'A New View of the Lunar South Pole from LOLA', PSJ (verify doi)"
    verified_at: ${verified_at}
    bundle: essential
  - id: pgda90-ldem-60s-240m
    url: https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_60S_240MPP_ADJ.TIF
    role: terrain-far
    format: cog
    resolution_m: 240
    expected_bytes: 218961039
    expected_size_mb: 219.0
    access: full                 # or cog-window: {half_width_km: 460}
    bundle: essential
  - id: pgda90-ldem-80s-20m
    url: https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF
    role: terrain-mid-plus
    format: cog
    resolution_m: 20
    expected_bytes: 2696082051
    expected_size_mb: 2696.1
    access: cog-window           # NEVER full; windows ±30 km around preset sites
    bundle: overnight
  - id: pgda90-ldem-80s-80m-err
    url: https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ_ERR.TIF
    role: terrain-uncertainty
    expected_bytes: 254808965
    expected_size_mb: 254.8
    bundle: optional

  # ---------------- Terrain fallback (PDS LOLA GDR 2017, archival) ----------------
  - id: pds-ldem-80s-80m-jp2
    url: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/jp2/ldem_80s_80m.jp2
    label_url: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/jp2/ldem_80s_80m_jp2.lbl
    role: terrain-mid-fallback
    format: jp2-lossless
    frame: MOON_ME_DE421
    expected_bytes: 29837992
    expected_size_mb: 29.8
    citation: "Smith, D.E., et al. (2010) Space Sci Rev 150:209-241; LRO-L-LOLA-4-GDR-V1.0"
    bundle: fallback
  - id: pds-ldem-75s-240m-jp2
    url: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/jp2/ldem_75s_240m.jp2
    role: terrain-far-fallback
    expected_bytes: 10766928
    expected_size_mb: 10.8
    bundle: fallback

  # ---------------- Validation maps (Mazarico et al. 2011 lineage) ----------------
  - id: pds-avgvisib-85s-60m
    url: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/avgvisib_85s_060m_201608.img
    label_url: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/avgvisib_85s_060m_201608.lbl
    role: validation-illumination
    format: pds3-img-int16
    scaling: 0.00004
    definition: "fraction of timesteps sunlit by ANY fraction of solar disc"
    expected_bytes: 51166728
    expected_size_mb: 51.2
    mirror: https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_85S_060M_201608.IMG
    citation: "Mazarico, E., et al. (2011) Icarus 211:1066-1081, doi:10.1016/j.icarus.2010.10.030"
    bundle: essential
  - id: pds-avgvisib-85s-60m-earth
    url: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/avgvisib_85s_060m_201608_earth.img
    role: validation-earth-visibility
    expected_bytes: 51166728
    expected_size_mb: 51.2
    bundle: essential
  - id: pds-lpsr-85s-60m
    url: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/lpsr_85s_060m_201608.img
    role: overlay-psr
    expected_bytes: 51166728
    expected_size_mb: 51.2
    bundle: essential

  # ---------------- SPICE (NAIF generic kernels) ----------------
  - id: naif-lsk
    url: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls
    role: spice-lsk
    expected_bytes: 5257
    expected_size_mb: 0.005
    license: "NAIF generic kernels: public, no restrictions"
    citation: "Acton, C.H. (1996) PSS 44:65-70"
    bundle: essential
  - id: naif-spk-de440s
    url: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp
    role: spice-spk-planets
    coverage: ["1849-12-26", "2150-01-22"]
    expected_bytes: 32726016
    expected_size_mb: 32.7
    citation: "Park, R.S., et al. (2021) AJ 161:105"
    bundle: essential
  - id: naif-pck-moon-pa-de440
    url: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.bpc
    role: spice-pck-moon
    coverage: ["1549-12-31", "2650-01-25"]
    expected_bytes: 12863488
    expected_size_mb: 12.9
    bundle: essential
  - id: naif-fk-moon-de440
    url: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf
    role: spice-fk-moon
    note: "MOON_ME == MOON_ME_DE440_ME421 (aligned with DE421 ME, <=3.07e-7 rad 2000-2040)"
    expected_bytes: 19478
    expected_size_mb: 0.02
    bundle: essential
  - id: naif-pck-pck00011
    url: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc
    role: spice-pck-constants
    expected_bytes: 131226
    expected_size_mb: 0.13
    bundle: essential
  - id: naif-pck-earth-predict
    url: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/earth_2026_260806_2126_predict.bpc
    role: spice-pck-earth
    coverage_note: "low-accuracy long-term predict to 2126 (needed: earth_latest_high_prec ends 2026-12-27)"
    expected_bytes: 19169280
    expected_size_mb: 19.2
    bundle: essential
  - id: naif-fk-earth-topo
    url: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/stations/earth_topo_260814.tf
    role: spice-fk-dsn
    expected_bytes: 69400
    expected_size_mb: 0.07
    bundle: essential
  - id: naif-spk-dsn-stations
    url: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/stations/earthstns_itrf93_260814.bsp
    role: spice-spk-dsn
    expected_bytes: 26624
    expected_size_mb: 0.03
    bundle: essential

  # ---------------- External validation API ----------------
  - id: jpl-horizons-api
    url: https://ssd.jpl.nasa.gov/api/horizons.api
    role: validation-ephemeris
    kind: api
    api_signature_version: "1.2"
    rate_policy: {max_rps: 1, concurrency: 1, backoff_on: [503]}
    error_mode: "errors may return HTTP 200; require $$SOE/$$EOE block"
    citation: "JPL Horizons On-Line Ephemeris System, NASA/JPL SSD"
    verified_at: ${verified_at}

  # ---------------- Stretch ----------------
  - id: zenodo-sfs-a3clr22-peak-near-shackleton
    url: https://zenodo.org/records/17954508/files/A3CLR22_8_Peak_Near_Shackleton.zip
    role: terrain-sfs-stretch
    expected_size_mb: 1297.4
    license: CC-BY-4.0
    citation: "Bertone, S., et al., PSJ, doi:10.3847/PSJ/ae5b70; data doi:10.5281/zenodo.17954508"
    bundle: stretch
    verify_url: true             # direct file URL pattern not yet HEAD-checked
```

> YAML notes: the `<<:` merge keys keep the draft compact, and `${…}` marks a value taken from `defaults` (it is not real YAML interpolation). When M1 writes the real file, expand both into explicit fields so the pydantic schema can validate every entry.

---

## 6. Network Reality Check (critical for M0-02)

Measured from this machine on 2026-10-01 (single sample, 8 MB range reads, 90 s cap):

| Host | Throughput observed |
|---|---|
| Cloudflare (speed test) | **~5.06 MB/s** |
| NAIF (`naif.jpl.nasa.gov`) | ~35 KB/s |
| PDS Geosciences (`wustl.edu`) | ~19 KB/s |
| MIT imbrium | ~8 KB/s |
| PGDA (`gsfc.nasa.gov`) | ~2.7 KB/s (plus intermittent connection resets) |
| GitHub (archive download) | ~58 KB/s |

**Interpretation:** the local link is fast, but long-haul routes to US origins are throttled. At ~20–35 KB/s, the ~945 MB essential bundle would take **~8–13 hours**, which breaks the H+0 → H+8 walking-skeleton gate.

**Mitigations, in priority order:**

1. **Cloud relay at H+0:** start a US-region cloud VM (or CI runner). It fetches from the origins at datacenter speed, verifies SHA-256 and pushes to our Cloudflare R2 bucket. Team laptops then pull from R2 at ~5 MB/s (945 MB in ≈ 3–4 min). This also produces the immutable mirror CLAUDE.md §7 asks for.

2. **Ask the Local Lead (P0-02b) to approve pre-downloading raw public data,** with no processing. This is now high priority.

3. **Re-measure from the venue network** during P0-09. GitHub at 58 KB/s also means `git push/pull` and possibly package installs may crawl, so test `pnpm install` and `uv sync` speed there too.

4. Fetcher requirements: `User-Agent` header (PGDA reset connections without one), resumable range downloads, retries with backoff, and content-type/size/hash checks.

---

## 7. Open Items (added to REMAINING.md)

| ID | Item |
|---|---|
| P1-04a | `gdalinfo /vsicurl/…` on PGDA #90/#78 files: confirm COG tiling, dtype, nodata, geotransform |
| P1-04b | Verify the Oct-2024 Artemis III region list and coordinates from NASA's source; map each region to a DEM tier |
| P1-04c | Extract the AVGVISIB simulation time span and observer height from Mazarico et al. 2011 / readme |
| P1-04d | Verify the Barker et al. 2023 PSJ citation/DOI for PGDA #90 |
| P1-04e | `HEAD`-check the Zenodo direct-file URL pattern |
| P0-12 | Network plan: cloud relay account (US region) + R2 bucket; venue throughput test |
