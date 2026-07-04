# TusCoach

AI-powered coaching application for Turkish Medical Residency Exam (TUS) preparation.

## Features

- ✅ **Study Tracking** - Record study sessions with duration and topics
- ✅ **Mock Exam Tracking** - Track exam scores and performance
- ✅ **AI Coaching Workflows** - Automated coaching based on your behavior
  - Daily Review: Creates personalized study tasks
  - Exam Intervention: Analyzes exam performance
  - Inactivity Detection: Motivational messages for inactive periods
- ✅ **Smart Study Plans** - AI-generated daily tasks based on weak topics
- ✅ **Message System** - Receive coaching messages in your inbox
- ✅ **Progress Analytics** - Weekly stats, streaks, adherence tracking
- ✅ **Mobile App** - Native iOS/Android app built with Expo
- ✅ **Event-Driven Architecture** - Real-time workflow triggers

## Documentation

- **[Dev Runbook](docs/dev_runbook.md)** - Quick reference for running the app
- **[Dummy Book](docs/dummy_book.md)** - Complete walkthrough of every feature with detailed explanations
- **[Backend README](backend/README.md)** - Backend-specific documentation
- **[Mobile README](mobile/README.md)** - Mobile app documentation
- **[Messages API Hardening](backend/MESSAGES_API_HARDENING.md)** - Message endpoint details
- **[Admin Endpoints](backend/ADMIN_ENDPOINTS.md)** - Admin/debug tools
- **[Push Notification E2E Verification](docs/push_e2e_check.md)** - Complete guide for testing push notifications

## Project Structure

```
TusCoach/
├── venv/              # Python virtual environment (shared)
├── backend/           # FastAPI Python backend
│   ├── app/           # Application code
│   │   ├── api/       # REST API endpoints
│   │   ├── models/    # SQLAlchemy models
│   │   ├── schemas/   # Pydantic schemas
│   │   ├── services/  # Business logic
│   │   ├── workflows/ # AI coaching workflows
│   │   └── core/      # Config, DB, Celery
│   ├── alembic/       # Database migrations
│   └── tests/         # Unit tests
├── mobile/            # React Native Expo app
│   ├── app/           # App screens (file-based routing)
│   └── src/           # Shared code (API, state, components)
├── docs/              # Documentation
└── README.md          # This file
```

## Quick Start

See **[Dev Runbook](docs/dev_runbook.md)** for detailed instructions.

### Prerequisites
- Python 3.14+ (venv at project root)
- PostgreSQL 16+ (port 5433)
- Redis 7+ (port 6379)
- Node.js 18+
- Expo CLI

### Start Backend

```bash
cd backend
./dev.sh  # Starts FastAPI on 0.0.0.0:8000
```

### Start Celery Worker

```bash
cd backend
../venv/bin/celery -A app.core.celery_app worker --loglevel=info
```

### Start Celery Beat (Scheduler)

```bash
cd backend
../venv/bin/celery -A app.core.celery_app beat \
  --loglevel=info \
  --scheduler celery.beat:Scheduler
```

### Start Mobile App

```bash
cd mobile
npm install  # First time only
npm start    # For iOS Simulator

# For physical device:
export EXPO_PUBLIC_API_BASE_URL=http://YOUR_IP:8000/v1
npm start
```

### Test User
- Email: `mobile@test.com`
- Password: `test123`

## Tech Stack

### Backend
- **Framework**: Python 3.14, FastAPI, SQLAlchemy 2.0, Pydantic
- **Database**: PostgreSQL 16 with Alembic migrations
- **Task Queue**: Celery + Redis
- **Authentication**: JWT tokens with bcrypt
- **AI**: OpenAI API for coaching messages

### Mobile
- **Framework**: React Native with Expo SDK 54
- **Routing**: Expo Router (file-based)
- **State**: Zustand with persist middleware
- **Storage**: SecureStore (iOS Keychain / Android Keystore)
- **API**: Axios with request interceptors
- **Data Fetching**: TanStack Query (React Query)

### Architecture
- Event-driven workflow system
- Scheduled tasks with Celery Beat
- Idempotent operations with database constraints
- Rate limiting for workflow triggers
- Read/unread tracking with client-side state

## API Endpoints

**Authentication:**
- `POST /v1/auth/register` - Create new user
- `POST /v1/auth/login` - Get JWT token

**Study:**
- `POST /v1/students/{id}/sessions` - Record study session
- `GET /v1/students/{id}/plan?date=YYYY-MM-DD` - Get daily tasks
- `PATCH /v1/plan-tasks/{id}` - Update task status

**Exams:**
- `POST /v1/students/{id}/exams` - Record mock exam

**Messages:**
- `GET /v1/students/me/messages/latest` - Latest message
- `GET /v1/students/me/messages?limit=50` - Message history

**Stats:**
- `GET /v1/students/{id}/stats` - Weekly statistics with streak

**Admin (Dev):**
- `GET /v1/admin/workflow_runs?limit=50` - Debug workflows
- `GET /v1/admin/events?limit=50` - Debug events
- `GET /v1/admin/plan_tasks?date=YYYY-MM-DD` - Debug tasks

Interactive docs: http://localhost:8000/docs

## Key Features Explained

### AI Coaching Workflows

**Daily Review Workflow:**
- Triggers: Study session (6h rate limit) or nightly at 21:30 Istanbul time
- Calculates risk scores for all topics
- Creates 2 tasks per weak topic (max 3 topics = 6 tasks)
- Generates AI coaching message
- Rate limited to prevent spam

**Exam Intervention Workflow:**
- Triggers: Immediately after mock exam submission
- Analyzes exam performance
- Identifies weak subjects
- Provides personalized feedback

**Inactivity Scan Workflow:**
- Triggers: Every 6 hours via Celery Beat
- Detects students with no activity in 3+ days
- Sends motivational messages

### Event-Driven Architecture

1. User action creates event (e.g., study_session_created)
2. Event logged in database with processed_at = NULL
3. Celery Beat runs every 2 minutes
4. Unprocessed events trigger workflows
5. Events marked as processed (processed_at = NOW())
6. Workflows execute in Celery worker
7. Results stored in workflow_runs table

### Message System

**Storage:**
- Messages persisted in `coach_messages` table (dedicated table)
- Linked to `workflow_runs` via `workflow_run_id`
- Idempotency via UNIQUE constraint on `(user_id, workflow_run_id)`

**Read Tracking:**
- `read_at` timestamp (NULL = unread)
- Auto-marks as read when message opened
- Unread count badge on Inbox tab (auto-refreshes every 30s)

**Features:**
- Message history with newest-first ordering
- Filter by unread status
- Push notifications via Expo
- Deep linking to message detail screen

**Backfill:**
- Use `scripts/backfill_coach_messages.py` to migrate historical messages
- See [backend/scripts/README.md](backend/scripts/README.md) for details

## Troubleshooting

**Common Issues:**

1. **Mobile can't connect to backend**
   - Use your computer's IP, not 127.0.0.1
   - Set `EXPO_PUBLIC_API_BASE_URL=http://YOUR_IP:8000/v1`
   - Ensure backend runs with `--host 0.0.0.0`

2. **Celery Beat disk I/O error on macOS**
   - Always use: `--scheduler celery.beat:Scheduler`
   - Avoids celerybeat-schedule.db permission issues

3. **401 Unauthorized errors**
   - Token may have expired
   - Log out and log back in to get fresh token

4. **Workflows not triggering**
   - Check Celery worker is running
   - Check Celery beat is running
   - Query event_logs table for processed_at status

See **[Dev Runbook](docs/dev_runbook.md)** for detailed troubleshooting.

## Development Workflow

1. Make changes to backend code → Uvicorn auto-reloads
2. Make changes to mobile code → Metro bundler auto-reloads
3. Database schema changes → Create Alembic migration
4. Test with admin endpoints → Debug data and workflows
5. Check logs → Backend, Celery worker, Celery beat

## Database Maintenance Scripts

**Backfill Coach Messages:**
```bash
cd backend

# Dry run (see what would be created)
python scripts/backfill_coach_messages.py

# Actually perform the backfill
python scripts/backfill_coach_messages.py --commit
```

Populates `coach_messages` table from historical `workflow_runs` data. Safe to rerun (idempotent).

See [backend/scripts/README.md](backend/scripts/README.md) for detailed documentation.

## Testing

```bash
# Backend unit tests
cd backend
../venv/bin/python -m pytest tests/ -v

# Specific test file
../venv/bin/python -m pytest tests/test_messages.py -v

# Run with coverage
../venv/bin/python -m pytest --cov=app --cov-report=term
```

## Contributing

This is a personal project for TUS exam preparation. Not currently accepting contributions.

## License

MIT
