# Methods — SIGHTLINE

How the numbers are made. Written for the people who will check them. Each section says what is
validated and what is not. Decisions behind these choices: `docs/progress/DECISIONS.md`.

**Status (2026-10-02):** time, lunar frames, the Sun/Earth/DSN ephemeris and `getSunEarth` are
real and checked against SPICE. The terrain horizon, illumination percentages, communication
windows and the Horizons comparison are not built yet.

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
   `elev_m`). LT+S is evaluated at the Moon's centre, not at the site; §5 shows that costs less
   than 3e-5°.
3. Azimuth clockwise from local north in [0, 2π); elevation above the local tangent plane.
   **Pole convention:** the local basis stays finite at ±90° and uses the longitude given, so at the
   exact pole "north" is the horizontal direction along that meridian (grid north).
4. **Horizon: terrain is not modelled.** The horizon is flat ground at the site's own height. From
   the top of a mast of height `h` over ground radius `R` it lies below the tangent plane by
   `acos(R / (R + h))` (0.0869° for 2 m, 0 for no mast).
5. **Sun disk fraction:** the part of a circular disk above a straight horizon (circular-segment
   area), `1/2 + (d·√(1−d²) + asin d)/π` with `d = (elevation − horizon) / angular radius`. The
   angular radius is `asin(695,700 km / distance)`, with the radius taken from `pck00011.tpc`.
6. **Earth visible:** Earth's centre is above that horizon (plus an optional margin).
7. **DSN visible:** Earth is visible and at least one of the three complexes sees the site above
   its own horizon (optional mask, default 0°). A station's vertical is taken as its geocentric
   direction, which differs from the geodetic vertical by up to 0.19°.

**What this is not.** Without terrain, "the Sun is above the flat horizon" is not "the site is lit".
`getHorizon`, `getTimeline`, `findWindows` and `probeLit` therefore refuse to answer
(`NotAvailableError`, task M2-05) instead of returning flat-ground percentages. The mock engine
still answers them, labelled SIMULATED.

## 4. The site catalog

`sightline sites` writes `packages/engine/src/data/sites.json` from the downloaded PGDA #78 site
DEMs (Barker et al. 2021). Each site is the **centre of its 16 km tile**, computed from the file's
georeference, with the height sampled from the 5 m DEM at that point (the mean of the four pixels
around the centre). Shackleton Rim is Site04, Connecting Ridge is Site01 and de Gerlache Rim is
Site11, as PGDA names them. A tile centre is a fact we can reproduce from the file; it is not a
landing point or a rim point (D-019, option A). Longitudes are stored east in [-180, 180].

## 5. Validation

Parity fixtures in `fixtures/golden/` are written only by `sightline golden`. Tolerances were fixed
before the first run and are not to be loosened to make a test pass.

| Quantity | Reference | Tolerance | Worst gap measured (144 cases, 4 sites, with and without a 2 m mast) |
|---|---|---|---|
| UTC to ET, ET to UTC | SPICE `str2et`, `et2utc` (15 cases, three leap seconds) | 1 µs; exact string | within the tolerance in every case |
| Sun azimuth and elevation | SPICE `spkcpo`, observer fixed on the Moon, LT+S at the observer | 1e-4° | 2.1e-8° |
| Earth azimuth and elevation | the same | 1e-4° | 2.7e-5° |
| Sun disk fraction | the same direction, same formula in Python | (2/π)·1e-4°/r_sun, about 2e-4 | 6.4e-9 |
| DSN elevation of the site | SPICE `spkcpt` in each station's topocentric frame | 0.25° | 0.189° |

The Sun and Earth references come from a different SPICE route than the engine's (observer on the
Moon versus Moon-centre minus site vector), so the agreement also tests that simplification. The
0.25° DSN tolerance is the 0.19° geodetic-versus-geocentric gap plus margin; the measured gap
(0.189°) is that effect, not noise.

Seasonal checks on the real file (2026, three sites): the Sun's elevation reaches ±1.77°
(Shackleton Rim), ±2.05° to 2.11° (Connecting Ridge) and ±2.8° (de Gerlache Rim), which is the
lunar axial tilt of 1.54° plus each site's colatitude; the Sun circles the horizon 12 or 13 times
(one lunar day each); the month-averaged elevation changes sign on 2026-02-27 and 2026-08-23 (the
draconic cycle); Earth stays within about 10° of the horizon. With a 0° mask a DSN link exists
whenever Earth is above the horizon (the best complex is never below about 8.7°); with a 10° mask
there are short gaps, about 0.5% of the Earth-up time.

**Not validated yet:** a comparison with JPL Horizons (task S1-04); any terrain-dependent result;
the Earth orientation predict kernel's accuracy beyond its use for station directions; the engine
in a browser worker (the checks above run in Node).
