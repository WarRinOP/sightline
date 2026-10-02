import pytest

from sightline_pipeline import __version__
from sightline_pipeline.cli import NOT_IMPLEMENTED, build_parser, main

COMMANDS = ["fetch", "dem", "tiles", "ephem", "mock"]


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


@pytest.mark.parametrize("command", COMMANDS)
def test_stub_exits_nonzero_and_names_its_task(
    command: str, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main([command]) == NOT_IMPLEMENTED
    err = capsys.readouterr().err
    assert "not implemented" in err
    assert "task M1-" in err


def test_subcommand_options_parse() -> None:
    p = build_parser()
    assert p.parse_args(["fetch", "--only", "naif-de440s"]).only == "naif-de440s"
    ns = p.parse_args(["ephem", "--start", "2026-01-01", "--end", "2032-12-31", "--step", "600"])
    assert (ns.start, ns.end, ns.step) == ("2026-01-01", "2032-12-31", 600)


def test_unknown_command_is_rejected() -> None:
    with pytest.raises(SystemExit) as exc:
        main(["nonsense"])
    assert exc.value.code == 2


def test_missing_command_is_rejected() -> None:
    with pytest.raises(SystemExit) as exc:
        main([])
    assert exc.value.code == 2
