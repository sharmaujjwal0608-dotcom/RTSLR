"""Research schemas. Keys follow ``research/data/*.json`` exactly.

Records are served as recorded: the typed fields document the known shape, and any further key
present in a record is passed through unchanged (``extra="allow"``) so nothing is dropped or
renamed on the way out.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict


class _Record(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)


class DatasetOut(_Record):
    id: str
    name: str
    signLanguage: str
    description: str = ""
    classes: str | None = None
    size: str | None = None
    signers: str | None = None
    modality: str | None = None
    staticOrDynamic: str | None = None
    license: str | None = None
    url: str | None = None
    limitations: str | None = None
    verified: bool = False
    usedByRtslr: bool = False


class ReferenceOut(_Record):
    id: str
    title: str
    authors: list[str] = []
    year: int | None = None
    venue: str | None = None
    url: str | None = None
    summary: str = ""
    verified: bool = False
    verificationNote: str | None = None


class BenchmarkOut(_Record):
    """A result published by someone else. Never an RTSLR result."""

    id: str
    referenceId: str
    signLanguage: str
    task: str
    classes: int | None = None
    method: str
    metricName: str
    metricValue: float | None = None
    dataset: str | None = None
    evaluationProtocol: str | None = None
    caveat: str | None = None


class ExperimentOut(_Record):
    """An experiment RTSLR actually ran. The list is empty until a real run is recorded."""

    id: str
    experimentId: str | None = None
    title: str | None = None
    date: str | None = None
    commit: str | None = None
    datasetVersion: str | None = None
    protocol: str | None = None
    metrics: dict[str, Any] | None = None
    artefactsUrl: str | None = None


class RoadmapItemOut(_Record):
    id: str
    phase: str
    title: str
    description: str = ""
    status: str
    dependsOn: list[str] = []
