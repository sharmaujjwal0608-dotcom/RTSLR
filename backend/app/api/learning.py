from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query

from app.api.deps import DbSession, error_responses
from app.core.errors import not_found
from app.core.rate_limit import rate_limit
from app.db import repositories
from app.schemas import CategoryOut, LessonOut, LessonsQuery

router = APIRouter(
    prefix="/learning", tags=["learning"], dependencies=[Depends(rate_limit("read"))]
)


@router.get(
    "/categories",
    response_model=list[CategoryOut],
    summary="Vocabulary categories",
    responses=error_responses(429),
)
def list_categories(db: DbSession) -> list[CategoryOut]:
    return [CategoryOut.model_validate(c) for c in repositories.list_categories(db)]


@router.get(
    "/lessons",
    response_model=list[LessonOut],
    summary="Lessons, optionally for one category",
    responses=error_responses(422, 429),
)
def list_lessons(query: Annotated[LessonsQuery, Query()], db: DbSession) -> list[LessonOut]:
    return [LessonOut.model_validate(x) for x in repositories.list_lessons(db, query.category)]


@router.get(
    "/lessons/{lesson_id}",
    response_model=LessonOut,
    summary="One lesson with its sign ids",
    responses=error_responses(404, 422, 429),
)
def get_lesson(
    lesson_id: Annotated[str, Path(min_length=1, max_length=96)], db: DbSession
) -> LessonOut:
    lesson = repositories.get_lesson(db, lesson_id)
    if lesson is None:
        raise not_found("Lesson")
    return LessonOut.model_validate(lesson)
