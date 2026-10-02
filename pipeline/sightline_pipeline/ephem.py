"""Sample Sun, Earth and DSN complexes from SPICE into the compact file the engine reads.

Layout (little-endian float64, record-major): for each record, for each body in `bodies`, six
values x, y, z (km) and vx, vy, vz (km/s) in MOON_ME with LT+S:

- SUN, EARTH: apparent state of the body relative to the Moon's centre.
- DSN_*: apparent state of the station relative to the Earth's centre (station minus Earth).

The engine interpolates between records with cubic Hermite, using the velocities.
"""

import json
from pathlib import Path
from typing import Any

import numpy as np
import spiceypy
from numpy.typing import NDArray

from sightline_pipeline import __version__
from sightline_pipeline.kernels import loaded_kernels
from sightline_pipeline.leapseconds import parse_lsk
from sightline_pipeline.sources import Sources

BODIES = ("SUN", "EARTH", "DSN_GOLDSTONE", "DSN_CANBERRA", "DSN_MADRID")
# The three DSN complexes, each represented by its 70 m antenna.
STATIONS = {"DSN_GOLDSTONE": "DSS-14", "DSN_CANBERRA": "DSS-43", "DSN_MADRID": "DSS-63"}
VALUES_PER_BODY = 6
FRAME = "MOON_ME"
ABCORR = "LT+S"

# The Earth orientation kernel starts at 2026-01-01T00:00:00 UTC, and an apparent (LT+S) state
# looks back by the light time (about 1.3 s), so the first sample is one minute into the year.
DEFAULT_START_UTC = "2026-01-01T00:01:00"
DEFAULT_END_UTC = "2027-01-01T00:01:00"
DEFAULT_STEP_S = 3600


def _state(target: str, et: float) -> NDArray[np.float64]:
    state, _lt = spiceypy.spkezr(target, et, FRAME, ABCORR, "MOON")
    return np.asarray(state, dtype=np.float64)


def sample_states(ets: NDArray[np.float64]) -> NDArray[np.float64]:
    """States for every epoch: shape (n, len(BODIES), 6). Kernels must be loaded."""
    out = np.empty((len(ets), len(BODIES), VALUES_PER_BODY), dtype=np.float64)
    for i, et in enumerate(ets):
        t = float(et)
        sun, earth = _state("SUN", t), _state("EARTH", t)
        out[i, 0], out[i, 1] = sun, earth
        for j, body in enumerate(BODIES[2:], start=2):
            station, _lt = spiceypy.spkezr(STATIONS[body], t, FRAME, ABCORR, "MOON")
            out[i, j] = np.asarray(station, dtype=np.float64) - earth
    return out


def epoch_grid(start_utc: str, end_utc: str, step_s: int) -> NDArray[np.float64]:
    start_et = float(spiceypy.str2et(start_utc))
    span = float(spiceypy.str2et(end_utc)) - start_et
    n_steps = round(span / step_s)
    if abs(span - n_steps * step_s) > 1e-3:
        raise ValueError(f"{start_utc} to {end_utc} is not a whole number of {step_s} s steps")
    return start_et + step_s * np.arange(n_steps + 1, dtype=np.float64)


def write_ephemeris(
    raw_dir: Path,
    sources: Sources,
    out_dir: Path,
    *,
    start_utc: str = DEFAULT_START_UTC,
    end_utc: str = DEFAULT_END_UTC,
    step_s: int = DEFAULT_STEP_S,
) -> tuple[Path, Path, Path]:
    """Write `<stem>.bin`, `<stem>.json` (header) and `leapseconds.json` into `out_dir`."""
    out_dir.mkdir(parents=True, exist_ok=True)
    year = start_utc[:4]
    stem = f"ephemeris_{year}_{step_s}s"
    with loaded_kernels(raw_dir, sources) as datasets:
        ets = epoch_grid(start_utc, end_utc, step_s)
        states = sample_states(ets)
        sun_radius_km = float(spiceypy.bodvrd("SUN", "RADII", 3)[1][0])
        moon_radius_km = float(spiceypy.bodvrd("MOON", "RADII", 3)[1][0])
        kernel_names = [d.filename for d in datasets]
        kernel_ids = [d.id for d in datasets]
        lsk = next(d for d in datasets if d.id == "naif-lsk")
        leap = parse_lsk(raw_dir / lsk.id / lsk.filename)

    bin_path = out_dir / f"{stem}.bin"
    states.reshape(len(ets), -1).astype("<f8").tofile(bin_path)

    header: dict[str, Any] = {
        "schema_version": 1,
        "frame": FRAME,
        "aberration_correction": ABCORR,
        "start_et": float(ets[0]),
        "end_et": float(ets[-1]),
        "step_s": step_s,
        "record_count": len(ets),
        "bodies": list(BODIES),
        "spice_kernels": kernel_names,
        "simulated": False,
        "provenance": {
            "source": "SIGHTLINE_PIPELINE",
            "simulated": False,
            "data_sources": kernel_ids,
            "spice_kernels": kernel_names,
            "dem_citation": None,
            "pipeline_version": __version__,
            "data_version": f"ephem-{year}-{step_s}s-v1",
        },
        "start_utc": start_utc,
        "end_utc": end_utc,
        "sun_radius_km": sun_radius_km,
        "moon_radius_km": moon_radius_km,
        "layout": {
            "file": bin_path.name,
            "dtype": "float64",
            "endianness": "little",
            "values_per_body": VALUES_PER_BODY,
            "fields": ["x_km", "y_km", "z_km", "vx_km_s", "vy_km_s", "vz_km_s"],
            "stations": STATIONS,
        },
    }
    header_path = out_dir / f"{stem}.json"
    header_path.write_text(json.dumps(header, indent=2) + "\n", encoding="utf-8")
    leap_path = out_dir / "leapseconds.json"
    leap_path.write_text(json.dumps(leap, indent=2) + "\n", encoding="utf-8")
    return bin_path, header_path, leap_path
