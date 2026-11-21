from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query

from app.api.deps import DbSession, error_responses
from app.core.errors import not_found
from app.core.rate_limit import rate_limit
from app.db import repositories
from app.schemas import SignOut, VocabularyPage, VocabularyQuery

router = APIRouter(
    prefix="/vocabulary", tags=["vocabulary"], dependencies=[Depends(rate_limit("read"))]
)


@router.get(
    "",
    response_model=VocabularyPage,
    summary="Search the sign vocabulary",
    description=(
        "Paginated. `limit` is 1-200 (default 50). `mediaStatus` is `pending` unless a verified "
        "source is recorded, and `recognitionSupported` is true only for signs covered by a "
        "shipped model."
    ),
    responses=error_responses(422, 429),
)
def search_vocabulary(query: Annotated[VocabularyQuery, Query()], db: DbSession) -> VocabularyPage:
    signs, total = repositories.search_signs(
        db,
        sign_language=query.sign_language,
        category=query.category,
        q=query.q,
        limit=query.limit,
        offset=query.offset,
    )
    return VocabularyPage(items=[SignOut.model_validate(s) for s in signs], total=total)


@router.get(
    "/{sign_id}",
    response_model=SignOut,
    summary="One sign",
    responses=error_responses(404, 422, 429),
)
def get_sign(sign_id: Annotated[str, Path(min_length=1, max_length=96)], db: DbSession) -> SignOut:
    sign = repositories.get_sign(db, sign_id)
    if sign is None:
        raise not_found("Sign")
    return SignOut.model_validate(sign)
