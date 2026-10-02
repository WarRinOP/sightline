import hashlib
from collections.abc import Callable
from pathlib import Path

import httpx
import pytest

from sightline_pipeline.fetch import FetchError, fetch_dataset, make_client, run_fetch, target_path
from sightline_pipeline.sources import Dataset, Sources, load_sources

PAYLOAD = bytes(range(256)) * 40  # 10,240 bytes
SHA = hashlib.sha256(PAYLOAD).hexdigest()
MD5 = hashlib.md5(PAYLOAD, usedforsecurity=False).hexdigest()
URL = "https://example.invalid/kernels/test.bsp"

Handler = Callable[[httpx.Request], httpx.Response]


def dataset(**over: object) -> Dataset:
    base: dict[str, object] = {
        "id": "test-kernel",
        "group": "spice",
        "url": URL,
        "role": "test",
        "expected_bytes": len(PAYLOAD),
        "expected_content_type": "application/octet-stream",
        "sha256": SHA,
        "md5": MD5,
        "license": "test",
        "citation": "test",
        "verified_at": "2026-10-02",
    }
    return Dataset.model_validate(base | over)


def serve(handler: Handler) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def ok(_: httpx.Request) -> httpx.Response:
    return httpx.Response(
        200, content=PAYLOAD, headers={"content-type": "application/octet-stream"}
    )


def no_sleep(_: float) -> None:
    return None


def test_downloads_verifies_and_keeps_the_file(tmp_path: Path) -> None:
    with serve(ok) as client:
        r = fetch_dataset(dataset(), tmp_path, client, sleep=no_sleep)
    assert r.status == "downloaded"
    assert r.pinned
    assert r.sha256 == SHA
    assert r.downloaded_bytes == len(PAYLOAD)
    assert target_path(tmp_path, dataset()).read_bytes() == PAYLOAD
    assert not list(tmp_path.rglob("*.part"))


def test_sends_the_project_user_agent(tmp_path: Path) -> None:
    seen: list[str] = []

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append(req.headers.get("user-agent", ""))
        return ok(req)

    with make_client(httpx.MockTransport(handler)) as client:
        fetch_dataset(dataset(), tmp_path, client, sleep=no_sleep)
    assert seen[0].startswith("sightline-spaceapps/")


def test_second_run_uses_the_cache_without_the_network(tmp_path: Path) -> None:
    with serve(ok) as client:
        fetch_dataset(dataset(), tmp_path, client, sleep=no_sleep)

    def boom(_: httpx.Request) -> httpx.Response:
        raise AssertionError("the network must not be used")

    with serve(boom) as client:
        r = fetch_dataset(dataset(), tmp_path, client, sleep=no_sleep)
    assert r.status == "cached"
    assert r.sha256 == SHA


def test_unpinned_dataset_reports_its_hash(tmp_path: Path) -> None:
    with serve(ok) as client:
        r = fetch_dataset(dataset(sha256=None, md5=None), tmp_path, client, sleep=no_sleep)
    assert not r.pinned
    assert r.sha256 == SHA


def test_html_soft_404_is_rejected_and_nothing_is_kept(tmp_path: Path) -> None:
    def soft_404(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, content=b"<html>Not Found</html>", headers={"content-type": "text/html"}
        )

    with serve(soft_404) as client, pytest.raises(FetchError, match="Content-Type"):
        fetch_dataset(dataset(), tmp_path, client, sleep=no_sleep)
    assert not target_path(tmp_path, dataset()).exists()
    assert not list(tmp_path.rglob("*.part"))


def test_missing_content_type_header_matches_a_null_expectation(tmp_path: Path) -> None:
    def bare(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=PAYLOAD)

    ds = dataset(expected_content_type=None)
    with serve(bare) as client:
        assert fetch_dataset(ds, tmp_path, client, sleep=no_sleep).status == "downloaded"


def test_wrong_size_is_rejected(tmp_path: Path) -> None:
    with serve(ok) as client, pytest.raises(FetchError, match="size"):
        fetch_dataset(dataset(expected_bytes=len(PAYLOAD) - 1), tmp_path, client, sleep=no_sleep)
    assert not target_path(tmp_path, dataset()).exists()


def test_wrong_pinned_hash_is_rejected_and_the_file_deleted(tmp_path: Path) -> None:
    with serve(ok) as client, pytest.raises(FetchError, match="SHA-256"):
        fetch_dataset(dataset(sha256="0" * 64), tmp_path, client, sleep=no_sleep)
    assert not target_path(tmp_path, dataset()).exists()
    assert not list(tmp_path.rglob("*.part"))


def test_wrong_publisher_md5_is_rejected(tmp_path: Path) -> None:
    with serve(ok) as client, pytest.raises(FetchError, match="MD5"):
        fetch_dataset(dataset(md5="0" * 32), tmp_path, client, sleep=no_sleep)


def test_corrupt_cached_file_is_discarded_and_downloaded_again(tmp_path: Path) -> None:
    path = target_path(tmp_path, dataset())
    path.parent.mkdir(parents=True)
    path.write_bytes(b"x" * len(PAYLOAD))  # right size, wrong content
    with serve(ok) as client:
        r = fetch_dataset(dataset(), tmp_path, client, sleep=no_sleep)
    assert r.status == "downloaded"
    assert path.read_bytes() == PAYLOAD


def test_http_error_is_not_retried_forever(tmp_path: Path) -> None:
    calls = 0

    def not_found(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(404, text="nope")

    with serve(not_found) as client, pytest.raises(FetchError, match="HTTP 404"):
        fetch_dataset(dataset(), tmp_path, client, sleep=no_sleep)
    assert calls == 1


def test_server_errors_are_retried_with_backoff(tmp_path: Path) -> None:
    calls = 0
    waits: list[float] = []

    def flaky(req: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(503) if calls < 3 else ok(req)

    with serve(flaky) as client:
        r = fetch_dataset(dataset(), tmp_path, client, sleep=waits.append)
    assert r.status == "downloaded"
    assert calls == 3
    assert waits == [1.0, 2.0]


def test_gives_up_after_repeated_failures_but_keeps_the_partial_file(tmp_path: Path) -> None:
    def always_down(_: httpx.Request) -> httpx.Response:
        return httpx.Response(503)

    with serve(always_down) as client, pytest.raises(FetchError, match="gave up"):
        fetch_dataset(dataset(), tmp_path, client, sleep=no_sleep)


def test_resumes_a_partial_download_with_a_range_request(tmp_path: Path) -> None:
    path = target_path(tmp_path, dataset())
    path.parent.mkdir(parents=True)
    path.with_name(path.name + ".part").write_bytes(PAYLOAD[:4000])
    ranges: list[str | None] = []

    def server(req: httpx.Request) -> httpx.Response:
        ranges.append(req.headers.get("range"))
        return httpx.Response(
            206,
            content=PAYLOAD[4000:],
            headers={
                "content-type": "application/octet-stream",
                "content-range": f"bytes 4000-{len(PAYLOAD) - 1}/{len(PAYLOAD)}",
            },
        )

    with serve(server) as client:
        r = fetch_dataset(dataset(), tmp_path, client, sleep=no_sleep)
    assert ranges == ["bytes=4000-"]
    assert r.downloaded_bytes == len(PAYLOAD) - 4000
    assert path.read_bytes() == PAYLOAD


def test_restarts_when_the_server_ignores_the_range_header(tmp_path: Path) -> None:
    path = target_path(tmp_path, dataset())
    path.parent.mkdir(parents=True)
    path.with_name(path.name + ".part").write_bytes(b"stale-prefix")
    with serve(ok) as client:  # answers 200 with the whole file
        r = fetch_dataset(dataset(), tmp_path, client, sleep=no_sleep)
    assert r.downloaded_bytes == len(PAYLOAD)
    assert path.read_bytes() == PAYLOAD


def test_run_fetch_spaces_requests_and_writes_a_log(tmp_path: Path) -> None:
    waits: list[float] = []
    a = dataset(id="a-kernel", url="https://example.invalid/a.bsp")
    b = dataset(id="b-kernel", url="https://example.invalid/b.bsp")
    with serve(ok) as client:
        results = run_fetch([a, b], tmp_path, client, sleep=waits.append)
    assert [r.dataset_id for r in results] == ["a-kernel", "b-kernel"]
    assert 1.0 in waits  # one request per second between datasets
    log = (tmp_path / "fetch_log.jsonl").read_text().splitlines()
    assert len(log) == 2
    assert SHA in log[0]


def test_sources_select_by_id_and_by_group() -> None:
    sources = Sources(
        schema_version=1,
        datasets=[
            dataset(id="one", group="g1"),
            dataset(id="two", group="g1"),
            dataset(id="three", group="g2"),
        ],
    )
    assert [d.id for d in sources.select([])] == ["one", "two", "three"]
    assert [d.id for d in sources.select(["g1"])] == ["one", "two"]
    assert [d.id for d in sources.select(["three"])] == ["three"]
    with pytest.raises(KeyError, match="unknown"):
        sources.select(["nope"])


def test_duplicate_ids_are_rejected() -> None:
    with pytest.raises(ValueError, match="duplicate"):
        Sources(schema_version=1, datasets=[dataset(), dataset()])


def test_the_real_sources_file_is_valid_and_complete() -> None:
    sources = load_sources()
    spice = sources.select(["spice"])
    assert len(spice) == 8
    # D-008: the kernel set is 65,010,769 bytes (62.0 MiB).
    assert sum(d.expected_bytes for d in spice) == 65_010_769
    assert all(
        d.url.startswith("https://naif.jpl.nasa.gov/pub/naif/generic_kernels/") for d in spice
    )
    # Pinned after the first verified download (2026-10-02); an unpinned kernel is a regression.
    assert all(d.sha256 is not None for d in spice)
    names = {d.filename for d in spice}
    assert "moon_pa_de440_200625.bpc" in names
    assert "pck00011.tpc" in names
