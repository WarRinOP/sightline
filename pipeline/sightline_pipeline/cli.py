"""Command-line entry point `sightline`. Subcommands are stubs until their tasks land."""

import argparse
import sys
from collections.abc import Sequence
from pathlib import Path

from sightline_pipeline import __version__
from sightline_pipeline.fetch import FetchError, FetchResult, make_client, run_fetch
from sightline_pipeline.sources import DEFAULT_RAW_DIR, DEFAULT_SOURCES_PATH, load_sources

OK = 0
FAILED = 1
NOT_IMPLEMENTED = 2

# subcommands that are still stubs -> (help text, task that implements it)
_COMMANDS: dict[str, tuple[str, str]] = {
    "dem": ("parse PDS3 labels and DEM images into a memmap plus metadata", "M1-03"),
    "tiles": ("build the terrain tile pyramid", "M1-04"),
    "ephem": ("compute Sun, Earth and DSN positions in MOON_ME", "M1-05"),
    "mock": ("write synthetic data with simulated: true", "M1-09"),
}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="sightline",
        description="SIGHTLINE data pipeline (skeleton: no subcommand does real work yet).",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    sub = parser.add_subparsers(dest="command", required=True, metavar="<command>")
    fetch = sub.add_parser(
        "fetch",
        help="download datasets into data/raw/ and verify size, type and checksums",
        description="Download datasets listed in pipeline/sources.yaml. Resumes partial downloads.",
    )
    fetch.add_argument(
        "--only",
        action="append",
        default=[],
        metavar="ID_OR_GROUP",
        help="a dataset id or a group such as 'spice' (repeatable); default: everything",
    )
    fetch.add_argument(
        "--strict", action="store_true", help="fail if a dataset has no pinned sha256"
    )
    fetch.add_argument("--sources", type=Path, default=DEFAULT_SOURCES_PATH, help=argparse.SUPPRESS)
    fetch.add_argument("--raw-dir", type=Path, default=DEFAULT_RAW_DIR, help="download directory")
    for name, (help_text, task) in _COMMANDS.items():
        p = sub.add_parser(name, help=f"{help_text} (stub, {task})", description=help_text)
        if name == "ephem":
            p.add_argument("--start", metavar="YYYY-MM-DD", help="first day of the range")
            p.add_argument("--end", metavar="YYYY-MM-DD", help="last day of the range")
            p.add_argument("--step", type=int, metavar="SECONDS", help="sample step in seconds")
    return parser


def _fmt_rate(bps: float) -> str:
    return f"{bps / 1000:.0f} KB/s" if bps < 1e6 else f"{bps / 1e6:.2f} MB/s"


def _report(results: list[FetchResult]) -> None:
    total = sum(r.size_bytes for r in results)
    fetched = sum(r.downloaded_bytes for r in results)
    secs = sum(r.seconds for r in results)
    for r in results:
        pin = "pinned" if r.pinned else "UNPINNED"
        speed = _fmt_rate(r.throughput_bps) if r.status == "downloaded" else "-"
        print(f"{r.status:<10} {r.dataset_id:<26} {r.size_bytes:>11,} B  {speed:>10}  {pin}")
    rate = _fmt_rate(fetched / secs) if secs > 0 else "-"
    print(f"{len(results)} datasets, {total:,} B on disk, {fetched:,} B downloaded, overall {rate}")
    unpinned = [r for r in results if not r.pinned]
    if unpinned:
        print("\nPin these in pipeline/sources.yaml (sha256, trust on first use):")
        for r in unpinned:
            print(f"  {r.dataset_id}: {r.sha256}")


def _run_fetch(args: argparse.Namespace) -> int:
    try:
        sources = load_sources(args.sources)
        datasets = sources.select(args.only)
    except KeyError as e:
        print(f"sightline fetch: {e.args[0]}", file=sys.stderr)
        return FAILED
    if args.strict and (missing := [d.id for d in datasets if d.sha256 is None]):
        print(f"sightline fetch: no pinned sha256 for {missing}", file=sys.stderr)
        return FAILED
    with make_client() as client:
        try:
            results = run_fetch(
                datasets,
                args.raw_dir,
                client,
                progress=lambda m: print(m, file=sys.stderr, flush=True),
            )
        except FetchError as e:
            print(f"sightline fetch: {e}", file=sys.stderr)
            return FAILED
    _report(results)
    return OK


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command == "fetch":
        return _run_fetch(args)
    task = _COMMANDS[args.command][1]
    print(
        f"sightline {args.command}: not implemented yet (task {task}).",
        file=sys.stderr,
    )
    return NOT_IMPLEMENTED


if __name__ == "__main__":
    sys.exit(main())
