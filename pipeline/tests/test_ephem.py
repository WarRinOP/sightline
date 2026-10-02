import json
from pathlib import Path

import numpy as np
import spiceypy

from sightline_pipeline.ephem import (
    BODIES,
    DEFAULT_END_UTC,
    DEFAULT_START_UTC,
    DEFAULT_STEP_S,
    VALUES_PER_BODY,
    epoch_grid,
    sample_states,
    write_ephemeris,
)
from sightline_pipeline.kernels import loaded_kernels
from sightline_pipeline.sources import DEFAULT_ENGINE_DATA_DIR, DEFAULT_RAW_DIR, load_sources
from tests.conftest import needs_kernels

COMMITTED_BIN = DEFAULT_ENGINE_DATA_DIR / "ephemeris_2026_3600s.bin"
COMMITTED_HEADER = DEFAULT_ENGINE_DATA_DIR / "ephemeris_2026_3600s.json"


@needs_kernels
def test_header_is_consistent_with_the_file() -> None:
    h = json.loads(COMMITTED_HEADER.read_text(encoding="utf-8"))
    assert h["frame"] == "MOON_ME"
    assert h["aberration_correction"] == "LT+S"
    assert h["bodies"] == list(BODIES)
    assert h["simulated"] is False
    assert h["record_count"] == int((h["end_et"] - h["start_et"]) // h["step_s"]) + 1
    assert COMMITTED_BIN.stat().st_size == h["record_count"] * len(BODIES) * VALUES_PER_BODY * 8
    assert h["provenance"]["source"] == "SIGHTLINE_PIPELINE"
    assert "naif-spk-de440s" in h["provenance"]["data_sources"]
    assert h["start_utc"] == DEFAULT_START_UTC
    assert h["end_utc"] == DEFAULT_END_UTC
    assert h["step_s"] == DEFAULT_STEP_S


@needs_kernels
def test_the_epoch_grid_is_uniform_and_ends_on_the_requested_instant() -> None:
    with loaded_kernels(DEFAULT_RAW_DIR, load_sources()):
        ets = epoch_grid("2026-03-01T00:00:00", "2026-03-02T00:00:00", 3600)
        assert len(ets) == 25
        assert np.allclose(np.diff(ets), 3600.0, atol=1e-6, rtol=0)
        # The grid is uniform in ET; UTC differs from ET by a periodic term of about 1.7 ms at
        # most, which changes by tens of microseconds over a day. `epoch_grid` allows 1 ms.
        assert abs(ets[-1] - spiceypy.str2et("2026-03-02T00:00:00")) < 1e-3


@needs_kernels
def test_sampled_states_have_the_physical_scales() -> None:
    with loaded_kernels(DEFAULT_RAW_DIR, load_sources()):
        ets = epoch_grid("2026-06-01T00:00:00", "2026-06-01T03:00:00", 3600)
        s = sample_states(ets)
    assert s.shape == (4, len(BODIES), VALUES_PER_BODY)
    sun = np.linalg.norm(s[:, 0, :3], axis=1)
    earth = np.linalg.norm(s[:, 1, :3], axis=1)
    assert np.all((sun > 1.45e8) & (sun < 1.55e8))  # about 1 AU in km
    assert np.all((earth > 3.5e5) & (earth < 4.1e5))  # the Moon's distance in km
    for j in (2, 3, 4):  # a DSN complex is on the Earth's surface
        r = np.linalg.norm(s[:, j, :3], axis=1)
        assert np.all((r > 6300) & (r < 6400))


@needs_kernels
def test_regenerating_a_slice_reproduces_the_committed_file(tmp_path: Path) -> None:
    # Same kernels, same code: the first 49 hourly records must match the committed binary.
    bin_path, header_path, _ = write_ephemeris(
        DEFAULT_RAW_DIR,
        load_sources(),
        tmp_path,
        start_utc=DEFAULT_START_UTC,
        end_utc="2026-01-03T00:01:00",
        step_s=DEFAULT_STEP_S,
    )
    fresh = np.fromfile(bin_path, dtype="<f8").reshape(-1, len(BODIES) * VALUES_PER_BODY)
    committed = np.fromfile(COMMITTED_BIN, dtype="<f8").reshape(-1, len(BODIES) * VALUES_PER_BODY)
    assert fresh.shape == (49, 30)
    assert np.allclose(fresh, committed[:49], rtol=1e-9, atol=1e-6)
    assert json.loads(header_path.read_text(encoding="utf-8"))["record_count"] == 49


@needs_kernels
def test_leap_second_table_is_written_next_to_the_ephemeris(tmp_path: Path) -> None:
    _, _, leap = write_ephemeris(
        DEFAULT_RAW_DIR,
        load_sources(),
        tmp_path,
        start_utc=DEFAULT_START_UTC,
        end_utc="2026-01-01T03:01:00",
        step_s=DEFAULT_STEP_S,
    )
    t = json.loads(leap.read_text(encoding="utf-8"))
    committed = json.loads(
        (DEFAULT_ENGINE_DATA_DIR / "leapseconds.json").read_text(encoding="utf-8")
    )
    assert t == committed
