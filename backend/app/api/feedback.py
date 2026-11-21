from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Response

from app.api.deps import AppSettings, DbSession, error_responses
from app.core.rate_limit import rate_limit
from app.schemas import FeedbackIn, FeedbackOut
from app.services import feedback as feedback_service

router = APIRouter(
    prefix="/feedback",
    tags=["feedback"],
    # POST and DELETE share one per-client budget.
    dependencies=[Depends(rate_limit("feedback"))],
)


@router.post(
    "",
    response_model=FeedbackOut,
    status_code=201,
    summary="Send consent-managed feedback",
    description=(
        "Stores a short plain-text message only when `consent` is `true` and `consentVersion` "
        "names a consent text the server accepts; otherwise 400 and nothing is stored. "
        "The request cannot carry images, video, camera frames or hand landmarks, and the "
        "server stores no IP address or user agent with the message. The response contains a "
        "`deletionToken` that is shown once (only its hash is kept); the client keeps it to "
        "delete the message later. Rate limited per client."
    ),
    responses=error_responses(400, 413, 415, 422, 429),
)
def create_feedback(payload: FeedbackIn, db: DbSession, settings: AppSettings) -> FeedbackOut:
    return feedback_service.create_feedback(db, payload, settings)


@router.delete(
    "/{feedback_id}",
    status_code=204,
    response_class=Response,
    summary="Delete feedback you sent",
    description=(
        "Needs the `X-Deletion-Token` header returned when the feedback was created. "
        "An unknown id and a wrong or missing token both answer 404."
    ),
    responses=error_responses(404, 429),
)
def delete_feedback(
    feedback_id: str,
    db: DbSession,
    x_deletion_token: Annotated[str | None, Header()] = None,
) -> Response:
    feedback_service.delete_feedback(db, feedback_id, x_deletion_token)
    return Response(status_code=204)
