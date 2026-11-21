"""Research data, served exactly as recorded in ``research/data/*.json``."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, error_responses
from app.core.rate_limit import rate_limit
from app.db import repositories
from app.schemas import BenchmarkOut, DatasetOut, ExperimentOut, ReferenceOut, RoadmapItemOut

router = APIRouter(
    prefix="/research",
    tags=["research"],
    dependencies=[Depends(rate_limit("read"))],
    responses=error_responses(429),
)


def _records(rows: list[Any]) -> list[dict[str, Any]]:
    # Each research row returns its record with the same keys as the source JSON file.
    return [row.to_record() for row in rows]


@router.get("/datasets", response_model=list[DatasetOut], summary="Dataset metadata")
def list_datasets(db: DbSession) -> Any:
    return _records(repositories.list_datasets(db))


@router.get("/references", response_model=list[ReferenceOut], summary="Research references")
def list_references(db: DbSession) -> Any:
    return _records(repositories.list_references(db))


@router.get(
    "/benchmarks",
    response_model=list[BenchmarkOut],
    summary="Published benchmarks",
    description="Results published by other groups. None of them is an RTSLR result.",
)
def list_benchmarks(db: DbSession) -> Any:
    return _records(repositories.list_benchmarks(db))


@router.get(
    "/experiments",
    response_model=list[ExperimentOut],
    summary="RTSLR's own experiments",
    description="Empty until RTSLR has run and recorded a real experiment.",
)
def list_experiments(db: DbSession) -> Any:
    return _records(repositories.list_experiments(db))


@router.get("/roadmap", response_model=list[RoadmapItemOut], summary="Roadmap items")
def list_roadmap(db: DbSession) -> Any:
    return _records(repositories.list_roadmap(db))
