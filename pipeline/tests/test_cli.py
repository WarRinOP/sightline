from pathlib import Path

import pytest

from sightline_pipeline import __version__
from sightline_pipeline.cli import FAILED, NOT_IMPLEMENTED, build_parser, main

COMMANDS = ["fetch", "sites", "ephem", "golden", "dem", "tiles", "mock"]
STUBS = ["dem", "tiles", "mock"]


def test_help_exits_zero_and_lists_every_command(capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["--help"])
    assert exc.value.code == 0
    out = capsys.readouterr().out
    for name in COMMANDS:
        assert name in out


def test_version(capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["--version"])
    assert exc.value.code == 0
    assert __version__ in capsys.readouterr().out


@pytest.mark.parametrize("command", STUBS)
def test_stub_exits_nonzero_and_names_its_task(
    command: str, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main([command]) == NOT_IMPLEMENTED
    err = capsys.readouterr().err
    assert "not implemented" in err
    assert "task M1-" in err


def test_subcommand_options_parse() -> None:
    p = build_parser()
    assert p.parse_args(["fetch", "--only", "spice", "--only", "naif-lsk"]).only == [
        "spice",
        "naif-lsk",
    ]
    ns = p.parse_args(["ephem", "--start", "2026-01-01", "--end", "2032-12-31", "--step", "600"])
    assert (ns.start, ns.end, ns.step) == ("2026-01-01", "2032-12-31", 600)
    assert p.parse_args(["ephem"]).start == "2026-01-01T00:01:00"
    assert p.parse_args(["ephem"]).step == 3600


def test_unknown_command_is_rejected() -> None:
    with pytest.raises(SystemExit) as exc:
        main(["nonsense"])
    assert exc.value.code == 2


def test_missing_command_is_rejected() -> None:
    with pytest.raises(SystemExit) as exc:
        main([])
    assert exc.value.code == 2


def test_fetch_rejects_an_unknown_dataset_without_touching_the_network(
    capsys: pytest.CaptureFixture[str],
) -> None:
    assert main(["fetch", "--only", "nonsense"]) == FAILED
    assert "unknown dataset id or group" in capsys.readouterr().err


def test_fetch_strict_fails_while_a_hash_is_unpinned(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    sources = tmp_path / "sources.yaml"
    sources.write_text(
        """
schema_version: 1
datasets:
  - id: unpinned-one
    group: test
    url: https://example.invalid/x.bin
    role: test
    expected_bytes: 10
    expected_content_type: null
    sha256: null
    license: test
    citation: test
    verified_at: 2026-10-02
""",
        encoding="utf-8",
    )
    code = main(
        ["fetch", "--strict", "--sources", str(sources), "--raw-dir", str(tmp_path / "raw")]
    )
    assert code == FAILED
    assert "no pinned sha256" in capsys.readouterr().err


@pytest.mark.parametrize("command", ["sites", "ephem", "golden"])
def test_pipeline_steps_fail_cleanly_when_the_data_is_missing(
    command: str, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    code = main([command, "--raw-dir", str(tmp_path / "empty")])
    assert code == FAILED
    err = capsys.readouterr().err
    assert f"sightline {command}:" in err
    assert "missing" in err
