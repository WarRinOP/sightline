import json
import math
from collections.abc import Callable

import numpy as np
import numpy.typing as npt
import pytest
from rasterio.warp import transform

from sightline_pipeline.horizon import (
    AZIMUTH_SAMPLES,
    FAR_DATASET,
    MOON_RADIUS_M,
    Dem,
    build_horizon,
    elevation_angle,
    horizon_hulls,
    horizon_masks,
    horizon_path,
    mask_from_hulls,
    project,
    read_dem,
    upper_envelope,
)
from sightline_pipeline.sites import DEFAULT_SITES_PATH, MOON_GEOGRAPHIC, SITE_SPECS, SiteSpec
from sightline_pipeline.sources import DEFAULT_RAW_DIR, load_sources
from tests.conftest import _present

F64 = npt.NDArray[np.float64]
STEREO = "+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs"
SITE04 = "pgda78-site04-surf"
needs_horizon_dems = pytest.mark.skipif(
    not _present([*(spec.dataset_id for spec in SITE_SPECS), FAR_DATASET]),
    reason="site and 80 m DEMs missing: run `sightline fetch --only dem`",
)

LAT, LON = math.radians(-89.5), math.radians(40.0)


def observer_xy() -> tuple[float, float]:
    x, y = project(np.array([LAT]), np.array([LON]))
    return float(x[0]), float(y[0])


def make_dem(
    height: Callable[[F64, F64], F64], half_m: float, res_m: float, centre: tuple[float, float]
) -> Dem:
    """A raster of `height(x, y)` centred on `centre`, with pixel-centre values."""
    n = int(round(2 * half_m / res_m))
    left, top = centre[0] - half_m, centre[1] + half_m
    cols = left + (np.arange(n) + 0.5) * res_m
    rows = top - (np.arange(n) + 0.5) * res_m
    xx, yy = np.meshgrid(cols, rows)
    return Dem(z=height(xx, yy).astype(np.float32), left=left, top=top, res=res_m)


def masks(
    dem: Dem,
    ground_m: float = 0.0,
    heights: tuple[float, ...] = (0.0,),
    step_m: float = 5.0,
    range_m: float = 3000.0,
    n_azimuth: int = 360,
) -> F64:
    return horizon_masks(
        LAT,
        LON,
        ground_m,
        dem,
        None,
        mast_heights_m=heights,
        n_azimuth=n_azimuth,
        near_step_m=step_m,
        near_range_m=range_m,
    )


def test_projection_matches_proj() -> None:
    rng = np.random.default_rng(7)
    lat = np.radians(rng.uniform(-90, -80, 500))
    lon = np.radians(rng.uniform(-180, 180, 500))
    xs, ys = transform(MOON_GEOGRAPHIC, STEREO, np.degrees(lon).tolist(), np.degrees(lat).tolist())
    x, y = project(lat, lon)
    assert np.abs(x - np.array(xs)).max() < 1e-6
    assert np.abs(y - np.array(ys)).max() < 1e-6


def test_bilinear_sampling_is_exact_on_a_ramp_and_nan_outside() -> None:
    dem = make_dem(lambda x, y: 0.3 * x - 0.1 * y + 5.0, 500.0, 10.0, (0.0, 0.0))
    x = np.array([0.0, 123.4, -401.7, 495.0])
    y = np.array([0.0, -77.7, 250.2, -495.0])
    assert np.allclose(dem.sample(x, y), 0.3 * x - 0.1 * y + 5.0, atol=1e-3)
    # Outside the outermost pixel centres there is no value, not an extrapolation.
    assert np.isnan(dem.sample(np.array([499.0, 0.0]), np.array([0.0, 600.0]))).all()


def test_flat_sphere_gives_the_closed_form() -> None:
    # A DEM of zeros is the sphere itself. From the ground the nearest sample is the highest
    # (elevation -a/2); from a mast it is the ground at the horizon distance. Both come from the
    # closed form, evaluated sample by sample.
    dem = make_dem(lambda x, y: np.zeros_like(x), 6000.0, 50.0, observer_xy())
    heights = (0.0, 2.0, 20.0)
    m = masks(dem, heights=heights, step_m=50.0, range_m=5000.0)
    steps = np.arange(50.0, 5000.0 + 25.0, 50.0)

    def closed_form(h: float, r: float) -> float:
        a = r / MOON_RADIUS_M
        return math.atan2(
            MOON_RADIUS_M * math.cos(a) - (MOON_RADIUS_M + h), MOON_RADIUS_M * math.sin(a)
        )

    for k, h in enumerate(heights):
        expected = max(closed_form(h, float(r)) for r in steps)
        assert np.allclose(m[k], expected, atol=1e-12), h
    assert m[0][0] == pytest.approx(-(50.0 / MOON_RADIUS_M) / 2, abs=1e-12)
    # From a 2 m mast the highest ground is at the horizon distance sqrt(2 R h) = 2.6 km, and its
    # angle is the flat-horizon dip acos(R / (R + h)) that the engine uses without terrain.
    dip = math.acos(MOON_RADIUS_M / (MOON_RADIUS_M + 2.0))
    # Samples are 50 m apart, so the nearest is up to 25 m off the maximum: 0.5 (4/s^3) 25^2 = 6e-8.
    assert m[1][0] == pytest.approx(-dip, abs=1e-7)
    # Every azimuth is alike on a symmetric world, including the wrap at north.
    assert np.ptp(m[1]) < 1e-12


def test_a_wall_gives_its_elevation_angle() -> None:
    # A 100 m block 1 km due north of the observer: the highest ground is its near edge. North is
    # the direction of increasing latitude, which in this projection is away from the pole, along
    # the unit vector (sin lon, cos lon).
    x0, y0 = observer_xy()
    u, v = math.sin(LON), math.cos(LON)

    def block(x: F64, y: F64) -> F64:
        along = (x - x0) * u + (y - y0) * v
        across = -(x - x0) * v + (y - y0) * u
        return np.where((along > 1000.0) & (along < 1400.0) & (np.abs(across) < 300.0), 100.0, 0.0)

    m = masks(make_dem(block, 3000.0, 5.0, (x0, y0)))[0]
    expected = float(elevation_angle(np.array([100.0]), np.array([1000.0]), 0.0)[0])
    assert expected > 0.09  # the wall is a real feature, not noise
    assert m[0] == pytest.approx(expected, abs=1e-3)
    assert m[180] < 0.0  # behind the observer there is only the falling sphere


def _east_vector_target(dist_m: float) -> tuple[float, float]:
    """Lat and lon `dist_m` due east, built from 3-D vectors (independent of `destination`)."""
    p = np.array([math.cos(LAT) * math.cos(LON), math.cos(LAT) * math.sin(LON), math.sin(LAT)])
    east = np.array([-math.sin(LON), math.cos(LON), 0.0])
    a = dist_m / MOON_RADIUS_M
    q = math.cos(a) * p + math.sin(a) * east
    return math.asin(q[2]), math.atan2(q[1], q[0])


def test_azimuth_is_clockwise_from_north_with_no_wrap_error() -> None:
    x0, y0 = observer_xy()
    lat_e, lon_e = _east_vector_target(800.0)
    ex, ey = project(np.array([lat_e]), np.array([lon_e]))

    def bump(x: F64, y: F64) -> F64:
        return 60.0 * np.exp(-(((x - ex[0]) ** 2 + (y - ey[0]) ** 2) / (2 * 60.0**2)))

    dem = make_dem(bump, 2500.0, 5.0, (x0, y0))
    m = masks(dem)[0]
    assert abs(int(np.argmax(m)) - 90) <= 1  # 360 bins of 1 degree: east is index 90
    # A bump due north peaks across the 359/0 seam, and the two sides agree.
    # A step along the meridian is due north by definition.
    x_n, y_n = project(np.array([LAT + 800.0 / MOON_RADIUS_M]), np.array([LON]))

    def north_bump(x: F64, y: F64) -> F64:
        return 60.0 * np.exp(-(((x - x_n[0]) ** 2 + (y - y_n[0]) ** 2) / (2 * 60.0**2)))

    mn = masks(make_dem(north_bump, 2500.0, 5.0, (x0, y0)))[0]
    assert int(np.argmax(mn)) in (0, 359, 1)
    assert mn[359] == pytest.approx(mn[1], rel=0.15)
    assert float(mn.min()) > -2e-3 and mn[180] < 0.01  # a bump is local, not a wall all round


def test_crater_rim_sees_a_lower_horizon_than_the_floor() -> None:
    # A bowl z = k rho^2 out to rho0, then a flat rim plateau at z0 = k rho0^2.
    x0, y0 = observer_xy()
    k, rho0 = 2e-4, 1000.0
    z0 = k * rho0**2

    def bowl_at(cx: float, cy: float) -> Callable[[F64, F64], F64]:
        def height(x: F64, y: F64) -> F64:
            rho = np.hypot(x - cx, y - cy)
            return np.where(rho <= rho0, k * rho**2, z0)

        return height

    # Floor: standing at the bowl's centre, the highest ground is the wall's top ring, seen at
    # elevation atan(z0 / rho0) in every direction.
    floor = masks(make_dem(bowl_at(x0, y0), 4000.0, 5.0, (x0, y0)), ground_m=0.0)[0]
    expected = float(elevation_angle(np.array([z0]), np.array([rho0]), 0.0)[0])
    assert np.allclose(floor, expected, atol=2e-3)

    # Rim: standing on the plateau 1.5 km from the centre of the same bowl.
    rim_dem = make_dem(bowl_at(x0 + 1500.0, y0), 5000.0, 5.0, (x0, y0))
    rim = masks(rim_dem, ground_m=z0)[0]
    assert rim.mean() < floor.mean() - 0.1
    assert rim.max() < 0.02  # level plateau all round, and the bowl only dips away


def test_a_taller_mast_never_raises_the_mask() -> None:
    x0, y0 = observer_xy()

    def hills(x: F64, y: F64) -> F64:
        u, v = (x - x0) / 700.0, (y - y0) / 900.0
        return 90.0 * np.sin(u) * np.cos(v) + 40.0 * np.sin(3.1 * u + 1.0) * np.sin(2.3 * v)

    dem = make_dem(hills, 4000.0, 10.0, (x0, y0))
    heights = (0.0, 0.5, 1.0, 2.0, 5.0, 20.0)
    m = masks(dem, heights=heights, step_m=10.0, range_m=3500.0)
    assert (np.diff(m, axis=0) <= 1e-15).all()  # delta theta <= 0 for every azimuth
    assert (m[0] - m[-1] > 0).any()  # and a mast does change something on rough ground


def test_matches_the_textbook_formula_on_random_terrain() -> None:
    # An independent scalar implementation: 3-D vectors for the ray, per-sample bilinear, and the
    # small-angle form theta = atan((z - z_obs - h) / r) - r / (2R).
    x0, y0 = observer_xy()

    def hills(x: F64, y: F64) -> F64:
        u, v = (x - x0) / 400.0, (y - y0) / 500.0
        return 120.0 * np.sin(u + 0.3) * np.cos(1.7 * v) + 50.0 * np.sin(2.9 * u) * np.cos(2.1 * v)

    dem = make_dem(hills, 3000.0, 10.0, (x0, y0))
    ground, mast = 20.0, 2.0
    fast = horizon_masks(
        LAT,
        LON,
        ground,
        dem,
        None,
        mast_heights_m=(mast,),
        n_azimuth=360,
        near_step_m=10.0,
        near_range_m=2500.0,
    )[0]

    p = np.array([math.cos(LAT) * math.cos(LON), math.cos(LAT) * math.sin(LON), math.sin(LAT)])
    north = np.array(
        [-math.sin(LAT) * math.cos(LON), -math.sin(LAT) * math.sin(LON), math.cos(LAT)]
    )
    east = np.array([-math.sin(LON), math.cos(LON), 0.0])
    for az_deg in range(0, 360, 31):
        az = math.radians(az_deg)
        d = math.cos(az) * north + math.sin(az) * east
        best = -math.inf
        for r in np.arange(10.0, 2500.0 + 5.0, 10.0):
            a = r / MOON_RADIUS_M
            q = math.cos(a) * p + math.sin(a) * d
            lat, lon = math.asin(q[2]), math.atan2(q[1], q[0])
            x, y = project(np.array([lat]), np.array([lon]))
            z = float(dem.sample(x, y)[0])
            theta = math.atan((z - ground - mast) / r) - r / (2 * MOON_RADIUS_M)
            best = max(best, theta)
        assert fast[az_deg] == pytest.approx(best, abs=5e-5)


def test_no_data_in_a_direction_is_an_error_not_a_horizon() -> None:
    x0, y0 = observer_xy()
    dem = make_dem(lambda x, y: np.zeros_like(x), 100.0, 5.0, (x0 + 5000.0, y0))  # not around us
    with pytest.raises(ValueError, match="no terrain data"):
        masks(dem)


def test_the_envelope_is_the_maximum_of_the_lines_everywhere() -> None:
    rng = np.random.default_rng(3)
    for _ in range(50):
        n = int(rng.integers(1, 400))
        a = rng.normal(0.0, 0.05, n)
        b = 1.0 / rng.uniform(5.0, 5e5, n)  # 1 / horizontal distance, like the real lines
        env_a, env_b = upper_envelope(a, b, 20.0)
        h = np.linspace(0.0, 20.0, 4001)
        direct = np.max(a[None, :] - b[None, :] * h[:, None], axis=1)
        enveloped = np.max(env_a[None, :] - env_b[None, :] * h[:, None], axis=1)
        assert np.allclose(direct, enveloped, atol=1e-12, rtol=0)
        assert (np.diff(env_b) < 0).all()  # each segment is flatter than the last
        assert len(env_a) <= n


def test_the_envelope_of_two_known_lines() -> None:
    # y = 1 - 1 h and y = 0.5 - 0.1 h cross at h = 5/9: the steep one first, then the flat one.
    env_a, env_b = upper_envelope(np.array([1.0, 0.5, -3.0]), np.array([1.0, 0.1, 0.01]), 20.0)
    assert env_a.tolist() == [1.0, 0.5]
    assert env_b.tolist() == [1.0, 0.1]
    # Past the largest height of interest the flatter line is not needed.
    env_a, _ = upper_envelope(np.array([1.0, 0.5]), np.array([1.0, 0.1]), 0.5)
    assert env_a.tolist() == [1.0]
    with pytest.raises(ValueError, match="no ground points"):
        upper_envelope(np.array([-np.inf]), np.array([0.0]), 20.0)


def test_the_stored_envelope_equals_the_direct_mask_at_any_mast_height() -> None:
    # Rough synthetic terrain; heights that no grid would contain.
    x0, y0 = observer_xy()

    def hills(x: F64, y: F64) -> F64:
        u, v = (x - x0) / 90.0, (y - y0) / 110.0
        return 40.0 * np.sin(u + 0.3) * np.cos(1.3 * v) + 15.0 * np.sin(3.7 * u) * np.cos(2.9 * v)

    dem = make_dem(hills, 3000.0, 5.0, (x0, y0))
    far = make_dem(lambda x, y: np.zeros_like(x), 20_000.0, 80.0, (x0, y0))
    heights = (0.0, 0.07, 0.4, 1.3, 2.0, 6.1, 13.3, 19.99, 20.0)
    ground = 12.0
    hulls = horizon_hulls(LAT, LON, ground, dem, far, n_azimuth=120)
    offsets = np.concatenate([[0], np.cumsum([len(a) for a, _ in hulls])])
    doc = {
        "hull_offsets": offsets.tolist(),
        "hull_a": np.concatenate([a for a, _ in hulls]).tolist(),
        "hull_b": np.concatenate([b for _, b in hulls]).tolist(),
    }
    direct = horizon_masks(LAT, LON, ground, dem, far, heights, n_azimuth=120)
    for k, h in enumerate(heights):
        assert np.allclose(mask_from_hulls(doc, h), direct[k], atol=1e-12, rtol=0), h
    # The envelope is a handful of lines per azimuth, not the thousands of samples.
    assert len(doc["hull_a"]) < 120 * 40


@pytest.mark.parametrize("spec", SITE_SPECS, ids=lambda spec: spec.site_id)
def test_committed_horizon_file_is_well_formed(spec: SiteSpec) -> None:
    doc = json.loads(horizon_path(spec.site_id).read_text(encoding="utf-8"))
    assert doc["schema_version"] == 2
    assert doc["site_id"] == spec.site_id
    assert doc["azimuth_samples"] == AZIMUTH_SAMPLES == 1440
    assert doc["azimuth_step_rad"] == pytest.approx(2 * math.pi / 1440)
    assert doc["max_mast_height_m"] == 20.0
    offsets = np.array(doc["hull_offsets"])
    a, b = np.array(doc["hull_a"]), np.array(doc["hull_b"])
    assert offsets.shape == (1441,) and offsets[0] == 0 and offsets[-1] == len(a) == len(b)
    assert (np.diff(offsets) >= 1).all()  # at least one line per azimuth
    assert np.isfinite(a).all() and (b > 0).all()
    heights = (0.0, 0.1, 0.5, 1.0, 2.0, 3.3, 7.0, 12.0, 20.0)
    rows = np.array([mask_from_hulls(doc, h) for h in heights])
    assert np.isfinite(rows).all() and np.abs(rows).max() < math.pi / 2
    assert (np.diff(rows, axis=0) <= 1e-12).all()  # a taller mast never raises the mask
    assert doc["provenance"]["simulated"] is False
    assert doc["provenance"]["data_sources"] == [spec.dataset_id, FAR_DATASET]
    catalog = {s["id"]: s for s in json.loads(DEFAULT_SITES_PATH.read_text())["sites"]}[
        spec.site_id
    ]
    assert doc["location"]["lat_rad"] == pytest.approx(math.radians(catalog["lat_deg"]), abs=1e-12)
    assert doc["location"]["elev_m"] == catalog["elev_m"]


@needs_horizon_dems
@pytest.mark.parametrize("spec", SITE_SPECS, ids=lambda spec: spec.site_id)
def test_horizon_file_regenerates_from_the_dems(spec: SiteSpec) -> None:
    doc = build_horizon(DEFAULT_RAW_DIR, load_sources(), DEFAULT_SITES_PATH, spec.site_id)
    committed = json.loads(horizon_path(spec.site_id).read_text(encoding="utf-8"))
    assert doc["location"] == committed["location"]
    for h in (0.0, 0.3, 2.0, 7.7, 20.0):
        assert np.abs(mask_from_hulls(doc, h) - mask_from_hulls(committed, h)).max() < 2e-6, h
    # The 5 m and 80 m rasters agree about the ground under the observer. A peak is smoothed in
    # the 80 m map (3.1 m at the Shackleton crest), so this catches gross offsets, not that.
    m = doc["method"]
    assert abs(m["sampled_near_height_m"] - m["sampled_far_height_m"]) < 10.0


@needs_horizon_dems
def test_on_the_real_tile_the_crest_sees_a_lower_horizon_than_the_floor() -> None:
    by_id = {d.id: d for d in load_sources().datasets}
    near = read_dem(DEFAULT_RAW_DIR / SITE04 / by_id[SITE04].filename)
    far = read_dem(DEFAULT_RAW_DIR / FAR_DATASET / by_id[FAR_DATASET].filename)
    z = np.nan_to_num(near.z, nan=0.0)
    # Stay 1 km inside the tile edge so every ray starts on 5 m data.
    margin = int(1000 / near.res)
    inner = np.zeros_like(z, dtype=bool)
    inner[margin:-margin, margin:-margin] = True
    out: dict[str, float] = {}
    for name, idx in (
        ("crest", np.argmax(np.where(inner, z, -np.inf))),
        ("floor", np.argmin(np.where(inner, z, np.inf))),
    ):
        r, c = np.unravel_index(idx, z.shape)
        x = near.left + (c + 0.5) * near.res
        y = near.top - (r + 0.5) * near.res
        rho = math.hypot(x, y)
        lat = -math.pi / 2 + 2 * math.atan(rho / (2 * MOON_RADIUS_M))
        lon = math.atan2(x, y)
        mask = horizon_masks(
            lat, lon, float(z[r, c]), near, far, mast_heights_m=(0.0,), n_azimuth=360
        )[0]
        out[name] = float(mask.mean())
    assert out["crest"] < out["floor"]


@needs_horizon_dems
@pytest.mark.parametrize("spec", SITE_SPECS, ids=lambda spec: spec.site_id)
def test_the_committed_envelope_is_exact_at_any_mast_height(spec: SiteSpec) -> None:
    # The engine evaluates the stored lines at the requested mast height. They must equal a
    # fresh brute-force mask at heights that were never stored.
    by_id = {d.id: d for d in load_sources().datasets}
    near = read_dem(DEFAULT_RAW_DIR / spec.dataset_id / by_id[spec.dataset_id].filename)
    far = read_dem(DEFAULT_RAW_DIR / FAR_DATASET / by_id[FAR_DATASET].filename)
    doc = json.loads(horizon_path(spec.site_id).read_text(encoding="utf-8"))
    loc = doc["location"]
    heights = (0.0, 0.05, 0.125, 0.7, 1.9, 2.0, 6.1, 13.3, 19.9, 20.0)
    exact = horizon_masks(loc["lat_rad"], loc["lon_rad"], loc["elev_m"], near, far, heights)
    for k, h in enumerate(heights):
        # Rounding of the stored lines (9 decimals) is the only difference allowed.
        assert np.abs(mask_from_hulls(doc, h) - exact[k]).max() < 2e-7, (spec.site_id, h)
