"""Site catalog from the PGDA #78 site DEMs, with each site's sampled height.

A site is either the centre of its tile (D-019, option A) or, for Shackleton Rim, the crest of the
rim ridge: the highest 5 m pixel more than 1 km from the tile edge (D-024). Both are facts we can
reproduce from the published file. Neither is a landing point, and the catalog says so.
"""

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.warp import transform

from sightline_pipeline import __version__
from sightline_pipeline.fetch import verify_file
from sightline_pipeline.sources import Dataset, Sources

MOON_GEOGRAPHIC = CRS.from_proj4("+proj=longlat +a=1737400 +b=1737400 +no_defs")
DEFAULT_SITES_PATH = Path(__file__).resolve().parents[2] / "packages/engine/src/data/sites.json"


# The crest search ignores the outer kilometre of the tile: a ridge that continues off the tile
# has its true top elsewhere, and rays from a pixel near the edge would leave the 5 m data at once.
CREST_MARGIN_M = 1000.0


@dataclass(frozen=True)
class SiteSpec:
    dataset_id: str
    site_id: str
    name: str
    pgda_site: str  # id on the PGDA product page
    pgda_name: str  # name PGDA gives it
    placement: str = "centre"  # "centre" of the tile, or the "crest" of its rim ridge


SITE_SPECS = (
    SiteSpec(
        "pgda78-site04-surf",
        "shackleton-rim",
        "Shackleton Rim crest",
        "Site04",
        "Shackleton rim",
        placement="crest",
    ),
    SiteSpec(
        "pgda78-site01-surf", "connecting-ridge", "Connecting Ridge", "Site01", "Connecting ridge"
    ),
    SiteSpec(
        "pgda78-site11-surf", "de-gerlache-rim", "de Gerlache Rim", "Site11", "de Gerlache rim"
    ),
)


def tile_centre(path: Path) -> tuple[float, float, float]:
    """(lat_deg, lon_deg east in [-180, 180], height_m) at the centre of a pixel-registered tile.

    Even pixel counts put the centre on the corner of four pixels, so the height is their mean.
    """
    with rasterio.open(path) as src:
        b = src.bounds
        (lon,), (lat,) = transform(
            src.crs, MOON_GEOGRAPHIC, [(b.left + b.right) / 2], [(b.bottom + b.top) / 2]
        )
        h, w = src.height, src.width
        if h % 2 or w % 2:
            raise ValueError(f"{path.name}: odd tile size {w}x{h}; the centre is not on a corner")
        window = src.read(1, window=((h // 2 - 1, h // 2 + 1), (w // 2 - 1, w // 2 + 1)))
    if not np.isfinite(window).all():
        raise ValueError(f"{path.name}: the centre of the tile has no data")
    return float(lat), float(((lon + 180.0) % 360.0) - 180.0), float(window.mean())


def rim_crest(path: Path, margin_m: float = CREST_MARGIN_M) -> tuple[float, float, float]:
    """(lat_deg, lon_deg east in [-180, 180], height_m) of the highest pixel centre in the tile
    that is more than `margin_m` from every edge. The height is that pixel's own value."""
    with rasterio.open(path) as src:
        z = src.read(1)
        t = src.transform
        crs = src.crs
    k = math.ceil(margin_m / t.a)
    if 2 * k >= min(z.shape):
        raise ValueError(f"{path.name}: a {margin_m:g} m margin leaves no tile")
    inner = z[k:-k, k:-k]
    if not np.isfinite(inner).any():
        raise ValueError(f"{path.name}: no data inside the {margin_m:g} m margin")
    r, c = np.unravel_index(np.nanargmax(inner), inner.shape)
    r, c = int(r) + k, int(c) + k
    x, y = t.c + (c + 0.5) * t.a, t.f + (r + 0.5) * t.e
    (lon,), (lat,) = transform(crs, MOON_GEOGRAPHIC, [x], [y])
    return float(lat), float(((lon + 180.0) % 360.0) - 180.0), float(z[r, c])


def build_sites(raw_dir: Path, sources: Sources) -> list[dict[str, Any]]:
    by_id: dict[str, Dataset] = {d.id: d for d in sources.datasets}
    sites: list[dict[str, Any]] = []
    for spec in SITE_SPECS:
        ds = by_id[spec.dataset_id]
        if ds.product_url is None:
            raise ValueError(f"{ds.id} has no product_url in sources.yaml")
        path = raw_dir / ds.id / ds.filename
        if not path.exists():
            raise FileNotFoundError(f"{path} is missing: run `sightline fetch --only dem`")
        verify_file(path, ds)
        if spec.placement == "crest":
            lat, lon, elev = rim_crest(path)
            where = (
                f"Highest 5 m pixel of the PGDA site DEM {spec.pgda_site} (PGDA name: "
                f"'{spec.pgda_name}') more than {CREST_MARGIN_M / 1000:g} km from the edge of its "
                f"16 km tile: the crest of the rim ridge, not the tile centre. This is not a "
                f"landing point."
            )
        else:
            lat, lon, elev = tile_centre(path)
            where = (
                f"Centre of the PGDA site DEM {spec.pgda_site} (PGDA name: "
                f"'{spec.pgda_name}'), a 16 km tile. This is a tile centre, not a landing "
                f"or rim point."
            )
        sites.append(
            {
                "id": spec.site_id,
                "name": spec.name,
                "lat_deg": round(lat, 6),
                "lon_deg": round(lon, 6),
                "elev_m": round(elev, 1),
                "description": (
                    f"{where} Height sampled from the 5 m DEM above the 1737.4 km reference "
                    f"sphere. {ds.citation}."
                ),
                "simulated": False,
                "source_url": ds.product_url,
            }
        )
    return sites


def write_sites(
    raw_dir: Path, sources: Sources, out: Path = DEFAULT_SITES_PATH
) -> list[dict[str, Any]]:
    sites = build_sites(raw_dir, sources)
    doc = {"schema_version": 1, "generated_by": f"sightline sites {__version__}", "sites": sites}
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return sites
