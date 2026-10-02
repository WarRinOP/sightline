"""Site catalog from the PGDA #78 site DEMs: the centre of each tile, with its sampled height.

A tile centre is a fact we can reproduce from the published file (D-019, option A). It is not a
landing point or a rim point, and the catalog says so.
"""

import json
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


@dataclass(frozen=True)
class SiteSpec:
    dataset_id: str
    site_id: str
    name: str
    pgda_site: str  # id on the PGDA product page
    pgda_name: str  # name PGDA gives it


SITE_SPECS = (
    SiteSpec("pgda78-site04-surf", "shackleton-rim", "Shackleton Rim", "Site04", "Shackleton rim"),
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
        lat, lon, elev = tile_centre(path)
        sites.append(
            {
                "id": spec.site_id,
                "name": spec.name,
                "lat_deg": round(lat, 6),
                "lon_deg": round(lon, 6),
                "elev_m": round(elev, 1),
                "description": (
                    f"Centre of the PGDA site DEM {spec.pgda_site} (PGDA name: "
                    f"'{spec.pgda_name}'), a 16 km tile. This is a tile centre, not a landing "
                    f"or rim point. Height sampled from the 5 m DEM above the 1737.4 km "
                    f"reference sphere. {ds.citation}."
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
