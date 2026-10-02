import json
import math
from pathlib import Path

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin

from sightline_pipeline.sites import (
    DEFAULT_SITES_PATH,
    SITE_SPECS,
    build_sites,
    tile_centre,
)
from sightline_pipeline.sources import DEFAULT_RAW_DIR, load_sources
from tests.conftest import needs_site_dems

STEREO = "+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs"
# Team-lead decision on D-019, option A: the centre of each PGDA #78 tile.
CONFIRMED = {
    "shackleton-rim": (-89.767, 188.130),
    "connecting-ridge": (-89.463, 222.510),
    "de-gerlache-rim": (-88.683, 292.068),
}


def write_tile(path: Path, data: np.ndarray, left: float, top: float, res: float) -> None:
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        height=data.shape[0],
        width=data.shape[1],
        count=1,
        dtype="float32",
        crs=STEREO,
        transform=from_origin(left, top, res, res),
        nodata=float("nan"),
    ) as dst:
        dst.write(data.astype("float32"), 1)


def test_tile_centre_of_a_synthetic_tile_is_the_projected_centre_and_the_mean_of_four_pixels(
    tmp_path: Path,
) -> None:
    # 4 x 4 pixels of 500 m: x from 9000 to 11000, y from -1000 to 1000, centre (10000, 0).
    data = np.arange(16, dtype="float32").reshape(4, 4)
    path = tmp_path / "t.tif"
    write_tile(path, data, left=9000.0, top=1000.0, res=500.0)
    lat, lon, h = tile_centre(path)
    rho = 10000.0
    expected_lat = math.degrees(2 * math.atan(rho / (2 * 1_737_400)) - math.pi / 2)
    assert lat == pytest.approx(expected_lat, abs=1e-9)
    assert lon == pytest.approx(90.0, abs=1e-9)  # x > 0, y = 0: due east of the 0 meridian
    # The centre sits on the corner of the middle four pixels: 5, 6, 9, 10.
    assert h == pytest.approx((5 + 6 + 9 + 10) / 4)


def test_tile_centre_longitude_is_east_positive_in_minus_180_to_180(tmp_path: Path) -> None:
    path = tmp_path / "west.tif"
    write_tile(path, np.zeros((4, 4)), left=-11000.0, top=1000.0, res=500.0)  # centre at x = -10000
    assert tile_centre(path)[1] == pytest.approx(-90.0, abs=1e-9)


def test_tile_centre_rejects_odd_sizes_and_missing_data(tmp_path: Path) -> None:
    odd = tmp_path / "odd.tif"
    write_tile(odd, np.zeros((5, 5)), left=9000.0, top=1250.0, res=500.0)
    with pytest.raises(ValueError, match="odd tile size"):
        tile_centre(odd)
    hole = tmp_path / "hole.tif"
    data = np.ones((4, 4), dtype="float32")
    data[1, 1] = np.nan
    write_tile(hole, data, left=9000.0, top=1000.0, res=500.0)
    with pytest.raises(ValueError, match="no data"):
        tile_centre(hole)


def test_the_three_specs_point_at_registered_site_dems() -> None:
    by_id = {d.id: d for d in load_sources().datasets}
    for spec in SITE_SPECS:
        ds = by_id[spec.dataset_id]
        assert ds.group == "dem"
        assert ds.product_url == "https://pgda.gsfc.nasa.gov/products/78"
        assert ds.sha256 is not None
        assert spec.pgda_site in ds.filename


@needs_site_dems
def test_catalog_holds_the_confirmed_tile_centres() -> None:
    sites = {s["id"]: s for s in build_sites(DEFAULT_RAW_DIR, load_sources())}
    assert set(sites) == set(CONFIRMED)
    for site_id, (lat, lon_east) in CONFIRMED.items():
        s = sites[site_id]
        assert s["lat_deg"] == pytest.approx(lat, abs=5e-4)
        assert (s["lon_deg"] % 360) == pytest.approx(lon_east, abs=5e-4)
        assert s["simulated"] is False
        assert s["source_url"] == "https://pgda.gsfc.nasa.gov/products/78"
        assert "not a landing or rim point" in s["description"]
        assert -7000 < s["elev_m"] < 7000


@needs_site_dems
def test_the_committed_catalog_is_exactly_what_the_pipeline_produces() -> None:
    committed = json.loads(DEFAULT_SITES_PATH.read_text(encoding="utf-8"))
    assert committed["schema_version"] == 1
    assert committed["sites"] == build_sites(DEFAULT_RAW_DIR, load_sources())
