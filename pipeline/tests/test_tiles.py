import json

import numpy as np
import numpy.typing as npt
import pytest
import rasterio

from sightline_pipeline.horizon import FAR_DATASET, Dem
from sightline_pipeline.sites import SITE_SPECS
from sightline_pipeline.sources import DEFAULT_RAW_DIR, load_sources
from sightline_pipeline.tiles import (
    DEFAULT_ENGINE_TILES_DIR,
    DEFAULT_PROBE_PATH,
    DEFAULT_TILES_DIR,
    HEADER_BYTES,
    INTERIOR_PX,
    MAX_COUNT,
    DecodedTile,
    Mosaic,
    choose_scale_m,
    decode_tile,
    encode_tile,
    halve,
    reference_height_m,
    resample_bilinear,
    sample_spacing_m,
    site_mosaic,
    tile_path,
    tile_range,
)
from tests.conftest import _present

F32 = npt.NDArray[np.float32]
HALF = 304_000.0

needs_pyramid = pytest.mark.skipif(
    not (DEFAULT_TILES_DIR / "manifest.json").exists(),
    reason="tile pyramid missing: run `sightline tiles`",
)
needs_dems = pytest.mark.skipif(
    not _present([FAR_DATASET, *(s.dataset_id for s in SITE_SPECS)]),
    reason="DEMs missing: run `sightline fetch --only dem`",
)


def plane_dem(left: float, top: float, res: float, n: int, a: float, b: float, c: float) -> Dem:
    """A north-up raster whose pixel-centre heights are the plane z = a x + b y + c."""
    xs = left + (np.arange(n) + 0.5) * res
    ys = top - (np.arange(n) + 0.5) * res
    z = (a * xs[None, :] + b * ys[:, None] + c).astype(np.float32)
    return Dem(z=z, left=left, top=top, res=res)


def test_spacing_at_the_levels_the_sources_serve() -> None:
    assert sample_spacing_m(7, HALF) == pytest.approx(76.6129, abs=1e-4)  # 80 m map
    assert sample_spacing_m(11, HALF) == pytest.approx(4.78831, abs=1e-5)  # 5 m DEMs
    assert sample_spacing_m(0, HALF) == pytest.approx(2**11 * sample_spacing_m(11, HALF))


@pytest.mark.parametrize("origin,size", [(0, 62), (5, 200), (-3, 1000), (61, 500), (62, 64)])
def test_tile_range_is_exactly_the_tiles_whose_window_fits(origin: int, size: int) -> None:
    lo, hi = tile_range(origin, size)
    fits = [
        t
        for t in range(-20, 60)
        if t * INTERIOR_PX - 1 >= origin and t * INTERIOR_PX + INTERIOR_PX <= origin + size - 1
    ]
    assert list(range(lo, hi + 1)) == fits


def test_bilinear_reproduces_a_plane_between_pixel_centres() -> None:
    dem = plane_dem(1000.0, 5000.0, 5.0, 400, a=0.3, b=-0.2, c=17.0)
    xs = 1000.0 + np.array([3.0, 777.7, 1996.0])
    ys = 5000.0 - np.array([4.0, 913.3, 1990.0])
    z = resample_bilinear(dem.z, dem.left, dem.top, dem.res, xs, ys, clamp=False)
    expected = 0.3 * xs[None, :] - 0.2 * ys[:, None] + 17.0
    np.testing.assert_allclose(z, expected, atol=2e-3)  # float32 storage


def test_bilinear_strict_mode_refuses_the_rim_and_clamp_mode_takes_the_nearest_centre() -> None:
    dem = plane_dem(0.0, 100.0, 10.0, 10, a=1.0, b=0.0, c=0.0)
    edge = np.array([2.0])  # 3 m inside the raster, 3 m before the first pixel centre (5 m)
    rows = np.array([50.0])
    with pytest.raises(ValueError):
        resample_bilinear(dem.z, 0.0, 100.0, 10.0, edge, rows, clamp=False)
    z = resample_bilinear(dem.z, 0.0, 100.0, 10.0, edge, rows, clamp=True)
    assert float(z[0, 0]) == pytest.approx(5.0)  # the first centre's height, not extrapolated
    with pytest.raises(ValueError):  # more than half a pixel outside the raster
        resample_bilinear(dem.z, 0.0, 100.0, 10.0, np.array([-1.0]), rows, clamp=True)


def test_site_mosaic_samples_sit_on_the_contract_grid_with_x_along_columns_and_y_along_rows() -> (
    None
):
    a, b, c = 0.5, 0.25, 100.0
    dem = plane_dem(-2000.0, 3000.0, 5.0, 800, a, b, c)  # x -2000..2000, y -1000..3000
    m = site_mosaic(dem, HALF)
    s = sample_spacing_m(11, HALF)
    assert m.level == 11
    for j, i in [(0, 0), (0, 40), (30, 0), (m.z.shape[0] - 1, m.z.shape[1] - 1)]:
        x = -HALF + (m.ox + i + 0.5) * s
        y = -HALF + (m.oy + j + 0.5) * s
        assert float(m.z[j, i]) == pytest.approx(a * x + b * y + c, abs=2e-3)
    # the first and last samples are the outermost ones whose centre is between pixel centres
    assert -2000.0 + 2.5 <= -HALF + (m.ox + 0.5) * s < -2000.0 + 2.5 + s
    last_x = -HALF + (m.ox + m.z.shape[1] - 0.5) * s
    assert 2000.0 - 2.5 - s < last_x <= 2000.0 - 2.5


def test_halve_is_the_mean_of_the_four_children_and_keeps_only_whole_parents() -> None:
    rng = np.random.default_rng(1)
    z = rng.normal(size=(7, 9)).astype(np.float32)
    m = Mosaic(level=5, z=z, ox=3, oy=-2)  # odd origin: the first child column has no sibling
    h = halve(m)
    assert h.level == 4
    # parents I need children 2I and 2I+1 inside [3, 12): I = 2..5; rows [-2, 5): J = -1..1
    assert (h.ox, h.oy) == (2, -1)
    assert h.z.shape == (3, 4)

    def child(j: int, i: int) -> float:
        return float(z[j - m.oy, i - m.ox])

    expected = (child(-2, 4) + child(-2, 5) + child(-1, 4) + child(-1, 5)) / 4
    assert float(h.z[0, 0]) == pytest.approx(float(expected), abs=1e-6)


def test_halving_a_plane_gives_the_plane_at_the_parent_centre() -> None:
    a, b = 0.4, -0.3
    dem = plane_dem(-2000.0, 2000.0, 5.0, 800, a, b, 0.0)
    m = site_mosaic(dem, HALF)
    h = halve(m)
    s_parent = sample_spacing_m(10, HALF)
    x = -HALF + (h.ox + 7 + 0.5) * s_parent
    y = -HALF + (h.oy + 3 + 0.5) * s_parent
    assert float(h.z[3, 7]) == pytest.approx(a * x + b * y, abs=2e-3)


def test_encode_decode_error_is_at_most_half_a_scale_step() -> None:
    rng = np.random.default_rng(2)
    heights = (1500.0 + 800.0 * rng.random((64, 64))).astype(np.float32)
    t = decode_tile(encode_tile(3, 5, 6, heights))
    assert (t.level, t.x, t.y, t.scale_m) == (3, 5, 6, 0.1)
    assert t.offset_m == float(heights.min())
    assert t.counts.min() == 0
    assert np.abs(t.heights_m - heights.astype(np.float64)).max() <= 0.05 + 1e-9


def test_tile_bytes_have_the_documented_layout() -> None:
    data = encode_tile(2, 1, 3, np.full((64, 64), -12.5, dtype=np.float32))
    assert len(data) == HEADER_BYTES + 2 * 64 * 64 == 8224
    assert data[:4] == b"SLT1"
    assert int.from_bytes(data[4:6], "little") == 2  # level
    assert int.from_bytes(data[6:8], "little") == 64  # size_px
    assert int.from_bytes(data[8:12], "little") == 1  # x
    assert int.from_bytes(data[12:16], "little") == 3  # y
    assert np.frombuffer(data[16:24], dtype="<f8")[0] == -12.5  # offset_m
    assert np.frombuffer(data[24:32], dtype="<f8")[0] == 0.1  # scale_m


def test_relief_beyond_the_uint16_range_gets_a_coarser_scale_not_a_clip() -> None:
    assert choose_scale_m(6553.5) == 0.1
    assert choose_scale_m(6553.6) == 0.11
    heights = np.zeros((64, 64), dtype=np.float32)
    heights[0, 0], heights[63, 63] = -7000.0, 6300.0  # 13.3 km, like the level-0 tile
    t = decode_tile(encode_tile(0, 0, 0, heights))
    assert t.scale_m == choose_scale_m(13_300.0) > 0.2
    assert int(t.counts.max()) <= MAX_COUNT
    assert float(t.heights_m[63, 63]) == pytest.approx(6300.0, abs=t.scale_m / 2 + 1e-9)
    assert float(t.heights_m[0, 0]) == -7000.0


def test_non_finite_and_misshapen_tiles_are_refused() -> None:
    bad = np.zeros((64, 64), dtype=np.float32)
    bad[3, 3] = np.nan
    with pytest.raises(ValueError):
        encode_tile(0, 0, 0, bad)
    with pytest.raises(ValueError):
        encode_tile(0, 0, 0, np.zeros((63, 64), dtype=np.float32))
    good = encode_tile(0, 0, 0, np.zeros((64, 64), dtype=np.float32))
    with pytest.raises(ValueError):
        decode_tile(b"XXXX" + good[4:])
    with pytest.raises(ValueError):
        decode_tile(good[:-2])


def test_reference_is_the_plane_value_at_the_centre_for_any_sub_grid() -> None:
    a, b, c = 0.2, 0.1, 5.0
    dem = plane_dem(0.0, 4000.0, 5.0, 800, a, b, c)
    x_m, y_m = 1234.5, 2222.5
    for n_sub in (1, 2, 8):
        ref = reference_height_m(dem.z, dem.left, dem.top, dem.res, x_m, y_m, 60.0, n_sub)
        assert ref == pytest.approx(a * x_m + b * y_m + c, abs=2e-3)


# ---- against the real files (skipped when the data or the pyramid is absent) ----


@needs_pyramid
def test_built_manifest_and_coverage_are_consistent() -> None:
    manifest = json.loads((DEFAULT_TILES_DIR / "manifest.json").read_text(encoding="utf-8"))
    coverage = json.loads((DEFAULT_TILES_DIR / "coverage.json").read_text(encoding="utf-8"))
    assert manifest["simulated"] is False and manifest["provenance"]["simulated"] is False
    assert manifest["level_count"] == 12 and manifest["height_scale_m"] == 0.1
    assert manifest["bounds_m"]["x_max_m"] == HALF
    for r in coverage["rects"]:
        for x, y in [(r["x_min"], r["y_min"]), (r["x_max"], r["y_max"])]:
            assert tile_path(DEFAULT_TILES_DIR, r["level"], x, y).exists()
    regional = [r for r in coverage["rects"] if r["source"] == FAR_DATASET]
    assert [r["level"] for r in regional] == list(range(8))
    assert all(r["x_max"] == 2 ** r["level"] - 1 for r in regional)
    listed = {
        (r["level"], x, y)
        for r in coverage["rects"]
        for x in range(r["x_min"], r["x_max"] + 1)
        for y in range(r["y_min"], r["y_max"] + 1)
    }
    on_disk = {
        (int(f.parent.parent.name), int(f.parent.name), int(f.stem))
        for f in DEFAULT_TILES_DIR.rglob("*.bin")
    }
    assert on_disk == listed  # the rectangles overlap where the 5 m DEMs do; a tile is one file


def read_tile(level: int, x: int, y: int) -> DecodedTile:
    return decode_tile(tile_path(DEFAULT_TILES_DIR, level, x, y).read_bytes())


@needs_pyramid
def test_neighbouring_tiles_agree_on_their_shared_samples() -> None:
    """A tile's border columns are the neighbour's first interior columns (and the reverse).

    Within one source. Each side is rounded to half a step of its own scale, so they agree to
    the mean of the two scales.
    """
    for level, x, y in [(3, 2, 4), (5, 10, 17), (7, 60, 61), (11, 1030, 1010), (9, 255, 250)]:
        a, e, n = (
            read_tile(level, x, y),
            read_tile(level, x + 1, y),
            read_tile(level, x, y + 1),
        )
        east = (a.scale_m + e.scale_m) / 2 + 1e-6
        north = (a.scale_m + n.scale_m) / 2 + 1e-6
        np.testing.assert_allclose(a.heights_m[:, 63], e.heights_m[:, 1], atol=east)
        np.testing.assert_allclose(a.heights_m[:, 62], e.heights_m[:, 0], atol=east)
        np.testing.assert_allclose(a.heights_m[63, :], n.heights_m[1, :], atol=north)
        np.testing.assert_allclose(a.heights_m[62, :], n.heights_m[0, :], atol=north)


@needs_pyramid
@needs_dems
def test_a_tile_in_the_overlap_of_two_5m_dems_comes_from_the_nearer_centre() -> None:
    """(-8000, -12000) m is in Site04 and Site01; Site01's centre is 3 km away, Site04's 8.6 km."""
    level, s = 11, sample_spacing_m(11, HALF)
    tx, ty = int((-8000 + HALF) // (62 * s)), int((-12000 + HALF) // (62 * s))
    tile = read_tile(level, tx, ty)
    by_id = {d.id: d for d in load_sources().datasets}
    refs: dict[str, list[float]] = {}
    for ds_id in ("pgda78-site01-surf", "pgda78-site04-surf"):
        with rasterio.open(DEFAULT_RAW_DIR / ds_id / by_id[ds_id].filename) as src:
            z, t = src.read(1).astype(np.float32), src.transform
        refs[ds_id] = [
            reference_height_m(
                z,
                t.c,
                t.f,
                t.a,
                -HALF + (tx * 62 + c - 1 + 0.5) * s,
                -HALF + (ty * 62 + r - 1 + 0.5) * s,
                s,
                1,
            )
            for r in range(1, 63, 4)
            for c in range(1, 63, 4)
        ]
    got = [float(tile.heights_m[r, c]) for r in range(1, 63, 4) for c in range(1, 63, 4)]
    near, far = refs["pgda78-site01-surf"], refs["pgda78-site04-surf"]
    assert max(abs(g - n) for g, n in zip(got, near, strict=True)) <= 0.051
    # the test only means something if the DEMs differ in this tile
    assert max(abs(f - n) for f, n in zip(far, near, strict=True)) > 0.3


@needs_pyramid
@needs_dems
def test_built_tiles_match_the_raw_rasters_within_half_a_scale_step() -> None:
    """Every committed probe: the pyramid's value against the raw raster's (no shared code)."""
    probes = json.loads(DEFAULT_PROBE_PATH.read_text(encoding="utf-8"))["probes"]
    assert len(probes) >= 400
    worst = 0.0
    for p in probes:
        tile = decode_tile(tile_path(DEFAULT_TILES_DIR, p["level"], p["x"], p["y"]).read_bytes())
        got = float(tile.heights_m[p["row"], p["col"]])
        assert abs(got - p["ref_height_m"]) <= tile.scale_m / 2 + 0.002, p
        if tile.scale_m == 0.1:
            worst = max(worst, abs(got - p["ref_height_m"]))
    assert worst < 0.06


@needs_pyramid
def test_committed_subset_is_byte_identical_to_the_full_pyramid() -> None:
    coverage = json.loads((DEFAULT_ENGINE_TILES_DIR / "coverage.json").read_text(encoding="utf-8"))
    assert len(coverage["rects"]) >= 85
    for r in coverage["rects"]:
        sub = tile_path(DEFAULT_ENGINE_TILES_DIR, r["level"], r["x_min"], r["y_min"]).read_bytes()
        full = tile_path(DEFAULT_TILES_DIR, r["level"], r["x_min"], r["y_min"]).read_bytes()
        assert sub == full
