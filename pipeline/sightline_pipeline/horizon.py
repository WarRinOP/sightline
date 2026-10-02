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

The mask depends on the observer's mast height h. For a ground point at height z and distance s,
with a = s / R, the tangent of its elevation is exactly linear in h:

    tan(theta) = A - h * B,  A = ((z - g) - (R + z) 2 sin^2(a/2)) / H,  B = 1 / H,
    H = (R + z) sin a,       g = ground height under the mast.

So the mask at any mast height is atan(max over ground points of A - h B): the upper envelope of
lines, a handful of segments per azimuth. `horizon_hulls` keeps those lines, which makes the mast
dependence exact instead of interpolated between heights.
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
from sightline_pipeline.sites import SITE_SPECS
from sightline_pipeline.sources import DEFAULT_ENGINE_DATA_DIR, Sources

MOON_RADIUS_M = 1_737_400.0
# 0.25° steps: the contract's HORIZON_AZIMUTH_SAMPLES (MASTER_PLAN).
AZIMUTH_SAMPLES = 1440
MAX_MAST_HEIGHT_M = 20.0  # the contract's maximum
NEAR_STEP_M = 5.0  # the site DEM's pixel
NEAR_RANGE_M = 12_000.0  # beyond the 16 km tile's half-diagonal (11.3 km)
FAR_STEP_M = 80.0  # the mid-tier DEM's pixel
FAR_RANGE_M = 300_000.0  # the 80S map reaches 304 km from the pole
_CHUNK = 60  # azimuths per block, to bound memory

FAR_DATASET = "pgda90-ldem-80s-80m"


def horizon_path(site_id: str, out_dir: Path = DEFAULT_ENGINE_DATA_DIR) -> Path:
    return out_dir / f"horizon_{site_id}.json"


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


def _ray_lines(
    dem: Dem,
    cover: Dem | None,
    lat_rad: float,
    lon_rad: float,
    az: F64,
    steps: F64,
    ground_m: float,
) -> tuple[F64, F64, npt.NDArray[np.bool_]]:
    """For azimuths `az` (one block) and ray distances `steps`: the (A, B) of every ground point,
    and whether the point has data. `cover` is a finer DEM: points it has data for are skipped, so
    each point of ground is judged by the best raster that covers it."""
    lat2, lon2 = destination(lat_rad, lon_rad, az[:, None], steps[None, :])
    x, y = project(lat2, lon2)
    z = dem.sample(x, y)
    ok = np.isfinite(z)
    if cover is not None:
        ok &= ~np.isfinite(cover.sample(x, y))
    zt = np.where(ok, z, 0.0)
    angle = np.broadcast_to(steps[None, :], z.shape) / MOON_RADIUS_M
    r_t = MOON_RADIUS_M + zt
    # (R+z) cos a - (R+g) is written as (z - g) - (R+z)(1 - cos a): the two terms of the direct form
    # are ~1.7e6 m and nearly equal, so subtracting them loses digits at small a.
    horizontal = r_t * np.sin(angle)
    a_line = ((zt - ground_m) - r_t * 2.0 * np.sin(angle / 2) ** 2) / horizontal
    b_line = 1.0 / horizontal
    return a_line, b_line, ok


def _sample_lines(
    near: Dem | None,
    far: Dem | None,
    lat_rad: float,
    lon_rad: float,
    ground_m: float,
    az: F64,
    near_step_m: float,
    near_range_m: float,
    far_step_m: float,
    far_range_m: float,
) -> tuple[F64, F64]:
    """(A, B) of all ground points on the rays of one azimuth block, shape (n_az, n_points), with
    A = -inf where a point has no data (so it never wins the maximum) and B = 0."""
    parts = []
    if near is not None:
        steps = np.arange(
            near_step_m, near_range_m + near_step_m / 2, near_step_m, dtype=np.float64
        )
        parts.append(_ray_lines(near, None, lat_rad, lon_rad, az, steps, ground_m))
    if far is not None:
        steps = np.arange(far_step_m, far_range_m + far_step_m / 2, far_step_m, dtype=np.float64)
        parts.append(_ray_lines(far, near, lat_rad, lon_rad, az, steps, ground_m))
    a = np.concatenate([p[0] for p in parts], axis=1)
    b = np.concatenate([p[1] for p in parts], axis=1)
    ok = np.concatenate([p[2] for p in parts], axis=1)
    return np.where(ok, a, -np.inf), np.where(ok, b, 0.0)


def horizon_masks(
    lat_rad: float,
    lon_rad: float,
    ground_m: float,
    near: Dem | None,
    far: Dem | None,
    mast_heights_m: Sequence[float],
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
    out = np.empty((len(mast_heights_m), n_azimuth))
    for i0 in range(0, n_azimuth, _CHUNK):
        if progress:
            progress(f"azimuths {i0}-{min(i0 + _CHUNK, n_azimuth)}")
        a, b = _sample_lines(
            near, far, lat_rad, lon_rad, ground_m, az[i0 : i0 + _CHUNK],
            near_step_m, near_range_m, far_step_m, far_range_m,
        )  # fmt: skip
        for k, h in enumerate(mast_heights_m):
            best = np.max(a - b * h, axis=1)
            # Checked before the arctan, which would turn -inf (no data) into a finite -pi/2.
            if not np.isfinite(best).all():
                raise ValueError("some azimuths have no terrain data in any raster")
            out[k, i0 : i0 + _CHUNK] = np.arctan(best)
    return out


def upper_envelope(a: F64, b: F64, h_max: float) -> tuple[F64, F64]:
    """The lines y = A - B h (B > 0) that are the maximum somewhere on [0, h_max], in the order
    they take over as h grows. Every line decreases, and the slower ones win later."""
    keep = np.isfinite(a) & (b > 0)
    a, b = a[keep], b[keep]
    if a.size == 0:
        raise ValueError("no ground points on this azimuth")
    # Highest at h = 0; among equals, the flattest line, which stays on top longest.
    top = np.flatnonzero(a == a.max())
    cur = int(top[np.argmin(b[top])])
    out_a, out_b = [a[cur]], [b[cur]]
    h = 0.0
    while True:
        slower = b < b[cur]
        if not slower.any():
            break
        # Where each slower line meets the current one; it is the maximum from there on, until a
        # still slower line takes over. The earliest crossing is the next segment.
        cross = np.full(a.shape, np.inf)
        cross[slower] = (a[cur] - a[slower]) / (b[cur] - b[slower])
        cross = np.maximum(cross, h)  # at h the current line is on top, up to rounding
        first = cross.min()
        if first > h_max:
            break
        ties = np.flatnonzero(cross == first)
        cur = int(ties[np.argmin(b[ties])])
        h = float(first)
        out_a.append(a[cur])
        out_b.append(b[cur])
    return np.array(out_a), np.array(out_b)


def horizon_hulls(
    lat_rad: float,
    lon_rad: float,
    ground_m: float,
    near: Dem | None,
    far: Dem | None,
    h_max: float = MAX_MAST_HEIGHT_M,
    n_azimuth: int = AZIMUTH_SAMPLES,
    progress: Callable[[str], None] | None = None,
) -> list[tuple[F64, F64]]:
    """Per azimuth, the envelope lines (A, B): mask(h) = atan(max(A - B h)) for h in [0, h_max]."""
    if near is None and far is None:
        raise ValueError("no DEM given")
    az = (np.arange(n_azimuth) * (2 * np.pi / n_azimuth)).astype(np.float64)
    hulls: list[tuple[F64, F64]] = []
    for i0 in range(0, n_azimuth, _CHUNK):
        if progress:
            progress(f"azimuths {i0}-{min(i0 + _CHUNK, n_azimuth)}")
        a, b = _sample_lines(
            near, far, lat_rad, lon_rad, ground_m, az[i0 : i0 + _CHUNK],
            NEAR_STEP_M, NEAR_RANGE_M, FAR_STEP_M, FAR_RANGE_M,
        )  # fmt: skip
        for row in range(a.shape[0]):
            try:
                hulls.append(upper_envelope(a[row], b[row], h_max))
            except ValueError as e:
                raise ValueError("some azimuths have no terrain data in any raster") from e
    return hulls


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


def mask_from_hulls(doc: dict[str, Any], mast_height_m: float) -> F64:
    """Evaluate a horizon document's stored envelope at one mast height (radians per azimuth)."""
    offsets = np.asarray(doc["hull_offsets"], dtype=np.intp)
    values = np.asarray(doc["hull_a"], dtype=np.float64) - np.asarray(
        doc["hull_b"], dtype=np.float64
    ) * float(mast_height_m)
    return np.arctan(np.maximum.reduceat(values, offsets[:-1]))


def build_horizon(
    raw_dir: Path,
    sources: Sources,
    sites_path: Path,
    site_id: str,
    far: Dem | None = None,
    progress: Callable[[str], None] | None = None,
) -> dict[str, Any]:
    """The horizon document for one catalog site. Pass `far` to reuse an already-read 80 m map."""
    spec = next((s for s in SITE_SPECS if s.site_id == site_id), None)
    if spec is None:
        raise ValueError(f"unknown site '{site_id}'")
    by_id = {d.id: d for d in sources.datasets}
    paths: dict[str, Path] = {}
    for ds_id in (spec.dataset_id, FAR_DATASET):
        ds = by_id[ds_id]
        path = raw_dir / ds.id / ds.filename
        if not path.exists():
            raise FileNotFoundError(f"{path} is missing: run `sightline fetch --only dem`")
        verify_file(path, ds)
        paths[ds_id] = path

    sites = json.loads(sites_path.read_text(encoding="utf-8"))["sites"]
    site = next((s for s in sites if s["id"] == site_id), None)
    if site is None:
        raise ValueError(f"{sites_path} has no site '{site_id}': run `sightline sites`")
    lat_rad, lon_rad = math.radians(site["lat_deg"]), math.radians(site["lon_deg"])
    ground_m = float(site["elev_m"])

    near = read_dem(paths[spec.dataset_id])
    far = far if far is not None else read_dem(paths[FAR_DATASET])
    x, y = project(np.array([lat_rad]), np.array([lon_rad]))
    sampled = float(near.sample(x, y)[0])
    # The catalog height is a pixel value (or the mean of four) rounded to 0.1 m; the mask uses the
    # catalog value so it matches the engine's `location.elev_m` exactly.
    if not abs(sampled - ground_m) < 0.1:
        raise ValueError(f"site height {ground_m} m disagrees with the DEM ({sampled:.3f} m)")
    far_h = float(far.sample(x, y)[0])

    hulls = horizon_hulls(lat_rad, lon_rad, ground_m, near, far, progress=progress)
    offsets = np.concatenate([[0], np.cumsum([len(a) for a, _ in hulls])]).astype(int)
    ds_near, ds_far = by_id[spec.dataset_id], by_id[FAR_DATASET]
    return {
        "schema_version": 2,
        "generated_by": f"sightline horizon {__version__}",
        "site_id": site_id,
        "location": {"lat_rad": lat_rad, "lon_rad": lon_rad, "elev_m": ground_m},
        "azimuth_samples": AZIMUTH_SAMPLES,
        "azimuth_step_rad": 2 * math.pi / AZIMUTH_SAMPLES,
        "max_mast_height_m": MAX_MAST_HEIGHT_M,
        # mask(az_i, h) = atan(max over k in [offsets[i], offsets[i+1]) of a[k] - b[k] h), exact
        # for every h in [0, max_mast_height_m]. a to 9 decimals, b to 9 significant digits.
        "hull_offsets": [int(v) for v in offsets],
        "hull_a": [round(float(v), 9) for a, _ in hulls for v in a],
        "hull_b": [float(f"{v:.9g}") for _, b in hulls for v in b],
        "method": {
            "geometry": "exact sphere, R = 1737400 m, great-circle rays, bilinear DEM sampling",
            "near": f"{spec.dataset_id}: {NEAR_STEP_M:g} m steps to {NEAR_RANGE_M / 1000:g} km",
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
            "data_sources": [spec.dataset_id, FAR_DATASET],
            "spice_kernels": [],
            "dem_citation": f"{ds_near.citation}; {ds_far.citation}",
            "pipeline_version": __version__,
            "data_version": f"horizon-{site_id}-v1",
        },
    }


def write_horizons(
    raw_dir: Path,
    sources: Sources,
    sites_path: Path,
    out_dir: Path = DEFAULT_ENGINE_DATA_DIR,
    site_ids: Sequence[str] | None = None,
    progress: Callable[[str], None] | None = None,
) -> list[Path]:
    """Write `horizon_<site>.json` for each catalog site (or the ones named)."""
    by_id = {d.id: d for d in sources.datasets}
    far_ds = by_id[FAR_DATASET]
    far_path = raw_dir / far_ds.id / far_ds.filename
    if not far_path.exists():
        raise FileNotFoundError(f"{far_path} is missing: run `sightline fetch --only dem`")
    far = read_dem(far_path)  # 231 MB once, shared by the sites
    out_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for spec in SITE_SPECS:
        if site_ids is not None and spec.site_id not in site_ids:
            continue
        if progress:
            progress(spec.site_id)
        doc = build_horizon(raw_dir, sources, sites_path, spec.site_id, far, progress)
        path = horizon_path(spec.site_id, out_dir)
        path.write_text(json.dumps(doc, ensure_ascii=False) + "\n", encoding="utf-8")
        written.append(path)
    return written
