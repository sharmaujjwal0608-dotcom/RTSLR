from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Path

from app.api.deps import DbSession, error_responses
from app.core.errors import not_found
from app.core.rate_limit import rate_limit
from app.db import repositories
from app.schemas import ModelOut

router = APIRouter(prefix="/models", tags=["models"], dependencies=[Depends(rate_limit("read"))])

ContentId = Annotated[str, Path(min_length=1, max_length=96)]


@router.get(
    "",
    response_model=list[ModelOut],
    summary="List model versions",
    description=(
        "Metadata about the recognisers the browser can run. `validated` is true only for a "
        "model with a documented, reproducible evaluation; no validated ISL model exists today."
    ),
    responses=error_responses(429),
)
def list_models(db: DbSession) -> list[ModelOut]:
    return [ModelOut.model_validate(m) for m in repositories.list_models(db)]


@router.get(
    "/{model_id}",
    response_model=ModelOut,
    summary="One model version",
    responses=error_responses(404, 422, 429),
)
def get_model(model_id: ContentId, db: DbSession) -> ModelOut:
    model = repositories.get_model(db, model_id)
    if model is None:
        raise not_found("Model")
    return ModelOut.model_validate(model)
