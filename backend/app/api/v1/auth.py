import logging
from datetime import timedelta
from typing import Any, Annotated

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core import security
from app.core.config import get_settings
from app.core.db import get_db
from app.core.rate_limit import RateLimiter
from app.models.user import User, StudentProfile
from app.schemas.auth import Token, UserCreate, UserLogin, UserResponse, UpdateProfileRequest
from app.api.deps import get_current_user
from app.services.events_service import emit_event

logger = logging.getLogger("tuscoach.auth")

settings = get_settings()
router = APIRouter()

# Rate limiters — per-IP sliding window
_register_limiter = RateLimiter(max_calls=5, window_seconds=60)
_login_limiter = RateLimiter(max_calls=10, window_seconds=60)


@router.post("/register", response_model=UserResponse)
def register(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    _rate=Depends(_register_limiter),
) -> Any:
    """
    Create new user.
    """
    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )

    user = User(
        email=user_in.email,
        hashed_password=security.get_password_hash(user_in.password),
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Auto-create student profile (MVP)
    profile = StudentProfile(user_id=user.id)
    db.add(profile)
    db.commit()
    db.refresh(profile)

    return {
        "id": user.id,
        "email": user.email,
        "is_active": user.is_active,
        "student_id": profile.id,
        "display_name": user.display_name,
    }


@router.post("/login", response_model=Token)
def login(
    form_data: UserLogin,
    request: Request,
    db: Session = Depends(get_db),
    _rate=Depends(_login_limiter),
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests.
    """
    user = db.query(User).filter(User.email == form_data.email).first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    # Log login event
    try:
        emit_event(
            db=db,
            student_id=user.id,
            event_type="user_login",
            payload={
                "ip": request.client.host if request.client else None,
                "user_agent": request.headers.get("user-agent"),
                "email": user.email
            }
        )
    except Exception:
        logger.exception("Failed to log login event for user %s", user.id)

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserResponse)
def read_users_me(
    current_user: Annotated[User, Depends(get_current_user)]
) -> Any:
    """
    Get current user.
    """
    student_id = current_user.student_profile.id if current_user.student_profile else None
    return {
        "id": current_user.id,
        "email": current_user.email,
        "is_active": current_user.is_active,
        "student_id": student_id,
        "display_name": current_user.display_name,
    }


@router.put("/me", response_model=UserResponse)
def update_profile(
    body: UpdateProfileRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Any:
    """
    Update current user profile (display name).
    """
    if body.display_name is not None:
        current_user.display_name = body.display_name
    db.commit()
    db.refresh(current_user)

    student_id = current_user.student_profile.id if current_user.student_profile else None
    return {
        "id": current_user.id,
        "email": current_user.email,
        "is_active": current_user.is_active,
        "student_id": student_id,
        "display_name": current_user.display_name,
    }
