"""Shared helpers: tests that need downloaded data skip, with a reason, when it is missing."""

import pytest

from sightline_pipeline.kernels import KERNEL_IDS
from sightline_pipeline.sites import SITE_SPECS
from sightline_pipeline.sources import DEFAULT_RAW_DIR, load_sources


def _present(ids: list[str]) -> bool:
    by_id = {d.id: d for d in load_sources().datasets}
    return all((DEFAULT_RAW_DIR / i / by_id[i].filename).exists() for i in ids)


needs_kernels = pytest.mark.skipif(
    not _present(list(KERNEL_IDS)),
    reason="SPICE kernels missing: run `sightline fetch --only spice`",
)
needs_site_dems = pytest.mark.skipif(
    not _present([s.dataset_id for s in SITE_SPECS]),
    reason="site DEMs missing: run `sightline fetch --only dem`",
)
