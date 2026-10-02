"""Reference values for the engine's parity tests. Generated only by `sightline golden`.

Never edit the output by hand and never loosen a test tolerance to make parity pass
(CLAUDE.md §7.8). Sun and Earth directions come from SPICE with the observer fixed on the Moon
(`spkcpo`, light time evaluated at the observer), a different route from the engine's, which
subtracts the site vector from the Moon-centre state. DSN elevations come from SPICE's own
topocentric frames (`spkcpt`).
"""

import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import spiceypy
from numpy.typing import NDArray

from sightline_pipeline import __version__
from sightline_pipeline.ephem import STATIONS
from sightline_pipeline.kernels import loaded_kernels
from sightline_pipeline.sites import DEFAULT_SITES_PATH
from sightline_pipeline.sources import Sources

EPOCH_COUNT = 36
SAMPLE_START_UTC = "2026-01-02T00:00:00"
SAMPLE_END_UTC = "2026-12-30T00:00:00"

# (UTC label, note). Includes both ends of the table and three leap seconds.
TIME_CASES = (
    "1972-01-01T00:00:00",
    "1972-06-30T23:59:59",
    "1972-06-30T23:59:60",
    "1972-07-01T00:00:00",
    "1999-12-31T23:59:59",
    "2000-01-01T12:00:00",
    "2012-06-30T23:59:60",
    "2016-12-31T23:59:59",
    "2016-12-31T23:59:60",
    "2017-01-01T00:00:00",
    "2026-01-01T00:00:00",
    "2026-03-20T12:34:56.789",
    "2026-06-21T03:04:05.250",
    "2026-09-23T18:00:00",
    "2026-12-31T23:59:59.500",
)

# Not a catalog site: the exact pole, to pin the azimuth convention (the given longitude is used).
POLE_POINT = {"id": "pole-test-point", "lat_deg": -90.0, "lon_deg": 0.0, "elev_m": 0.0}

Vec = NDArray[np.float64]


def enu_basis(lat_rad: float, lon_rad: float) -> tuple[Vec, Vec, Vec]:
    """(up, east, north) unit vectors in MOON_ME for a point on the sphere."""
    sl, cl = math.sin(lat_rad), math.cos(lat_rad)
    so, co = math.sin(lon_rad), math.cos(lon_rad)
    up = np.array([cl * co, cl * so, sl])
    east = np.array([-so, co, 0.0])
    north = np.array([-sl * co, -sl * so, cl])
    return up, east, north


def az_el(v: Vec, lat_rad: float, lon_rad: float) -> tuple[float, float]:
    up, east, north = enu_basis(lat_rad, lon_rad)
    az = math.atan2(float(v @ east), float(v @ north)) % (2 * math.pi)
    return az, math.asin(float(v @ up) / float(np.linalg.norm(v)))


def disk_fraction(sun_el_rad: float, horizon_rad: float, sun_radius_rad: float) -> float:
    """Fraction of a circular disk above a straight horizon (circular-segment area)."""
    d = max(-1.0, min(1.0, (sun_el_rad - horizon_rad) / sun_radius_rad))
    return 0.5 + (d * math.sqrt(1 - d * d) + math.asin(d)) / math.pi


def reference_case(
    site: dict[str, Any], mast_m: float, et: float, moon_km: float, sun_km: float
) -> dict[str, Any]:
    lat, lon = math.radians(site["lat_deg"]), math.radians(site["lon_deg"])
    up, _e, _n = enu_basis(lat, lon)
    site_r_km = moon_km + site["elev_m"] / 1000.0
    obspos = (site_r_km + mast_m / 1000.0) * up

    def topo(target: str) -> Vec:
        state, _lt = spiceypy.spkcpo(
            target, et, "MOON_ME", "OBSERVER", "LT+S", obspos, "MOON", "MOON_ME"
        )
        return np.asarray(state[:3], dtype=np.float64)

    sun_v, earth_v = topo("SUN"), topo("EARTH")
    sun_az, sun_el = az_el(sun_v, lat, lon)
    earth_az, earth_el = az_el(earth_v, lat, lon)
    # Horizon of flat ground at the site's own height, seen from the mast top.
    dip = math.acos(site_r_km / (site_r_km + mast_m / 1000.0)) if mast_m > 0 else 0.0
    sun_r = math.asin(sun_km / float(np.linalg.norm(sun_v)))
    dsn: dict[str, float] = {}
    for body, station in STATIONS.items():
        state, _lt = spiceypy.spkcpt(
            obspos, "MOON", "MOON_ME", et, f"{station}_TOPO", "OBSERVER", "LT+S", station
        )
        dsn[body.removeprefix("DSN_").lower()] = math.asin(
            float(state[2]) / float(np.linalg.norm(state[:3]))
        )
    return {
        "site_id": site["id"],
        "lat_deg": site["lat_deg"],
        "lon_deg": site["lon_deg"],
        "elev_m": site["elev_m"],
        "mast_height_m": mast_m,
        "epoch_et": et,
        "sun_azimuth_rad": sun_az,
        "sun_elevation_rad": sun_el,
        "sun_disk_fraction": disk_fraction(sun_el, -dip, sun_r),
        "earth_azimuth_rad": earth_az,
        "earth_elevation_rad": earth_el,
        "dsn_elevation_rad": dsn,
    }


def write_golden(
    raw_dir: Path, sources: Sources, out_dir: Path, sites_path: Path = DEFAULT_SITES_PATH
) -> list[Path]:
    sites = json.loads(sites_path.read_text(encoding="utf-8"))["sites"]
    out_dir.mkdir(parents=True, exist_ok=True)
    with loaded_kernels(raw_dir, sources) as datasets:
        moon_km = float(spiceypy.bodvrd("MOON", "RADII", 3)[1][0])
        sun_km = float(spiceypy.bodvrd("SUN", "RADII", 3)[1][0])
        time_cases = [{"utc": utc, "et": float(spiceypy.str2et(utc))} for utc in TIME_CASES]
        for c in time_cases:
            c["utc_from_et"] = spiceypy.et2utc(c["et"], "ISOC", 3)
        e0 = float(spiceypy.str2et(SAMPLE_START_UTC))
        e1 = float(spiceypy.str2et(SAMPLE_END_UTC))
        # Offsets are not whole hours, so the engine's interpolation is exercised between records.
        epochs = [e0 + (k + 0.37) * (e1 - e0) / EPOCH_COUNT for k in range(EPOCH_COUNT)]
        cases = [
            reference_case(site, 0.0 if k % 2 == 0 else 2.0, et, moon_km, sun_km)
            for site in [*sites, POLE_POINT]
            for k, et in enumerate(epochs)
        ]
        kernels = [d.filename for d in datasets]

    meta = {
        "schema_version": 1,
        "generated_by": f"sightline golden {__version__}",
        "kernels": kernels,
    }
    paths = []
    for name, body in (
        ("time.json", {**meta, "cases": time_cases}),
        (
            "sun_earth.json",
            {**meta, "moon_radius_km": moon_km, "sun_radius_km": sun_km, "cases": cases},
        ),
    ):
        p = out_dir / name
        p.write_text(json.dumps(body, indent=2) + "\n", encoding="utf-8")
        paths.append(p)
    return paths
