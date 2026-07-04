from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.preferences import (
    StudentPreferencesOut,
    StudentPreferencesUpdate,
    OnboardingStatusOut,
)
from app.services.preferences_service import (
    get_preferences,
    update_preferences,
    get_onboarding_status,
)

router = APIRouter()


@router.get("/students/me/preferences", response_model=StudentPreferencesOut)
def get_my_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the authenticated student's preferences (creates defaults if first call)."""
    prefs = get_preferences(db, current_user.id)
    return prefs


@router.put("/students/me/preferences", response_model=StudentPreferencesOut)
def update_my_preferences(
    body: StudentPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update any subset of preference fields. Returns the full object."""
    # Only send fields that were explicitly included in the request body
    updates = body.model_dump(exclude_unset=True)
    prefs = update_preferences(db, current_user.id, updates)
    return prefs


@router.get("/students/me/onboarding_status", response_model=OnboardingStatusOut)
def get_my_onboarding_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check whether key onboarding fields (exam_date, daily targets) are set."""
    return get_onboarding_status(db, current_user.id)
