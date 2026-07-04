"""
Stats API endpoints
"""
from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.stats import StatsResponse, StatsSummary, WeeklyBucket, DailyBucket
from app.services.stats_service import (
    get_student_stats,
    get_stats_summary,
    get_weekly_stats,
    get_daily_stats,
)

router = APIRouter(prefix="/students/me", tags=["stats"])


@router.get("/stats", response_model=StatsResponse)
def get_my_stats(
    range: str = Query("7d", description="Time range (e.g., 7d, 14d, 30d)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get study statistics for the authenticated user.

    Supported ranges:
    - 7d: Last 7 days (default)
    - 14d: Last 14 days
    - 30d: Last 30 days
    """
    # Parse range (e.g., "7d" -> 7)
    try:
        range_days = int(range.rstrip('d'))
    except ValueError:
        range_days = 7  # Default to 7 days

    # Limit to reasonable ranges
    if range_days < 1:
        range_days = 7
    elif range_days > 90:
        range_days = 90

    stats = get_student_stats(db, current_user.id, range_days)

    return StatsResponse(**stats)


@router.get("/stats/summary", response_model=StatsSummary)
def get_my_stats_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dashboard summary: today, week, streak, exam countdown."""
    return StatsSummary(**get_stats_summary(db, current_user.id))


@router.get("/stats/weekly", response_model=List[WeeklyBucket])
def get_my_weekly_stats(
    weeks: int = Query(8, ge=1, le=52, description="Number of weeks"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Weekly aggregated study data, oldest-first."""
    return [WeeklyBucket(**b) for b in get_weekly_stats(db, current_user.id, weeks)]


@router.get("/stats/daily", response_model=List[DailyBucket])
def get_my_daily_stats(
    days: int = Query(30, ge=1, le=365, description="Number of days"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Daily study data, oldest-first."""
    return [DailyBucket(**b) for b in get_daily_stats(db, current_user.id, days)]
