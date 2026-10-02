"""Command-line entry point `sightline`. Subcommands are stubs until their tasks land."""

import argparse
import sys
from collections.abc import Sequence

from sightline_pipeline import __version__

NOT_IMPLEMENTED = 2

# subcommand -> (help text, task that implements it)
_COMMANDS: dict[str, tuple[str, str]] = {
    "fetch": ("download datasets and verify SHA-256", "M1-02"),
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
    for name, (help_text, task) in _COMMANDS.items():
        p = sub.add_parser(name, help=f"{help_text} (stub, {task})", description=help_text)
        if name == "fetch":
            p.add_argument("--only", metavar="DATASET_ID", help="fetch a single dataset id")
        if name == "ephem":
            p.add_argument("--start", metavar="YYYY-MM-DD", help="first day of the range")
            p.add_argument("--end", metavar="YYYY-MM-DD", help="last day of the range")
            p.add_argument("--step", type=int, metavar="SECONDS", help="sample step in seconds")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    task = _COMMANDS[args.command][1]
    print(
        f"sightline {args.command}: not implemented yet (task {task}).",
        file=sys.stderr,
    )
    return NOT_IMPLEMENTED


if __name__ == "__main__":
    sys.exit(main())
