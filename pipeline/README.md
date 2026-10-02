# SIGHTLINE pipeline

Python data pipeline (owner: Dev 1). It will download and verify NASA data, build terrain tiles
and the ephemeris, and generate the golden fixtures the TypeScript engine is tested against.

**Status (S1-01):** only the command-line skeleton exists. Every subcommand is a stub that exits
with code 2 and names the task that will implement it. Nothing here produces data yet.

```bash
uv sync --project pipeline
uv run --project pipeline sightline --help
uv run --project pipeline pytest
```
