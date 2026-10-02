import json
import math
from collections.abc import Callable
from pathlib import Path
from urllib.parse import parse_qs

import httpx
import pytest

from sightline_pipeline.fetch import make_client
from sightline_pipeline.horizons import (
    MAX_TIMES_PER_REQUEST,
    HorizonsError,
    Site,
    build_params,
    build_reference,
    cache_path,
    check_context,
    epochs_utc,
    horizons_time,
    load_sites,
    parse_context,
    parse_observer_csv,
    query,
    separation_deg,
)
from sightline_pipeline.sources import (
    DEFAULT_ENGINE_DATA_DIR,
    DEFAULT_GOLDEN_DIR,
    DEFAULT_RAW_DIR,
    load_sources,
)
from tests.conftest import needs_kernels

SITE = Site("shackleton-rim", -89.766811, -171.869898, 769.7)
API = load_sources().api("jpl-horizons-api")


def result_text(site: Site, times: list[str], rows: list[tuple[float, float]]) -> str:
    """The parts of a Horizons answer that the code reads, in Horizons' format."""
    lon = site.lon_deg % 360.0
    lines = [
        "Target body name: Sun (10)                        {source: DE441}",
        "Center body name: Moon (301)                      {source: DE441}",
        f"Center geodetic : {lon:.6f}, {site.lat_deg:.6f}, {site.elev_m / 1000:.4f}".replace(
            "0.7697", ".7697"
        )
        + "   {E-lon(deg),Lat(deg),Alt(km)}",
        "Center pole/equ : MEAN_ME (high precision)        {East-longitude positive}",
        "Center radii    : 1737.4, 1737.4, 1737.4 km       {Equator_a, b, pole_c}",
        "Atmos refraction: NO (AIRLESS)",
        " Date__(UT)__HR:MN:SC.fff, , ,Azimuth_(a-app), Elevation_(a-app),",
        "$$SOE",
        *[
            f" {horizons_time(t)},*, ,  {az:.9f},       {el:.9f},"
            for t, (az, el) in zip(times, rows, strict=True)
        ],
        "$$EOE",
    ]
    return "\n".join(lines)


def answer(text: str, version: str = "1.2") -> httpx.Response:
    return httpx.Response(200, json={"signature": {"version": version}, "result": text})


def no_sleep(_: float) -> None:
    return None


def test_fifty_epochs_evenly_spread_over_2026_to_the_millisecond() -> None:
    t = epochs_utc()
    assert len(t) == 50
    assert t[0] == "2026-01-02T00:00:00.000"
    assert t[-1] == "2026-12-30T00:00:00.000"
    assert all(x.startswith("2026-") for x in t)
    assert t == sorted(t)
    # Not on whole hours (the first and last are the only ones that are), so the engine's
    # interpolation is exercised between its hourly samples.
    assert sum(1 for x in t if x.endswith(":00:00.000")) < 10


def test_epochs_handle_one_and_reject_none() -> None:
    assert epochs_utc(1) == ["2026-01-02T00:00:00.000"]
    with pytest.raises(ValueError):
        epochs_utc(0)


def test_horizons_time_format_and_rejection() -> None:
    assert horizons_time("2026-03-20T12:34:56.789") == "2026-Mar-20 12:34:56.789"
    assert horizons_time("2026-12-30T00:00:00.000") == "2026-Dec-30 00:00:00.000"
    with pytest.raises(ValueError):
        horizons_time("20 March 2026")


def test_site_coord_wraps_longitude_to_east_0_360_and_converts_height_to_km() -> None:
    assert SITE.site_coord == "188.130102000,-89.766811000,0.769700000"


def test_params_are_quoted_as_the_api_requires_and_ask_for_the_right_thing() -> None:
    times = epochs_utc(3)
    p = build_params(SITE, "10", times)
    assert p["COMMAND"] == "'10'"
    assert p["CENTER"] == "'coord@301'"
    assert p["EPHEM_TYPE"] == "'OBSERVER'"
    assert p["QUANTITIES"] == "'4'"
    assert p["TLIST_TYPE"] == "'CAL'" and p["TIME_TYPE"] == "'UT'"
    assert p["TLIST"].count("'") == 2 * 3
    assert p["TLIST"].split(",")[0] == "'2026-Jan-02 00:00:00.000'"
    assert p["SITE_COORD"] == "'188.130102000,-89.766811000,0.769700000'"
    assert all(v.startswith("'") or k == "format" for k, v in p.items())
    assert "START_TIME" not in p and "STEP_SIZE" not in p  # TLIST excludes the span parameters


def test_the_largest_request_stays_under_the_length_that_worked() -> None:
    p = build_params(SITE, "10", epochs_utc(MAX_TIMES_PER_REQUEST))
    url = httpx.Request("GET", API.url, params=p).url
    assert len(str(url)) < 2000  # 1,324 worked and 2,249 got HTTP 502 on 2026-10-02


def test_parse_observer_csv_reads_az_el_and_checks_each_time() -> None:
    times = epochs_utc(3)
    rows = [(192.262275252, 1.101341937), (145.998090737, -1.45659207), (99.303500664, 1.01196308)]
    assert parse_observer_csv(result_text(SITE, times, rows), times) == rows


def test_parse_observer_csv_rejects_bad_answers() -> None:
    times = epochs_utc(3)
    rows = [(1.0, 2.0)] * 3
    good = result_text(SITE, times, rows)
    with pytest.raises(HorizonsError, match="SOE"):
        parse_observer_csv("No ephemeris for target body", times)
    with pytest.raises(HorizonsError, match="rows"):
        parse_observer_csv(good, times[:2])
    with pytest.raises(HorizonsError, match="row time"):
        parse_observer_csv(good, [times[1], times[0], times[2]])
    with pytest.raises(HorizonsError, match="header"):
        parse_observer_csv(good.replace("Date__(UT)", "Date"), times)
    with pytest.raises(HorizonsError, match="Azi/Elev"):
        parse_observer_csv(good.replace("Azimuth", "Bearing"), times)


def test_context_check_accepts_an_altitude_with_no_leading_zero() -> None:
    ctx = parse_context(result_text(SITE, epochs_utc(1), [(1.0, 2.0)]))
    assert "Center geodetic" in ctx and ".7697" in ctx["Center geodetic"]
    check_context(ctx, SITE)


def test_context_check_rejects_a_site_the_moon_shape_or_refraction_we_did_not_ask_for() -> None:
    ctx = parse_context(result_text(SITE, epochs_utc(1), [(1.0, 2.0)]))
    other = Site("x", SITE.lat_deg, SITE.lon_deg + 0.001, SITE.elev_m)
    with pytest.raises(HorizonsError, match="read the site"):
        check_context(ctx, other)
    with pytest.raises(HorizonsError, match="sphere"):
        check_context({**ctx, "Center radii": "1738.1, 1738.1, 1736.0 km  {a, b, c}"}, SITE)
    with pytest.raises(HorizonsError, match="orientation"):
        check_context({**ctx, "Center pole/equ": "IAU_MOON"}, SITE)
    with pytest.raises(HorizonsError, match="refraction"):
        check_context({**ctx, "Atmos refraction": "YES (REFRACTED)"}, SITE)


def test_separation_resolves_tiny_angles_that_an_acos_formula_would_hide() -> None:
    assert separation_deg(10, 5, 10, 5) == 0.0
    for tiny in (1e-9, 1e-8, 1e-7, 1e-6):
        assert separation_deg(10, 5, 10, 5 + tiny) == pytest.approx(tiny, rel=1e-6)
    assert separation_deg(0, 0, 90, 0) == pytest.approx(90.0)
    assert separation_deg(10, 90, 200, 90) == pytest.approx(0.0, abs=1e-9)
    # The floor of acos(1 - eps): the value every sub-microdegree residual used to collapse to.
    assert math.degrees(math.acos(1 - 2**-53)) == pytest.approx(8.537736e-07, rel=1e-6)


class TestQuery:
    def params(self) -> dict[str, str]:
        return build_params(SITE, "10", epochs_utc(2))

    def test_uses_the_cache_on_the_second_call_without_the_network(self, tmp_path: Path) -> None:
        calls = 0

        def handler(_: httpx.Request) -> httpx.Response:
            nonlocal calls
            calls += 1
            return answer("hello")

        file = tmp_path / "c.json"
        with make_client(httpx.MockTransport(handler)) as c:
            a = query(c, API, self.params(), file, sleep=no_sleep)
            b = query(c, API, self.params(), file, sleep=no_sleep)
            query(c, API, self.params(), file, refresh=True, sleep=no_sleep)
        assert a == b and calls == 2

    def test_http_200_carrying_an_error_is_an_error(self, tmp_path: Path) -> None:
        def handler(_: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"signature": {"version": "1.2"}, "error": "bad time"})

        with (
            make_client(httpx.MockTransport(handler)) as c,
            pytest.raises(HorizonsError, match="bad time"),
        ):
            query(c, API, self.params(), tmp_path / "c.json", sleep=no_sleep)
        assert not (tmp_path / "c.json").exists()

    def test_a_changed_signature_version_is_refused(self, tmp_path: Path) -> None:
        with make_client(httpx.MockTransport(lambda _: answer("x", version="1.3"))) as c:
            with pytest.raises(HorizonsError, match="signature version"):
                query(c, API, self.params(), tmp_path / "c.json", sleep=no_sleep)

    def test_overload_is_retried_with_backoff_then_succeeds(self, tmp_path: Path) -> None:
        calls = 0
        waits: list[float] = []

        def handler(_: httpx.Request) -> httpx.Response:
            nonlocal calls
            calls += 1
            return httpx.Response(503) if calls < 3 else answer("ok")

        with make_client(httpx.MockTransport(handler)) as c:
            data = query(c, API, self.params(), tmp_path / "c.json", sleep=waits.append)
        assert data["result"] == "ok" and waits == [1.0, 2.0]

    def test_gives_up_naming_the_last_status_and_the_url_length(self, tmp_path: Path) -> None:
        with make_client(httpx.MockTransport(lambda _: httpx.Response(502, text="<html>"))) as c:
            with pytest.raises(HorizonsError, match="HTTP 502.*URL is too long"):
                query(c, API, self.params(), tmp_path / "c.json", sleep=no_sleep)

    def test_other_http_errors_are_not_retried(self, tmp_path: Path) -> None:
        calls = 0

        def handler(_: httpx.Request) -> httpx.Response:
            nonlocal calls
            calls += 1
            return httpx.Response(400, text="bad request")

        with (
            make_client(httpx.MockTransport(handler)) as c,
            pytest.raises(HorizonsError, match="HTTP 400"),
        ):
            query(c, API, self.params(), tmp_path / "c.json", sleep=no_sleep)
        assert calls == 1

    def test_cache_names_differ_by_site_target_and_parameters(self, tmp_path: Path) -> None:
        a = cache_path(tmp_path, "s", "sun", self.params())
        b = cache_path(tmp_path, "s", "earth", self.params())
        c = cache_path(tmp_path, "s", "sun", build_params(SITE, "10", epochs_utc(3)))
        assert len({a, b, c}) == 3


_MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


def _calendar_to_iso(t: str) -> str:
    """`2026-Mar-20 12:34:56.789` back to `2026-03-20T12:34:56.789`."""
    month = _MONTHS.index(t[5:8]) + 1
    return f"{t[:4]}-{month:02d}-{t[9:11]}T{t[12:]}"


def fake_server(requests: list[httpx.Request]) -> Callable[[httpx.Request], httpx.Response]:
    """Answers like Horizons for the parameters in the request (fixed az/el per target)."""

    def handler(req: httpx.Request) -> httpx.Response:
        requests.append(req)
        q = {k: v[0] for k, v in parse_qs(req.url.query.decode()).items()}
        times = [t.strip("'") for t in q["TLIST"].split(",")]
        lon, lat, alt = (float(x) for x in q["SITE_COORD"].strip("'").split(","))
        site = Site("x", lat, lon, alt * 1000.0)
        iso = [_calendar_to_iso(t) for t in times]
        az, el = (100.0, 1.0) if q["COMMAND"] == "'10'" else (170.0, 5.0)
        return answer(result_text(site, iso, [(az, el)] * len(iso)))

    return handler


@needs_kernels
def test_the_reference_is_built_in_batches_one_request_at_a_time_and_cached(tmp_path: Path) -> None:
    sources = load_sources()
    sites = load_sites(DEFAULT_ENGINE_DATA_DIR / "sites.json")
    requests: list[httpx.Request] = []
    waits: list[float] = []
    raw = tmp_path / "raw"
    # The kernels live in the real raw dir; link them so `loaded_kernels` finds and verifies them.
    for ds in sources.datasets:
        src = DEFAULT_RAW_DIR / ds.id
        if src.exists() and ds.group == "spice":
            (raw / ds.id).parent.mkdir(parents=True, exist_ok=True)
            (raw / ds.id).symlink_to(src, target_is_directory=True)
    with make_client(httpx.MockTransport(fake_server(requests))) as c:
        ref = build_reference(raw, sources, sites, c, sleep=waits.append)
        assert len(requests) == 3 * 2 * 2  # 3 sites x (Sun, Earth) x 2 batches of 25
        assert ref["api"]["requests_made_this_run"] == 12
        assert len(ref["cases"]) == 150
        assert waits == [API.min_interval_s] * 11  # at most one request per second
        for r in requests:
            q = {k: v[0] for k, v in parse_qs(r.url.query.decode()).items()}
            assert len(q["TLIST"].split(",")) <= MAX_TIMES_PER_REQUEST
        again = build_reference(raw, sources, sites, c, sleep=waits.append)
        assert len(requests) == 12 and again["api"]["requests_made_this_run"] == 0
    c0 = ref["cases"][0]
    assert c0["horizons"]["sun"] == {"az_deg": 100.0, "el_deg": 1.0}
    assert set(c0["spice"]) == {"sun", "earth"}


def test_the_committed_reference_is_complete_and_consistent_with_the_catalog() -> None:
    ref = json.loads((DEFAULT_GOLDEN_DIR / "horizons_reference.json").read_text(encoding="utf-8"))
    sites = load_sites(DEFAULT_ENGINE_DATA_DIR / "sites.json")
    assert [s["id"] for s in ref["sites"]] == [s.id for s in sites]
    assert [e["utc"] for e in ref["epochs"]] == epochs_utc()
    assert len(ref["cases"]) == len(sites) * 50
    assert ref["api"]["signature"]["version"] == API.signature_version
    assert ref["query"]["targets"] == {"sun": "10", "earth": "399"}
    assert "MEAN_ME" in ref["horizons_context"]["Center pole/equ"]
    # Horizons and SPICE are independent routes; they agree far inside the 0.02 degree tolerance.
    for body in ("sun", "earth"):
        assert ref["horizons_vs_spice_separation_deg"][body]["max"] < 1e-4
    for c in ref["cases"]:
        for body in ("sun", "earth"):
            assert c["horizons"][body] != c["spice"][body]  # two sources, never the same numbers
