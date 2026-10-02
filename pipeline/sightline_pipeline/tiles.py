"""The terrain tile pyramid (M1-04): the contract's `TileManifest` and `TileData`, as files.

One quadtree over the square that the 80 m south-polar map covers (the pole at the origin, bounds
±304 km). Level L has 2^L by 2^L tiles of 64 samples a side: 62 interior samples plus a 1-sample
border that holds the neighbour's ground, so a bilinear read never needs the next tile. The
interior spacing is 608 km / 2^L / 62 (76.6 m at level 7, 4.79 m at level 11). A sample sits at the
centre of its cell; row 0 is the lowest y, column 0 the lowest x (the contract's convention).

Two sources, kept apart on purpose (D-027):

- Levels 0 to 7 come from `LDEM_80S_80MPP_ADJ`, everywhere. Level 7 is the 80 m map resampled
  bilinearly to 76.6 m; each coarser level is the mean of 2 x 2 samples of the finer one.
- Levels 8 to 11 come from the three 5 m site DEMs and exist only under them. Level 11 is the
  5 m DEM resampled to 4.79 m; levels 10, 9, 8 are 2 x 2 means. A tile is written only if all
  64 x 64 samples, border included, lie inside the DEM; the tiles along a DEM's edge are dropped.

The spacings are not the sources' (80 m and 5 m), so a sample is an interpolated value, not a
pixel: the raster-to-tile comparison in the tests is against bilinear interpolation of the raw
raster at the sample's position. At the outer edge of the map (levels 0 to 7), the border samples
and the half-pixel rim outside the outermost pixel centres repeat the nearest value; the 5 m
levels never extrapolate.

Heights are `offset_m + scale_m * count`, with `count` a uint16. A tile's offset is its lowest
sample, so the error is at most scale/2. The manifest's `height_scale_m` is 0.1 m, the finest
scale; a tile whose relief exceeds 6553.5 m (the coarsest levels, where one sample is a 10 km
mean) carries a larger `scale_m` in its header. The relief is never clipped.

A tile file is 32 bytes of header, little-endian, then 64 * 64 uint16 counts, row-major:

    4s magic "SLT1" | u16 level | u16 size_px | u32 x | u32 y | f64 offset_m | f64 scale_m
"""

import hashlib
import json
import math
import struct
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import numpy.typing as npt
import rasterio

from sightline_pipeline import __version__
from sightline_pipeline.fetch import verify_file
from sightline_pipeline.horizon import FAR_DATASET, MOON_RADIUS_M, Dem, project, read_dem
from sightline_pipeline.sites import SITE_SPECS
from sightline_pipeline.sources import (
    DEFAULT_ENGINE_DATA_DIR,
    DEFAULT_GOLDEN_DIR,
    REPO_ROOT,
    Sources,
)

F32 = npt.NDArray[np.float32]
F64 = npt.NDArray[np.float64]

TILE_SIZE_PX = 64
BORDER_PX = 1
INTERIOR_PX = TILE_SIZE_PX - 2 * BORDER_PX
LEVEL_COUNT = 12
REGIONAL_MAX_LEVEL = 7  # levels 0..7 from the 80 m map
SITE_MIN_LEVEL = 8  # levels 8..11 from the 5 m DEMs
SITE_MAX_LEVEL = LEVEL_COUNT - 1
HEIGHT_SCALE_M = 0.1
MAX_COUNT = 65_535
DATA_VERSION = "lola-tiles-v1"

MAGIC = b"SLT1"
_HEADER = struct.Struct("<4sHHIIdd")
HEADER_BYTES = _HEADER.size  # 32

DEFAULT_TILES_DIR = REPO_ROOT / "data" / "processed" / "tiles"
DEFAULT_ENGINE_TILES_DIR = DEFAULT_ENGINE_DATA_DIR / "tiles"
DEFAULT_PROBE_PATH = DEFAULT_GOLDEN_DIR / "tiles_probe.json"
# Levels whose every tile is committed with the engine, and the levels at which the tile under
# each catalog site is committed (a few hundred KB in all; the full pyramid is gitignored).
COMMITTED_FULL_LEVELS = range(0, 4)
COMMITTED_SITE_LEVELS = (REGIONAL_MAX_LEVEL, *range(SITE_MIN_LEVEL, LEVEL_COUNT))
PROBES_PER_TILE = 5
PROBE_SEED = 1_737_400


# --------------------------------------------------------------------------------------------
# Geometry


def sample_spacing_m(level: int, half_extent_m: float) -> float:
    """Interior ground sample distance at `level`."""
    return float(2.0 * half_extent_m / 2**level / INTERIOR_PX)


def tile_range(origin: int, size: int) -> tuple[int, int]:
    """Inclusive range of tile indices whose 64-sample window lies inside [origin, origin + size).

    A tile `t` reads interior sample indices `62 t - 1` to `62 t + 62` (border included).
    Empty when the first value exceeds the second.
    """
    return -((-(origin + 1)) // INTERIOR_PX), (origin + size - 1 - INTERIOR_PX) // INTERIOR_PX


@dataclass(frozen=True)
class Mosaic:
    """Samples of one level on the global index grid; `z[j, i]` is sample (ox + i, oy + j).

    Index i runs along x and j along y, both upward; the sample's centre is at
    `x_min + (ox + i + 0.5) * spacing`.
    """

    level: int
    z: F32
    ox: int
    oy: int


def resample_bilinear(
    z: F32,
    left: float,
    top: float,
    res: float,
    xs: F64,
    ys: F64,
    *,
    clamp: bool,
    chunk_rows: int = 256,
) -> F32:
    """Bilinear heights of a north-up raster on the grid xs (columns) by ys (rows, y up).

    With `clamp` False every position must lie between the outermost pixel centres, so nothing is
    extrapolated. With `clamp` True a position up to half a pixel outside them (still inside the
    raster) takes the nearest pixel centre's weight; further out is an error.
    """
    h, w = z.shape
    col = (xs - left) / res - 0.5
    row_all = (top - ys) / res - 0.5
    slack = 0.5 if clamp else 1e-9
    for name, v, n in (("x", col, w), ("y", row_all, h)):
        if v.min() < -slack or v.max() > n - 1 + slack:
            raise ValueError(f"{name} positions leave the raster (clamp={clamp})")
    c0 = np.clip(np.floor(col), 0, w - 2).astype(np.intp)
    fc = np.clip(col - c0, 0.0, 1.0).astype(np.float32)
    out = np.empty((len(ys), len(xs)), dtype=np.float32)
    for a in range(0, len(ys), chunk_rows):
        row = row_all[a : a + chunk_rows]
        r0 = np.clip(np.floor(row), 0, h - 2).astype(np.intp)
        fr = np.clip(row - r0, 0.0, 1.0).astype(np.float32)[:, None]
        r, c = r0[:, None], c0[None, :]
        top_row = z[r, c] * (1 - fc) + z[r, c + 1] * fc
        bottom_row = z[r + 1, c] * (1 - fc) + z[r + 1, c + 1] * fc
        out[a : a + chunk_rows] = top_row * (1 - fr) + bottom_row * fr
    return out


def regional_mosaic(far: Dem, half_extent_m: float) -> Mosaic:
    """Level 7 of the whole map, from the 80 m raster."""
    n = 2**REGIONAL_MAX_LEVEL * INTERIOR_PX
    s = sample_spacing_m(REGIONAL_MAX_LEVEL, half_extent_m)
    centres = -half_extent_m + (np.arange(n) + 0.5) * s
    z = resample_bilinear(far.z, far.left, far.top, far.res, centres, centres, clamp=True)
    return Mosaic(REGIONAL_MAX_LEVEL, z, 0, 0)


def site_mosaic(near: Dem, half_extent_m: float) -> Mosaic:
    """Level 11 under one 5 m DEM: the samples whose centres lie between its pixel centres."""
    s = sample_spacing_m(SITE_MAX_LEVEL, half_extent_m)
    h, w = near.z.shape

    def span(lo_m: float, hi_m: float) -> tuple[int, int]:
        lo = math.ceil((lo_m + half_extent_m) / s - 0.5 - 1e-9)
        hi = math.floor((hi_m + half_extent_m) / s - 0.5 + 1e-9)
        return lo, hi

    i0, i1 = span(near.left + near.res / 2, near.left + w * near.res - near.res / 2)
    j0, j1 = span(near.top - h * near.res + near.res / 2, near.top - near.res / 2)
    xs = np.asarray(-half_extent_m + (np.arange(i0, i1 + 1) + 0.5) * s, dtype=np.float64)
    ys = np.asarray(-half_extent_m + (np.arange(j0, j1 + 1) + 0.5) * s, dtype=np.float64)
    z = resample_bilinear(near.z, near.left, near.top, near.res, xs, ys, clamp=False)
    return Mosaic(SITE_MAX_LEVEL, z, i0, j0)


def halve(m: Mosaic) -> Mosaic:
    """The next coarser level: each sample is the mean of the 2 x 2 samples under it.

    Only samples with all four children are kept, so a sparse mosaic stays inside its source.
    """
    i0, j0 = -((-m.ox) // 2), -((-m.oy) // 2)
    i1, j1 = (m.ox + m.z.shape[1]) // 2, (m.oy + m.z.shape[0]) // 2
    sub = m.z[2 * j0 - m.oy : 2 * j1 - m.oy, 2 * i0 - m.ox : 2 * i1 - m.ox]
    mean = sub.reshape(j1 - j0, 2, i1 - i0, 2).mean(axis=(1, 3), dtype=np.float64)
    return Mosaic(m.level - 1, mean.astype(np.float32), i0, j0)


# --------------------------------------------------------------------------------------------
# Encoding


def choose_scale_m(relief_m: float) -> float:
    """0.1 m while the tile's relief fits 65,535 counts, else the next 0.01 m that does."""
    if relief_m <= MAX_COUNT * HEIGHT_SCALE_M:
        return HEIGHT_SCALE_M
    return round(math.ceil(relief_m / MAX_COUNT / 0.01) * 0.01, 2)


def encode_tile(level: int, x: int, y: int, heights_m: F32) -> bytes:
    if heights_m.shape != (TILE_SIZE_PX, TILE_SIZE_PX):
        raise ValueError(f"a tile is {TILE_SIZE_PX} x {TILE_SIZE_PX}, got {heights_m.shape}")
    if not np.isfinite(heights_m).all():
        raise ValueError(f"tile {level}/{x}/{y} has non-finite heights")
    h = heights_m.astype(np.float64)
    offset_m = float(h.min())
    scale_m = choose_scale_m(float(h.max()) - offset_m)
    counts = np.rint((h - offset_m) / scale_m)
    if counts.max() > MAX_COUNT:
        raise ValueError(f"tile {level}/{x}/{y}: relief does not fit uint16 at {scale_m} m")
    header = _HEADER.pack(MAGIC, level, TILE_SIZE_PX, x, y, offset_m, scale_m)
    return header + counts.astype("<u2").tobytes()


@dataclass(frozen=True)
class DecodedTile:
    level: int
    x: int
    y: int
    offset_m: float
    scale_m: float
    counts: npt.NDArray[np.uint16]

    @property
    def heights_m(self) -> F64:
        return np.asarray(self.offset_m + self.scale_m * self.counts.astype(np.float64))


def decode_tile(data: bytes) -> DecodedTile:
    if len(data) != HEADER_BYTES + 2 * TILE_SIZE_PX**2:
        raise ValueError(f"tile file is {len(data)} bytes")
    magic, level, size, x, y, offset_m, scale_m = _HEADER.unpack_from(data)
    if magic != MAGIC or size != TILE_SIZE_PX:
        raise ValueError("not a SLT1 tile")
    counts = np.frombuffer(data, dtype="<u2", offset=HEADER_BYTES).reshape(
        TILE_SIZE_PX, TILE_SIZE_PX
    )
    return DecodedTile(level, x, y, offset_m, scale_m, counts.astype(np.uint16))


def tile_path(root: Path, level: int, x: int, y: int) -> Path:
    return root / str(level) / str(x) / f"{y}.bin"


# --------------------------------------------------------------------------------------------
# Independent reference: used for the probe fixture, not by the builder


def reference_height_m(
    z: F32,
    left: float,
    top: float,
    res: float,
    x_m: float,
    y_m: float,
    cell_m: float,
    n_sub: int,
) -> float:
    """Mean of the raw raster's bilinear height over an n_sub x n_sub grid inside one sample cell.

    Written separately from `resample_bilinear` (scalar loops over a point list, `clamp` only
    where the point is inside the raster but outside the outermost pixel centres), so the
    builder and the check share no interpolation code. For n_sub = 1 it is the raster's height
    at the sample's centre; for n_sub = 2^k it is what k halvings of the finer level give.
    """
    h, w = z.shape
    offsets = (-0.5 + (np.arange(n_sub) + 0.5) / n_sub) * cell_m
    total = 0.0
    for dy in offsets:
        for dx in offsets:
            col = min(max((x_m + dx - left) / res - 0.5, 0.0), w - 1.0)
            row = min(max((top - (y_m + dy)) / res - 0.5, 0.0), h - 1.0)
            c0, r0 = min(int(col), w - 2), min(int(row), h - 2)
            fc, fr = col - c0, row - r0
            total += (1 - fr) * ((1 - fc) * float(z[r0, c0]) + fc * float(z[r0, c0 + 1])) + fr * (
                (1 - fc) * float(z[r0 + 1, c0]) + fc * float(z[r0 + 1, c0 + 1])
            )
    return total / (n_sub * n_sub)


# --------------------------------------------------------------------------------------------
# The build


def _rect(level: int, x0: int, x1: int, y0: int, y1: int, source: str) -> dict[str, Any]:
    return {
        "level": level,
        "x_min": x0,
        "x_max": x1,
        "y_min": y0,
        "y_max": y1,
        "source": source,
    }


def _write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def build_manifest(
    sources: Sources, half_extent_m: float, dataset_ids: list[str]
) -> dict[str, Any]:
    by_id = {d.id: d for d in sources.datasets}
    citations = list(dict.fromkeys(by_id[i].citation for i in dataset_ids))
    return {
        "schema_version": 1,
        "data_version": DATA_VERSION,
        "projection": "polar_stereographic_south",
        "moon_radius_m": int(MOON_RADIUS_M),
        "bounds_m": {
            "x_min_m": -half_extent_m,
            "y_min_m": -half_extent_m,
            "x_max_m": half_extent_m,
            "y_max_m": half_extent_m,
        },
        "tile_size_px": TILE_SIZE_PX,
        "border_px": BORDER_PX,
        "level_count": LEVEL_COUNT,
        "height_encoding": "uint16_offset",
        "height_scale_m": HEIGHT_SCALE_M,
        "simulated": False,
        "provenance": {
            "source": "SIGHTLINE_PIPELINE",
            "simulated": False,
            "data_sources": dataset_ids,
            "spice_kernels": [],
            "dem_citation": "; ".join(citations),
            "pipeline_version": __version__,
            "data_version": DATA_VERSION,
        },
    }


@dataclass
class TileStats:
    count: int = 0
    bytes: int = 0
    coarse_scale: int = 0  # tiles whose scale is above 0.1 m
    max_scale_m: float = HEIGHT_SCALE_M


def build_tiles(
    raw_dir: Path,
    sources: Sources,
    sites_path: Path,
    out_dir: Path = DEFAULT_TILES_DIR,
    engine_dir: Path = DEFAULT_ENGINE_TILES_DIR,
    probe_path: Path = DEFAULT_PROBE_PATH,
    progress: Callable[[str], None] | None = None,
) -> dict[str, Any]:
    """Write the full pyramid to `out_dir`, the committed subset to `engine_dir`, and the probe
    fixture to `probe_path`. Returns a summary."""
    say = progress or (lambda _m: None)
    by_id = {d.id: d for d in sources.datasets}
    dataset_ids = [FAR_DATASET, *(s.dataset_id for s in SITE_SPECS)]
    paths: dict[str, Path] = {}
    for ds_id in dataset_ids:
        ds = by_id[ds_id]
        path = raw_dir / ds.id / ds.filename
        if not path.exists():
            raise FileNotFoundError(f"{path} is missing: run `sightline fetch --only dem`")
        verify_file(path, ds)
        paths[ds_id] = path

    far = read_dem(paths[FAR_DATASET])
    half = far.z.shape[1] * far.res / 2
    if far.z.shape[0] != far.z.shape[1] or far.left != -half or far.top != half:
        raise ValueError("the 80 m map is not a square centred on the pole")

    manifest = build_manifest(sources, half, dataset_ids)
    stats: dict[int, TileStats] = {lv: TileStats() for lv in range(LEVEL_COUNT)}
    rects: list[dict[str, Any]] = []
    written: dict[tuple[int, int, int], bytes] = {}  # committed subset, filled below
    written_source: dict[tuple[int, int, int], str] = {}

    sites = json.loads(sites_path.read_text(encoding="utf-8"))["sites"]
    site_xy: list[tuple[float, float]] = []
    for site in sites:
        x, y = project(
            np.array([math.radians(site["lat_deg"])]), np.array([math.radians(site["lon_deg"])])
        )
        site_xy.append((float(x[0]), float(y[0])))

    def locate(level: int, x_m: float, y_m: float) -> tuple[int, int]:
        tile_m = 2 * half / 2**level
        return int((x_m + half) // tile_m), int((y_m + half) // tile_m)

    def emit(level: int, tx: int, ty: int, heights: F32, committed: bool, source: str) -> None:
        data = encode_tile(level, tx, ty, heights)
        _write(tile_path(out_dir, level, tx, ty), data)
        st = stats[level]
        st.count += 1
        st.bytes += len(data)
        scale = decode_tile(data).scale_m
        if scale > HEIGHT_SCALE_M:
            st.coarse_scale += 1
            st.max_scale_m = max(st.max_scale_m, scale)
        if committed:
            written[(level, tx, ty)] = data
            written_source[(level, tx, ty)] = source

    # Levels 0..7 from the 80 m map. The border at the map's outer edge repeats the edge sample.
    say("level 7 from the 80 m map")
    m = regional_mosaic(far, half)
    for level in range(REGIONAL_MAX_LEVEL, -1, -1):
        n_tiles = 2**level
        say(f"level {level}: {n_tiles * n_tiles} tiles")
        padded = np.pad(m.z, BORDER_PX, mode="edge")
        wanted = {locate(level, x, y) for x, y in site_xy}
        for ty in range(n_tiles):
            for tx in range(n_tiles):
                window = padded[
                    ty * INTERIOR_PX : ty * INTERIOR_PX + TILE_SIZE_PX,
                    tx * INTERIOR_PX : tx * INTERIOR_PX + TILE_SIZE_PX,
                ]
                committed = level in COMMITTED_FULL_LEVELS or (
                    level in COMMITTED_SITE_LEVELS and (tx, ty) in wanted
                )
                emit(level, tx, ty, window, committed, FAR_DATASET)
        rects.append(_rect(level, 0, n_tiles - 1, 0, n_tiles - 1, FAR_DATASET))
        if level > 0:
            m = halve(m)

    # Levels 8..11 from the 5 m DEMs. Site04 and Site01 overlap (6 km by 11 km) and disagree there
    # by up to 10.7 m (D-027), so a tile that two DEMs could build comes from the DEM whose centre
    # is nearer to the tile's centre. Every tile is written once.
    chains: dict[str, dict[int, Mosaic]] = {}
    ranges: dict[tuple[str, int], tuple[int, int, int, int]] = {}
    dem_centre: dict[str, tuple[float, float]] = {}
    for spec in SITE_SPECS:
        say(f"{spec.dataset_id}: levels {SITE_MAX_LEVEL} down to {SITE_MIN_LEVEL}")
        dem = read_dem(paths[spec.dataset_id])
        rows, cols = dem.z.shape
        dem_centre[spec.dataset_id] = (
            dem.left + cols * dem.res / 2,
            dem.top - rows * dem.res / 2,
        )
        mosaic = site_mosaic(dem, half)
        chains[spec.dataset_id] = {}
        for level in range(SITE_MAX_LEVEL, SITE_MIN_LEVEL - 1, -1):
            chains[spec.dataset_id][level] = mosaic
            tx0, tx1 = tile_range(mosaic.ox, mosaic.z.shape[1])
            ty0, ty1 = tile_range(mosaic.oy, mosaic.z.shape[0])
            if tx0 > tx1 or ty0 > ty1:
                raise ValueError(f"{spec.dataset_id}: no whole tile at level {level}")
            ranges[(spec.dataset_id, level)] = (tx0, tx1, ty0, ty1)
            rects.append(_rect(level, tx0, tx1, ty0, ty1, spec.dataset_id))
            say(f"  level {level}: tiles x {tx0}..{tx1}, y {ty0}..{ty1}")
            if level > SITE_MIN_LEVEL:
                mosaic = halve(mosaic)
    for level in range(SITE_MAX_LEVEL, SITE_MIN_LEVEL - 1, -1):
        tile_m = 2 * half / 2**level
        owner: dict[tuple[int, int], tuple[float, str]] = {}
        for spec in SITE_SPECS:
            tx0, tx1, ty0, ty1 = ranges[(spec.dataset_id, level)]
            cx_m, cy_m = dem_centre[spec.dataset_id]
            for ty in range(ty0, ty1 + 1):
                for tx in range(tx0, tx1 + 1):
                    dist_m = math.hypot(
                        -half + (tx + 0.5) * tile_m - cx_m, -half + (ty + 0.5) * tile_m - cy_m
                    )
                    if (tx, ty) not in owner or dist_m < owner[(tx, ty)][0]:
                        owner[(tx, ty)] = (dist_m, spec.dataset_id)
        wanted = {locate(level, x, y) for x, y in site_xy}
        for (tx, ty), (_, ds_id) in sorted(owner.items()):
            mosaic = chains[ds_id][level]
            r0 = ty * INTERIOR_PX - BORDER_PX - mosaic.oy
            c0 = tx * INTERIOR_PX - BORDER_PX - mosaic.ox
            window = mosaic.z[r0 : r0 + TILE_SIZE_PX, c0 : c0 + TILE_SIZE_PX]
            committed = level in COMMITTED_SITE_LEVELS and (tx, ty) in wanted
            emit(level, tx, ty, window, committed, ds_id)

    rects.sort(key=lambda r: (r["level"], r["source"]))
    coverage = {
        "schema_version": 1,
        "data_version": DATA_VERSION,
        "note": (
            "A tile exists if some rectangle holds it. Where 5 m DEMs overlap, the tile is built "
            "from the DEM whose centre is nearer to the tile's centre, whatever the rectangle's "
            "source says."
        ),
        "rects": rects,
    }
    _write_json(out_dir / "manifest.json", manifest)
    _write_json(out_dir / "coverage.json", coverage)

    # The committed subset: the same bytes, with a coverage file that lists only what is there.
    subset_rects = [
        _rect(lv, tx, tx, ty, ty, "committed-subset") for (lv, tx, ty) in sorted(written)
    ]
    for (lv, tx, ty), data in written.items():
        _write(tile_path(engine_dir, lv, tx, ty), data)
    _write_json(engine_dir / "manifest.json", manifest)
    _write_json(
        engine_dir / "coverage.json",
        {"schema_version": 1, "data_version": DATA_VERSION, "rects": subset_rects},
    )

    probes = _probe_fixture(written, written_source, paths, far, half)
    _write_json(probe_path, probes)
    return {
        "out_dir": out_dir,
        "engine_dir": engine_dir,
        "probe_path": probe_path,
        "stats": stats,
        "committed_tiles": len(written),
        "committed_bytes": sum(len(d) for d in written.values()),
        "probes": len(probes["probes"]),
    }


def _write_json(path: Path, doc: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, ensure_ascii=False) + "\n", encoding="utf-8")


def _probe_fixture(
    committed: dict[tuple[int, int, int], bytes],
    owners: dict[tuple[int, int, int], str],
    paths: dict[str, Path],
    far: Dem,
    half: float,
) -> dict[str, Any]:
    """Interior samples of the committed tiles with the raw raster's value at the same place."""
    rasters: dict[str, tuple[F32, float, float, float]] = {
        FAR_DATASET: (far.z, far.left, far.top, far.res)
    }
    for spec in SITE_SPECS:
        with rasterio.open(paths[spec.dataset_id]) as src:
            rasters[spec.dataset_id] = (
                src.read(1).astype(np.float32),
                src.transform.c,
                src.transform.f,
                src.transform.a,
            )
    rng = np.random.default_rng(PROBE_SEED)
    out: list[dict[str, Any]] = []
    for level, tx, ty in sorted(committed):
        cell_m = sample_spacing_m(level, half)
        source = owners[(level, tx, ty)]
        n_sub = 2 ** ((REGIONAL_MAX_LEVEL if source == FAR_DATASET else SITE_MAX_LEVEL) - level)
        z, left, top, res = rasters[source]
        tile = decode_tile(committed[(level, tx, ty)])
        for _ in range(PROBES_PER_TILE):
            row, col = (int(v) for v in rng.integers(BORDER_PX, TILE_SIZE_PX - BORDER_PX, size=2))
            x_m = -half + (tx * INTERIOR_PX + col - BORDER_PX + 0.5) * cell_m
            y_m = -half + (ty * INTERIOR_PX + row - BORDER_PX + 0.5) * cell_m
            ref = reference_height_m(z, left, top, res, x_m, y_m, cell_m, n_sub)
            out.append(
                {
                    "level": level,
                    "x": tx,
                    "y": ty,
                    "row": row,
                    "col": col,
                    "x_m": round(x_m, 3),
                    "y_m": round(y_m, 3),
                    "source": source,
                    "n_sub": n_sub,
                    "ref_height_m": round(ref, 4),
                    "tile_height_m": round(float(tile.heights_m[row, col]), 4),
                }
            )
    digest = hashlib.sha256(b"".join(committed[k] for k in sorted(committed))).hexdigest()
    return {
        "schema_version": 1,
        "generated_by": f"sightline tiles {__version__}",
        "data_version": DATA_VERSION,
        "note": (
            "ref_height_m is the raw raster's bilinear height averaged over n_sub x n_sub points "
            "inside the sample's cell, from reference_height_m (no code shared with the builder). "
            "The engine test compares the decoded committed tile with it."
        ),
        "committed_tiles_sha256": digest,
        "probes": out,
    }
