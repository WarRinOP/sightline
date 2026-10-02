"""Terrain horizon mask for one observer: the highest elevation the ground reaches per azimuth.

Rays leave the observer along great circles of the 1737.4 km sphere. Along each ray the DEM height
is sampled (bilinear) and turned into an elevation angle above the observer's horizontal plane, with
the sphere's curvature in the geometry (not as a correction). The mask is the maximum over the ray.

Two DEMs are used, because the 5 m site tile only reaches about 8 km from its centre: the tile for
the near field and the 80 m south-polar map for everything the tile does not cover, out to
`FAR_RANGE_M`. Terrain beyond that range, or outside both rasters, is not seen, so the mask is a
lower bound on the true horizon there (METHODS §6).

Azimuth is clockwise from local north, as in the engine (`azElFromVector`); index i of the mask is
azimuth i * 2π / n. Heights are relative to the sphere, like the DEMs.
"""

import json
import math
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import numpy.typing as npt
import rasterio

from sightline_pipeline import __version__
from sightline_pipeline.fetch import verify_file
from sightline_pipeline.sources import DEFAULT_ENGINE_DATA_DIR, Sources

MOON_RADIUS_M = 1_737_400.0
# 0.25° steps: the contract's HORIZON_AZIMUTH_SAMPLES (MASTER_PLAN).
AZIMUTH_SAMPLES = 1440
# A taller mast lowers the mask, and the engine interpolates linearly between these heights. The
# grid is dense near 0 because ground a few metres away (a steep wall) makes the mask fall by
# degrees per metre of mast; the interpolation error is measured in METHODS §6.
MAST_HEIGHTS_M = (0.0, 0.25, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0, 7.5, 10.0, 15.0, 20.0)
NEAR_STEP_M = 5.0  # the site DEM's pixel
NEAR_RANGE_M = 12_000.0  # beyond the 16 km tile's half-diagonal (11.3 km)
FAR_STEP_M = 80.0  # the mid-tier DEM's pixel
FAR_RANGE_M = 300_000.0  # the 80S map reaches 304 km from the pole
_CHUNK = 60  # azimuths per block, to bound memory

SITE_ID = "shackleton-rim"
NEAR_DATASET = "pgda78-site04-surf"
FAR_DATASET = "pgda90-ldem-80s-80m"
DATA_VERSION = "horizon-shackleton-rim-v1"
DEFAULT_HORIZON_PATH = DEFAULT_ENGINE_DATA_DIR / "horizon_shackleton-rim.json"

F64 = npt.NDArray[np.float64]


@dataclass(frozen=True)
class Dem:
    """A north-up raster in the south-polar stereographic plane; values are pixel-centre heights."""

    z: npt.NDArray[np.float32]
    left: float
    top: float
    res: float

    def sample(self, x: F64, y: F64) -> F64:
        """Bilinear height at (x, y) metres; NaN outside the pixel centres or next to a NaN."""
        col = (x - self.left) / self.res - 0.5
        row = (self.top - y) / self.res - 0.5
        h, w = self.z.shape
        inside = (col >= 0) & (col <= w - 1) & (row >= 0) & (row <= h - 1)
        c = np.where(inside, col, 0.0)
        r = np.where(inside, row, 0.0)
        c0 = np.minimum(np.floor(c).astype(np.intp), w - 2)
        r0 = np.minimum(np.floor(r).astype(np.intp), h - 2)
        fc, fr = c - c0, r - r0
        z = self.z
        out = (
            z[r0, c0] * (1 - fc) * (1 - fr)
            + z[r0, c0 + 1] * fc * (1 - fr)
            + z[r0 + 1, c0] * (1 - fc) * fr
            + z[r0 + 1, c0 + 1] * fc * fr
        ).astype(np.float64)
        return np.asarray(np.where(inside, out, np.nan), dtype=np.float64)


def project(lat_rad: F64, lon_rad: F64) -> tuple[F64, F64]:
    """South-polar stereographic, true scale at the pole, central meridian 0 (the PGDA DEMs' CRS).

    rho = 2R tan((90° + lat) / 2); x = rho sin(lon), y = rho cos(lon). Checked against PROJ in
    the tests, and against the real files' CRS when they are loaded.
    """
    rho = 2.0 * MOON_RADIUS_M * np.tan((np.pi / 2 + lat_rad) / 2)
    return rho * np.sin(lon_rad), rho * np.cos(lon_rad)


def destination(lat_rad: float, lon_rad: float, azimuth_rad: F64, dist_m: F64) -> tuple[F64, F64]:
    """Point reached from (lat, lon) along a great circle: azimuth clockwise from north."""
    a = dist_m / MOON_RADIUS_M
    sin_lat2 = math.sin(lat_rad) * np.cos(a) + math.cos(lat_rad) * np.sin(a) * np.cos(azimuth_rad)
    lat2 = np.arcsin(np.clip(sin_lat2, -1.0, 1.0))
    lon2 = lon_rad + np.arctan2(
        np.sin(azimuth_rad) * np.sin(a) * math.cos(lat_rad),
        np.cos(a) - math.sin(lat_rad) * sin_lat2,
    )
    return lat2, lon2


def elevation_angle(z_target_m: F64, dist_m: F64, observer_height_m: float) -> F64:
    """Exact elevation of a surface point above the observer's horizontal plane.

    The observer is `observer_height_m` above the sphere, the target `z_target_m` above it, and
    `dist_m` apart along the surface. In the observer's frame the target is at horizontal
    (R+z) sin(a) and vertical (R+z) cos(a) - (R+h), with a = dist / R. For small a this equals
    atan((z - h) / dist) - dist / (2R) to O(a^3), the textbook form.
    """
    a = dist_m / MOON_RADIUS_M
    r_t = MOON_RADIUS_M + z_target_m
    # (R+z) cos a - (R+h) written as (z - h) - (R+z)(1 - cos a): the two terms of the direct form
    # are ~1.7e6 m and nearly equal, so subtracting them loses digits at small a.
    vertical = (z_target_m - observer_height_m) - r_t * 2.0 * np.sin(a / 2) ** 2
    return np.asarray(np.arctan2(vertical, r_t * np.sin(a)), dtype=np.float64)


def _ray_max(
    dem: Dem,
    cover: Dem | None,
    lat_rad: float,
    lon_rad: float,
    az: F64,
    steps: F64,
    heights_m: Sequence[float],
) -> npt.NDArray[np.float64]:
    """Max elevation per (mast, azimuth) over one DEM; -inf where it has no data on a ray.

    `cover` is a finer DEM: samples it has data for are skipped, so each point of ground is judged
    by the best raster that covers it.
    """
    out = np.full((len(heights_m), az.size), -np.inf)
    for i0 in range(0, az.size, _CHUNK):
        sl = slice(i0, i0 + _CHUNK)
        lat2, lon2 = destination(lat_rad, lon_rad, az[sl, None], steps[None, :])
        x, y = project(lat2, lon2)
        z = dem.sample(x, y)
        ok = np.isfinite(z)
        if cover is not None:
            ok &= ~np.isfinite(cover.sample(x, y))
        d = np.broadcast_to(steps[None, :], z.shape)
        zt = np.where(ok, z, 0.0)
        for k, h in enumerate(heights_m):
            ang = np.where(ok, elevation_angle(zt, d, h), -np.inf)
            out[k, sl] = ang.max(axis=1)
    return out


def horizon_masks(
    lat_rad: float,
    lon_rad: float,
    ground_m: float,
    near: Dem | None,
    far: Dem | None,
    mast_heights_m: Sequence[float] = MAST_HEIGHTS_M,
    n_azimuth: int = AZIMUTH_SAMPLES,
    near_step_m: float = NEAR_STEP_M,
    near_range_m: float = NEAR_RANGE_M,
    far_step_m: float = FAR_STEP_M,
    far_range_m: float = FAR_RANGE_M,
    progress: Callable[[str], None] | None = None,
) -> npt.NDArray[np.float64]:
    """Mask elevation in radians, shape (len(mast_heights_m), n_azimuth).

    Row k is for an observer `ground_m + mast_heights_m[k]` above the sphere. A mask that is -inf
    in some direction means no raster covers it, which is an error rather than a horizon.
    """
    if near is None and far is None:
        raise ValueError("no DEM given")
    az = (np.arange(n_azimuth) * (2 * np.pi / n_azimuth)).astype(np.float64)
    heights = [ground_m + h for h in mast_heights_m]
    parts = []
    if near is not None:
        if progress:
            progress("near field")
        near_steps = np.arange(
            near_step_m, near_range_m + near_step_m / 2, near_step_m, dtype=np.float64
        )
        parts.append(_ray_max(near, None, lat_rad, lon_rad, az, near_steps, heights))
    if far is not None:
        if progress:
            progress("far field")
        far_steps = np.arange(
            far_step_m, far_range_m + far_step_m / 2, far_step_m, dtype=np.float64
        )
        parts.append(_ray_max(far, near, lat_rad, lon_rad, az, far_steps, heights))
    mask: F64 = np.asarray(np.maximum.reduce(parts), dtype=np.float64)
    if not np.isfinite(mask).all():
        raise ValueError("some azimuths have no terrain data in any raster")
    return mask


def read_dem(path: Path) -> Dem:
    """A PGDA raster, checked to be north-up and in the stereographic plane `project` assumes."""
    with rasterio.open(path) as src:
        t = src.transform
        if t.b != 0 or t.d != 0 or t.a != -t.e or t.a <= 0:
            raise ValueError(f"{path.name}: expected a north-up raster with square pixels")
        crs = src.crs.to_dict() if src.crs else {}
        z = src.read(1).astype(np.float32)
    if crs.get("proj") != "stere" or crs.get("lat_0") != -90 or crs.get("lon_0") != 0:
        raise ValueError(f"{path.name}: expected a south-polar stereographic CRS, got {crs}")
    if crs.get("x_0", 0) != 0 or crs.get("y_0", 0) != 0 or crs.get("R", crs.get("a")) != 1737400:
        raise ValueError(f"{path.name}: unexpected offsets or radius in the CRS: {crs}")
    return Dem(z=z, left=t.c, top=t.f, res=t.a)


def build_horizon(
    raw_dir: Path,
    sources: Sources,
    sites_path: Path,
    progress: Callable[[str], None] | None = None,
) -> dict[str, Any]:
    by_id = {d.id: d for d in sources.datasets}
    paths: dict[str, Path] = {}
    for ds_id in (NEAR_DATASET, FAR_DATASET):
        ds = by_id[ds_id]
        path = raw_dir / ds.id / ds.filename
        if not path.exists():
            raise FileNotFoundError(f"{path} is missing: run `sightline fetch --only dem`")
        verify_file(path, ds)
        paths[ds_id] = path

    sites = json.loads(sites_path.read_text(encoding="utf-8"))["sites"]
    site = next((s for s in sites if s["id"] == SITE_ID), None)
    if site is None:
        raise ValueError(f"{sites_path} has no site '{SITE_ID}': run `sightline sites`")
    lat_rad, lon_rad = math.radians(site["lat_deg"]), math.radians(site["lon_deg"])
    ground_m = float(site["elev_m"])

    near, far = read_dem(paths[NEAR_DATASET]), read_dem(paths[FAR_DATASET])
    x, y = project(np.array([lat_rad]), np.array([lon_rad]))
    sampled = float(near.sample(x, y)[0])
    # The catalog height is the mean of the four centre pixels rounded to 0.1 m; the mask uses the
    # catalog value so it matches the engine's `location.elev_m` exactly.
    if not abs(sampled - ground_m) < 0.06:
        raise ValueError(f"site height {ground_m} m disagrees with the DEM ({sampled:.3f} m)")
    far_h = float(far.sample(x, y)[0])

    masks = horizon_masks(lat_rad, lon_rad, ground_m, near, far, progress=progress)
    ds_near, ds_far = by_id[NEAR_DATASET], by_id[FAR_DATASET]
    return {
        "schema_version": 1,
        "generated_by": f"sightline horizon {__version__}",
        "site_id": SITE_ID,
        "location": {"lat_rad": lat_rad, "lon_rad": lon_rad, "elev_m": ground_m},
        "azimuth_samples": AZIMUTH_SAMPLES,
        "azimuth_step_rad": 2 * math.pi / AZIMUTH_SAMPLES,
        "mast_heights_m": list(MAST_HEIGHTS_M),
        # 7 decimals is 6e-6 degrees; rounding keeps the file small and keeps it monotone in mast.
        "mask_elevation_rad": [[round(float(v), 7) for v in row] for row in masks],
        "method": {
            "geometry": "exact sphere, R = 1737400 m, great-circle rays, bilinear DEM sampling",
            "near": f"{NEAR_DATASET}: {NEAR_STEP_M:g} m steps to {NEAR_RANGE_M / 1000:g} km",
            "far": (
                f"{FAR_DATASET}: {FAR_STEP_M:g} m steps to {FAR_RANGE_M / 1000:g} km, "
                "only where the near raster has no data"
            ),
            "sampled_near_height_m": round(sampled, 3),
            "sampled_far_height_m": round(far_h, 3),
        },
        "provenance": {
            "source": "SIGHTLINE_PIPELINE",
            "simulated": False,
            "data_sources": [NEAR_DATASET, FAR_DATASET],
            "spice_kernels": [],
            "dem_citation": f"{ds_near.citation}; {ds_far.citation}",
            "pipeline_version": __version__,
            "data_version": DATA_VERSION,
        },
    }


def write_horizon(
    raw_dir: Path,
    sources: Sources,
    sites_path: Path,
    out: Path = DEFAULT_HORIZON_PATH,
    progress: Callable[[str], None] | None = None,
) -> Path:
    doc = build_horizon(raw_dir, sources, sites_path, progress)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(doc, ensure_ascii=False) + "\n", encoding="utf-8")
    return out
