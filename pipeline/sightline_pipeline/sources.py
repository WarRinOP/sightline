"""The dataset registry, `pipeline/sources.yaml`. Code refers to datasets by id only."""

from datetime import date
from pathlib import Path, PurePosixPath
from typing import Literal
from urllib.parse import urlparse

import yaml
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

PIPELINE_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = PIPELINE_DIR.parent
DEFAULT_SOURCES_PATH = PIPELINE_DIR / "sources.yaml"
DEFAULT_RAW_DIR = REPO_ROOT / "data" / "raw"


class Dataset(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]*$")
    group: str = Field(pattern=r"^[a-z0-9][a-z0-9-]*$")
    url: str
    role: str
    expected_bytes: int = Field(gt=0)
    # Exact media type the server sends; None means the server sends no Content-Type.
    expected_content_type: str | None
    sha256: str | None = Field(default=None, pattern=r"^[0-9a-f]{64}$")
    md5: str | None = Field(default=None, pattern=r"^[0-9a-f]{32}$")
    license: str
    citation: str
    verified_at: date
    note: str | None = None

    @field_validator("url")
    @classmethod
    def _https_only(cls, v: str) -> str:
        if urlparse(v).scheme != "https":
            raise ValueError("url must be https")
        return v

    @property
    def filename(self) -> str:
        return PurePosixPath(urlparse(self.url).path).name


class Sources(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    schema_version: Literal[1]
    datasets: list[Dataset]

    @model_validator(mode="after")
    def _unique_ids(self) -> "Sources":
        ids = [d.id for d in self.datasets]
        dupes = sorted({i for i in ids if ids.count(i) > 1})
        if dupes:
            raise ValueError(f"duplicate dataset ids: {dupes}")
        return self

    def select(self, only: list[str]) -> list[Dataset]:
        """Datasets whose id or group is in `only`, in file order. Empty `only` selects all."""
        if not only:
            return list(self.datasets)
        known = {d.id for d in self.datasets} | {d.group for d in self.datasets}
        unknown = [o for o in only if o not in known]
        if unknown:
            raise KeyError(f"unknown dataset id or group: {unknown}; known: {sorted(known)}")
        return [d for d in self.datasets if d.id in only or d.group in only]


def load_sources(path: Path = DEFAULT_SOURCES_PATH) -> Sources:
    with path.open(encoding="utf-8") as f:
        return Sources.model_validate(yaml.safe_load(f))
