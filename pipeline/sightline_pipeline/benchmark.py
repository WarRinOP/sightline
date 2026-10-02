"""Compare the engine's terrain illumination with published results (S1-05e, D-025).

Benchmark A: Barker et al. (2021) Table 2. Their method (section 5) is reproduced as closely as the
data allow: hourly steps from 2024-01-01 to 2026-01-01, the Sun's disk divided horizontally at the
horizon elevation at the disk centre's azimuth, a 5 m / 80 m nested terrain. It is run at the seven
Regions of Interest of Site 1 at 1 m and 5 m above the nominal DEM.

Benchmark B: the PDS AVGVISIB map (Mazarico et al. lineage): our any-part-of-the-disk lit fraction
at random points against the map's value at the pixel containing each point.

The criteria are in DECISIONS D-025 and were fixed before the first run.
"""

import json
import math
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import numpy.typing as npt
import spiceypy

from sightline_pipeline import __version__
from sightline_pipeline.ephem import ABCORR, FRAME, epoch_grid
from sightline_pipeline.horizon import (
    FAR_DATASET,
    MOON_RADIUS_M,
    Dem,
    horizon_masks,
    project,
    read_dem,
)
from sightline_pipeline.kernels import loaded_kernels
from sightline_pipeline.sites import SITE_SPECS
from sightline_pipeline.sources import DEFAULT_ENGINE_DATA_DIR, Sources

F64 = npt.NDArray[np.float64]

SUN_RADIUS_KM = 695_700.0  # pck00011.tpc, the value the engine uses
MOON_RADIUS_KM = MOON_RADIUS_M / 1000.0
BARKER_START_UTC = "2024-01-01T00:00:00"
BARKER_END_UTC = "2026-01-01T00:00:00"
BARKER_PATH = Path(__file__).resolve().parents[1] / "benchmarks" / "barker2021_table2.json"
AVGVISIB_DATASET = "pds-avgvisib-85s-60m"
BARKER_DATASET = "ntrs-barker2021-pdf"
DEFAULT_BENCHMARK_PATH = (
    Path(__file__).resolve().parents[2] / "fixtures" / "golden" / "illumination_benchmark.json"
)

# Criteria fixed before the first run (DECISIONS D-025).
A1_FLOOR_MARGIN_PP = 2.0
A2_CEILING_MARGIN_PP = 5.0
A3_MEDIAN_AT_1M_PCT = 70.0
B_RHO_ALL = 0.8
B_RHO_EACH_TILE = 0.7
B_POINTS_PER_TILE = 300
B_EDGE_MARGIN_M = 1000.0
B_RAYS = 360  # 1 degree rays for the 900 map points; the site masks use 1440
# Assumed linear limb-darkening coefficient for the sensitivity run only; not the paper's law.
LIMB_DARKENING_U = 0.6


# ---------------------------------------------------------------------------------------------
# geometry
# ---------------------------------------------------------------------------------------------


def unproject(x_m: F64, y_m: F64) -> tuple[F64, F64]:
    """Inverse of `horizon.project`: latitude and longitude (radians) of a plane point."""
    rho = np.hypot(x_m, y_m)
    return -np.pi / 2 + 2.0 * np.arctan(rho / (2.0 * MOON_RADIUS_M)), np.arctan2(x_m, y_m)


def sun_series(
    raw_dir: Path, sources: Sources, start_utc: str, end_utc: str, step_s: int
) -> tuple[F64, F64]:
    """Epochs (ET, both ends included) and the Sun minus the Moon's centre in MOON_ME, km, with
    light time and stellar aberration (LT+S) as the engine's ephemeris stores it. It needs only
    the Sun, so it works before 2026, where the Earth orientation kernel does not reach."""
    with loaded_kernels(raw_dir, sources):
        ets = epoch_grid(start_utc, end_utc, step_s)
        out = np.empty((ets.size, 3))
        for i, t in enumerate(ets):
            state, _lt = spiceypy.spkezr("SUN", float(t), FRAME, ABCORR, "MOON")
            out[i] = state[:3]
    return ets, out


def _enu(lat_rad: float, lon_rad: float) -> tuple[F64, F64, F64]:
    sl, cl, so, co = math.sin(lat_rad), math.cos(lat_rad), math.sin(lon_rad), math.cos(lon_rad)
    return (
        np.array([cl * co, cl * so, sl]),
        np.array([-so, co, 0.0]),
        np.array([-sl * co, -sl * so, cl]),
    )


def sun_az_el(sun_km: F64, lat_rad: float, lon_rad: float, height_m: float) -> tuple[F64, F64, F64]:
    """Azimuth (clockwise from north, [0, 2pi)), elevation and angular radius of the Sun from a
    point `height_m` above the sphere."""
    up, east, north = _enu(lat_rad, lon_rad)
    v = sun_km - (MOON_RADIUS_KM + height_m / 1000.0) * up
    dist = np.linalg.norm(v, axis=1)
    az = np.arctan2(v @ east, v @ north) % (2 * np.pi)
    az = np.where(az >= 2 * np.pi, 0.0, az)
    el = np.arcsin((v @ up) / dist)
    return az, el, np.arcsin(SUN_RADIUS_KM / dist)


def mask_at(mask_rad: F64, az_rad: F64) -> F64:
    """Linear interpolation of a horizon mask (index i is azimuth i * 2pi/n), wrapping at north."""
    n = mask_rad.size
    grid = np.arange(n) * (2 * np.pi / n)
    return np.asarray(np.interp(az_rad, grid, mask_rad, period=2 * np.pi), dtype=np.float64)


def disk_fraction_uniform(el: F64, horizon: F64, radius: F64) -> F64:
    """Fraction of a uniform disk above a straight horizon (circular segment)."""
    d = np.clip((el - horizon) / radius, -1.0, 1.0)
    return np.asarray(0.5 + (d * np.sqrt(1 - d * d) + np.arcsin(d)) / np.pi, dtype=np.float64)


def limb_darkened_table(u: float, n: int = 4001) -> tuple[F64, F64]:
    """Fraction of the flux of a limb-darkened disk, I(mu) = 1 - u (1 - mu), above a horizontal
    line at height d (disk radii) above the disk centre, on a grid of d in [-1, 1]. Numerical, by
    strips. d = -1 gives 1 and d = 1 gives 0."""
    d = np.linspace(-1.0, 1.0, n)
    flux = np.zeros(n)
    for i, x in enumerate(d):
        half = math.sqrt(max(0.0, 1.0 - x * x))
        if half == 0.0:
            continue
        t = np.linspace(-half, half, 801)
        mu = np.sqrt(np.maximum(0.0, 1.0 - x * x - t * t))
        flux[i] = np.trapezoid(1.0 - u * (1.0 - mu), t)
    # flux[i] is the flux in the strip at height d[i]; the visible part is its integral above d.
    cum = np.concatenate([[0.0], np.cumsum((flux[1:] + flux[:-1]) / 2 * np.diff(d))])
    return d, np.asarray(1.0 - cum / cum[-1], dtype=np.float64)


def disk_fraction_limb(el: F64, horizon: F64, radius: F64, table: tuple[F64, F64]) -> F64:
    # The table is indexed by the horizon's height above the disk centre, the opposite sign of the
    # Sun's height above the horizon.
    d = np.clip((el - horizon) / radius, -1.0, 1.0)
    return np.asarray(np.interp(-d, table[0], table[1]), dtype=np.float64)


def longest_run_days(flags: npt.NDArray[np.bool_], step_s: float) -> float:
    """Longest run of True in `flags`, in days (a run cut by the ends counts as far as it goes)."""
    best = run = 0
    for f in flags:
        run = run + 1 if f else 0
        best = max(best, run)
    return best * step_s / 86_400.0


@dataclass(frozen=True)
class Series:
    mean_disk_pct: float
    lit_pct: float  # any part of the disk above the horizon
    lcip_days: float
    lcsp_days: float


def summarize(frac: F64, step_s: float) -> Series:
    lit = frac > 0.0
    return Series(
        float(frac.mean() * 100.0),
        float(lit.mean() * 100.0),
        longest_run_days(lit, step_s),
        longest_run_days(~lit, step_s),
    )


def spearman(a: F64, b: F64) -> float:
    """Spearman rank correlation, with mid-ranks for ties."""

    def ranks(v: F64) -> F64:
        _vals, inv, counts = np.unique(v, return_inverse=True, return_counts=True)
        mid = np.cumsum(counts) - (counts - 1) / 2.0
        return np.asarray(mid[inv], dtype=np.float64)

    ra, rb = ranks(a), ranks(b)
    return float(np.corrcoef(ra, rb)[0, 1])


# ---------------------------------------------------------------------------------------------
# Benchmark A
# ---------------------------------------------------------------------------------------------


def load_barker(path: Path = BARKER_PATH) -> dict[str, Any]:
    doc: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    return doc


def evaluate_barker(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Apply the criteria A1 to A3 to rows holding ours and the paper's values (percent)."""
    a1 = all(
        r[f"ours_{h}_pct"] >= r[f"paper_{h}_A"] - A1_FLOOR_MARGIN_PP
        for r in rows
        for h in ("dz1", "dz5")
    )
    a2 = all(
        r[f"ours_{h}_pct"] <= r[f"paper_{h}_C"] + A2_CEILING_MARGIN_PP
        for r in rows
        for h in ("dz1", "dz5")
    )
    median_1m = float(np.median([r["ours_dz1_pct"] for r in rows]))
    return {
        "A1_floor": a1,
        "A2_ceiling": a2,
        "A3_median_at_1m_pct": median_1m,
        "A3_median_at_least_70": median_1m >= A3_MEDIAN_AT_1M_PCT,
        "passes": bool(a1 and a2 and median_1m >= A3_MEDIAN_AT_1M_PCT),
    }


def benchmark_barker(raw_dir: Path, sources: Sources, sun_km: F64, step_s: float) -> dict[str, Any]:
    paper = load_barker()
    by_id = {d.id: d for d in sources.datasets}
    spec = next(s for s in SITE_SPECS if s.site_id == "connecting-ridge")  # Site 1
    near = read_dem(raw_dir / spec.dataset_id / by_id[spec.dataset_id].filename)
    far = read_dem(raw_dir / FAR_DATASET / by_id[FAR_DATASET].filename)
    table = limb_darkened_table(LIMB_DARKENING_U)
    rows: list[dict[str, Any]] = []
    for i, roi in enumerate(paper["rois"]):
        x, y = paper["x_km"][i] * 1000.0, paper["y_km"][i] * 1000.0
        lat, lon = (float(v[0]) for v in unproject(np.array([x]), np.array([y])))
        ground = float(near.sample(np.array([x]), np.array([y]))[0])
        if not math.isfinite(ground):
            raise ValueError(f"RoI {roi} centroid is outside the Site01 tile")
        row: dict[str, Any] = {
            "roi": roi,
            "x_km": paper["x_km"][i],
            "y_km": paper["y_km"][i],
            "ground_m": round(ground, 2),
        }
        masks = horizon_masks(lat, lon, ground, near, far, (1.0, 5.0))
        for k, (tag, h) in enumerate((("dz1", 1.0), ("dz5", 5.0))):
            az, el, rad = sun_az_el(sun_km, lat, lon, ground + h)
            hor = mask_at(masks[k], az)
            uni = summarize(disk_fraction_uniform(el, hor, rad), step_s)
            ld = summarize(disk_fraction_limb(el, hor, rad, table), step_s)
            row[f"ours_{tag}_pct"] = round(uni.mean_disk_pct, 3)
            row[f"ours_{tag}_limb_pct"] = round(ld.mean_disk_pct, 3)
            row[f"ours_{tag}_lit_pct"] = round(uni.lit_pct, 3)
            row[f"ours_{tag}_lcip_days"] = round(uni.lcip_days, 2)
            row[f"ours_{tag}_lcsp_days"] = round(uni.lcsp_days, 2)
            p = paper[tag]
            for case in ("A", "B", "C"):
                row[f"paper_{tag}_{case}"] = p["avg_ill_1"][case][i]
            row[f"paper_{tag}_lcip_1_A_days"] = p["lcip_1_days"]["A"][i]
            row[f"paper_{tag}_lcsp_99_A_days"] = p["lcsp_99_days"]["A"][i]
        rows.append(row)
    return {
        "start_utc": BARKER_START_UTC,
        "end_utc": BARKER_END_UTC,
        "steps": int(sun_km.shape[0]),
        "rows": rows,
        "criteria": evaluate_barker(rows),
        "limb_darkening_u_assumed": LIMB_DARKENING_U,
    }


FAR_RANGES_M = (50_000.0, 100_000.0, 150_000.0, 300_000.0)


def range_sensitivity(
    raw_dir: Path, sources: Sources, sun_km: F64, step_s: float
) -> dict[str, Any]:
    """Added after the first run (informational): how much the far-field range matters. The Barker
    RoIs at 1 m with the 80 m map used out to 50, 100, 150 and 300 km. The paper uses its 80 m map
    to 100 km and a 240 m map beyond; the engine uses its 80 m map to 300 km."""
    paper = load_barker()
    by_id = {d.id: d for d in sources.datasets}
    spec = next(s for s in SITE_SPECS if s.site_id == "connecting-ridge")
    near = read_dem(raw_dir / spec.dataset_id / by_id[spec.dataset_id].filename)
    far = read_dem(raw_dir / FAR_DATASET / by_id[FAR_DATASET].filename)
    out: dict[str, list[float]] = {f"{int(r / 1000)}km": [] for r in FAR_RANGES_M}
    for i in range(len(paper["rois"])):
        x, y = paper["x_km"][i] * 1000.0, paper["y_km"][i] * 1000.0
        lat, lon = (float(v[0]) for v in unproject(np.array([x]), np.array([y])))
        ground = float(near.sample(np.array([x]), np.array([y]))[0])
        for r in FAR_RANGES_M:
            mask = horizon_masks(lat, lon, ground, near, far, (1.0,), far_range_m=r)[0]
            az, el, rad = sun_az_el(sun_km, lat, lon, ground + 1.0)
            frac = disk_fraction_uniform(el, mask_at(mask, az), rad)
            out[f"{int(r / 1000)}km"].append(round(float(frac.mean() * 100), 3))
    worst = max(abs(a - b) for a, b in zip(out["100km"], out["300km"], strict=True))
    return {
        "mean_disk_pct_at_1m_by_far_range": out,
        "max_abs_change_100km_to_300km_pp": round(worst, 3),
    }


# ---------------------------------------------------------------------------------------------
# Benchmark B
# ---------------------------------------------------------------------------------------------

# The eight symmetries of the square: how the AVGVISIB map's plane may be turned and flipped
# relative to the PGDA DEMs' plane (the label gives a centre longitude of 180 degrees).
ORIENTATIONS: dict[str, Callable[[F64, F64], tuple[F64, F64]]] = {
    "identity": lambda x, y: (x, y),
    "rot90": lambda x, y: (-y, x),
    "rot180": lambda x, y: (-x, -y),
    "rot270": lambda x, y: (y, -x),
    "flip_x": lambda x, y: (-x, y),
    "flip_y": lambda x, y: (x, -y),
    "transpose": lambda x, y: (y, x),
    "anti_transpose": lambda x, y: (-y, -x),
}
AVGVISIB_SIZE = 5058
AVGVISIB_RES_M = 60.0
AVGVISIB_SCALE = 0.00004


def read_avgvisib(path: Path) -> npt.NDArray[np.float32]:
    """The map as fractions in [0, 1]; the file is little-endian int16, 5058 x 5058."""
    raw = np.fromfile(path, dtype="<i2")
    if raw.size != AVGVISIB_SIZE * AVGVISIB_SIZE:
        raise ValueError(f"{path.name}: {raw.size} values, expected {AVGVISIB_SIZE}^2")
    return (raw.reshape(AVGVISIB_SIZE, AVGVISIB_SIZE) * AVGVISIB_SCALE).astype(np.float32)


def map_pixel(x_m: F64, y_m: F64, orientation: str) -> tuple[F64, F64]:
    """Row and column (0-based, pixel centres) in the map of DEM-plane points. The pole is at
    2528.5, the middle of the array; north is up in the map's own plane."""
    mx, my = ORIENTATIONS[orientation](x_m, y_m)
    centre = (AVGVISIB_SIZE - 1) / 2.0
    return centre - my / AVGVISIB_RES_M, centre + mx / AVGVISIB_RES_M


def sample_map(amap: npt.NDArray[np.float32], x_m: F64, y_m: F64, orientation: str) -> F64:
    row, col = map_pixel(x_m, y_m, orientation)
    r = np.rint(row).astype(int)
    c = np.rint(col).astype(int)
    ok = (r >= 0) & (r < AVGVISIB_SIZE) & (c >= 0) & (c < AVGVISIB_SIZE)
    out = np.full(x_m.shape, np.nan)
    out[ok] = amap[r[ok], c[ok]]
    return out


def choose_orientation(
    amap: npt.NDArray[np.float32], dem: Dem, n: int = 40_000, seed: int = 1
) -> dict[str, Any]:
    """Pick the orientation from terrain, not from illumination: with the right one, the map's
    zero pixels (permanent shadow) sit on lower ground than its non-zero pixels, measured in the
    80 m DEM. Returns the evidence for all eight."""
    rng = np.random.default_rng(seed)
    # Points within 100 km of the pole, in the DEM's plane.
    x = rng.uniform(-100_000.0, 100_000.0, n)
    y = rng.uniform(-100_000.0, 100_000.0, n)
    z = dem.sample(x, y)
    ok = np.isfinite(z)
    scores: dict[str, float] = {}
    for name in ORIENTATIONS:
        value = sample_map(amap, x, y, name)
        good = ok & np.isfinite(value)
        zero = good & (value == 0.0)
        lit = good & (value > 0.0)
        scores[name] = float(z[zero].mean() - z[lit].mean()) if zero.sum() > 50 else float("nan")
    best = min((k for k, v in scores.items() if math.isfinite(v)), key=lambda k: scores[k])
    ranked = sorted(v for v in scores.values() if math.isfinite(v))
    return {
        "chosen": best,
        "zero_minus_lit_mean_height_m": {k: round(v, 1) for k, v in scores.items()},
        "margin_to_second_m": round(ranked[1] - ranked[0], 1),
    }


def site_points(
    raw_dir: Path,
    sources: Sources,
    sites_path: Path,
    sun_km: F64,
    amap: npt.NDArray[np.float32],
    orientation: str,
) -> dict[str, Any]:
    """The catalog sites themselves against the map. Added after the first run, so informational
    (not one of the D-025 criteria): the map's pixel is 60 m wide and the site is a point on a 5 m
    DEM, so the map's 3 x 3 neighbourhood is given too."""
    by_id = {d.id: d for d in sources.datasets}
    far = read_dem(raw_dir / FAR_DATASET / by_id[FAR_DATASET].filename)
    sites = {s["id"]: s for s in json.loads(sites_path.read_text(encoding="utf-8"))["sites"]}
    out: dict[str, Any] = {}
    for spec in SITE_SPECS:
        s = sites[spec.site_id]
        near = read_dem(raw_dir / spec.dataset_id / by_id[spec.dataset_id].filename)
        lat, lon = math.radians(s["lat_deg"]), math.radians(s["lon_deg"])
        x, y = (v[0] for v in project(np.array([lat]), np.array([lon])))
        row, col = map_pixel(np.array([x]), np.array([y]), orientation)
        r, c = int(round(float(row[0]))), int(round(float(col[0])))
        block = amap[r - 1 : r + 2, c - 1 : c + 2]
        masks = horizon_masks(lat, lon, s["elev_m"], near, far, (0.0, 2.0))
        entry: dict[str, Any] = {
            "map_pixel": round(float(amap[r, c]), 4),
            "map_3x3_min": round(float(block.min()), 4),
            "map_3x3_max": round(float(block.max()), 4),
        }
        for k, mast in enumerate((0.0, 2.0)):
            az, el, rad = sun_az_el(sun_km, lat, lon, s["elev_m"] + mast)
            frac = disk_fraction_uniform(el, mask_at(masks[k], az), rad)
            entry[f"ours_lit_{mast:g}m"] = round(float((frac > 0).mean()), 4)
            entry[f"ours_mean_disk_{mast:g}m"] = round(float(frac.mean()), 4)
        out[spec.site_id] = entry
    return out


def benchmark_map(
    raw_dir: Path,
    sources: Sources,
    sun_km: F64,
    step_s: float,
    sites_path: Path,
    seed: int = 7,
) -> dict[str, Any]:
    by_id = {d.id: d for d in sources.datasets}
    amap = read_avgvisib(raw_dir / AVGVISIB_DATASET / by_id[AVGVISIB_DATASET].filename)
    far = read_dem(raw_dir / FAR_DATASET / by_id[FAR_DATASET].filename)
    orientation = choose_orientation(amap, far)
    chosen = str(orientation["chosen"])
    rng = np.random.default_rng(seed)
    per_tile: dict[str, Any] = {}
    all_ours: dict[float, list[F64]] = {0.0: [], 2.0: []}
    all_map: list[F64] = []
    for spec in SITE_SPECS:
        near = read_dem(raw_dir / spec.dataset_id / by_id[spec.dataset_id].filename)
        h, w = near.z.shape
        m = int(B_EDGE_MARGIN_M / near.res)
        xs: list[float] = []
        ys: list[float] = []
        ours: dict[float, list[float]] = {0.0: [], 2.0: []}
        tries = 0
        while len(xs) < B_POINTS_PER_TILE and tries < 100 * B_POINTS_PER_TILE:
            tries += 1
            r, c = int(rng.integers(m, h - m)), int(rng.integers(m, w - m))
            x = near.left + (c + 0.5) * near.res
            y = near.top - (r + 0.5) * near.res
            ground = float(near.z[r, c])
            if not math.isfinite(ground):
                continue
            lat, lon = (float(v[0]) for v in unproject(np.array([x]), np.array([y])))
            masks = horizon_masks(lat, lon, ground, near, far, (0.0, 2.0), n_azimuth=B_RAYS)
            for k, mast in enumerate((0.0, 2.0)):
                az, el, rad = sun_az_el(sun_km, lat, lon, ground + mast)
                frac = disk_fraction_uniform(el, mask_at(masks[k], az), rad)
                ours[mast].append(float((frac > 0).mean()))
            xs.append(x)
            ys.append(y)
        value = sample_map(amap, np.array(xs), np.array(ys), chosen)
        keep = np.isfinite(value)
        entry: dict[str, Any] = {
            "points": int(keep.sum()),
            "map_mean": round(float(value[keep].mean()), 4),
        }
        for mast in (0.0, 2.0):
            o = np.array(ours[mast])[keep]
            entry[f"spearman_{mast:g}m"] = round(spearman(o, value[keep]), 4)
            entry[f"ours_mean_lit_{mast:g}m"] = round(float(o.mean()), 4)
            all_ours[mast].append(o)
        all_map.append(value[keep])
        per_tile[spec.site_id] = entry
    everything = np.concatenate(all_map)
    summary = {
        f"spearman_{mast:g}m": round(spearman(np.concatenate(all_ours[mast]), everything), 4)
        for mast in (0.0, 2.0)
    }
    passes = bool(
        summary["spearman_2m"] >= B_RHO_ALL
        and all(t["spearman_2m"] >= B_RHO_EACH_TILE for t in per_tile.values())
    )
    return {
        "orientation": orientation,
        "points_per_tile": B_POINTS_PER_TILE,
        "rays": B_RAYS,
        "all_tiles": {"points": int(everything.size), **summary},
        "tiles": per_tile,
        "sites_informational": site_points(raw_dir, sources, sites_path, sun_km, amap, chosen),
        "criteria": {
            "rho_all_at_least": B_RHO_ALL,
            "rho_each_tile_at_least": B_RHO_EACH_TILE,
            "passes": passes,
        },
    }


# ---------------------------------------------------------------------------------------------
# the whole benchmark
# ---------------------------------------------------------------------------------------------


def engine_cross_check(raw_dir: Path, sources: Sources, sites_path: Path) -> dict[str, Any]:
    """Mean disk fraction and any-sliver lit fraction at the catalog sites for 2 m, over the
    engine's own epochs (hourly, 2026-01-01T00:01:00 to 2027-01-01T00:01:00), by this Python path.
    The engine test reads this and recomputes the same numbers in TypeScript."""
    ets, sun = sun_series(raw_dir, sources, "2026-01-01T00:01:00", "2027-01-01T00:01:00", 3600)
    by_id = {d.id: d for d in sources.datasets}
    far = read_dem(raw_dir / FAR_DATASET / by_id[FAR_DATASET].filename)
    sites = {s["id"]: s for s in json.loads(sites_path.read_text(encoding="utf-8"))["sites"]}
    out: dict[str, Any] = {"first_et": float(ets[0]), "steps": int(ets.size), "mast_m": 2.0}
    for spec in SITE_SPECS:
        s = sites[spec.site_id]
        near = read_dem(raw_dir / spec.dataset_id / by_id[spec.dataset_id].filename)
        lat, lon = math.radians(s["lat_deg"]), math.radians(s["lon_deg"])
        masks = horizon_masks(lat, lon, s["elev_m"], near, far, (2.0,))
        az, el, rad = sun_az_el(sun, lat, lon, s["elev_m"] + 2.0)
        frac = disk_fraction_uniform(el, mask_at(masks[0], az), rad)
        out[spec.site_id] = {
            "mean_disk_pct": round(float(frac.mean() * 100), 4),
            "lit_pct": round(float((frac > 0).mean() * 100), 4),
        }
    return out


def run_benchmark(raw_dir: Path, sources: Sources, sites_path: Path) -> dict[str, Any]:
    _ets, sun = sun_series(raw_dir, sources, BARKER_START_UTC, BARKER_END_UTC, 3600)
    sun = sun[:-1]  # the end of the period is excluded: 17,544 hourly steps
    by_id = {d.id: d for d in sources.datasets}
    return {
        "schema_version": 1,
        "generated_by": f"sightline benchmark {__version__}",
        "criteria_source": "docs/progress/DECISIONS.md D-025, fixed before the first run",
        "paper": {"dataset_id": BARKER_DATASET, "citation": by_id[BARKER_DATASET].citation},
        "map": {"dataset_id": AVGVISIB_DATASET, "citation": by_id[AVGVISIB_DATASET].citation},
        "barker_table2": benchmark_barker(raw_dir, sources, sun, 3600.0),
        "avgvisib": benchmark_map(raw_dir, sources, sun, 3600.0, sites_path),
        "range_sensitivity_informational": range_sensitivity(raw_dir, sources, sun, 3600.0),
        "engine_cross_check": engine_cross_check(raw_dir, sources, sites_path),
    }


def write_benchmark(
    raw_dir: Path,
    sources: Sources,
    sites_path: Path = DEFAULT_ENGINE_DATA_DIR / "sites.json",
    out: Path = DEFAULT_BENCHMARK_PATH,
) -> Path:
    doc = run_benchmark(raw_dir, sources, sites_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return out
