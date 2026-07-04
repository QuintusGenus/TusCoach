# TusCoach Backend

FastAPI backend for TUS Medical Residency Exam coaching application.

## Running the Application

### Development Server

```bash
./dev.sh
```

Or manually:

```bash
source ../venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Celery Workers and Beat Scheduler

### Running Celery Worker

The worker processes background tasks asynchronously.

```bash
# From backend directory
celery -A app.core.celery_app worker --loglevel=info
```

### Running Celery Beat (In-Memory Scheduler)

Beat is the task scheduler that triggers periodic tasks. We use the in-memory scheduler to avoid macOS disk I/O issues with the default persistent scheduler.

```bash
# From backend directory
celery -A app.core.celery_app beat --loglevel=info --scheduler celery.beat:Scheduler
```

**Important:** Always use `--scheduler celery.beat:Scheduler` to avoid dbm/sqlite3 disk I/O errors on macOS.

### Production Setup

Run both worker and beat in separate terminals or as background services:

**Terminal 1 - Worker:**
```bash
cd backend
celery -A app.core.celery_app worker --loglevel=info
```

**Terminal 2 - Beat:**
```bash
cd backend
celery -A app.core.celery_app beat --loglevel=info --scheduler celery.beat:Scheduler
```

### Scheduled Tasks

The following tasks are configured in `app/core/celery_app.py`:

| Task Name | Schedule | Description |
|-----------|----------|-------------|
| `inactivity_scan` | Every 6 hours | Scans for inactive students and triggers rescue workflows |
| `nightly_daily_review` | Daily at 21:30 (Europe/Istanbul) | Runs daily review workflow for all students |
| `process_recent_events` | Every 2 minutes | Processes unprocessed events and triggers appropriate workflows |

**Timezone:** All schedules use `Europe/Istanbul` timezone.

### Monitoring Tasks

To see active tasks and workers:

```bash
# List active tasks
celery -A app.core.celery_app inspect active

# List registered tasks
celery -A app.core.celery_app inspect registered

# Check worker stats
celery -A app.core.celery_app inspect stats
```

## Database Migrations

```bash
# Run migrations
alembic upgrade head

# Create new migration
alembic revision --autogenerate -m "description"
```

## Configuration

Environment variables are configured in `.env` file. See `.env.example` for required variables.

Key configuration:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection for Celery broker/backend
- `SECRET_KEY`: JWT secret key
