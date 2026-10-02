import json
import math
from collections.abc import Callable

import numpy as np
import numpy.typing as npt
import pytest
from rasterio.warp import transform

from sightline_pipeline.horizon import (
    AZIMUTH_SAMPLES,
    DEFAULT_HORIZON_PATH,
    FAR_DATASET,
    MAST_HEIGHTS_M,
    MOON_RADIUS_M,
    NEAR_DATASET,
    Dem,
    build_horizon,
    elevation_angle,
    horizon_masks,
    project,
    read_dem,
)
from sightline_pipeline.sites import DEFAULT_SITES_PATH, MOON_GEOGRAPHIC
from sightline_pipeline.sources import DEFAULT_RAW_DIR, load_sources
from tests.conftest import _present

F64 = npt.NDArray[np.float64]
STEREO = "+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs"
needs_horizon_dems = pytest.mark.skipif(
    not _present([NEAR_DATASET, FAR_DATASET]),
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


def test_committed_horizon_file_is_well_formed() -> None:
    doc = json.loads(DEFAULT_HORIZON_PATH.read_text(encoding="utf-8"))
    assert doc["azimuth_samples"] == AZIMUTH_SAMPLES == 1440
    assert doc["azimuth_step_rad"] == pytest.approx(2 * math.pi / 1440)
    assert doc["mast_heights_m"] == list(MAST_HEIGHTS_M)
    rows = np.array(doc["mask_elevation_rad"])
    assert rows.shape == (len(MAST_HEIGHTS_M), 1440)
    assert np.isfinite(rows).all() and np.abs(rows).max() < math.pi / 2
    assert (np.diff(rows, axis=0) <= 0).all()
    assert doc["provenance"]["simulated"] is False
    assert doc["provenance"]["data_sources"] == [NEAR_DATASET, FAR_DATASET]


@needs_horizon_dems
def test_horizon_file_regenerates_from_the_dems() -> None:
    doc = build_horizon(DEFAULT_RAW_DIR, load_sources(), DEFAULT_SITES_PATH)
    committed = json.loads(DEFAULT_HORIZON_PATH.read_text(encoding="utf-8"))
    assert doc["location"] == committed["location"]
    assert doc["mast_heights_m"] == committed["mast_heights_m"]
    a, b = np.array(doc["mask_elevation_rad"]), np.array(committed["mask_elevation_rad"])
    assert np.abs(a - b).max() < 2e-7  # same code and data; rounding at 1e-7
    # The 5 m and 80 m rasters agree about the ground under the observer to a metre or so.
    m = doc["method"]
    assert abs(m["sampled_near_height_m"] - m["sampled_far_height_m"]) < 3.0


@needs_horizon_dems
def test_on_the_real_tile_the_crest_sees_a_lower_horizon_than_the_floor() -> None:
    by_id = {d.id: d for d in load_sources().datasets}
    near = read_dem(DEFAULT_RAW_DIR / NEAR_DATASET / by_id[NEAR_DATASET].filename)
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
def test_mast_interpolation_is_tight_where_the_sun_can_be() -> None:
    # The engine interpolates linearly between the stored mast heights. Between them the error
    # can reach 0.3 degrees, but only on steep-wall azimuths where the mask is above 3 degrees;
    # the Sun never gets above about 2.8 degrees at these latitudes. Where it can be, the error
    # must stay below 0.001 degrees (1/270 of the Sun's radius).
    by_id = {d.id: d for d in load_sources().datasets}
    near = read_dem(DEFAULT_RAW_DIR / NEAR_DATASET / by_id[NEAR_DATASET].filename)
    far = read_dem(DEFAULT_RAW_DIR / FAR_DATASET / by_id[FAR_DATASET].filename)
    doc = json.loads(DEFAULT_HORIZON_PATH.read_text(encoding="utf-8"))
    grid = np.array(doc["mast_heights_m"])
    rows = np.array(doc["mask_elevation_rad"])
    loc = doc["location"]
    mids = [float((a + b) / 2) for a, b in zip(grid[:-1], grid[1:], strict=True)]
    exact = horizon_masks(
        loc["lat_rad"], loc["lon_rad"], loc["elev_m"], near, far, mast_heights_m=mids
    )
    for k, h in enumerate(mids):
        j = int(np.searchsorted(grid, h))
        t = (h - grid[j - 1]) / (grid[j] - grid[j - 1])
        interpolated = rows[j - 1] + (rows[j] - rows[j - 1]) * t
        low = exact[k] < math.radians(3.0)
        assert low.sum() > 100  # there are azimuths in the Sun's band to judge
        assert np.abs(interpolated - exact[k])[low].max() < math.radians(0.001), h
