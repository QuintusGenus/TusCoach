"""
API v1 Router - aggregates all v1 routes
"""
from fastapi import APIRouter
from app.api.v1.sessions import router as sessions_router
from app.api.v1.scores import router as scores_router
from app.api.v1.workflows import router as workflows_router


router = APIRouter(prefix="/v1")

# Include all v1 routers
router.include_router(sessions_router)
router.include_router(scores_router)
router.include_router(workflows_router)
from app.api.v1 import messages
from app.api.v1.auth import router as auth_router

router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(messages.router, tags=["messages"])

from app.api.v1 import plans
router.include_router(plans.router, tags=["plans"])

from app.api.v1.stats import router as stats_router
router.include_router(stats_router)

from app.api.v1 import preferences
router.include_router(preferences.router, tags=["preferences"])

from app.api.v1.admin import router as admin_router
router.include_router(admin_router, prefix="/admin", tags=["admin"])

from app.api.v1 import chat
router.include_router(chat.router, tags=["chat"])

from app.api.v1.exams import router as exams_router
router.include_router(exams_router)

from app.api.v1.notes import router as notes_router
router.include_router(notes_router)

from app.api.v1.calendar import router as calendar_router
router.include_router(calendar_router)

from app.api.v1.qbank import router as qbank_router
router.include_router(qbank_router)

# Subjects endpoint (no auth needed)
from app.core.constants import TUS_SUBJECTS

@router.get("/subjects", tags=["subjects"])
def get_subjects():
    """Return the list of TUS exam subjects."""
    return TUS_SUBJECTS
