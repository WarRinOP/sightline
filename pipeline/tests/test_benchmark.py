import json
import math
from pathlib import Path

import numpy as np
import numpy.typing as npt
import pytest
import spiceypy

from sightline_pipeline import benchmark as bm
from sightline_pipeline.benchmark import (
    AVGVISIB_SIZE,
    BARKER_PATH,
    choose_orientation,
    disk_fraction_limb,
    disk_fraction_uniform,
    evaluate_barker,
    limb_darkened_table,
    load_barker,
    longest_run_days,
    map_pixel,
    mask_at,
    sample_map,
    spearman,
    summarize,
    sun_az_el,
    unproject,
)
from sightline_pipeline.golden import disk_fraction
from sightline_pipeline.horizon import Dem, project
from sightline_pipeline.kernels import loaded_kernels
from sightline_pipeline.sources import DEFAULT_RAW_DIR, load_sources
from tests.conftest import needs_kernels

F64 = npt.NDArray[np.float64]
GOLDEN = Path(__file__).resolve().parents[2] / "fixtures" / "golden" / "sun_earth.json"


def test_unproject_inverts_project() -> None:
    rng = np.random.default_rng(2)
    lat = np.radians(rng.uniform(-90, -80, 300))
    lon = np.radians(rng.uniform(-179, 179, 300))
    lat2, lon2 = unproject(*project(lat, lon))
    assert np.allclose(lat2, lat, atol=1e-12) and np.allclose(lon2, lon, atol=1e-12)


def test_visible_fraction_matches_the_golden_formula() -> None:
    rng = np.random.default_rng(4)
    r = np.full(200, 0.00465)
    el = rng.uniform(-0.02, 0.02, 200)
    hor = rng.uniform(-0.02, 0.02, 200)
    ours = disk_fraction_uniform(el, hor, r)
    gold = np.array(
        [disk_fraction(float(e), float(h), 0.00465) for e, h in zip(el, hor, strict=True)]
    )
    assert np.allclose(ours, gold, atol=1e-12)
    assert disk_fraction_uniform(np.array([0.1]), np.array([0.0]), np.array([0.005]))[0] == 1.0
    assert disk_fraction_uniform(np.array([-0.1]), np.array([0.0]), np.array([0.005]))[0] == 0.0


def test_limb_darkened_fraction_has_the_right_limits() -> None:
    d, f = limb_darkened_table(0.6)
    assert f[0] == pytest.approx(1.0, abs=1e-9) and f[-1] == pytest.approx(0.0, abs=1e-9)
    assert np.interp(0.0, d, f) == pytest.approx(0.5, abs=1e-6)  # a symmetric disk
    assert (np.diff(f) <= 1e-12).all()
    # With no limb darkening it is the uniform disk.
    d0, f0 = limb_darkened_table(0.0)
    r = np.full(d0.size, 1.0)
    # The table is indexed by the horizon above the centre; the formula by the centre above it.
    assert np.allclose(f0, disk_fraction_uniform(-d0, np.zeros_like(d0), r), atol=2e-4)
    # Limb darkening changes the answer, but only a little (it is a second-order effect).
    diff = np.abs(f - f0).max()
    assert 1e-3 < diff < 0.1
    out = disk_fraction_limb(np.array([0.003]), np.array([0.0]), np.array([0.00465]), (d, f))
    assert 0.0 < out[0] < 1.0


def test_runs_and_ranks() -> None:
    flags = np.array([1, 1, 0, 1, 1, 1, 0, 0], dtype=bool)
    assert longest_run_days(flags, 86_400.0) == 3.0  # the lit run
    assert longest_run_days(~flags, 43_200.0) == 1.0  # two dark steps of half a day
    s = summarize(np.array([0.0, 0.5, 1.0, 1.0]), 3600.0)
    assert (s.mean_disk_pct, s.lit_pct) == (62.5, 75.0)
    assert spearman(np.arange(10.0), np.arange(10.0) ** 3) == pytest.approx(1.0)
    assert spearman(np.arange(10.0), -np.arange(10.0)) == pytest.approx(-1.0)
    # Ties get mid-ranks: ranks of [1,1,2] are [1.5,1.5,3] against [1,2,3].
    a, b = np.array([1.0, 1.0, 2.0]), np.array([1.0, 2.0, 3.0])
    assert spearman(a, b) == pytest.approx(np.corrcoef([1.5, 1.5, 3], [1, 2, 3])[0, 1])


def test_mask_lookup_wraps_at_north() -> None:
    mask = np.array([0.0, 1.0, 2.0, 3.0])  # bins at 0, 90, 180, 270 degrees
    assert mask_at(mask, np.array([math.radians(45)]))[0] == pytest.approx(0.5)
    assert mask_at(mask, np.array([math.radians(315)]))[0] == pytest.approx(1.5)  # 3 -> 0
    assert mask_at(mask, np.array([2 * math.pi - 1e-12]))[0] == pytest.approx(0.0, abs=1e-9)


def test_sun_direction_geometry() -> None:
    lat, lon = math.radians(-89.5), math.radians(40.0)
    up = np.array([math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat)])
    north = np.array(
        [-math.sin(lat) * math.cos(lon), -math.sin(lat) * math.sin(lon), math.cos(lat)]
    )
    east = np.array([-math.sin(lon), math.cos(lon), 0.0])
    au = 1.496e8
    for vec, want_az, want_el in ((up, 0.0, 90.0), (north, 0.0, 0.0), (east, 90.0, 0.0)):
        az, el, rad = sun_az_el((au * vec)[None, :], lat, lon, 0.0)
        assert math.degrees(el[0]) == pytest.approx(want_el, abs=1e-3)
        if want_el < 90.0:
            assert math.degrees(az[0]) == pytest.approx(want_az, abs=1e-3)
        assert math.degrees(rad[0]) == pytest.approx(0.2666, abs=0.005)
    # A Sun a little west of north is just below 360 degrees, never 360.
    az, _el, _r = sun_az_el((au * (north - 1e-16 * east))[None, :], lat, lon, 0.0)
    assert 0.0 <= az[0] < 2 * math.pi


def test_barker_table_is_structurally_sound() -> None:
    t = load_barker(BARKER_PATH)
    assert t["rois"] == [1, 2, 3, 4, 5, 6, 7] and t["source_dataset_id"] == "ntrs-barker2021-pdf"
    for tag in ("dz1", "dz5"):
        ill = t[tag]["avg_ill_1"]
        for i in range(7):
            assert ill["B"][i] <= ill["A"][i] <= ill["C"][i] <= 100.0
    # The RoI centroids are in the Site01 tile, whose centre is near (-10.99, -11.99) km.
    assert all(
        abs(x + 10.99) < 8 and abs(y + 11.99) < 8 for x, y in zip(t["x_km"], t["y_km"], strict=True)
    )
    # Every one of the paper's 1 m averages is just above the 70% RoI threshold or a pessimistic
    # percentile of it; none is wildly off.
    assert 67.0 <= min(t["dz1"]["avg_ill_1"]["A"]) and max(t["dz1"]["avg_ill_1"]["A"]) <= 72.0


def _row(ours1: float, ours5: float) -> dict[str, float]:
    return {
        "ours_dz1_pct": ours1,
        "ours_dz5_pct": ours5,
        "paper_dz1_A": 70.0,
        "paper_dz1_C": 85.0,
        "paper_dz5_A": 88.0,
        "paper_dz5_C": 91.0,
    }


def test_the_criteria_a1_a2_a3_each_bite() -> None:
    ok = evaluate_barker([_row(75.0, 90.0)] * 3)
    assert ok["passes"] and ok["A1_floor"] and ok["A2_ceiling"] and ok["A3_median_at_least_70"]
    assert not evaluate_barker([_row(67.9, 90.0)] * 3)["A1_floor"]  # 2.1 points under A
    assert evaluate_barker([_row(68.0, 90.0)] * 3)["A1_floor"]  # exactly 2.0 under is allowed
    assert not evaluate_barker([_row(75.0, 85.9)] * 3)["A1_floor"]  # at 5 m too
    assert not evaluate_barker([_row(90.1, 90.0)] * 3)["A2_ceiling"]  # 5.1 over C
    low = evaluate_barker([_row(69.0, 90.0)] * 3)
    assert low["A1_floor"] and not low["A3_median_at_least_70"] and not low["passes"]


def test_map_orientation_is_chosen_from_terrain_not_illumination() -> None:
    # A DEM with a deep pit at (x, y) = (30 km, 10 km). Build a map whose zero pixels (shadow)
    # cover the pit as seen through rot180, the way the real label might need. The terrain test
    # must find rot180 and not another of the eight.
    res = 80.0
    n = 2500
    left, top = -100_000.0, 100_000.0
    cols = left + (np.arange(n) + 0.5) * res
    rows = top - (np.arange(n) + 0.5) * res
    xx, yy = np.meshgrid(cols, rows)
    z = np.where(np.hypot(xx - 30_000.0, yy - 10_000.0) < 12_000.0, -3000.0, 0.0)
    dem = Dem(z=z.astype(np.float32), left=left, top=top, res=res)

    amap = np.full((AVGVISIB_SIZE, AVGVISIB_SIZE), 0.6, dtype=np.float32)
    pr, pc = map_pixel(np.array([30_000.0]), np.array([10_000.0]), "rot180")
    r0, c0 = int(round(float(pr[0]))), int(round(float(pc[0])))
    rr, cc = np.ogrid[:AVGVISIB_SIZE, :AVGVISIB_SIZE]
    amap[(rr - r0) ** 2 + (cc - c0) ** 2 < (11_000.0 / 60.0) ** 2] = 0.0
    found = choose_orientation(amap, dem, n=30_000)
    assert found["chosen"] == "rot180"
    assert found["margin_to_second_m"] > 500.0
    # Sampling through the chosen orientation puts the pit in shadow and a far point in light.
    assert sample_map(amap, np.array([30_000.0]), np.array([10_000.0]), "rot180")[0] == 0.0
    assert sample_map(amap, np.array([-60_000.0]), np.array([-60_000.0]), "rot180")[
        0
    ] == pytest.approx(0.6)
    assert np.isnan(sample_map(amap, np.array([400_000.0]), np.array([0.0]), "rot180")[0])


@needs_kernels
def test_the_sun_path_matches_the_spice_golden_cases() -> None:
    # The benchmark computes the Sun as the engine does (Moon-centre state minus the site vector);
    # the golden fixture's references come from SPICE with the observer on the site.
    golden = json.loads(GOLDEN.read_text(encoding="utf-8"))
    cases = [c for c in golden["cases"] if c["site_id"] == "connecting-ridge"][:30]
    with loaded_kernels(DEFAULT_RAW_DIR, load_sources()):
        sun = np.array(
            [
                spiceypy.spkezr("SUN", c["epoch_et"], bm.FRAME, bm.ABCORR, "MOON")[0][:3]
                for c in cases
            ]
        )
    for k, c in enumerate(cases):
        lat, lon = math.radians(c["lat_deg"]), math.radians(c["lon_deg"])
        az, el, _rad = sun_az_el(sun[k : k + 1], lat, lon, c["elev_m"] + c["mast_height_m"])
        assert math.degrees(abs(el[0] - c["sun_elevation_rad"])) < 1e-4
        daz = abs(az[0] - c["sun_azimuth_rad"])
        assert math.degrees(min(daz, 2 * math.pi - daz)) * math.cos(el[0]) < 1e-4


BENCH = Path(__file__).resolve().parents[2] / "fixtures" / "golden" / "illumination_benchmark.json"


def test_the_criteria_constants_are_the_ones_fixed_in_d025() -> None:
    # D-025 fixed these before the first run. Changing one needs a new decision, not an edit.
    assert (bm.A1_FLOOR_MARGIN_PP, bm.A2_CEILING_MARGIN_PP, bm.A3_MEDIAN_AT_1M_PCT) == (
        2.0,
        5.0,
        70.0,
    )
    assert (bm.B_RHO_ALL, bm.B_RHO_EACH_TILE, bm.B_POINTS_PER_TILE) == (0.8, 0.7, 300)
    assert (bm.BARKER_START_UTC, bm.BARKER_END_UTC) == (
        "2024-01-01T00:00:00",
        "2026-01-01T00:00:00",
    )


def test_the_committed_benchmark_passes_its_own_criteria() -> None:
    d = json.loads(BENCH.read_text(encoding="utf-8"))
    a = d["barker_table2"]
    assert a["steps"] == 17_544  # two years, hourly, end excluded
    assert len(a["rows"]) == 7
    assert evaluate_barker(a["rows"]) == a["criteria"]  # recomputed from the numbers, not trusted
    assert a["criteria"]["passes"] is True
    # The paper's numbers in the rows are the ones in the transcribed table.
    t = load_barker(BARKER_PATH)
    for i, r in enumerate(a["rows"]):
        assert r["paper_dz1_A"] == t["dz1"]["avg_ill_1"]["A"][i]
        assert r["paper_dz5_C"] == t["dz5"]["avg_ill_1"]["C"][i]
        assert r["ours_dz1_pct"] <= r["ours_dz5_pct"] + 1.0  # a taller mast does not see less
        assert (
            r["ours_dz1_pct"] <= r["ours_dz1_lit_pct"]
        )  # a mean fraction is below the any-part share
        # Limb darkening, as assumed here, moves the average by little: the match is not a
        # product of using a uniform disk.
        assert abs(r["ours_dz1_pct"] - r["ours_dz1_limb_pct"]) < 1.0
    m = d["avgvisib"]
    assert m["criteria"]["passes"] is True
    assert m["orientation"]["chosen"] == "identity"
    assert m["orientation"]["margin_to_second_m"] > 300.0  # the terrain test is not a coin toss
    assert m["all_tiles"]["points"] == 900 and m["all_tiles"]["spearman_2m"] >= 0.8
    assert all(t["spearman_2m"] >= 0.7 for t in m["tiles"].values())
    assert set(d["engine_cross_check"]) >= {"shackleton-rim", "connecting-ridge", "de-gerlache-rim"}
    # The far-field range matters out to about 150 km and has nearly converged by 300 km.
    rs = d["range_sensitivity_informational"]
    assert rs["max_abs_change_100km_to_300km_pp"] > 1.0
    by = rs["mean_disk_pct_at_1m_by_far_range"]
    assert max(abs(a - b) for a, b in zip(by["150km"], by["300km"], strict=True)) < 0.5


@needs_kernels
def test_barker_rows_regenerate() -> None:
    from tests.conftest import _present

    ids = ["pgda78-site01-surf", "pgda90-ldem-80s-80m"]
    if not _present(ids):
        pytest.skip("site and 80 m DEMs missing: run `sightline fetch --only dem`")
    sources = load_sources()
    _ets, sun = bm.sun_series(
        DEFAULT_RAW_DIR, sources, bm.BARKER_START_UTC, bm.BARKER_END_UTC, 3600
    )
    fresh = bm.benchmark_barker(DEFAULT_RAW_DIR, sources, sun[:-1], 3600.0)
    committed = json.loads(BENCH.read_text(encoding="utf-8"))["barker_table2"]
    assert fresh["rows"] == committed["rows"]
