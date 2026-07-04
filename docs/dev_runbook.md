# TusCoach Development Runbook

Complete guide for running the TusCoach application in development mode.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Backend Setup](#backend-setup)
- [Mobile Setup](#mobile-setup)
- [Database & Redis](#database--redis)
- [Celery Workers](#celery-workers)
- [Common Pitfalls](#common-pitfalls)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

**Required Software:**
- Python 3.14+ with venv in `/Users/burakozer/TusCoach/venv`
- PostgreSQL 16+ (running on port 5433)
- Redis 7+ (running on port 6379)
- Node.js 18+ with npm
- Expo CLI
- iOS Simulator (for Mac) or Android Emulator
- Physical device (optional, for real device testing)

**Environment:**
- macOS (tested on Darwin 24.6.0)
- Backend timezone: Europe/Istanbul

---

## Quick Start

**Terminal 1 - Backend:**
```bash
cd backend
./dev.sh
```

**Terminal 2 - Celery Worker:**
```bash
cd backend
../venv/bin/celery -A app.core.celery_app worker --loglevel=info
```

**Terminal 3 - Celery Beat (Scheduler):**
```bash
cd backend
../venv/bin/celery -A app.core.celery_app beat \
  --loglevel=info \
  --scheduler celery.beat:Scheduler
```

**Terminal 4 - Mobile:**
```bash
cd mobile
npm start
# Scan QR code with Expo Go app
```

---

## Backend Setup

### 1. Start Backend Server

```bash
cd /Users/burakozer/TusCoach/backend
./dev.sh
```

**What it does:**
- Kills any process on port 8000
- Starts Uvicorn with hot reload
- Listens on `0.0.0.0:8000` (accessible from network)

**Manual start (alternative):**
```bash
cd backend
../venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Backend Environment Variables

Create/edit `backend/.env`:
```bash
# Application
APP_NAME=TusCoach
APP_VERSION=0.1.0
ENV=local

# Database (PostgreSQL via Docker)
DATABASE_URL=postgresql://tuscoach:tuscoach123@localhost:5433/tuscoach

# Redis
REDIS_URL=redis://localhost:6379/0

# Authentication
JWT_SECRET=your-secret-key-here

# LLM Configuration
LLM_PROVIDER=openai
LLM_API_KEY=your-api-key-here

# CORS
ALLOWED_ORIGINS=["http://localhost:3000"]
```

### 3. Verify Backend is Running

```bash
# Check health
curl http://localhost:8000/

# Check API docs
open http://localhost:8000/docs

# Expected response
{"message": "TusCoach API is running"}
```

---

## Mobile Setup

### 1. Install Dependencies

```bash
cd mobile
npm install
```

### 2. iOS Simulator (Default)

```bash
cd mobile
npm start
# Press 'i' to open iOS Simulator
```

**Default API URL:** `http://127.0.0.1:8000/v1`

### 3. Physical Device (Network Testing)

**Step 1:** Find your computer's local IP:
```bash
ipconfig getifaddr en0  # macOS WiFi
# Example output: 192.168.1.172
```

**Step 2:** Set environment variable:
```bash
cd mobile
export EXPO_PUBLIC_API_BASE_URL=http://192.168.1.172:8000/v1
npm start
```

**Step 3:** Scan QR code with Expo Go app on your phone.

**Important:**
- Phone and computer must be on the same WiFi network
- Backend must listen on `0.0.0.0` (not `127.0.0.1`)
- Firewall must allow connections on port 8000

### 4. Persistent Environment Variable (Optional)

Create `mobile/.env`:
```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.172:8000/v1
```

Then just run:
```bash
npm start
```

---

## Database & Redis

### PostgreSQL

**Assumed to be running on port 5433 with credentials:**
- Host: `localhost`
- Port: `5433`
- User: `tuscoach`
- Password: `tuscoach123`
- Database: `tuscoach`
- Test DB: `tuscoach_test`

**Connect to database:**
```bash
PGPASSWORD=tuscoach123 psql -h localhost -p 5433 -U tuscoach -d tuscoach
```

**Common operations:**
```sql
-- List tables
\dt

-- Check users
SELECT id, email, role, is_active FROM users;

-- Check workflow runs
SELECT id, student_id, workflow_name, status, created_at
FROM workflow_runs
ORDER BY created_at DESC
LIMIT 10;

-- Check event logs
SELECT id, event_type, processed_at, created_at
FROM event_logs
ORDER BY created_at DESC
LIMIT 10;

-- Exit
\q
```

**Run migrations:**
```bash
cd backend
../venv/bin/alembic upgrade head
```

### Redis

**Assumed to be running on port 6379.**

**Connect to Redis:**
```bash
redis-cli

# Check keys
KEYS *

# Monitor commands
MONITOR

# Exit
exit
```

**Verify Redis connection:**
```bash
redis-cli ping
# Expected: PONG
```

---

## Celery Workers

### 1. Celery Worker (Task Processor)

Processes background tasks like workflow execution.

```bash
cd backend
../venv/bin/celery -A app.core.celery_app worker --loglevel=info
```

**Alternative log levels:**
- `--loglevel=debug` - Verbose logging
- `--loglevel=warning` - Minimal logging

**Verify worker is running:**
```bash
# In another terminal
cd backend
../venv/bin/celery -A app.core.celery_app inspect active
```

### 2. Celery Beat (Scheduler)

Triggers scheduled tasks (workflows).

**⚠️ IMPORTANT - Use In-Memory Scheduler:**

macOS has issues with persistent schedulers causing disk I/O errors. Always use the in-memory scheduler:

```bash
cd backend
../venv/bin/celery -A app.core.celery_app beat \
  --loglevel=info \
  --scheduler celery.beat:Scheduler
```

**DO NOT USE:**
```bash
# ❌ This causes disk I/O errors on macOS
celery -A app.core.celery_app beat --loglevel=info
```

### 3. Scheduled Tasks

**Current schedule (Europe/Istanbul timezone):**

| Task | Schedule | Description |
|------|----------|-------------|
| `inactivity_scan_every_6h` | Every 6 hours | Scans for inactive students |
| `nightly_daily_review_2130` | Daily at 21:30 | Creates daily review tasks |
| `process_recent_events_every_2min` | Every 2 minutes | Processes unprocessed events |

**Monitor scheduled tasks:**
```bash
cd backend
../venv/bin/celery -A app.core.celery_app inspect scheduled
```

### 4. Celery Flower (Optional Monitoring)

```bash
cd backend
../venv/bin/pip install flower
../venv/bin/celery -A app.core.celery_app flower --port=5555
```

Open http://localhost:5555 to view task monitoring dashboard.

---

## Common Pitfalls

### 1. Mobile Can't Connect to Backend

**Symptom:** "Network request failed" or "Connection refused" on mobile device.

**Causes & Solutions:**

**a) Using 127.0.0.1 on physical device:**
```bash
# ❌ Wrong - only works on simulator
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/v1

# ✅ Correct - use your computer's IP
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.172:8000/v1
```

**b) Backend listening on localhost only:**
```bash
# ❌ Wrong
uvicorn app.main:app --host 127.0.0.1 --port 8000

# ✅ Correct - use dev.sh or specify 0.0.0.0
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**c) Different WiFi networks:**
- Ensure phone and computer are on the same WiFi
- Corporate/public WiFi may block device-to-device communication

**d) Firewall blocking port 8000:**
```bash
# macOS - allow incoming connections
# System Preferences > Security > Firewall > Allow incoming connections for "Python"
```

### 2. Port Conflicts

**Symptom:** "Address already in use" error.

**Solution:**
```bash
# Find process using port 8000
lsof -ti:8000

# Kill the process
lsof -ti:8000 | xargs kill -9

# Or use dev.sh (automatically kills port 8000)
./dev.sh
```

### 3. Celery Beat Disk I/O Error (macOS)

**Symptom:**
```
PermissionError: [Errno 1] Operation not permitted: 'celerybeat-schedule.db'
```

**Solution:** Always use in-memory scheduler:
```bash
celery -A app.core.celery_app beat \
  --loglevel=info \
  --scheduler celery.beat:Scheduler
```

### 4. Token/Authentication Issues

**Symptom:** 401 Unauthorized errors on mobile.

**Causes & Solutions:**

**a) Token expired:**
- Tokens expire after a set time
- Solution: Log out and log back in

**b) Token not stored:**
- Check Zustand auth store
- Solution: Clear app data and log in again

**c) Backend changed:**
- JWT_SECRET changed in backend
- Solution: Re-authenticate all users

**Debug token:**
```bash
# Login and get token
curl -X POST http://localhost:8000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mobile@test.com","password":"test123"}'

# Decode token (use jwt.io or)
# The response includes: {"access_token": "...", "token_type": "bearer"}
```

### 5. Database Migration Issues

**Symptom:** Models don't match database schema.

**Solution:**
```bash
cd backend

# Check current migration version
../venv/bin/alembic current

# Run pending migrations
../venv/bin/alembic upgrade head

# If migrations are out of sync, check history
../venv/bin/alembic history
```

### 6. Missing Dependencies

**Backend:**
```bash
cd backend
../venv/bin/pip install -r requirements.txt
```

**Mobile:**
```bash
cd mobile
npm install
```

### 7. Redis Not Running

**Symptom:** Connection refused to localhost:6379.

**Check if Redis is running:**
```bash
redis-cli ping
# Should return: PONG
```

**Start Redis:**
```bash
# macOS with Homebrew
brew services start redis

# Or manually
redis-server
```

### 8. PostgreSQL Not Running

**Symptom:** Connection refused to localhost:5433.

**Check if PostgreSQL is running:**
```bash
PGPASSWORD=tuscoach123 psql -h localhost -p 5433 -U tuscoach -d tuscoach
```

**Start PostgreSQL (Docker):**
```bash
# Assuming PostgreSQL is running in Docker
docker ps | grep postgres
```

---

## Troubleshooting

### Check All Services

```bash
# Backend
curl http://localhost:8000/
# Expected: {"message": "TusCoach API is running"}

# PostgreSQL
PGPASSWORD=tuscoach123 psql -h localhost -p 5433 -U tuscoach -d tuscoach -c "SELECT version();"
# Should return PostgreSQL version

# Redis
redis-cli ping
# Expected: PONG

# Celery Worker
cd backend
../venv/bin/celery -A app.core.celery_app inspect active
# Should show worker status

# Celery Beat
# Check logs for scheduled tasks being enqueued
```

### View Logs

**Backend logs:**
- In terminal where `dev.sh` is running
- Uses Uvicorn logging

**Celery Worker logs:**
- In terminal where worker is running
- Look for task execution logs

**Celery Beat logs:**
- In terminal where beat is running
- Look for "Scheduler: Sending due task" messages

**Mobile logs:**
- In terminal where `npm start` is running
- Metro bundler logs
- Check Expo Go app for errors

### Debug API Calls

**Using curl:**
```bash
# Login
TOKEN=$(curl -X POST http://localhost:8000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mobile@test.com","password":"test123"}' \
  | jq -r '.access_token')

# Get messages
curl http://localhost:8000/v1/students/me/messages \
  -H "Authorization: Bearer $TOKEN"

# Admin endpoints
curl http://localhost:8000/v1/admin/workflow_runs?limit=5 \
  -H "Authorization: Bearer $TOKEN"
```

**Using API docs:**
1. Open http://localhost:8000/docs
2. Click "Authorize" button
3. Enter token: `Bearer YOUR_TOKEN_HERE`
4. Test endpoints interactively

### Reset Database (Dev Only)

**⚠️ WARNING: This deletes all data!**

```bash
# Connect to PostgreSQL
PGPASSWORD=tuscoach123 psql -h localhost -p 5433 -U tuscoach -d postgres

# Drop and recreate database
DROP DATABASE tuscoach;
CREATE DATABASE tuscoach;
\q

# Run migrations
cd backend
../venv/bin/alembic upgrade head

# Create test user
cd backend
../venv/bin/python -c "
from app.core.db import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

db = SessionLocal()
user = User(
    email='mobile@test.com',
    hashed_password=get_password_hash('test123'),
    role='student',
    is_active=True
)
db.add(user)
db.commit()
print(f'Created user: {user.email} with id: {user.id}')
db.close()
"
```

### View Running Processes

```bash
# All TusCoach-related processes
ps aux | grep -E "uvicorn|celery|expo"

# Ports in use
lsof -i :8000  # Backend
lsof -i :5433  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :19000 # Expo dev server
```

---

## Development Workflow

### 1. Daily Startup

```bash
# Terminal 1 - Backend
cd /Users/burakozer/TusCoach/backend && ./dev.sh

# Terminal 2 - Celery Worker
cd /Users/burakozer/TusCoach/backend && \
  ../venv/bin/celery -A app.core.celery_app worker --loglevel=info

# Terminal 3 - Celery Beat
cd /Users/burakozer/TusCoach/backend && \
  ../venv/bin/celery -A app.core.celery_app beat \
    --loglevel=info --scheduler celery.beat:Scheduler

# Terminal 4 - Mobile (choose one)
# For simulator:
cd /Users/burakozer/TusCoach/mobile && npm start

# For physical device:
cd /Users/burakozer/TusCoach/mobile && \
  export EXPO_PUBLIC_API_BASE_URL=http://192.168.1.172:8000/v1 && \
  npm start
```

### 2. Making Changes

**Backend code changes:**
- Uvicorn auto-reloads on file changes
- No need to restart

**Mobile code changes:**
- Metro bundler auto-reloads
- Shake device/simulator to reload manually

**Database schema changes:**
```bash
# Create migration
cd backend
../venv/bin/alembic revision --autogenerate -m "Description"

# Review migration file in backend/alembic/versions/

# Apply migration
../venv/bin/alembic upgrade head
```

### 3. Testing

**Backend unit tests:**
```bash
cd backend
../venv/bin/python -m pytest tests/ -v
```

**Specific test file:**
```bash
../venv/bin/python -m pytest tests/test_messages.py -v
```

**Mobile testing:**
- Test on simulator and physical device
- Different screen sizes
- Network conditions

---

## Quick Reference

### Backend URLs
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- API Redoc: http://localhost:8000/redoc

### Database
- PostgreSQL: `localhost:5433`
- Redis: `localhost:6379`

### Mobile
- Simulator API: `http://127.0.0.1:8000/v1`
- Device API: `http://YOUR_IP:8000/v1`
- Set via: `EXPO_PUBLIC_API_BASE_URL`

### Celery Commands
```bash
# Worker
celery -A app.core.celery_app worker --loglevel=info

# Beat (in-memory scheduler)
celery -A app.core.celery_app beat --loglevel=info --scheduler celery.beat:Scheduler

# Inspect active tasks
celery -A app.core.celery_app inspect active

# Inspect scheduled tasks
celery -A app.core.celery_app inspect scheduled

# Purge all tasks
celery -A app.core.celery_app purge
```

### Test User
- Email: `mobile@test.com`
- Password: `test123`

---

## Additional Resources

- **Backend README**: `/backend/README.md`
- **Mobile README**: `/mobile/README.md`
- **API Docs**: http://localhost:8000/docs
- **Dummy Book**: `/docs/dummy_book.md` (detailed walkthrough)
