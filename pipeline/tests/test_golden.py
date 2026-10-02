import json
import math
from pathlib import Path

import numpy as np

from sightline_pipeline.golden import (
    EPOCH_COUNT,
    POLE_POINT,
    az_el,
    disk_fraction,
    enu_basis,
    write_golden,
)
from sightline_pipeline.sources import DEFAULT_GOLDEN_DIR, DEFAULT_RAW_DIR, load_sources
from tests.conftest import needs_kernels


def test_enu_basis_is_orthonormal_and_right_handed() -> None:
    for lat in (-math.pi / 2, -1.2, 0.0, 0.9):
        for lon in (-2.0, 0.0, 1.3):
            up, east, north = enu_basis(lat, lon)
            assert np.allclose([up @ up, east @ east, north @ north], 1.0)
            assert abs(up @ east) < 1e-12 and abs(up @ north) < 1e-12 and abs(east @ north) < 1e-12
            assert np.allclose(np.cross(east, north), up)


def test_az_el_conventions() -> None:
    lat, lon = -1.2, 2.1
    up, east, north = enu_basis(lat, lon)
    assert az_el(north, lat, lon)[0] == 0.0
    assert math.isclose(az_el(east, lat, lon)[0], math.pi / 2)
    assert math.isclose(az_el(-north, lat, lon)[0], math.pi)
    assert math.isclose(az_el(-east, lat, lon)[0], 3 * math.pi / 2)
    assert math.isclose(az_el(up, lat, lon)[1], math.pi / 2)


def test_az_just_west_of_north_stays_below_two_pi() -> None:
    # East component of -1.1e-16: atan2 gives about -1e-16 and `% 2π` used to round up to 2π,
    # which broke the [0, 2π) convention (seen on a CI runner whose matmul rounded the other way).
    lat, lon = -1.2, 2.1
    _up, east, north = enu_basis(lat, lon)
    az = az_el(north - 1e-16 * east, lat, lon)[0]
    assert 0.0 <= az < 2 * math.pi


def test_disk_fraction_limits_and_symmetry() -> None:
    r = 0.00465
    assert math.isclose(disk_fraction(0.1, 0.1, r), 0.5)
    assert disk_fraction(0.1 + r, 0.1, r) == 1.0
    assert disk_fraction(0.1 - r, 0.1, r) == 0.0
    assert math.isclose(disk_fraction(0.3 * r, 0, r) + disk_fraction(-0.3 * r, 0, r), 1.0)


def test_the_pole_test_point_is_the_exact_south_pole() -> None:
    assert POLE_POINT["lat_deg"] == -90.0


def test_committed_fixtures_have_the_expected_shape() -> None:
    sun_earth = json.loads((DEFAULT_GOLDEN_DIR / "sun_earth.json").read_text(encoding="utf-8"))
    assert len(sun_earth["cases"]) == 4 * EPOCH_COUNT  # 3 catalog sites and the pole
    assert {c["mast_height_m"] for c in sun_earth["cases"]} == {0.0, 2.0}
    time = json.loads((DEFAULT_GOLDEN_DIR / "time.json").read_text(encoding="utf-8"))
    assert any(c["utc"].endswith("23:59:60") for c in time["cases"])  # leap seconds are covered
    assert sun_earth["generated_by"].startswith("sightline golden")


@needs_kernels
def test_regenerating_the_fixtures_reproduces_the_committed_ones(tmp_path: Path) -> None:
    write_golden(DEFAULT_RAW_DIR, load_sources(), tmp_path)
    for name in ("time.json", "sun_earth.json"):
        fresh = json.loads((tmp_path / name).read_text(encoding="utf-8"))
        committed = json.loads((DEFAULT_GOLDEN_DIR / name).read_text(encoding="utf-8"))
        assert fresh["kernels"] == committed["kernels"]
        assert len(fresh["cases"]) == len(committed["cases"])
        for a, b in zip(fresh["cases"], committed["cases"], strict=True):
            for key, va in a.items():
                vb = b[key]
                if isinstance(va, dict):
                    assert all(math.isclose(va[k], vb[k], rel_tol=1e-9, abs_tol=1e-12) for k in va)
                elif isinstance(va, float):
                    assert math.isclose(va, vb, rel_tol=1e-9, abs_tol=1e-12), (name, key)
                else:
                    assert va == vb, (name, key)
