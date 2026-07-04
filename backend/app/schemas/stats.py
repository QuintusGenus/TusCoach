"""
Stats schemas for API responses
"""
from pydantic import BaseModel
from datetime import date
from typing import List, Optional


class DailyMinutes(BaseModel):
    """Daily minutes studied"""
    date: date
    minutes: int


class StatsResponse(BaseModel):
    """Stats response for a given time range"""
    range: str
    daily_minutes: List[DailyMinutes]
    total_minutes: int
    streak_days: int


# ── Analytics schemas ──

class StatsSummary(BaseModel):
    """Dashboard summary stats"""
    today_minutes: int
    today_target_minutes: Optional[int] = None
    week_minutes: int
    week_target_minutes: Optional[int] = None
    streak_days: int
    last_session_date: Optional[date] = None
    exam_countdown_days: Optional[int] = None


class WeeklyBucket(BaseModel):
    """One week of aggregated study data"""
    week_start: date
    minutes: int
    target_minutes: Optional[int] = None


class DailyBucket(BaseModel):
    """One day of study data"""
    date: date
    minutes: int
    target_minutes: Optional[int] = None
