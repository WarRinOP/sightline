"""Ask JPL Horizons for the Sun and Earth as seen from our three sites, to compare with the engine.

Horizons is an independent implementation (DE441, its own lunar orientation model, light bending),
so agreement is evidence that the engine's geometry is right, not just that it matches itself.
Responses are cached under `data/raw/horizons/`; a rerun uses the cache and makes no request.
"""

import hashlib
import json
import math
import re
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import httpx
import numpy as np
import spiceypy

from sightline_pipeline import __version__
from sightline_pipeline.golden import reference_case
from sightline_pipeline.kernels import ensure_kernels_present, loaded_kernels
from sightline_pipeline.sources import Api, Sources

API_ID = "jpl-horizons-api"
TARGETS = {"sun": "10", "earth": "399"}  # Horizons ids: Sun, Earth (body centre)
EPOCH_COUNT = 50
RANGE_START_UTC = "2026-01-02T00:00:00"
RANGE_END_UTC = "2026-12-30T00:00:00"
MAX_ATTEMPTS = 5
MAX_BACKOFF_S = 30.0
# Measured 2026-10-02: a request with 25 times (URL 1,324 characters) is answered; 50 times
# (2,249 characters) gets an HTTP 502 HTML page from the gateway, every time. So ask in batches.
MAX_TIMES_PER_REQUEST = 25

_MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

Progress = Callable[[str], None]


class HorizonsError(Exception):
    """A Horizons answer that cannot be trusted or parsed."""


@dataclass(frozen=True)
class Site:
    id: str
    lat_deg: float
    lon_deg: float
    elev_m: float

    @property
    def site_coord(self) -> str:
        # East longitude in [0, 360), latitude, altitude in km above the 1737.4 km sphere.
        return f"{self.lon_deg % 360.0:.9f},{self.lat_deg:.9f},{self.elev_m / 1000.0:.9f}"


def epochs_utc(
    n: int = EPOCH_COUNT, start: str = RANGE_START_UTC, end: str = RANGE_END_UTC
) -> list[str]:
    """`n` UTC instants evenly spaced from `start` to `end` (inclusive), to the millisecond."""
    t0 = datetime.fromisoformat(start).replace(tzinfo=UTC)
    t1 = datetime.fromisoformat(end).replace(tzinfo=UTC)
    if n < 1:
        raise ValueError("need at least one epoch")
    span_ms = round((t1 - t0).total_seconds() * 1000)
    out = []
    for k in range(n):
        t = t0 + timedelta(milliseconds=round(k * span_ms / (n - 1)) if n > 1 else 0)
        out.append(t.strftime("%Y-%m-%dT%H:%M:%S.") + f"{t.microsecond // 1000:03d}")
    return out


def horizons_time(utc_iso: str) -> str:
    """`2026-03-20T12:34:56.789` to Horizons' `2026-Mar-20 12:34:56.789`."""
    m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2}(?:\.\d+)?)", utc_iso)
    if m is None:
        raise ValueError(f"not an ISO UTC time: {utc_iso}")
    return f"{m[1]}-{_MONTHS[int(m[2]) - 1]}-{m[3]} {m[4]}"


def build_params(site: Site, command: str, utc_times: list[str]) -> dict[str, str]:
    """Query parameters, every value single-quoted as the API requires (httpx encodes them)."""
    tlist = ",".join(f"'{horizons_time(t)}'" for t in utc_times)
    return {
        "format": "json",
        "COMMAND": f"'{command}'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'",
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{site.site_coord}'",
        "TLIST": tlist,
        "TLIST_TYPE": "'CAL'",
        "TIME_TYPE": "'UT'",
        "TIME_DIGITS": "'FRACSEC'",
        "QUANTITIES": "'4'",
        "ANG_FORMAT": "'DEG'",
        "EXTRA_PREC": "'YES'",
        "CSV_FORMAT": "'YES'",
    }


def cache_path(cache_dir: Path, site_id: str, target: str, params: dict[str, str]) -> Path:
    digest = hashlib.sha256(json.dumps(params, sort_keys=True).encode()).hexdigest()[:12]
    return cache_dir / f"{site_id}-{target}-{digest}.json"


def parse_observer_csv(text: str, expected_times: list[str]) -> list[tuple[float, float]]:
    """(azimuth_deg, elevation_deg) per epoch from a CSV observer table, checking the times."""
    if "$$SOE" not in text or "$$EOE" not in text:
        raise HorizonsError(f"no $$SOE/$$EOE block in the answer: {text[:300]!r}")
    head, _, rest = text.partition("$$SOE")
    body = rest.partition("$$EOE")[0]
    header = next((ln for ln in reversed(head.splitlines()) if "Date__(UT)" in ln), None)
    if header is None:
        raise HorizonsError("no column header (Date__(UT)) before $$SOE")
    cols = [c.strip() for c in header.split(",")]
    try:
        i_az = next(i for i, c in enumerate(cols) if c.startswith("Azi"))
        i_el = next(i for i, c in enumerate(cols) if c.startswith("Elev"))
    except StopIteration as e:
        raise HorizonsError(f"no Azi/Elev columns in {cols}") from e
    rows = [ln.split(",") for ln in body.strip().splitlines() if ln.strip()]
    if len(rows) != len(expected_times):
        raise HorizonsError(f"{len(rows)} rows, expected {len(expected_times)}")
    out = []
    for row, want in zip(rows, expected_times, strict=True):
        got = row[0].strip()
        if got != horizons_time(want):
            raise HorizonsError(f"row time {got!r}, expected {horizons_time(want)!r}")
        out.append((float(row[i_az]), float(row[i_el])))
    return out


_CONTEXT_KEYS = (
    "Target body name",
    "Center body name",
    "Center geodetic",
    "Center cylindric",
    "Center pole/equ",
    "Center radii",
    "Atmos refraction",
    "Rel. light bend",
    "Vis. interferer",
)


def parse_context(text: str) -> dict[str, str]:
    """The header lines Horizons prints about the target, the centre and the corrections."""
    out: dict[str, str] = {}
    for key in _CONTEXT_KEYS:
        m = re.search(rf"^\s*{re.escape(key)}\s*:\s*(.+?)\s*$", text, re.M)
        if m:
            out[key] = m.group(1)
    return out


def check_context(context: dict[str, str], site: Site) -> None:
    """Fail if Horizons did not read the site as we meant it."""
    geodetic = context.get("Center geodetic", "")
    # Horizons writes the altitude as `.7697`, with no leading zero.
    nums = [float(x) for x in re.findall(r"[-+]?(?:\d+\.?\d*|\.\d+)", geodetic)[:3]]
    want = [site.lon_deg % 360.0, site.lat_deg, site.elev_m / 1000.0]
    if len(nums) != 3 or any(abs(a - b) > 1e-6 for a, b in zip(nums, want, strict=True)):
        raise HorizonsError(f"Horizons read the site as {geodetic!r}, we asked for {want}")
    radii = context.get("Center radii", "")
    axes = [float(x) for x in re.findall(r"[-+]?(?:\d+\.?\d*|\.\d+)", radii.split("km")[0])]
    if len(axes) != 3 or any(abs(a - 1737.4) > 1e-9 for a in axes):
        raise HorizonsError(f"the Moon is not a 1737.4 km sphere in Horizons: {radii!r}")
    if "MEAN_ME" not in context.get("Center pole/equ", ""):
        raise HorizonsError(f"unexpected lunar orientation: {context.get('Center pole/equ')!r}")
    if not context.get("Atmos refraction", "").upper().startswith("NO"):
        raise HorizonsError(f"refraction is on: {context.get('Atmos refraction')!r}")


def query(
    client: httpx.Client,
    api: Api,
    params: dict[str, str],
    cache_file: Path,
    *,
    refresh: bool = False,
    sleep: Callable[[float], None] = time.sleep,
    progress: Progress | None = None,
) -> dict[str, Any]:
    """The JSON answer, from the cache or from one request (serial, backoff on overload)."""
    if cache_file.exists() and not refresh:
        cached: dict[str, Any] = json.loads(cache_file.read_text(encoding="utf-8"))
        return cached
    last = "no answer"
    for attempt in range(MAX_ATTEMPTS):
        wait = min(2.0**attempt, MAX_BACKOFF_S)
        try:
            r = client.get(api.url, params=params)
        except httpx.TransportError as e:
            last = repr(e)
            if progress:
                progress(f"horizons: {e!r}; retry {attempt + 1}/{MAX_ATTEMPTS} in {wait:.0f} s")
            sleep(wait)
            continue
        if r.status_code in (429, 500, 502, 503, 504):
            last = f"HTTP {r.status_code}"
            if progress:
                progress(
                    f"horizons: HTTP {r.status_code}; retry {attempt + 1}/{MAX_ATTEMPTS} "
                    f"in {wait:.0f} s"
                )
            sleep(wait)
            continue
        if r.status_code != 200:
            raise HorizonsError(f"HTTP {r.status_code}: {r.text[:300]!r}")
        data: dict[str, Any] = r.json()
        version = str(data.get("signature", {}).get("version", ""))
        if version != api.signature_version:
            raise HorizonsError(
                f"Horizons signature version {version!r}, sources.yaml has "
                f"{api.signature_version!r}: re-read the API docs and update sources.yaml "
                "before trusting the answer"
            )
        if "error" in data:
            raise HorizonsError(f"Horizons error: {str(data['error'])[:300]!r}")
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        cache_file.write_text(json.dumps(data, indent=1) + "\n", encoding="utf-8")
        return data
    raise HorizonsError(
        f"gave up after {MAX_ATTEMPTS} attempts (last: {last}; a 502 can mean the URL is too long, "
        f"{len(client.build_request('GET', api.url, params=params).url.query)} bytes of query)"
    )


def _unit(az_deg: float, el_deg: float) -> tuple[float, float, float]:
    a, e = math.radians(az_deg), math.radians(el_deg)
    return math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e)


def separation_deg(az1: float, el1: float, az2: float, el2: float) -> float:
    """Great-circle angle between two directions given as azimuth and elevation in degrees.

    `atan2(|u x v|, u . v)`, not `acos(u . v)`: acos of a number within one rounding step of 1.0
    cannot return less than 8.5e-7 degrees, which would hide every smaller difference.
    """
    u, v = _unit(az1, el1), _unit(az2, el2)
    cross = (
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
    )
    dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
    return math.degrees(math.atan2(math.hypot(*cross), dot))


def load_sites(sites_path: Path) -> list[Site]:
    doc = json.loads(sites_path.read_text(encoding="utf-8"))
    return [Site(s["id"], s["lat_deg"], s["lon_deg"], s["elev_m"]) for s in doc["sites"]]


def build_reference(
    raw_dir: Path,
    sources: Sources,
    sites: list[Site],
    client: httpx.Client,
    *,
    refresh: bool = False,
    sleep: Callable[[float], None] = time.sleep,
    progress: Progress | None = None,
) -> dict[str, Any]:
    ensure_kernels_present(raw_dir, sources)
    api = sources.api(API_ID)
    utc = epochs_utc()
    cache_dir = raw_dir / "horizons"
    answers: dict[tuple[str, str], list[tuple[float, float]]] = {}
    context: dict[str, str] = {}
    signature: dict[str, Any] = {}
    requests_made = 0
    batches = [
        utc[i : i + MAX_TIMES_PER_REQUEST] for i in range(0, len(utc), MAX_TIMES_PER_REQUEST)
    ]
    for site in sites:
        for body, command in TARGETS.items():
            rows: list[tuple[float, float]] = []
            for times in batches:
                params = build_params(site, command, times)
                file = cache_path(cache_dir, site.id, body, params)
                fresh = refresh or not file.exists()
                if fresh and requests_made > 0:
                    sleep(api.min_interval_s)  # at most one request per second
                data = query(
                    client, api, params, file, refresh=refresh, sleep=sleep, progress=progress
                )
                requests_made += int(fresh)
                text = str(data["result"])
                ctx = parse_context(text)
                check_context(ctx, site)
                if not context:
                    context, signature = ctx, dict(data["signature"])
                rows += parse_observer_csv(text, times)
            answers[(site.id, body)] = rows

    with loaded_kernels(raw_dir, sources):
        ets = [float(spiceypy.str2et(t)) for t in utc]
        moon_km = float(spiceypy.bodvrd("MOON", "RADII", 3)[1][0])
        sun_km = float(spiceypy.bodvrd("SUN", "RADII", 3)[1][0])
        cases: list[dict[str, Any]] = []
        for site in sites:
            where: dict[str, Any] = {
                "id": site.id,
                "lat_deg": site.lat_deg,
                "lon_deg": site.lon_deg,
                "elev_m": site.elev_m,
            }
            for k, (t, et) in enumerate(zip(utc, ets, strict=True)):
                ref = reference_case(where, 0.0, et, moon_km, sun_km)
                spice = {
                    body: {
                        "az_deg": math.degrees(ref[f"{body}_azimuth_rad"]),
                        "el_deg": math.degrees(ref[f"{body}_elevation_rad"]),
                    }
                    for body in TARGETS
                }
                horizons = {
                    body: {
                        "az_deg": answers[(site.id, body)][k][0],
                        "el_deg": answers[(site.id, body)][k][1],
                    }
                    for body in TARGETS
                }
                cases.append(
                    {
                        "site_id": site.id,
                        "epoch_index": k,
                        "utc": t,
                        "epoch_et": et,
                        "horizons": horizons,
                        "spice": spice,
                    }
                )

    def gaps(body: str) -> list[float]:
        return [
            separation_deg(
                c["horizons"][body]["az_deg"],
                c["horizons"][body]["el_deg"],
                c["spice"][body]["az_deg"],
                c["spice"][body]["el_deg"],
            )
            for c in cases
        ]

    stats = {}
    for body in TARGETS:
        v = np.asarray(gaps(body))
        stats[body] = {
            "max": float(v.max()),
            "mean": float(v.mean()),
            "rms": float(np.sqrt(np.mean(v**2))),
        }
    return {
        "schema_version": 1,
        "generated_by": f"sightline horizons {__version__}",
        "api": {"id": api.id, "signature": signature, "requests_made_this_run": requests_made},
        "query": {
            "center": "coord@301",
            "coord_type": "GEODETIC (a 1737.4 km sphere in Horizons, so planetocentric)",
            "site_coord": "east longitude deg, latitude deg, altitude km above the sphere",
            "targets": TARGETS,
            "quantities": "4 (apparent azimuth and elevation, no atmosphere)",
            "time_type": "UT",
            "tlist_type": "CAL",
            "observer": "on the ground at the site (no mast)",
        },
        "horizons_context": context,
        "epochs": [
            {"index": k, "utc": t, "et": et} for k, (t, et) in enumerate(zip(utc, ets, strict=True))
        ],
        "sites": [
            {
                "id": s.id,
                "lat_deg": s.lat_deg,
                "lon_deg": s.lon_deg,
                "elev_m": s.elev_m,
                "site_coord": s.site_coord,
            }
            for s in sites
        ],
        "horizons_vs_spice_separation_deg": stats,
        "cases": cases,
    }


def write_reference(
    raw_dir: Path,
    sources: Sources,
    sites_path: Path,
    out_dir: Path,
    client: httpx.Client,
    *,
    refresh: bool = False,
    progress: Progress | None = None,
) -> Path:
    ref = build_reference(
        raw_dir, sources, load_sites(sites_path), client, refresh=refresh, progress=progress
    )
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "horizons_reference.json"
    path.write_text(json.dumps(ref, indent=2) + "\n", encoding="utf-8")
    return path
