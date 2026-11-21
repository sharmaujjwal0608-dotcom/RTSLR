"""HTTP routers, mounted under /api/v1 by ``app.main.create_app``."""

from fastapi import APIRouter

from app.api import feedback, health, learning, models, research, vocabulary

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(models.router)
api_router.include_router(vocabulary.router)
api_router.include_router(learning.router)
api_router.include_router(research.router)
api_router.include_router(feedback.router)

__all__ = ["api_router"]
