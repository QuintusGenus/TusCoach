# Admin/Debug Endpoints - Development Only

## ⚠️ WARNING: DEV-ONLY ENDPOINTS

These endpoints are for development and debugging purposes only.

**TODO before production:**
- Add proper admin role checking
- Currently allows any authenticated user - must restrict to admin role
- Consider rate limiting for production use

## New Files Created

### 1. `backend/app/schemas/admin.py`
Pydantic schemas for admin responses:
- `WorkflowRunOut` - Minimal workflow run info
- `EventLogOut` - Event log with processing status
- `PlanTaskOut` - Plan task details

### 2. `backend/app/api/v1/admin.py`
Admin router with three debug endpoints (96 lines)

## Endpoints

All endpoints require authentication (JWT token). Currently accessible by any authenticated user.

### 1. GET `/v1/admin/workflow_runs?limit=50`

Returns recent workflow runs for debugging.

**Query Parameters:**
- `limit` (optional): Number of runs to return (1-200, default 50)

**Response:** Array of WorkflowRunOut
```json
[
  {
    "id": 123,
    "student_id": 10,
    "workflow_name": "daily_review",
    "status": "completed",
    "created_at": "2026-02-06T10:30:00"
  }
]
```

**Use Cases:**
- Check if workflows are triggering
- Debug workflow execution status
- Monitor workflow activity

---

### 2. GET `/v1/admin/events?limit=50`

Returns recent event logs for debugging.

**Query Parameters:**
- `limit` (optional): Number of events to return (1-200, default 50)

**Response:** Array of EventLogOut
```json
[
  {
    "id": 456,
    "student_id": 10,
    "user_id": null,
    "event_type": "study_session_created",
    "created_at": "2026-02-06T09:15:00",
    "processed_at": "2026-02-06T09:17:00"
  }
]
```

**Use Cases:**
- Check if events are being logged
- Monitor event processing status (processed_at)
- Debug event-driven workflow triggers

---

### 3. GET `/v1/admin/plan_tasks?date=YYYY-MM-DD`

Returns plan tasks for a specific date.

**Query Parameters:**
- `date` (required): Date to filter tasks (format: YYYY-MM-DD)

**Response:** Array of PlanTaskOut
```json
[
  {
    "id": 789,
    "plan_id": 5,
    "date": "2026-02-06",
    "topic_id": 12,
    "task_type": "review",
    "target_minutes": 30,
    "status": "pending",
    "created_at": "2026-02-05T21:30:00"
  }
]
```

**Current Behavior:**
- Returns tasks for the authenticated user's student_id only

**TODO:**
- Add optional `student_id` parameter to view any student's tasks (admin only)

---

## Changes to Existing Files

### `backend/app/api/v1/router.py`

Added admin router:
```python
from app.api.v1.admin import router as admin_router
router.include_router(admin_router, prefix="/admin", tags=["admin"])
```

## Testing the Endpoints

### Using curl with authentication:

```bash
# Get your auth token first
TOKEN=$(curl -X POST http://localhost:8000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mobile@test.com","password":"test123"}' \
  | jq -r '.access_token')

# List workflow runs
curl http://localhost:8000/v1/admin/workflow_runs?limit=10 \
  -H "Authorization: Bearer $TOKEN"

# List events
curl http://localhost:8000/v1/admin/events?limit=20 \
  -H "Authorization: Bearer $TOKEN"

# List plan tasks for today
curl "http://localhost:8000/v1/admin/plan_tasks?date=$(date +%Y-%m-%d)" \
  -H "Authorization: Bearer $TOKEN"
```

### Using FastAPI docs:

1. Start the backend: `cd backend && ./dev.sh`
2. Open http://localhost:8000/docs
3. Authorize with your JWT token
4. Navigate to the "admin" section
5. Try out the endpoints

## Security Considerations

**Current State:**
- ✅ Authentication required (JWT token)
- ❌ No role-based access control
- ❌ Any authenticated user can access these endpoints

**Before Production:**
1. Add `role` field check in User model
2. Create `require_admin` dependency:
   ```python
   def require_admin(current_user: User = Depends(get_current_user)):
       if current_user.role != "admin":
           raise HTTPException(403, "Admin access required")
       return current_user
   ```
3. Replace `get_current_user` with `require_admin` in all admin endpoints
4. Add audit logging for admin actions
5. Consider rate limiting

## Future Enhancements

- [ ] Add filtering by student_id for workflow_runs and events
- [ ] Add date range filtering for all endpoints
- [ ] Add pagination with cursor-based navigation
- [ ] Add endpoint to trigger workflows manually
- [ ] Add endpoint to view/edit user roles
- [ ] Add admin dashboard with summary statistics
- [ ] Add audit log for all admin actions
