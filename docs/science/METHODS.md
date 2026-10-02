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
`getHorizon` and `probeLit` therefore answer only where a terrain horizon exists and refuse
elsewhere (`NotAvailableError`, S1-05); `getTimeline` and `findWindows` refuse everywhere until
M2-08. The mock engine still answers them, labelled SIMULATED.

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

## 6. Terrain horizon (S1-05)

`sightline horizon` computes, for one observer, the highest elevation the ground reaches in each of
1440 azimuths (0.25°, the contract's `HORIZON_AZIMUTH_SAMPLES`), for 13 mast heights from 0 to 20 m,
and writes `packages/engine/src/data/horizon_shackleton-rim.json` (205 KB). The engine loads it; it
does not recompute it. Today there is one observer: the Shackleton Rim catalog entry (§4), which is
the centre of the PGDA Site04 tile.

**Method.**

1. Rays leave the observer along great circles of the 1737.4 km sphere. Azimuth is clockwise from
   local north, with north towards increasing latitude, as `azElFromVector` defines it. The
   pipeline test builds the rays from 3-D east and north vectors independent of its own formula,
   and an engine test checks the engine's `enuBasis` equals those vectors.
2. Ground points are projected to the DEMs' south-polar stereographic plane (`rho = 2R tan((90° +
   lat)/2)`, `x = rho sin(lon)`, `y = rho cos(lon)`); this agrees with PROJ to 1e-9 m on 2,000
   random points in the CRS of both files, and `read_dem` refuses a file whose CRS differs.
3. Height is sampled bilinearly. Near field: the 5 m site tile (`pgda78-site04-surf`), every 5 m to
   12 km. Far field: the 80 m south-polar map (`pgda90-ldem-80s-80m`), every 80 m to 300 km, used
   only where the 5 m tile has no data. Terrain beyond 300 km or outside both rasters is not seen,
   so the mask is a lower bound on the true horizon there.
4. Elevation of a ground point `z` above the sphere at ground distance `s`, seen from an observer
   `h` above the sphere, with `a = s / R`: `atan2((z − h) − (R + z)·2 sin²(a/2), (R + z) sin a)`.
   This is exact for the sphere. It equals the textbook form `atan((z − h)/s) − s/(2R)` to
   O(a³); a test compares the two on random terrain over 12 azimuths and they agree within 5e-5 rad
   (the difference is the horizontal distance `(R+z) sin a` against `s`). The `(z − h)` form avoids
   subtracting two numbers near 1.7e6 m, which lost digits at small `a` (found by a test that
   expected `−a/2` and got 1.7e-12 rad off).
5. The mask is the maximum over the ray. Between stored mast heights the engine interpolates
   linearly, and between azimuth bins likewise (wrapping at north).

**What the tests establish.** On synthetic terrain with analytic answers (CI): a DEM of zeros (the
sphere) gives the closed form, and from a 2 m mast the mask equals the flat-horizon dip
`acos(R/(R+h))` that §3 uses without terrain; a 100 m wall 1 km away gives `atan` of its height
over its distance; a bump due east peaks at azimuth 90° and one due north peaks across the 359°/0°
seam; a bowl gives `atan(z_rim/ρ_rim)` from its floor and a lower, non-positive mask from the rim
plateau; a taller mast never raises the mask (Δθ ≤ 0 at every azimuth); no data in a direction is an
error, not a horizon. On the real tile (skipped in CI, which does not download the DEMs): the
highest point of the tile sees a lower mean horizon than the lowest point, and the file regenerates
from the DEMs.

**Measured properties of the Shackleton Rim file** (mast 0, degrees): minimum 0.089, mean 13.0,
maximum 32.7. The terrain rises about 31 m within 50 m to the east and falls the same to the west,
so the tile centre sits on a roughly 32° crater wall, not on the rim crest. For 2026, hourly, at a
2 m mast, the engine puts any part of the Sun above the mask 11.0% of the time (58.0% to 60.1%
above a flat horizon) and Earth above it 0% of the time (45% above a flat horizon). These are
engine outputs, **not validated** against published illumination or visibility maps (M2-13).

**Known limits.**

- **Mast interpolation.** Exact at the stored heights, which include the default 2 m. Between them
  the error is at most 2.2e-5° wherever the mask is below 3° (the only place the Sun can be at
  these latitudes) and up to 0.31° on steep-wall azimuths where the mask is above 3°. The
  controlling ground point there is a few metres away, so the mask drops by degrees per metre of
  mast; a finer grid does not shrink the worst case. A test asserts the first figure.
- **Ray spacing.** At 0.25° a ray pair is 35 m apart at 8 km and 1.3 km apart at 300 km, so a narrow
  ridge between rays can be missed. A finer ray set, or per-bin maxima, would remove this.
- **Straight horizon across the Sun's disk.** The mask is read at the Sun's centre azimuth and used
  as a straight line across the disk (radius 0.27°).
- **The 5 m and 80 m rasters** agree about the ground under the observer to 0.8 m (769.68 m against
  770.49 m); nothing was done to blend the two beyond the hand-over at the tile's edge.
- **One site.** Connecting Ridge and de Gerlache Rim have DEMs on disk but no mask yet.

