"""Load the pinned SPICE kernel set. Every file is verified against sources.yaml before use."""

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import spiceypy

from sightline_pipeline.fetch import verify_file
from sightline_pipeline.sources import Dataset, Sources

# Load order matters little to SPICE, but the Moon FK needs the Moon PCK and constants kernel
# for MOON_ME, and the DSN topocentric FK needs the Earth PCK for ITRF93.
KERNEL_IDS = (
    "naif-lsk",
    "naif-spk-de440s",
    "naif-pck-moon-pa-de440",
    "naif-pck-pck00011",
    "naif-fk-moon-de440",
    "naif-pck-earth-predict",
    "naif-fk-earth-topo",
    "naif-spk-dsn-stations",
)


def kernel_datasets(sources: Sources) -> list[Dataset]:
    by_id = {d.id: d for d in sources.datasets}
    return [by_id[i] for i in KERNEL_IDS]


def kernel_path(raw_dir: Path, ds: Dataset) -> Path:
    return raw_dir / ds.id / ds.filename


@contextmanager
def loaded_kernels(raw_dir: Path, sources: Sources) -> Iterator[list[Dataset]]:
    """Verify and load the kernels, then unload them on exit (SPICE state is global)."""
    datasets = kernel_datasets(sources)
    for ds in datasets:
        path = kernel_path(raw_dir, ds)
        if not path.exists():
            raise FileNotFoundError(f"{path} is missing: run `sightline fetch --only spice`")
        if ds.sha256 is None:
            raise ValueError(f"{ds.id} has no pinned sha256 in sources.yaml")
        verify_file(path, ds)
    spiceypy.kclear()
    try:
        for ds in datasets:
            spiceypy.furnsh(str(kernel_path(raw_dir, ds)))
        yield datasets
    finally:
        spiceypy.kclear()
