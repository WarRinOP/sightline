"""Download datasets into data/raw/ and check them: size, Content-Type, SHA-256, publisher MD5.

PGDA and some other hosts answer a wrong URL with HTTP 200 and an HTML page, so a 200 alone proves
nothing. A file is only kept once every check passes. Downloads resume from `<file>.part`.
"""

import hashlib
import json
import os
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

import httpx

from sightline_pipeline import __version__
from sightline_pipeline.sources import Dataset

USER_AGENT = f"sightline-spaceapps/{__version__}"
CHUNK_BYTES = 1 << 20
MAX_ATTEMPTS = 5
MAX_BACKOFF_S = 30.0
MIN_GAP_S = 1.0  # at most one request per second to a provider (CLAUDE.md §7.3)
PROGRESS_EVERY_S = 10.0

Progress = Callable[[str], None]


class FetchError(Exception):
    """A download that cannot be trusted or completed."""


@dataclass(frozen=True)
class FetchResult:
    dataset_id: str
    path: Path
    status: Literal["downloaded", "cached"]
    size_bytes: int
    sha256: str
    pinned: bool
    seconds: float  # time spent downloading; 0 when served from the cache
    downloaded_bytes: int  # bytes fetched this run (less than size_bytes after a resume)

    @property
    def throughput_bps(self) -> float:
        return self.downloaded_bytes / self.seconds if self.seconds > 0 else 0.0


def make_client(transport: httpx.BaseTransport | None = None) -> httpx.Client:
    return httpx.Client(
        transport=transport,
        headers={"User-Agent": USER_AGENT},
        timeout=httpx.Timeout(60.0, connect=20.0),
        follow_redirects=True,
    )


def target_path(raw_dir: Path, ds: Dataset) -> Path:
    return raw_dir / ds.id / ds.filename


def _media_type(content_type: str | None) -> str | None:
    return content_type.split(";")[0].strip().lower() if content_type else None


def _digests(path: Path) -> tuple[str, str]:
    sha, md5 = hashlib.sha256(), hashlib.md5(usedforsecurity=False)
    with path.open("rb") as f:
        while chunk := f.read(CHUNK_BYTES):
            sha.update(chunk)
            md5.update(chunk)
    return sha.hexdigest(), md5.hexdigest()


def _verify(path: Path, ds: Dataset) -> str:
    """Check size and hashes of a complete file; return its SHA-256."""
    size = path.stat().st_size
    if size != ds.expected_bytes:
        raise FetchError(f"{ds.id}: size {size} B, expected {ds.expected_bytes} B")
    sha, md5 = _digests(path)
    if ds.sha256 is not None and sha != ds.sha256:
        raise FetchError(f"{ds.id}: SHA-256 {sha} does not match the pinned {ds.sha256}")
    if ds.md5 is not None and md5 != ds.md5:
        raise FetchError(f"{ds.id}: MD5 {md5} does not match the publisher's {ds.md5}")
    return sha


def _check_content_type(ds: Dataset, response: httpx.Response) -> None:
    got = _media_type(response.headers.get("content-type"))
    if got != _media_type(ds.expected_content_type):
        raise FetchError(f"{ds.id}: Content-Type {got!r}, expected {ds.expected_content_type!r}")


def fetch_dataset(
    ds: Dataset,
    raw_dir: Path,
    client: httpx.Client,
    *,
    sleep: Callable[[float], None] = time.sleep,
    progress: Progress | None = None,
) -> FetchResult:
    final = target_path(raw_dir, ds)
    final.parent.mkdir(parents=True, exist_ok=True)

    if final.exists():
        try:
            sha = _verify(final, ds)
            return FetchResult(
                ds.id, final, "cached", final.stat().st_size, sha, ds.sha256 is not None, 0.0, 0
            )
        except FetchError as e:
            if progress:
                progress(f"{e}; discarding the cached file and downloading again")
            final.unlink()

    part = final.with_name(final.name + ".part")
    started = time.monotonic()
    fetched = 0
    last_report = started

    for attempt in range(MAX_ATTEMPTS):
        have = part.stat().st_size if part.exists() else 0
        if have > ds.expected_bytes:
            part.unlink()
            have = 0
        if have == ds.expected_bytes:
            break

        headers = {"Range": f"bytes={have}-"} if have else {}
        try:
            with client.stream("GET", ds.url, headers=headers) as r:
                if r.status_code == 416:  # our partial file does not fit the server's file
                    part.unlink(missing_ok=True)
                    continue
                if r.status_code in (429, 500, 502, 503, 504):
                    raise httpx.TransportError(f"HTTP {r.status_code}")
                if r.status_code not in (200, 206):
                    raise FetchError(f"{ds.id}: HTTP {r.status_code} from the provider")
                _check_content_type(ds, r)
                resumed = have > 0 and r.status_code == 206
                if resumed and not r.headers.get("content-range", "").startswith(f"bytes {have}-"):
                    part.unlink()
                    continue
                with part.open("ab" if resumed else "wb") as out:
                    for chunk in r.iter_bytes(CHUNK_BYTES):
                        out.write(chunk)
                        fetched += len(chunk)
                        now = time.monotonic()
                        if progress and now - last_report >= PROGRESS_EVERY_S:
                            last_report = now
                            done = out.tell()
                            rate = fetched / (now - started) / 1000
                            progress(
                                f"{ds.id}: {done / 1e6:.1f}/{ds.expected_bytes / 1e6:.1f} MB, "
                                f"{rate:.0f} KB/s"
                            )
        except httpx.TransportError as e:
            wait = min(2.0**attempt, MAX_BACKOFF_S)
            if progress:
                progress(f"{ds.id}: {e!r}; retry {attempt + 1}/{MAX_ATTEMPTS} in {wait:.0f} s")
            sleep(wait)
            continue
        if part.stat().st_size >= ds.expected_bytes:
            break
        sleep(min(2.0**attempt, MAX_BACKOFF_S))  # stream ended early: resume
    else:
        raise FetchError(f"{ds.id}: gave up after {MAX_ATTEMPTS} attempts (partial file kept)")

    seconds = time.monotonic() - started
    try:
        sha = _verify(part, ds)
    except FetchError:
        part.unlink(missing_ok=True)
        raise
    os.replace(part, final)
    return FetchResult(
        ds.id,
        final,
        "downloaded",
        final.stat().st_size,
        sha,
        ds.sha256 is not None,
        seconds,
        fetched,
    )


def _log(raw_dir: Path, r: FetchResult) -> None:
    entry = {
        "at": datetime.now(UTC).isoformat(timespec="seconds"),
        "id": r.dataset_id,
        "status": r.status,
        "size_bytes": r.size_bytes,
        "downloaded_bytes": r.downloaded_bytes,
        "seconds": round(r.seconds, 2),
        "throughput_bytes_per_s": round(r.throughput_bps),
        "sha256": r.sha256,
        "pinned": r.pinned,
    }
    with (raw_dir / "fetch_log.jsonl").open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")


def run_fetch(
    datasets: list[Dataset],
    raw_dir: Path,
    client: httpx.Client,
    *,
    sleep: Callable[[float], None] = time.sleep,
    progress: Progress | None = None,
) -> list[FetchResult]:
    """Fetch datasets one after another, at most one request per second."""
    raw_dir.mkdir(parents=True, exist_ok=True)
    results: list[FetchResult] = []
    for i, ds in enumerate(datasets):
        if i > 0:
            sleep(MIN_GAP_S)
        r = fetch_dataset(ds, raw_dir, client, sleep=sleep, progress=progress)
        _log(raw_dir, r)
        results.append(r)
    return results
