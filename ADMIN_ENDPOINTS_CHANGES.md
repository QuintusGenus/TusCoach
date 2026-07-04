# Admin Endpoints Implementation - Changes Summary

## New Files

### 1. `backend/app/schemas/admin.py` (48 lines)
```python
"""
Admin/Debug schemas for development
"""
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel


class WorkflowRunOut(BaseModel):
    """Minimal workflow run info for admin debugging"""
    id: int
    student_id: int
    workflow_name: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class EventLogOut(BaseModel):
    """Event log info for admin debugging"""
    id: int
    student_id: Optional[int] = None
    user_id: Optional[int] = None
    event_type: str
    created_at: datetime
    processed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PlanTaskOut(BaseModel):
    """Plan task info for admin debugging"""
    id: int
    plan_id: int
    date: date
    topic_id: int
    task_type: str
    target_minutes: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
```

### 2. `backend/app/api/v1/admin.py` (96 lines)
```python
"""
Admin/Debug endpoints for development

WARNING: DEV-ONLY ENDPOINTS
These endpoints are for development and debugging purposes.
TODO: Add proper admin role checking before deploying to production.
TODO: Currently allows any authenticated user - must restrict to admin role.
"""
from typing import List
from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.db import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.workflow import WorkflowRun
from app.models.events import EventLog
from app.models.study import PlanTask, StudyPlan
from app.schemas.admin import WorkflowRunOut, EventLogOut, PlanTaskOut

router = APIRouter()


@router.get("/workflow_runs", response_model=List[WorkflowRunOut])
def list_workflow_runs(
    limit: int = Query(50, ge=1, le=200, description="Number of workflow runs to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)  # TODO: Add admin role check
):
    """
    [DEV-ONLY] List recent workflow runs for debugging.

    Returns the last N workflow runs ordered by created_at descending.

    TODO: Restrict to admin role only.
    """
    runs = (
        db.query(WorkflowRun)
        .order_by(desc(WorkflowRun.created_at))
        .limit(limit)
        .all()
    )
    return runs


@router.get("/events", response_model=List[EventLogOut])
def list_event_logs(
    limit: int = Query(50, ge=1, le=200, description="Number of events to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)  # TODO: Add admin role check
):
    """
    [DEV-ONLY] List recent event logs for debugging.

    Returns the last N event logs ordered by created_at descending.

    TODO: Restrict to admin role only.
    """
    events = (
        db.query(EventLog)
        .order_by(desc(EventLog.created_at))
        .limit(limit)
        .all()
    )
    return events


@router.get("/plan_tasks", response_model=List[PlanTaskOut])
def list_plan_tasks(
    date: date = Query(..., description="Date to filter plan tasks (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)  # TODO: Add admin role check
):
    """
    [DEV-ONLY] List plan tasks for a specific date.

    Currently returns tasks for the authenticated user's student_id.

    TODO: Restrict to admin role only.
    TODO: Add optional student_id parameter to view any student's tasks (admin only).
    """
    # For MVP, return tasks for the authenticated user
    # In the future, admins should be able to query any student's tasks
    tasks = (
        db.query(PlanTask)
        .join(StudyPlan, PlanTask.plan_id == StudyPlan.id)
        .filter(PlanTask.date == date)
        .filter(StudyPlan.student_id == current_user.id)
        .order_by(PlanTask.created_at)
        .all()
    )
    return tasks
```

### 3. `backend/ADMIN_ENDPOINTS.md` (Documentation)
Complete documentation for the admin endpoints including:
- Security warnings and TODOs
- Endpoint specifications
- Request/response examples
- Testing instructions
- Future enhancement plans

## Modified Files

### `backend/app/api/v1/router.py`
**Added:**
```python
from app.api.v1.admin import router as admin_router
router.include_router(admin_router, prefix="/admin", tags=["admin"])
```

**Full diff:**
```diff
 from app.api.v1.stats import router as stats_router
 router.include_router(stats_router)
+
+from app.api.v1.admin import router as admin_router
+router.include_router(admin_router, prefix="/admin", tags=["admin"])
```

## Summary

### Changes:
- ✅ Created 3 new files (2 Python + 1 documentation)
- ✅ Modified 1 existing file (router.py)
- ✅ Added 3 new admin endpoints
- ✅ All endpoints require authentication
- ✅ Proper Pydantic schemas with validation
- ✅ Clear TODOs for production deployment

### Endpoints Created:
1. `GET /v1/admin/workflow_runs?limit=N` - List recent workflow runs
2. `GET /v1/admin/events?limit=N` - List recent event logs
3. `GET /v1/admin/plan_tasks?date=YYYY-MM-DD` - List plan tasks for date

### Security Status:
- ✅ Authentication required (JWT token)
- ⚠️ No role-based access control yet (TODO for production)
- ⚠️ Any authenticated user can access (dev-only acceptable)

### Testing:
```bash
# Verify imports work
cd backend
../venv/bin/python -c "from app.api.v1 import admin; print('✓ OK')"

# Test with curl (after authentication)
TOKEN="your-jwt-token"
curl http://localhost:8000/v1/admin/workflow_runs?limit=10 \
  -H "Authorization: Bearer $TOKEN"
```

## Lines of Code:
- **admin.py**: 96 lines (3 endpoints, full documentation)
- **admin schemas**: 48 lines (3 Pydantic models)
- **router.py**: +3 lines (registration)
- **Total**: 147 lines of new code

## Next Steps (Production TODO):
1. Add `role` field to User model if not present
2. Create `require_admin()` dependency function
3. Replace `get_current_user` with `require_admin` in admin endpoints
4. Add audit logging for admin actions
5. Consider rate limiting
6. Add filtering/pagination for larger datasets
