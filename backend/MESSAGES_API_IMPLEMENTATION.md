# Messages API Implementation Summary

**Status:** ✅ **FULLY IMPLEMENTED**

All mobile-facing message endpoints are implemented using `coach_messages` table as the source of truth.

## API Endpoints

### 1. Get Latest Message
```http
GET /v1/students/me/messages/latest
Authorization: Bearer <token>
```

**Response:** `CoachMessageOut`
```json
{
  "id": 123,
  "workflow_run_id": 456,
  "workflow_name": "daily_review",
  "created_at": "2024-01-15T10:30:00Z",
  "subject": "Daily Review Summary",
  "body": "Great progress today! You completed...",
  "tone": "encouraging",
  "read_at": null
}
```

**Implementation:**
- Returns most recent message ordered by `created_at DESC`
- Returns 404 if user has no messages
- Joins with `workflow_runs` to include `workflow_name`

---

### 2. List Messages
```http
GET /v1/students/me/messages?limit=50&unread_only=false
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional): Max messages to return (1-100, default: 50)
- `unread_only` (optional): Filter unread only (default: false)

**Response:** `List[CoachMessageOut]`
```json
[
  {
    "id": 125,
    "workflow_run_id": 460,
    "workflow_name": "exam_intervention",
    "created_at": "2024-01-15T14:00:00Z",
    "subject": "Exam Preparation Tips",
    "body": "Your TUS exam is in 2 weeks...",
    "tone": "supportive",
    "read_at": null
  },
  {
    "id": 124,
    "workflow_run_id": 458,
    "workflow_name": "daily_review",
    "created_at": "2024-01-14T10:30:00Z",
    "subject": "Keep up the momentum!",
    "body": "Yesterday you studied for 2 hours...",
    "tone": "encouraging",
    "read_at": "2024-01-14T11:00:00Z"
  }
]
```

**Implementation:**
- Orders by `created_at DESC` (newest first)
- Filters by `user_id` for access control
- Optionally filters `read_at IS NULL` when `unread_only=true`
- Limits results to specified count

---

### 3. Get Message by ID
```http
GET /v1/students/me/messages/{message_id}
Authorization: Bearer <token>
```

**Response:** `CoachMessageOut`

**Implementation:**
- Returns message by ID if it belongs to authenticated user
- Returns 404 if message not found or doesn't belong to user (prevents ID leaking)
- Joins with `workflow_runs` to include `workflow_name`

---

### 4. Mark Message as Read
```http
POST /v1/students/me/messages/{message_id}/read
Authorization: Bearer <token>
```

**Response:** `CoachMessageOut` (updated message)

**Implementation:**
- Sets `read_at = NOW()` if message is unread
- Idempotent: If already read, returns message without changing timestamp
- Returns 404 if message not found or doesn't belong to user
- Uses server-side timestamp (`func.now()`) for consistency

---

### 5. Get Unread Count
```http
GET /v1/students/me/messages/unread_count
Authorization: Bearer <token>
```

**Response:** `UnreadCountResponse`
```json
{
  "unread_count": 3
}
```

**Implementation:**
- Counts messages where `read_at IS NULL`
- Filters by `user_id`
- Returns 0 if user has no unread messages

---

## Data Model

### CoachMessage Table
```python
class CoachMessage(Base):
    __tablename__ = "coach_messages"

    id: int (PK)
    user_id: int (FK -> users.id, indexed)
    student_id: int (FK -> student_profiles.id, indexed)
    workflow_run_id: Optional[int] (FK -> workflow_runs.id, indexed, nullable)
    subject: str
    body: str (Text)
    tone: Optional[str]
    created_at: datetime (indexed, default=now)
    read_at: Optional[datetime] (indexed, nullable)

    # Idempotency constraint
    UNIQUE(user_id, workflow_run_id)
```

### Response Schema
```python
class CoachMessageOut(BaseModel):
    id: int
    workflow_run_id: Optional[int]
    workflow_name: Optional[str]  # Joined from workflow_runs
    created_at: datetime
    subject: str
    body: str
    tone: Optional[str]
    read_at: Optional[datetime]
```

---

## Access Control

All endpoints enforce user-level access control:

1. **Authentication Required:** All endpoints require valid JWT token
2. **User Isolation:** All queries filter by `user_id` from authenticated token
3. **No Cross-User Access:** Users cannot access messages from other users
4. **404 on Unauthorized:** Returns 404 (not 403) to avoid leaking message IDs

---

## Implementation Files

### API Layer
**File:** `backend/app/api/v1/messages.py`
- Defines all 5 endpoints
- Handles authentication via `get_current_user` dependency
- Returns appropriate HTTP status codes
- Delegates business logic to service layer

### Service Layer
**File:** `backend/app/services/messages_service.py`

**Functions:**
- `get_latest_student_message(db, user_id)` → Latest message
- `get_student_messages_history(db, user_id, limit, unread_only)` → Message list
- `get_message_by_id(db, user_id, message_id)` → Single message
- `mark_message_read(db, user_id, message_id)` → Mark as read
- `get_unread_count(db, user_id)` → Unread count
- `get_student_message_by_workflow_run(db, user_id, workflow_run_id)` → Legacy support

**Helper:**
- `_enrich_message(msg, workflow_name)` → Adds workflow_name to response

### Router Registration
**File:** `backend/app/api/v1/router.py`
```python
router.include_router(messages.router, tags=["messages"])
```

### Models
**File:** `backend/app/models/message.py`
- `CoachMessage` SQLAlchemy model

### Schemas
**File:** `backend/app/schemas/coach_message.py`
- `CoachMessageOut` Pydantic response schema
- `UnreadCountResponse` Pydantic response schema

---

## Tests

### Test Files
1. **`tests/test_messages_api.py`** (NEW)
   - Complete API endpoint tests
   - Authentication tests
   - Access control tests
   - Schema validation tests
   - Idempotency tests

2. **`tests/test_message_persistence_idempotency.py`**
   - Workflow persistence tests
   - Database constraint tests

### Running Tests
```bash
cd backend
pytest tests/test_messages_api.py -v
pytest tests/test_message_persistence_idempotency.py -v
```

---

## Usage Examples

### Mobile App Integration
```typescript
// Fetch latest message
const latest = await fetchLatestMessage();

// Fetch message history
const messages = await fetchMessagesHistory(50, false);

// Fetch unread messages only
const unread = await fetchMessagesHistory(50, true);

// Get specific message
const message = await fetchMessageById(messageId);

// Mark message as read
const updated = await markMessageRead(messageId);

// Get unread count
const { unread_count } = await fetchUnreadCount();
```

### cURL Examples
```bash
# Get latest message
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/v1/students/me/messages/latest

# Get message history
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/v1/students/me/messages?limit=10&unread_only=true"

# Get specific message
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/v1/students/me/messages/123

# Mark message as read
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/v1/students/me/messages/123/read

# Get unread count
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/v1/students/me/messages/unread_count
```

---

## API Documentation

Interactive API documentation available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

All endpoints are documented with:
- Request/response schemas
- Parameter descriptions
- Example responses
- Authentication requirements

---

## Performance Considerations

### Indexes
All query patterns are optimized with indexes:
- `user_id` (for filtering by user)
- `created_at` (for ordering)
- `read_at` (for unread filtering)
- `workflow_run_id` (for joins)

### Queries
- Uses efficient LEFT JOIN for workflow_name enrichment
- Limits are enforced at database level
- Counts use optimized `func.count()` queries

### Caching Recommendations
For mobile apps:
- Cache unread count with 30-second TTL
- Use react-query for automatic caching and invalidation
- Invalidate cache after marking messages as read

---

## Migration Status

✅ All migrations applied:
- `c2f6a9f96091_add_coach_messages.py` - Initial table
- `d4c00193daf3_update_coach_messages.py` - Final schema with all indexes

---

## Monitoring

### Key Metrics to Track
1. **Unread message count** - Average per user
2. **Read rate** - % of messages marked as read
3. **Time to read** - Average time between created_at and read_at
4. **Message volume** - Messages created per day

### SQL Queries
```sql
-- Average unread count
SELECT AVG(unread_count) FROM (
  SELECT user_id, COUNT(*) as unread_count
  FROM coach_messages
  WHERE read_at IS NULL
  GROUP BY user_id
) subq;

-- Read rate
SELECT
  COUNT(CASE WHEN read_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) as read_rate_pct
FROM coach_messages;

-- Average time to read
SELECT AVG(EXTRACT(EPOCH FROM (read_at - created_at))) as avg_seconds_to_read
FROM coach_messages
WHERE read_at IS NOT NULL;
```

---

## Future Enhancements (Not Required)

Potential improvements for future iterations:
1. Pagination with cursor-based approach (more efficient for large datasets)
2. Message categories/tags
3. Bulk mark-as-read endpoint
4. Message search/filtering by subject/body
5. Message archival (soft delete)
6. Read receipts with detailed analytics
