from datetime import date, time, datetime
from typing import Optional
from pydantic import BaseModel, field_validator, ConfigDict


class StudentPreferencesOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    exam_date: Optional[date] = None
    daily_target_minutes_weekday: Optional[int] = None
    daily_target_minutes_weekend: Optional[int] = None
    preferred_study_window_start: Optional[time] = None
    preferred_study_window_end: Optional[time] = None
    quiet_hours_start: Optional[time] = None
    quiet_hours_end: Optional[time] = None
    timezone: str = "Europe/Istanbul"
    created_at: datetime
    updated_at: Optional[datetime] = None


class StudentPreferencesUpdate(BaseModel):
    """Partial update — every field is optional."""
    exam_date: Optional[date] = None
    daily_target_minutes_weekday: Optional[int] = None
    daily_target_minutes_weekend: Optional[int] = None
    preferred_study_window_start: Optional[time] = None
    preferred_study_window_end: Optional[time] = None
    quiet_hours_start: Optional[time] = None
    quiet_hours_end: Optional[time] = None
    timezone: Optional[str] = None

    @field_validator("daily_target_minutes_weekday", "daily_target_minutes_weekend")
    @classmethod
    def minutes_in_range(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not (5 <= v <= 1000):
            raise ValueError("Must be between 5 and 1000 minutes")
        return v

    @field_validator("timezone")
    @classmethod
    def timezone_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("Timezone must not be empty")
        return v


class OnboardingStatusOut(BaseModel):
    exam_date_set: bool
    daily_target_set: bool
