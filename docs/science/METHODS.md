# Methods — SIGHTLINE

How the numbers are made. Written for the people who will check them. Each section says what is
validated and what is not. Decisions behind these choices: `docs/progress/DECISIONS.md`.

**Status (2026-10-02):** time, lunar frames, the Sun/Earth/DSN ephemeris and `getSunEarth` are
real and checked against SPICE and against JPL Horizons. The terrain horizon, illumination
percentages and communication windows are not built yet.

---

## 1. Frames and time

- **Body-fixed frame:** `MOON_ME`, the Mean Earth / Polar Axis frame, defined by
  `moon_de440_250416.tf` on top of `moon_pa_de440_200625.bpc` (D-008). It is the frame of the LOLA
  DEMs (DE421 ME, within 3.07e-7 rad). `MOON_PA` and `IAU_MOON` are never used for terrain
  geometry. x points to 0° N 0° E, z to the mean pole, y east.
- **Reference sphere:** radius 1737.4 km (LOLA). Latitude is planetocentric, longitude east-positive.
  A site is `(lat, lon, ground height)`; its position is `(1737.4 km + height)` along the local up.
- **Time:** `epoch_et` is TDB seconds past J2000. UTC to ET follows the leap-second kernel
  `naif0012.tls`: `ET = TAI + 32.184 + K·sin(E)`, `E = M + EB·sin(M)`, `M = M0 + M1·TT`. The table
  (28 leap seconds, 1972 to 2017) and the constants are read from the kernel by `sightline ephem`
  into `packages/engine/src/data/leapseconds.json`. UTC before 1972 is refused. Second 60 is
  accepted only on the day before a leap second.
- **Where the J2000-to-MOON_ME rotation happens:** in the pipeline, with SPICE (`sightline ephem`),
  not in the browser. The engine receives states already in `MOON_ME`.

## 2. The ephemeris file

`sightline ephem` samples SPICE once and writes `ephemeris_2026_3600s.bin` plus a JSON header
(`EphemerisHeader` in `packages/contracts`, with extra fields for the layout and the Sun radius).

- **Samples:** 8,761 records, one per hour, from 2026-01-01T00:01:00 UTC to 2027-01-01T00:01:00 UTC.
  The first sample is one minute in because the Earth orientation kernel starts at
  2026-01-01T00:00:00 UTC and an apparent state looks back by the light time (about 1.3 s).
- **Layout:** little-endian float64, record-major. Per record, per body in the header's order, six
  values: x, y, z in km and vx, vy, vz in km/s, in `MOON_ME`.
- **Bodies:** `SUN` and `EARTH` are apparent states (**LT+S**, light time and stellar aberration)
  relative to the Moon's centre. `DSN_GOLDSTONE`, `DSN_CANBERRA` and `DSN_MADRID` are the apparent
  states of DSS-14, DSS-43 and DSS-63 relative to the Earth's centre (station minus Earth).
- **Kernels:** `naif0012.tls`, `de440s.bsp`, `moon_pa_de440_200625.bpc`, `pck00011.tpc`,
  `moon_de440_250416.tf`, `earth_2026_260806_2126_predict.bpc`, `earth_topo_260814.tf`,
  `earthstns_itrf93_260814.bsp`; every file is checked against a pinned SHA-256 before use.
- **Interpolation (engine):** cubic Hermite between records, using the stored velocities. The
  stored velocities come from SPICE, so the interpolation error is far below the tolerances in §5.
- **Size and range:** 2.1 MB, one year. This is a sample small enough to commit. The 2026 to 2032
  file at 10-minute steps is published later (M1-05, M1-08).

## 3. What `getSunEarth(epoch_et, location, mast)` computes

1. The site vector: `(1737.4 km + ground height + mast)` along the local up at `(lat, lon)`.
2. The direction to the Sun and to the Earth: the Moon-centre apparent state minus the site vector.
   This keeps topocentric parallax for both bodies (about 0.26° for Earth at the pole, and a
   2 km rim height alone moves Earth's direction by about 3e-4°, which is why `Location` has
   `elev_m`). LT+S is evaluated along the line of sight from the Moon's centre, not from the site.
   Measured against SPICE with the observer on the site (S1-04): the geometry is exact (0° with
   no correction), light time costs at most 3.1e-6° for Earth, and stellar aberration brings the
   total to 2.7e-5° for Earth (2.3e-8° for the Sun). The size is what you would expect if the
   aberration shift (about 1e-4 rad) is applied along the centre's line of sight rather than the
   site's: the two lines of sight differ by Earth's parallax of 0.26° (4.5e-3 rad), giving about
   1e-4 × 4.5e-3 rad = 2.6e-5°, while the Sun's parallax of 1.2e-5 rad makes the same effect
   negligible. We measured that aberration is responsible; we did not separately test that
   mechanism.
3. Azimuth clockwise from local north in [0, 2π); elevation above the local tangent plane.
   **Pole convention:** the local basis stays finite at ±90° and uses the longitude given, so at the
   exact pole "north" is the horizontal direction along that meridian (grid north).
4. **Horizon.** Where a terrain horizon exists (the Shackleton Rim tile centre only, §6) the mask
   at the body's azimuth is the horizon; elsewhere it is flat ground at the site's own height. From
   the top of a mast of height `h` over ground radius `R` the flat horizon lies below the tangent
   plane by `acos(R / (R + h))` (0.0869° for 2 m, 0 for no mast).
5. **Sun disk fraction:** the part of a circular disk above a straight horizon (circular-segment
   area), `1/2 + (d·√(1−d²) + asin d)/π` with `d = (elevation − horizon) / angular radius`. The
   angular radius is `asin(695,700 km / distance)`, with the radius taken from `pck00011.tpc`.
6. **Earth visible:** Earth's centre is above that horizon at Earth's azimuth (plus an optional
   margin).
7. **DSN visible:** Earth is visible and at least one of the three complexes sees the site above
   its own horizon (optional mask, default 0°). A station's vertical is taken as its geocentric
   direction, which differs from the geodetic vertical by up to 0.19°.

**What this is not.** On the flat horizon, "the Sun is above it" is not "the site is lit".
`getHorizon`, `probeLit` and `getTimeline` therefore answer only where a terrain horizon exists (the
three catalog sites, §6) and refuse elsewhere (`NotAvailableError`); `findWindows` refuses
everywhere until M2-09. The mock engine still answers them, labelled SIMULATED.

## 4. The site catalog

`sightline sites` writes `packages/engine/src/data/sites.json` from the downloaded PGDA #78 site
DEMs (Barker et al. 2021), each at a position that can be reproduced from the file, with the height
read from the 5 m DEM there. Shackleton Rim is Site04, Connecting Ridge is Site01 and de Gerlache
Rim is Site11, as PGDA names them. Longitudes are stored east in [-180, 180]. None is a landing
point.

- **Connecting Ridge and de Gerlache Rim** are the **centres of their 16 km tiles**, computed from
  the file's georeference, with the height the mean of the four pixels around the centre (D-019,
  option A).
- **Shackleton Rim** is the **crest of the rim ridge** in its tile: the highest 5 m pixel more than
  1 km from the tile edge, with that pixel's own height (D-024, the team lead's decision of
  2026-10-02). The tile centre it replaced is on a steep crater wall: the terrain rises 31 m within
  50 m to the east of it. The crest is 1.9 km from that centre, at 1739.1 m against 769.7 m. The
  1 km margin keeps the search off a ridge that continues off the tile (the highest pixel of the
  whole tile, 1805 m, is on its edge) and starts every ray on 5 m data. The same pixel is the best
  one for a 1 km and a 2 km margin, so it is an interior peak, not an edge effect.

## 5. Validation

Parity fixtures in `fixtures/golden/` are written only by `sightline golden`. Tolerances were fixed
before the first run and are not to be loosened to make a test pass.

| Quantity | Reference | Tolerance | Worst gap measured (144 cases, 4 sites, with and without a 2 m mast) |
|---|---|---|---|
| UTC to ET, ET to UTC | SPICE `str2et`, `et2utc` (15 cases, three leap seconds) | 1 µs; exact string | within the tolerance in every case |
| Sun azimuth and elevation | SPICE `spkcpo`, observer fixed on the Moon, LT+S at the observer | 1e-4° | 2.1e-8° |
| Earth azimuth and elevation | the same | 1e-4° | 2.7e-5° |
| Sun disk fraction | the same direction, same formula in Python | (2/π)·1e-4°/r_sun, about 2e-4 | 6.9e-9 |
| DSN elevation of the site | SPICE `spkcpt` in each station's topocentric frame | 0.25° | 0.189° |

The Sun and Earth references come from a different SPICE route than the engine's (observer on the
Moon versus Moon-centre minus site vector), so the agreement also tests that simplification. The
0.25° DSN tolerance is the 0.19° geodetic-versus-geocentric gap plus margin; the measured gap
(0.189°) is that effect, not noise.

Seasonal checks on the real file (2026, measured in S1-03 at the three tile centres and not repeated at the Shackleton crest): the Sun's elevation reaches ±1.77°
(Shackleton Rim), ±2.05° to 2.11° (Connecting Ridge) and ±2.8° (de Gerlache Rim), which is the
lunar axial tilt of 1.54° plus each site's colatitude; the Sun circles the horizon 12 or 13 times
(one lunar day each); the month-averaged elevation changes sign on 2026-02-27 and 2026-08-23 (the
draconic cycle); Earth stays within about 10° of the horizon. With a 0° mask a DSN link exists
whenever Earth is above the horizon (the best complex is never below about 8.7°); with a 10° mask
there are short gaps, about 0.5% of the Earth-up time.

### 5.1 Against JPL Horizons (S1-04)

An independent implementation: DE441 (the engine uses DE440), Horizons' own `MEAN_ME` lunar
orientation, light bending included. `sightline horizons` asks for the Sun (10) and Earth (399) from
each site (`CENTER='coord@301'`, geodetic coordinates on the 1737.4 km sphere, `QUANTITIES='4'`,
UT, no atmosphere), 50 epochs evenly spread from 2026-01-02 to 2026-12-30, at the site's ground
height with no mast. Horizons echoes how it read the site, the Moon's shape and orientation; the
command refuses to continue if the echo differs from what was asked. Answers are cached under
`data/raw/horizons/`, requests are serial and at least 1 s apart, and each request carries at most 25
times (50 times made the URL 2,249 characters long and the gateway answered HTTP 502; 25 worked).

Acceptance tolerance: **0.02°** on every case, written in DATA_VERIFICATION_REPORT §4.1 on
2026-10-01 before any residual existed. Engine minus Horizons, 3 sites × 50 epochs × 2 bodies = 300
rows, degrees (`fixtures/golden/horizons_residuals.json`):

| | Azimuth on the sky: max / mean / rms | Elevation: max / mean / rms | Separation: max / mean / rms |
|---|---|---|---|
| Sun | 3.2e-8 / -1.8e-9 / 1.4e-8 | 3.6e-9 / -9.1e-11 / 1.8e-9 | **3.3e-8** / 1.0e-8 / 1.4e-8 |
| Earth | 5.9e-7 / -3.4e-7 / 3.6e-7 | 2.6e-5 / +3.1e-7 / 1.8e-5 | **2.6e-5** / 1.6e-5 / 1.8e-5 |

The largest gap in any case is 2.65e-5° (the Earth), 755 times inside the tolerance. Horizons against
SPICE (the pipeline's own route) differs by at most 1.0e-8° for the Sun and 4.8e-7° for the Earth,
so the Earth gap is the engine's stellar-aberration approximation (§3), not a disagreement between
Horizons and SPICE. The two negative controls in the test show it can fail: a 10-minute time shift
and a 0.01° longitude error both break the tolerance.

**A mistake worth recording.** The first version of the separation used `acos(u·v)`. A cosine within
one rounding step of 1.0 cannot give an angle below 8.5377e-7° (`acos(1−2⁻⁵³)`), so every smaller
difference was reported as exactly that, and the same "maximum" appeared in three comparisons and for
both bodies. The statistics above use `atan2(|u×v|, u·v)`, which resolves angles down to 1e-12°.

**Not validated yet:** any terrain-dependent result;
the Earth orientation predict kernel's accuracy beyond its use for station directions; the engine
in a browser worker (the checks above run in Node).

## 6. Terrain horizon and timeline (S1-05)

`sightline horizon` computes, for each catalog site, the highest elevation the ground reaches in
each of 1440 azimuths (0.25°, the contract's `HORIZON_AZIMUTH_SAMPLES`) and writes
`packages/engine/src/data/horizon_<site>.json` (83 to 256 KB). The engine loads the files; it does
not recompute them.

**Method.**

1. Rays leave the observer along great circles of the 1737.4 km sphere. Azimuth is clockwise from
   local north, with north towards increasing latitude, as `azElFromVector` defines it. The
   pipeline test builds the rays from 3-D east and north vectors independent of its own formula,
   and an engine test checks the engine's `enuBasis` equals those vectors.
2. Ground points are projected to the DEMs' south-polar stereographic plane (`rho = 2R tan((90° +
   lat)/2)`, `x = rho sin(lon)`, `y = rho cos(lon)`); this agrees with PROJ to 1e-9 m on 2,000
   random points in the CRS of both files, and `read_dem` refuses a file whose CRS differs.
3. Height is sampled bilinearly. Near field: the site's 5 m tile, every 5 m to 12 km. Far field: the
   80 m south-polar map (`pgda90-ldem-80s-80m`), every 80 m to 300 km, used only where the 5 m tile
   has no data. Terrain beyond 300 km or outside both rasters is not seen, so the mask is a lower
   bound on the true horizon there.
4. For a ground point at height `z` above the sphere and distance `s` (`a = s/R`, `H = (R+z) sin a`),
   seen from an observer `g + h` above the sphere (`g` the ground under the mast, `h` the mast),
   the tangent of its elevation is exactly `A − h·B` with `A = ((z − g) − (R+z)·2 sin²(a/2)) / H`
   and `B = 1/H`. The first form is exact for the sphere and equals the textbook
   `atan((z − g − h)/s) − s/(2R)` to O(a³) (a test compares them within 5e-5 rad). The
   `(z − g)` form avoids subtracting two numbers near 1.7e6 m, which lost digits at small `a`.
5. **The mask at any mast height is `atan(max over ground points of A − h·B)`**: the upper envelope
   of lines in `h`. For each azimuth the file keeps only the lines that are highest somewhere on
   `h ∈ [0, 20 m]` (the contract's maximum): 2 to 6 per azimuth, 2,500 to 8,800 per site. So the
   mast dependence is exact, not interpolated. (A first version stored masks at 13 mast heights
   and interpolated; at Connecting Ridge and de Gerlache Rim it was off by 0.1° to 0.7° between
   stored heights in the Sun's band, because ground 5 to 30 m away dominates there. It was replaced.)
   Between azimuth bins the engine interpolates linearly, wrapping at north.

**What the tests establish.** On synthetic terrain with analytic answers (CI): a DEM of zeros (the
sphere) gives the closed form, and from a 2 m mast the mask equals the flat-horizon dip
`acos(R/(R+h))` that §3 uses without terrain; a 100 m wall 1 km away gives `atan` of its height
over its distance; a bump due east peaks at azimuth 90° and one due north peaks across the 359°/0°
seam; a bowl gives `atan(z_rim/ρ_rim)` from its floor and a lower, non-positive mask from the rim
plateau; a taller mast never raises the mask (Δθ ≤ 0 at every azimuth); the stored envelope equals a
brute-force mask at heights nobody stored; the envelope of random lines equals their maximum
everywhere; no data in a direction is an error, not a horizon; a brute-force scalar implementation
agrees within 5e-5 rad. On the real tiles (skipped in CI, which does not download the DEMs): the
highest point of the Site04 tile sees a lower mean horizon than the lowest, each file regenerates
from the DEMs, and the committed envelope equals a fresh brute-force mask at ten mast heights for
all three sites.

**Timeline** (`getTimeline`). For each step from `start_et` to `end_et` inclusive, `computeSky`
runs with the site's mask at the profile's mast height. A step is *lit* when the Sun's centre is at
least `min_sun_elev_rad` above the local horizontal (default 0) and the disk fraction above the mask
is positive and at least `min_sun_disk_fraction`; it has a *link* when Earth clears the mask by
`min_earth_elev_rad` and at least one DSN complex sees the site above `dsn_min_elev_rad`. A night
is a maximal run of unlit steps and a day a maximal run of lit steps, each counted as steps ×
`step_s`, a run cut by the end of the range counting as far as it goes. `probeLit` says lit for any
sliver of the disk; with `min_sun_elev_rad` at −90° the timeline agrees with it step for step
(tested), but with the default profile the timeline is stricter.

**Measured for the three sites** (2026, hourly, default profile: 2 m mast, 50 h battery; engine
output, **not validated** against published illumination or visibility maps, M2-13):

| Site | Lit | Link | Lit and link | Longest night | Longest day | Nights over 50 h |
|---|---|---|---|---|---|---|
| Shackleton Rim (crest) | 48.9 % | 49.9 % | 25.2 % | 185.8 d | 115.8 d | 1 |
| Connecting Ridge (tile centre) | 35.2 % | 39.8 % | 11.8 % | 146.3 d | 23.8 d | 9 |
| de Gerlache Rim (tile centre) | 36.6 % | 53.8 % | 21.4 % | 114.7 d | 25.6 d | 11 |

The long runs are the polar seasons: the Sun's centre is above the horizontal for roughly half of a
year and below it for the rest. With no mast the figures differ a lot at Connecting Ridge (lit
24.8 %, link 22.1 %): the ground within about 30 m of the observer, which the 5 m DEM resolves in
a few pixels, sets the mask there. The old Shackleton tile centre (on the crater wall, since
replaced) gave any-part-of-the-disk light 10.95 % of 2026 and Earth 0 %.

**Known limits.**

- **Near-field resolution.** At small masts the mask is set by ground a few pixels from the
  observer, so it is only as good as the 5 m DEM there. The lander's own footprint is not modelled.
- **Ray spacing.** At 0.25° a ray pair is 35 m apart at 8 km and 1.3 km apart at 300 km, so a narrow
  ridge between rays can be missed. A finer ray set, or per-bin maxima, would remove this.
- **Straight horizon across the Sun's disk.** The mask is read at the Sun's centre azimuth and used
  as a straight line across the disk (radius 0.27°).
- **The 5 m and 80 m rasters** agree about the ground under the observer to 0.8 m at the tile
  centres and 3.1 m at the Shackleton crest (an 80 m map smooths a peak); nothing was done to blend
  the two beyond the hand-over at the tile's edge.
- **Sun and Earth at azimuth, not area.** Earth's disk (about 1.9° across) is treated as a point.
