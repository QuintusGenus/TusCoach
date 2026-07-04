# TusCoach Complete Dummy Book
## From Zero to Hero - Every Single Step Explained

**For complete beginners who want to understand every line of code and every command.**

---

## Table of Contents

1. [What is TusCoach?](#what-is-tuscoach)
2. [Architecture Overview](#architecture-overview)
3. [Every Feature We Have](#every-feature-we-have)
4. [Complete Setup Walkthrough](#complete-setup-walkthrough)
5. [User Registration & Login](#user-registration--login)
6. [Database Exploration](#database-exploration)
7. [Creating Study Sessions](#creating-study-sessions)
8. [Study Plans & Tasks](#study-plans--tasks)
9. [Mock Exams](#mock-exams)
10. [AI Coaching Workflows](#ai-coaching-workflows)
11. [Messages & Inbox](#messages--inbox)
12. [Stats & Progress](#stats--progress)
13. [Push Notifications](#push-notifications)
14. [Student Preferences & Personalization](#student-preferences--personalization)
15. [Quiet Hours](#quiet-hours)
16. [Onboarding Flow](#onboarding-flow)
17. [Admin Debug Tools](#admin-debug-tools)
18. [Mobile App Features](#mobile-app-features)
19. [Troubleshooting Every Error](#troubleshooting-every-error)

---

## What is TusCoach?

**TusCoach** is an AI-powered coaching application for Turkish Medical Residency Exam (TUS) preparation.

**What it does:**
- Tracks your study sessions (how long you studied, which topics)
- Records mock exam scores
- Creates personalized daily study plans
- Sends AI-generated coaching messages based on your behavior
- Calculates your progress, streaks, and adherence
- Provides insights on weak topics

**Technology Stack:**
- **Backend**: Python FastAPI + PostgreSQL + Redis + Celery
- **Mobile**: React Native with Expo
- **AI**: OpenAI API for generating coaching messages

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         USER'S PHONE                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Expo React Native App (mobile/)                     │  │
│  │  - Onboarding: First-login wizard (exam, targets)    │  │
│  │  - Dashboard: Snapshot, coach message, today's tasks │  │
│  │  - Plan: Daily tasks with completion tracking        │  │
│  │  - Inbox: Coach messages history                     │  │
│  │  - Progress: Weekly stats, streak, adherence         │  │
│  │  - Settings: Preferences, notifications, logout      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                  ↓ HTTP/REST API        ↑ Expo Push
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (backend/)                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  FastAPI Server (port 8000)                          │  │
│  │  - Auth: /v1/auth/login, /register, /me              │  │
│  │  - Study: /v1/sessions, /v1/students/*/plan          │  │
│  │  - Messages: /v1/students/me/messages/*              │  │
│  │  - Preferences: /v1/students/me/preferences          │  │
│  │  - Devices: /v1/devices/register                     │  │
│  │  - Stats: /v1/students/*/stats                       │  │
│  │  - Admin: /v1/admin/* (debug endpoints)              │  │
│  └──────────────────────────────────────────────────────┘  │
│                            ↓                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  PostgreSQL (port 5433)                              │  │
│  │  Tables:                                              │  │
│  │  - users, student_profiles: Authentication & profile │  │
│  │  - student_preferences: Personalization settings     │  │
│  │  - study_sessions: User study logs                   │  │
│  │  - mock_exams: Exam scores                           │  │
│  │  - study_plans, plan_tasks: Plans & daily tasks      │  │
│  │  - event_logs: Trigger events for workflows          │  │
│  │  - workflow_runs: AI coaching executions             │  │
│  │  - coach_messages: Persistent coach messages         │  │
│  │  - devices: Expo push tokens per user                │  │
│  │  - notifications: Push notification outbox           │  │
│  └──────────────────────────────────────────────────────┘  │
│                            ↓                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Redis (port 6379)                                   │  │
│  │  - Task queue for Celery                             │  │
│  │  - Caching                                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                            ↓                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Celery Worker                                       │  │
│  │  - Processes background tasks                        │  │
│  │  - Executes AI workflows                             │  │
│  │  - Sends push notifications via Expo Push API        │  │
│  └──────────────────────────────────────────────────────┘  │
│                            ↓                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Celery Beat (Scheduler)                             │  │
│  │  - Every 2 min: Process events                       │  │
│  │  - Every 1 min: Send pending notifications           │  │
│  │  - Every 6 hours: Inactivity scan                    │  │
│  │  - Daily 21:30: Create daily tasks                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                            ↓                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Expo Push API (external)                            │  │
│  │  - https://exp.host/--/api/v2/push/send              │  │
│  │  - Delivers push notifications to devices            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Every Feature We Have

### 1. Authentication & User Management
- ✅ User registration with email/password
- ✅ JWT token-based login
- ✅ Token validation and auto-logout on expiry
- ✅ Secure password hashing
- ✅ User profiles with student metadata

### 2. Study Tracking
- ✅ Record study sessions (date, duration, topic)
- ✅ Multiple topics per session
- ✅ Timestamps for session start/end
- ✅ View study history

### 3. Mock Exam Tracking
- ✅ Record mock exam scores
- ✅ Track exam dates
- ✅ Store scores per subject/topic
- ✅ Historical exam performance

### 4. Study Plans & Daily Tasks
- ✅ Long-term study plans with start/end dates
- ✅ Daily task creation (review, practice questions)
- ✅ Task completion tracking
- ✅ Task status (pending, completed)
- ✅ Date-based task filtering
- ✅ Idempotent task creation (no duplicates)

### 5. AI Coaching Workflows
- ✅ **Daily Review Workflow**
  - Creates 2 tasks per day per weak topic
  - Triggered by study sessions (6h rate limit)
  - Nightly scheduled run at 21:30

- ✅ **Exam Intervention Workflow**
  - Triggered after mock exams
  - Analyzes performance
  - Provides targeted advice

- ✅ **Inactivity Scan Workflow**
  - Runs every 6 hours
  - Detects inactive students (no sessions in 3+ days)
  - Sends motivational messages

### 6. Event-Driven Architecture
- ✅ Event logging system
- ✅ Automatic event processing every 2 minutes
- ✅ Rate limiting to prevent workflow spam
- ✅ Event types: study_session_created, mock_exam_created
- ✅ Processed_at tracking for deduplication

### 7. Message System
- ✅ AI-generated coach messages
- ✅ Message history endpoint
- ✅ Inbox with NEW badges
- ✅ Message detail view
- ✅ Read/unread tracking
- ✅ Message metadata (subject, body, tone, workflow)

### 8. Statistics & Progress
- ✅ Weekly study stats
- ✅ Streak calculation (consecutive study days)
- ✅ Adherence percentage
- ✅ Daily breakdown of study time
- ✅ Total sessions and hours
- ✅ Current week vs historical data

### 9. Admin/Debug Tools
- ✅ View recent workflow runs
- ✅ View event logs with processing status
- ✅ View plan tasks by date
- ✅ Authentication required (TODO: admin role)

### 10. Push Notifications
- ✅ Device registration (Expo push tokens)
- ✅ Notification outbox with status tracking (pending, sent, failed, deferred)
- ✅ Celery task sends pending notifications every minute
- ✅ Expo Push API integration
- ✅ Invalid device token cleanup
- ✅ Notification deep linking (tap notification → opens message)
- ✅ Foreground, background, and killed-state notification handling
- ✅ One notification per workflow run (idempotent)

### 11. Student Preferences & Personalization
- ✅ `student_preferences` table (1:1 with student_profiles)
- ✅ Exam date tracking
- ✅ Weekday/weekend daily target minutes
- ✅ Preferred study window (start/end time)
- ✅ Quiet hours (start/end time)
- ✅ Timezone support (default: Europe/Istanbul)
- ✅ GET/PUT API for preferences (partial update via `exclude_unset`)
- ✅ Onboarding status endpoint (checks exam_date + daily targets set)
- ✅ Auto-provision: first GET creates row with defaults

### 12. Preference-Aware Workflows
- ✅ Daily review uses weekday/weekend target minutes
- ✅ Inactivity rescue uses preferred study window and recovery minutes
- ✅ Preference snapshot stored in workflow_runs.context
- ✅ Fallback to hardcoded defaults when no preferences set

### 13. Quiet Hours Notification Gating
- ✅ Notifications enqueued during quiet hours → status=deferred
- ✅ next_attempt_at set to quiet hours end (in UTC)
- ✅ Double-gate: checked at enqueue time AND re-checked at send time
- ✅ Overnight quiet hours (e.g. 23:00-07:00) handled correctly
- ✅ Timezone conversion via zoneinfo (student-local → UTC)
- ✅ Deferred notifications picked up when window ends

### 14. Mobile App
- ✅ **Onboarding Screen** (first login wizard)
  - 4-step wizard: exam date, targets, study window, quiet hours
  - Progress dots indicator
  - Skip for optional steps, required for targets
  - Submit via PUT /students/me/preferences
  - Routes to dashboard on success

- ✅ **Dashboard Screen**
  - Today's Snapshot card (exam countdown, target, study window)
  - "Edit" link → Preferences screen
  - Latest coach message
  - Today's plan tasks
  - Quick add session form

- ✅ **Plan Screen**
  - Date navigation (Yesterday/Today/Tomorrow)
  - Task list with completion checkboxes
  - Task metadata (type, duration, topic)

- ✅ **Inbox Screen**
  - Message list with previews
  - NEW badges for unread
  - Unread count badge on tab icon (refreshes every 30s)
  - Visual distinction for new messages
  - Tap to view full message

- ✅ **Message Detail Screen**
  - Full message display
  - Auto-marks as read (server-side read_at)
  - Formatted date and metadata

- ✅ **Progress Screen**
  - Weekly stats card
  - Streak counter
  - Daily breakdown chart
  - Study time visualization

- ✅ **Settings Screen**
  - Study Preferences navigation (→ Preferences screen)
  - Push notification status and re-registration
  - Logout

- ✅ **Preferences Screen** (edit later)
  - Loads current values from backend
  - Edit exam date, targets, study window, quiet hours
  - Save changes via PUT /students/me/preferences

### 15. API Endpoints

**Authentication:**
- `POST /v1/auth/register` - Create new user
- `POST /v1/auth/login` - Get JWT token
- `GET /v1/auth/me` - Get current user data

**Study:**
- `POST /v1/sessions/` - Record study session
- `GET /v1/students/me/plan?date=YYYY-MM-DD` - Get daily tasks
- `POST /v1/plan_tasks/{id}/complete` - Mark task complete

**Exams:**
- `POST /v1/students/{id}/exams` - Record mock exam

**Messages:**
- `GET /v1/students/me/messages/latest` - Get latest message
- `GET /v1/students/me/messages?limit=50` - Get message history
- `GET /v1/students/me/messages/{id}` - Get message by ID
- `GET /v1/students/me/messages/by-workflow-run/{id}` - Get by workflow run
- `POST /v1/students/me/messages/{id}/read` - Mark message as read
- `GET /v1/students/me/messages/unread_count` - Get unread count

**Preferences:**
- `GET /v1/students/me/preferences` - Get preferences (auto-creates defaults)
- `PUT /v1/students/me/preferences` - Update preferences (partial)
- `GET /v1/students/me/onboarding_status` - Check onboarding completion

**Devices:**
- `POST /v1/devices/register` - Register device for push notifications
- `POST /v1/devices/ping` - Ping device heartbeat

**Stats:**
- `GET /v1/students/me/stats` - Get weekly statistics

**Admin (Dev):**
- `GET /v1/admin/workflow_runs?limit=50`
- `GET /v1/admin/events?limit=50`
- `GET /v1/admin/plan_tasks?date=YYYY-MM-DD`

---

## Complete Setup Walkthrough

### Step 1: Navigate to Project

📍 **WHERE TO RUN THIS:** Project Root (`/Users/burakozer/TusCoach`)

```bash
# Open terminal and navigate to project root
cd /Users/burakozer/TusCoach

# List contents to verify you're in the right place
ls -la

# You should see:
# - backend/
# - mobile/
# - venv/
# - docs/
# - README.md
```

**What each directory is:**
- `backend/` - Python FastAPI server code
- `mobile/` - React Native Expo app code
- `venv/` - Python virtual environment with dependencies
- `docs/` - Documentation files

### Step 2: Start PostgreSQL

📍 **WHERE TO RUN THIS:** Any Terminal (No specific directory required)

```bash
# Check if PostgreSQL is running
PGPASSWORD=tuscoach123 psql -h localhost -p 5433 -U tuscoach -d tuscoach

# If you get connection error, start PostgreSQL
# (Assuming Docker setup)
docker ps | grep postgres

# You should see a container running on port 5433
```

**What this does:**
- Connects to PostgreSQL database
- Port 5433 (not default 5432) to avoid conflicts
- Username: tuscoach
- Password: tuscoach123
- Database: tuscoach

**If connected successfully, you'll see:**
```
psql (16.x)
Type "help" for help.

tuscoach=#
```

Type `\q` to exit.

### Step 3: Start Redis

📍 **WHERE TO RUN THIS:** Any Terminal (No specific directory required)

```bash
# Check if Redis is running
redis-cli ping

# Expected output: PONG

# If not running, start Redis
redis-server

# Or with Homebrew (macOS)
brew services start redis
```

**What Redis does:**
- Message broker for Celery tasks
- Queues background jobs
- Caches data

### Step 4: Start Backend Server

📍 **WHERE TO RUN THIS:** Backend Directory (`/Users/burakozer/TusCoach/backend`)

```bash
# Navigate to backend
cd /Users/burakozer/TusCoach/backend

# Start server using dev script
./dev.sh
```

**What happens:**
📍 **WHERE TO RUN THIS:** Backend Directory (`/Users/burakozer/TusCoach/backend`)

```bash
#!/bin/bash
# backend/dev.sh

PORT=8000
echo "Stopping any process on port $PORT..."
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true  # Kill existing process

echo "Starting Uvicorn server..."
../venv/bin/uvicorn app.main:app --host 0.0.0.0 --port $PORT --reload
```

**Explanation line by line:**
1. `PORT=8000` - Set port variable
2. `lsof -ti:$PORT` - Find process ID using port 8000
3. `xargs kill -9` - Force kill that process
4. `../venv/bin/uvicorn` - Run Uvicorn from virtual environment
5. `app.main:app` - Import `app` from `app/main.py`
6. `--host 0.0.0.0` - Listen on all network interfaces (allows phone to connect)
7. `--port $PORT` - Listen on port 8000
8. `--reload` - Auto-reload on code changes

**Expected output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [12345] using WatchFiles
INFO:     Started server process [12346]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

**Verify it's working:**
📍 **WHERE TO RUN THIS:** Any Terminal (No specific directory required)

```bash
# In a new terminal
curl http://localhost:8000/

# Expected: {"message":"TusCoach API is running"}
```

### Step 5: Start Celery Worker

**Open a new terminal tab/window.**

📍 **WHERE TO RUN THIS:** Backend Directory (`/Users/burakozer/TusCoach/backend`)

```bash
# Navigate to backend
cd /Users/burakozer/TusCoach/backend

# Start worker
../venv/bin/celery -A app.core.celery_app worker --loglevel=info
```

**Explanation:**
- `celery` - Celery command-line tool
- `-A app.core.celery_app` - Application module containing Celery app
- `worker` - Start worker process
- `--loglevel=info` - Show informational logs

**What it does:**
- Listens to Redis task queue
- Executes background tasks (workflows, AI calls)
- Processes async jobs

**Expected output:**
```
 -------------- celery@YourComputerName v5.x.x
---- **** -----
--- * ***  * -- Darwin-24.6.0-x86_64-64bit 2026-02-06 10:30:00
-- * - **** ---
- ** ---------- [config]
- ** ---------- .> app:         tuscoach:0x...
- ** ---------- .> transport:   redis://localhost:6379/0
- ** ---------- .> results:     disabled://
- *** --- * --- .> concurrency: 8 (prefork)
-- ******* ---- .> task events: OFF

[tasks]
  . app.tasks.process_recent_events
  . app.workflows.daily_review.daily_review_workflow
  ...

[2026-02-06 10:30:00,000: INFO/MainProcess] Connected to redis://localhost:6379/0
[2026-02-06 10:30:00,000: INFO/MainProcess] mingle: searching for neighbors
[2026-02-06 10:30:01,000: INFO/MainProcess] mingle: all alone
[2026-02-06 10:30:01,000: INFO/MainProcess] celery@YourComputerName ready.
```

### Step 6: Start Celery Beat (Scheduler)

**Open another new terminal tab/window.**

📍 **WHERE TO RUN THIS:** Backend Directory (`/Users/burakozer/TusCoach/backend`)

```bash
# Navigate to backend
cd /Users/burakozer/TusCoach/backend

# Start beat with in-memory scheduler (IMPORTANT!)
../venv/bin/celery -A app.core.celery_app beat \
  --loglevel=info \
  --scheduler celery.beat:Scheduler
```

**Why `--scheduler celery.beat:Scheduler`?**
- Default scheduler writes to disk (celerybeat-schedule.db)
- macOS has permission issues with this file
- In-memory scheduler avoids disk I/O errors
- Schedule is lost on restart (fine for development)

**What it does:**
- Sends scheduled tasks to worker at specific times
- Every 2 minutes: Process events
- Every 6 hours: Inactivity scan
- Daily 21:30: Create daily tasks

**Expected output:**
```
LocalTime -> 2026-02-06 10:30:00
Configuration ->
    . broker -> redis://localhost:6379/0
    . loader -> celery.loaders.app.AppLoader
    . scheduler -> celery.beat:Scheduler
    ...

[2026-02-06 10:30:00,000: INFO/MainProcess] beat: Starting...
[2026-02-06 10:30:00,000: INFO/MainProcess] Scheduler: Sending due task process_recent_events_every_2min
```

### Step 7: Start Mobile App

**Open another terminal.**

📍 **WHERE TO RUN THIS:** Mobile Directory (`/Users/burakozer/TusCoach/mobile`)

```bash
# Navigate to mobile directory
cd /Users/burakozer/TusCoach/mobile

# Install dependencies (first time only)
npm install

# Start Expo development server
npm start
```

**What happens:**
- Metro bundler starts
- QR code appears in terminal
- Web interface opens at http://localhost:19000 (Expo DevTools - deprecated)

**Expected output:**
```
Starting Metro Bundler
›  Metro waiting on exp://192.168.1.172:19000

› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)

› Press a │ open Android
› Press i │ open iOS simulator
› Press w │ open web

› Press r │ reload app
› Press m │ toggle menu
› Press d │ show developer menu
› Press ? │ show all commands
```

**To run on iOS Simulator:**
1. Press `i` in the terminal
2. iOS Simulator will open
3. Expo Go will install and load automatically
4. App will start

**To run on physical device:**
1. Install "Expo Go" app from App Store/Play Store
2. Scan QR code with camera (iOS) or Expo Go (Android)
3. App will load over network

**For physical device to connect to backend:**
📍 **WHERE TO RUN THIS:** Mobile Directory (`/Users/burakozer/TusCoach/mobile`)

```bash
# Stop the current npm start (Ctrl+C)

# Find your computer's IP
ipconfig getifaddr en0  # macOS WiFi
# Example output: 192.168.1.172

# Set environment variable and start
export EXPO_PUBLIC_API_BASE_URL=http://192.168.1.172:8000/v1
npm start

# Now scan QR code again
```

---

## User Registration & Login

### Using API Directly (curl)

**1. Register a new user:**

📍 **WHERE TO RUN THIS:** Any Terminal (No specific directory required)

```bash
# Create user with email and password
curl -X POST http://localhost:8000/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@example.com",
    "password": "securepass123"
  }'
```

**What happens in the backend:**
```python
# app/api/v1/auth.py

@router.post("/register")
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(400, "Email already registered")

    # Hash password
    hashed = get_password_hash(user_data.password)

    # Create user
    user = User(
        email=user_data.email,
        hashed_password=hashed,
        role="student",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {"id": user.id, "email": user.email}
```

**Expected response:**
```json
{
  "id": 11,
  "email": "student@example.com"
}
```

**2. Login to get JWT token:**

📍 **WHERE TO RUN THIS:** Any Terminal (No specific directory required)

```bash
curl -X POST http://localhost:8000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@example.com",
    "password": "securepass123"
  }'
```

**Expected response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMSIsImV4cCI6MTcwNzM5ODQwMH0.xxx",
  "token_type": "bearer",
  "user": {
    "id": 11,
    "email": "student@example.com",
    "role": "student",
    "is_active": true
  }
}
```

**3. Use token for authenticated requests:**

📍 **WHERE TO RUN THIS:** Any Terminal (No specific directory required)

```bash
# Save token to variable
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMSIsImV4cCI6MTcwNzM5ODQwMH0.xxx"

# Make authenticated request
curl http://localhost:8000/v1/students/me/messages \
  -H "Authorization: Bearer $TOKEN"
```

**How JWT authentication works:**

1. **Login:** Server verifies password, creates JWT token containing user ID
2. **Token structure:** `header.payload.signature`
   - Header: Algorithm (HS256)
   - Payload: User data (sub=user_id, exp=expiration)
   - Signature: HMAC signature using JWT_SECRET
3. **Requests:** Client sends token in Authorization header
4. **Verification:** Server decodes token, verifies signature, extracts user ID
5. **Expiry:** Token expires after set time, user must login again

### Using Mobile App

**1. Open app in simulator/device**

**2. Navigate to Login/Register screen**

**3. Enter credentials and tap Register/Login**

**What happens in mobile app:**
```typescript
// mobile/src/api/auth.ts

export async function login(email: string, password: string) {
  const response = await client.post('/auth/login', { email, password });
  return response.data;
}

// mobile/app/login.tsx

const handleLogin = async () => {
  try {
    const data = await login(email, password);

    // Store token and user in Zustand store
    setAuth(data.access_token, data.user);

    // Navigate to dashboard
    router.replace('/(tabs)');
  } catch (error) {
    Alert.alert('Login failed', error.message);
  }
};
```

**Token storage:**
- Uses Zustand persist middleware
- Stores in SecureStore (iOS Keychain / Android Keystore)
- Automatically includes in all API requests via Axios interceptor

---

## Database Exploration

### Connect to Database

📍 **WHERE TO RUN THIS:** Any Terminal (No specific directory required)

```bash
# Connect using psql
PGPASSWORD=tuscoach123 psql -h localhost -p 5433 -U tuscoach -d tuscoach
```

**You'll see:**
```
psql (16.x)
Type "help" for help.

tuscoach=#
```

### View All Tables

```sql
\dt

-- Output:
--              List of relations
--  Schema |         Name           | Type  |  Owner
-- --------+------------------------+-------+----------
--  public | users                  | table | tuscoach
--  public | student_profiles       | table | tuscoach
--  public | student_preferences    | table | tuscoach  ← NEW
--  public | topics                 | table | tuscoach
--  public | study_plans            | table | tuscoach
--  public | plan_tasks             | table | tuscoach
--  public | study_sessions         | table | tuscoach
--  public | mock_exams             | table | tuscoach
--  public | event_logs             | table | tuscoach
--  public | workflow_runs          | table | tuscoach
--  public | coach_messages         | table | tuscoach  ← NEW
--  public | devices                | table | tuscoach  ← NEW
--  public | notifications          | table | tuscoach  ← NEW
```

### View Table Structure

```sql
\d users

-- Output shows columns, types, and constraints:
-- Column    |           Type           | Nullable | Default
-- ----------+--------------------------+----------+---------
-- id        | integer                  | not null | nextval(...)
-- email     | character varying        | not null |
-- hashed_password | character varying  | not null |
-- role      | character varying        |          | 'student'
-- is_active | boolean                  |          | true
-- created_at| timestamp                |          |
```

### Query Users

```sql
-- View all users
SELECT id, email, role, is_active, created_at
FROM users
ORDER BY created_at DESC;

-- Count total users
SELECT COUNT(*) FROM users;

-- Find specific user
SELECT * FROM users WHERE email = 'mobile@test.com';
```

**Example output:**
```
 id |      email       |  role   | is_active |     created_at
----+------------------+---------+-----------+--------------------
 10 | mobile@test.com  | student | t         | 2026-02-04 12:07:00
 11 | student@example  | student | t         | 2026-02-06 10:45:00
```

### Query Study Sessions

```sql
-- View recent study sessions
SELECT
  s.id,
  s.student_id,
  u.email,
  s.date,
  s.duration_minutes,
  s.created_at
FROM study_sessions s
JOIN users u ON s.student_id = u.id
ORDER BY s.created_at DESC
LIMIT 10;
```

### Query Plan Tasks

```sql
-- Today's tasks for a user
SELECT
  pt.id,
  pt.date,
  t.name as topic_name,
  pt.task_type,
  pt.target_minutes,
  pt.status
FROM plan_tasks pt
JOIN topics t ON pt.topic_id = t.id
JOIN study_plans sp ON pt.plan_id = sp.id
WHERE sp.student_id = 10
  AND pt.date = CURRENT_DATE
ORDER BY pt.created_at;
```

### Query Workflow Runs

```sql
-- Recent workflow executions
SELECT
  id,
  student_id,
  workflow_name,
  status,
  created_at,
  context->>'student_message'::text as message
FROM workflow_runs
ORDER BY created_at DESC
LIMIT 5;
```

### Query Event Logs

```sql
-- Unprocessed events
SELECT
  id,
  student_id,
  event_type,
  created_at,
  processed_at
FROM event_logs
WHERE processed_at IS NULL
ORDER BY created_at DESC;

-- Events processed in last hour
SELECT
  event_type,
  COUNT(*) as count
FROM event_logs
WHERE processed_at >= NOW() - INTERVAL '1 hour'
GROUP BY event_type;
```

### Useful Queries for Debugging

**Check if user has study plan:**
```sql
SELECT * FROM study_plans WHERE student_id = 10;
```

**Check if daily tasks were created:**
```sql
SELECT COUNT(*) FROM plan_tasks
WHERE plan_id = (SELECT id FROM study_plans WHERE student_id = 10 LIMIT 1)
  AND date = CURRENT_DATE;
```

**Check workflow triggers:**
```sql
-- Did study session trigger workflow?
SELECT
  e.id as event_id,
  e.event_type,
  e.created_at as event_time,
  e.processed_at,
  wr.id as workflow_id,
  wr.workflow_name,
  wr.status
FROM event_logs e
LEFT JOIN workflow_runs wr ON wr.student_id = e.student_id
  AND wr.created_at >= e.processed_at
  AND wr.created_at < e.processed_at + INTERVAL '1 minute'
WHERE e.event_type = 'study_session_created'
ORDER BY e.created_at DESC
LIMIT 10;
```

### Query New Tables

**Coach Messages:**
```sql
-- Recent coach messages with read status
SELECT cm.id, u.email, cm.subject, cm.read_at, cm.created_at
FROM coach_messages cm
JOIN student_profiles p ON cm.student_id = p.id
JOIN users u ON p.user_id = u.id
ORDER BY cm.created_at DESC LIMIT 10;

-- Unread messages per user
SELECT u.email, COUNT(*) as unread
FROM coach_messages cm
JOIN student_profiles p ON cm.student_id = p.id
JOIN users u ON p.user_id = u.id
WHERE cm.read_at IS NULL
GROUP BY u.email;
```

**Devices (Push Tokens):**
```sql
-- Registered devices
SELECT d.id, u.email, d.platform, d.expo_push_token, d.last_active_at
FROM devices d
JOIN users u ON d.user_id = u.id
ORDER BY d.last_active_at DESC;
```

**Notifications:**
```sql
-- Recent notifications with status
SELECT n.id, u.email, n.type, n.status, n.title, n.sent_at, n.error
FROM notifications n
JOIN users u ON n.user_id = u.id
ORDER BY n.created_at DESC LIMIT 10;

-- Deferred (quiet hours) notifications
SELECT n.id, u.email, n.next_attempt_at, n.attempts
FROM notifications n
JOIN users u ON n.user_id = u.id
WHERE n.status = 'deferred';
```

**Student Preferences:**
```sql
-- All student preferences
SELECT u.email, sp.exam_date, sp.daily_target_minutes_weekday,
       sp.daily_target_minutes_weekend, sp.quiet_hours_start, sp.quiet_hours_end
FROM student_preferences sp
JOIN student_profiles p ON sp.student_id = p.id
JOIN users u ON p.user_id = u.id;
```

---

## Creating Study Sessions

### Via API

📍 **WHERE TO RUN THIS:** Any Terminal (No specific directory required)

```bash
# Login first
TOKEN=$(curl -X POST http://localhost:8000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mobile@test.com","password":"test123"}' \
  | jq -r '.access_token')

# Create study session
curl -X POST http://localhost:8000/v1/students/10/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-02-06",
    "duration_minutes": 90,
    "topic_ids": [1, 2, 3]
  }'
```

**What happens:**

1. **API receives request:**
```python
# backend/app/api/v1/sessions.py

@router.post("/students/{student_id}/sessions")
def create_study_session(
    student_id: int,
    session_data: StudySessionCreate,
    db: Session = Depends(get_db)
):
    # Create session record
    session = StudySession(
        student_id=student_id,
        date=session_data.date,
        duration_minutes=session_data.duration_minutes
    )
    db.add(session)
    db.commit()

    # Log event for workflow triggering
    event = EventLog(
        student_id=student_id,
        event_type="study_session_created",
        event_data={"session_id": session.id}
    )
    db.add(event)
    db.commit()

    return session
```

2. **Event logged in database:**
```sql
INSERT INTO event_logs (student_id, event_type, event_data, created_at)
VALUES (10, 'study_session_created', '{"session_id": 123}', NOW());
```

3. **Celery Beat triggers event processor (every 2 min):**
```python
# backend/app/tasks.py

@celery_app.task(name="process_recent_events")
def process_recent_events():
    # Find unprocessed events
    events = db.query(EventLog).filter(
        EventLog.processed_at.is_(None),
        EventLog.created_at >= cutoff_time
    ).all()

    for event in events:
        if event.event_type == "study_session_created":
            # Check rate limit (6 hours)
            if should_trigger_workflow(event.student_id, "daily_review"):
                # Trigger workflow
                daily_review_workflow.delay(
                    event.student_id,
                    run_id=generate_run_id()
                )

        # Mark as processed
        event.processed_at = datetime.utcnow()
        db.commit()
```

4. **Worker executes daily_review workflow:**
```python
# backend/app/workflows/daily_review.py

@celery_app.task(name="daily_review_workflow")
def daily_review_workflow(student_id: int, run_id: int):
    # Create workflow run record
    run = WorkflowRun(
        id=run_id,
        student_id=student_id,
        workflow_name="daily_review",
        status="running"
    )
    db.add(run)
    db.commit()

    # Calculate risk scores
    scores = calculate_risk_scores(db, student_id)

    # Identify weak topics
    weak_topics = get_weak_topics(scores)

    # Create 2 tasks per weak topic for tomorrow
    tasks_created = 0
    for topic in weak_topics:
        for task_type in ["review", "practice"]:
            stmt = insert(PlanTask).values(
                plan_id=plan.id,
                date=tomorrow,
                topic_id=topic.id,
                task_type=task_type,
                target_minutes=30
            ).on_conflict_do_nothing(
                index_elements=['plan_id', 'date', 'topic_id', 'task_type']
            )
            result = db.execute(stmt)
            tasks_created += result.rowcount

    # Call AI to generate message
    prompt = f"Generate coaching message for student with {tasks_created} new tasks..."
    ai_response = call_openai_api(prompt)

    # Store message in workflow run context
    run.context = {
        "student_message": {
            "subject": "Your Daily Study Plan",
            "body": ai_response.message,
            "tone": "encouraging"
        }
    }
    run.status = "completed"
    db.commit()
```

5. **User can now see message in Inbox:**
- Message stored in workflow_runs.context.student_message
- Fetched by /v1/students/me/messages endpoint
- Displayed in mobile app Inbox

### Via Mobile App

**1. Navigate to Dashboard**

**2. Find "Quick Add Session" card**

**3. Fill in:**
- Date (defaults to today)
- Duration in minutes
- Select topics (checkboxes)

**4. Tap "Add Session"**

**What happens:**
```typescript
// mobile/app/(tabs)/index.tsx

const handleAddSession = async () => {
  try {
    await createStudySession(user.id, {
      date: selectedDate,
      duration_minutes: parseInt(duration),
      topic_ids: selectedTopics
    });

    Alert.alert('Success', 'Study session recorded!');
    refetch(); // Refresh dashboard
  } catch (error) {
    Alert.alert('Error', error.message);
  }
};
```

**Behind the scenes:**
1. API call to POST /v1/students/{id}/sessions
2. Event logged in database
3. Celery processes event within 2 minutes
4. Workflow creates tasks and generates message
5. New message appears in Inbox with NEW badge

---

## Study Plans & Tasks

### How Plans Work

**Study Plan:**
- Long-term plan for a student
- Has start_date and end_date
- Contains many plan_tasks
- One active plan per student

**Plan Task:**
- Daily task (review, practice questions, reading)
- Belongs to a plan
- Tied to specific date and topic
- Has status (pending, completed)

### Create Study Plan

📍 **WHERE TO RUN THIS:** Any Terminal (No specific directory required)

```bash
# Via API (requires implementation - TODO)
# For now, plans are created automatically when first task is generated

# Or manually via database:
PGPASSWORD=tuscoach123 psql -h localhost -p 5433 -U tuscoach -d tuscoach

-- Create plan for user 10
INSERT INTO study_plans (student_id, start_date, end_date, version, status, created_at)
VALUES (10, '2026-02-01', '2026-04-30', 1, 'active', NOW())
RETURNING id;

-- Note the returned id (e.g., 5)
```

### View Today's Tasks

**Via API:**
📍 **WHERE TO RUN THIS:** Any Terminal (No specific directory required)

```bash
TOKEN=$(curl -X POST http://localhost:8000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mobile@test.com","password":"test123"}' \
  | jq -r '.access_token')

# Get today's tasks
curl "http://localhost:8000/v1/students/10/plan?date=$(date +%Y-%m-%d)" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "student_id": 10,
  "date": "2026-02-06",
  "tasks": [
    {
      "id": 123,
      "topic": "Anatomy - Cardiovascular System",
      "task_type": "review",
      "target_minutes": 30,
      "status": "pending"
    },
    {
      "id": 124,
      "topic": "Anatomy - Cardiovascular System",
      "task_type": "practice",
      "target_minutes": 30,
      "status": "pending"
    }
  ]
}
```

**Via Mobile App:**
1. Navigate to "Plan" tab
2. See today's date (default)
3. Tasks listed with checkboxes
4. Tap checkbox to mark complete

### Complete a Task

**Via API:**
📍 **WHERE TO RUN THIS:** Any Terminal (No specific directory required)

```bash
curl -X PATCH http://localhost:8000/v1/plan-tasks/123 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'
```

**Via Mobile:**
```typescript
// mobile/app/(tabs)/plan.tsx

const handleToggleTask = async (taskId: number, currentStatus: string) => {
  const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';

  try {
    await updateTaskStatus(taskId, { status: newStatus });
    refetch(); // Refresh task list
  } catch (error) {
    Alert.alert('Error', error.message);
  }
};
```

### How Tasks Are Created Automatically

**Trigger:** Study session OR nightly scheduled run

**Daily Review Workflow Logic:**
```python
def daily_review_workflow(student_id: int):
    # 1. Calculate risk scores
    scores = calculate_risk_scores(db, student_id)
    # Factors: inactivity, poor adherence, weak topics

    # 2. Identify weak topics (score > 60)
    weak_topics = [t for t in scores if t.risk_score > 60]

    # 3. For each weak topic, create 2 tasks for tomorrow
    tomorrow = date.today() + timedelta(days=1)
    for topic in weak_topics[:3]:  # Max 3 topics = 6 tasks
        # Review task
        create_task(plan_id, tomorrow, topic.id, "review", 30)

        # Practice task
        create_task(plan_id, tomorrow, topic.id, "practice", 30)

    # 4. Generate AI message
    message = generate_coaching_message(weak_topics, tasks_created)
```

**Idempotency:** Tasks are unique per (plan_id, date, topic_id, task_type), preventing duplicates.

---

## Mock Exams

### Record Mock Exam

📍 **WHERE TO RUN THIS:** Any Terminal (No specific directory required)

```bash
TOKEN=$(curl -X POST http://localhost:8000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mobile@test.com","password":"test123"}' \
  | jq -r '.access_token')

curl -X POST http://localhost:8000/v1/students/10/exams \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "exam_date": "2026-02-06",
    "total_score": 450,
    "max_score": 600,
    "subject_scores": {
      "anatomy": 85,
      "physiology": 78,
      "biochemistry": 92
    }
  }'
```

**What happens:**
1. Exam record created in mock_exams table
2. Event logged: mock_exam_created
3. Within 2 minutes, exam_intervention workflow triggers
4. Workflow analyzes performance
5. AI generates personalized feedback
6. Message appears in Inbox

**Exam Intervention Workflow:**
```python
def exam_intervention_workflow(student_id: int, exam_id: int):
    # Load exam data
    exam = db.query(MockExam).get(exam_id)

    # Calculate percentage
    percentage = (exam.total_score / exam.max_score) * 100

    # Identify weak subjects (< 70%)
    weak_subjects = [
        subj for subj, score in exam.subject_scores.items()
        if score < 70
    ]

    # Generate intervention message
    if percentage < 60:
        tone = "supportive"
        focus = "fundamentals"
    elif percentage < 75:
        tone = "encouraging"
        focus = "weak_areas"
    else:
        tone = "congratulatory"
        focus = "optimization"

    # Call AI
    prompt = f"""
    Student scored {percentage:.1f}% on mock exam.
    Weak subjects: {', '.join(weak_subjects)}
    Generate {tone} coaching message focusing on {focus}.
    """

    message = call_openai(prompt)

    # Store in workflow run
    save_workflow_message(student_id, "exam_intervention", message)
```

---

## AI Coaching Workflows

### Overview

Three workflows currently implemented:

1. **Daily Review** - Creates study tasks
2. **Exam Intervention** - Analyzes exam performance
3. **Inactivity Scan** - Detects inactive students

### Daily Review Workflow

**Triggers:**
- Study session created (6-hour rate limit)
- Nightly schedule (21:30 Istanbul time)

**Flow:**
```
Study Session Created
    ↓
Event Logged
    ↓
Celery Beat (every 2 min) picks up event
    ↓
Checks rate limit (last run > 6h ago?)
    ↓
Yes → Triggers daily_review_workflow task
    ↓
Worker picks up task
    ↓
Calculates risk scores for all topics
    ↓
Identifies weak topics (high risk score)
    ↓
Creates 2 tasks per weak topic (max 3 topics)
    ↓
Calls OpenAI API for coaching message
    ↓
Stores message in workflow_run.context
    ↓
User sees message in Inbox
```

**Risk Score Calculation:**
```python
def calculate_risk_scores(db, student_id):
    scores = []

    for topic in all_topics:
        # Inactivity score (0-40 points)
        days_since_study = get_days_since_last_study(topic)
        inactivity = min(40, days_since_study * 5)

        # Adherence score (0-30 points)
        adherence = calculate_adherence(topic)
        adherence_score = (1 - adherence) * 30

        # Performance score (0-30 points)
        avg_score = get_avg_exam_score(topic)
        performance = (1 - avg_score/100) * 30

        total = inactivity + adherence_score + performance
        scores.append({
            "topic_id": topic.id,
            "topic_name": topic.name,
            "risk_score": total
        })

    return sorted(scores, key=lambda x: x["risk_score"], reverse=True)
```

### Exam Intervention Workflow

**Triggers:**
- Mock exam created (immediate, no rate limit)

**Flow:**
```
Mock Exam Recorded
    ↓
Event Logged
    ↓
Celery picks up event
    ↓
exam_intervention_workflow triggered
    ↓
Analyzes exam scores
    ↓
Identifies weak subjects
    ↓
Calls OpenAI for personalized feedback
    ↓
Creates targeted study recommendations
    ↓
Message stored and visible in Inbox
```

### Inactivity Scan Workflow

**Triggers:**
- Scheduled every 6 hours by Celery Beat

**Flow:**
```
Celery Beat (every 6h)
    ↓
inactivity_scan task triggered
    ↓
Queries all active students
    ↓
For each student:
    - Check last study session date
    - If > 3 days ago → inactive
    ↓
For inactive students:
    - Call OpenAI for motivational message
    - Store message in Inbox
    ↓
Students see "We miss you!" type messages
```

**Code:**
```python
@celery_app.task(name="inactivity_scan")
def inactivity_scan():
    cutoff = datetime.utcnow() - timedelta(days=3)

    # Find students with no recent activity
    inactive_students = (
        db.query(User)
        .filter(User.is_active == True)
        .filter(~User.id.in_(
            db.query(StudySession.student_id)
            .filter(StudySession.created_at >= cutoff)
        ))
        .all()
    )

    for student in inactive_students:
        # Generate motivational message
        prompt = f"Generate encouraging message for inactive student..."
        message = call_openai(prompt)

        # Create workflow run with message
        create_workflow_message(student.id, "inactivity_scan", message)
```

---

## Messages & Inbox

### Message Structure

Messages are stored in `workflow_runs` table:
```json
{
  "id": 123,
  "student_id": 10,
  "workflow_name": "daily_review",
  "status": "completed",
  "context": {
    "student_message": {
      "subject": "Your Daily Study Plan is Ready",
      "body": "Great work today! I've created 6 new tasks...",
      "tone": "encouraging"
    },
    "tasks_created": 6,
    "weak_topics": ["Anatomy", "Biochemistry"]
  },
  "created_at": "2026-02-06T10:30:00"
}
```

### Fetch Latest Message

📍 **WHERE TO RUN THIS:** Any Terminal (No specific directory required)

```bash
curl http://localhost:8000/v1/students/me/messages/latest \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "workflow_run_id": 123,
  "workflow_name": "daily_review",
  "created_at": "2026-02-06T10:30:00",
  "subject": "Your Daily Study Plan is Ready",
  "body": "Great work today! I've created 6 new tasks...",
  "tone": "encouraging"
}
```

### Fetch Message History

📍 **WHERE TO RUN THIS:** Any Terminal (No specific directory required)

```bash
curl "http://localhost:8000/v1/students/me/messages?limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

**Returns array of messages, newest first.**

### Mobile Inbox

**Features:**
- List of all messages
- 80-character preview
- NEW badge for unread messages
- Visual distinction (indigo border for new)
- Tap to view full message

**Read/Unread Logic:**
```typescript
// mobile/src/state/authStore.ts

interface AuthState {
  token: string | null;
  user: User | null;
  lastSeenWorkflowRunId: number;  // Track highest seen ID
  setLastSeenWorkflowRunId: (id: number) => void;
}

// mobile/app/(tabs)/inbox.tsx

const isNew = message.workflow_run_id > lastSeenWorkflowRunId;

// mobile/app/message/[workflow_run_id].tsx

useEffect(() => {
  if (workflow_run_id) {
    const id = parseInt(workflow_run_id as string, 10);
    setLastSeenWorkflowRunId(id);  // Mark as read
  }
}, [workflow_run_id]);
```

**Flow:**
1. User opens app → Inbox shows messages
2. New messages have workflow_run_id > lastSeenWorkflowRunId
3. User taps message → Detail screen opens
4. useEffect updates lastSeenWorkflowRunId to current message ID
5. Return to Inbox → Message no longer shows NEW badge

---

## Stats & Progress

### Weekly Stats Endpoint

📍 **WHERE TO RUN THIS:** Any Terminal (No specific directory required)

```bash
curl http://localhost:8000/v1/students/10/stats \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "student_id": 10,
  "week_start": "2026-02-03",
  "week_end": "2026-02-09",
  "total_sessions": 12,
  "total_hours": 18.5,
  "adherence_percentage": 78.5,
  "current_streak": 5,
  "daily_breakdown": [
    {
      "date": "2026-02-03",
      "sessions": 2,
      "minutes": 90,
      "tasks_completed": 4
    },
    {
      "date": "2026-02-04",
      "sessions": 1,
      "minutes": 60,
      "tasks_completed": 2
    },
    ...
  ]
}
```

### Streak Calculation

**Logic:**
```python
def calculate_streak(db, student_id):
    # Get all study dates, sorted descending
    dates = (
        db.query(StudySession.date)
        .filter(StudySession.student_id == student_id)
        .distinct()
        .order_by(desc(StudySession.date))
        .all()
    )

    if not dates:
        return 0

    streak = 0
    current_date = date.today()

    # Must have studied today or yesterday to have active streak
    if dates[0].date not in [current_date, current_date - timedelta(days=1)]:
        return 0

    # Count consecutive days backwards
    expected_date = dates[0].date
    for study_date in dates:
        if study_date.date == expected_date:
            streak += 1
            expected_date -= timedelta(days=1)
        else:
            break

    return streak
```

**Examples:**
- Studied today → Streak starts
- Studied today and yesterday → Streak = 2
- Studied 5 days in a row → Streak = 5
- Missed yesterday → Streak = 0 (broken)

### Adherence Calculation

**Logic:**
```python
def calculate_adherence(db, student_id):
    # Get tasks for current week
    week_start = date.today() - timedelta(days=date.today().weekday())
    week_end = week_start + timedelta(days=6)

    tasks = db.query(PlanTask).filter(
        PlanTask.plan_id == plan.id,
        PlanTask.date >= week_start,
        PlanTask.date <= week_end
    ).all()

    if not tasks:
        return 100.0

    completed = len([t for t in tasks if t.status == "completed"])
    total = len(tasks)

    return (completed / total) * 100
```

### Mobile Progress Screen

**Displays:**
- Week summary card
  - Total sessions
  - Total hours
  - Adherence %
  - Current streak 🔥

- Daily breakdown
  - Bar chart showing minutes per day
  - Monday through Sunday
  - Visual representation of study consistency

**Implementation:**
```typescript
// mobile/app/(tabs)/progress.tsx

const { data: stats } = useQuery({
  queryKey: ['stats', user.id],
  queryFn: () => fetchWeeklyStats(user.id)
});

// Display stats
<View style={styles.summaryCard}>
  <Text>{stats.total_sessions} Sessions</Text>
  <Text>{stats.total_hours} Hours</Text>
  <Text>{stats.adherence_percentage}% Adherence</Text>
  <Text>🔥 {stats.current_streak} Day Streak</Text>
</View>

// Daily bars
{stats.daily_breakdown.map(day => (
  <View key={day.date}>
    <Text>{day.date}</Text>
    <View style={{height: day.minutes * 2}} />  // Bar height
  </View>
))}
```

---

## Push Notifications

### Overview

TusCoach sends push notifications to users' phones when new coach messages are generated by AI workflows. The system uses **Expo Push API** for delivery.

### How It Works

```
Workflow completes → coach_message saved
    ↓
enqueue_notification() called
    ↓
Notification row created in `notifications` table (status=pending or deferred)
    ↓
Celery Beat (every 1 min) → send_pending_notifications task
    ↓
For each pending notification:
    1. Re-check quiet hours → defer again if still in window
    2. Find user's devices (expo push tokens)
    3. Send via Expo Push API
    4. Process response (mark sent/failed, remove invalid tokens)
    ↓
User's phone receives push notification
    ↓
User taps → deep links to message detail screen
```

### Device Registration

When a user logs in, the mobile app:
1. Requests notification permissions from the OS
2. Gets an Expo Push Token (unique per device)
3. Sends token to backend via `POST /v1/devices/register`
4. Backend stores in `devices` table (upsert by token)

**Backend model:**
```python
# backend/app/models/devices.py
class Device(Base):
    __tablename__ = "devices"
    id: Mapped[int]
    user_id: Mapped[int]           # FK → users.id
    platform: Mapped[str]          # "ios" or "android"
    expo_push_token: Mapped[str]   # "ExponentPushToken[xxx]"
    created_at: Mapped[datetime]
    last_active_at: Mapped[datetime]
```

### Notification Outbox

Notifications are stored in the `notifications` table as a reliable outbox:

```python
# backend/app/models/notifications.py
class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int]
    user_id: Mapped[int]                    # FK → users.id
    workflow_run_id: Mapped[Optional[int]]   # FK → workflow_runs.id (UNIQUE)
    type: Mapped[str]                        # "coach_message", "task_reminder", etc.
    title: Mapped[str]
    body: Mapped[str]
    data: Mapped[Optional[dict]]            # Deep link data (JSON)
    status: Mapped[str]                      # "pending", "sent", "failed", "deferred"
    error: Mapped[Optional[str]]
    next_attempt_at: Mapped[Optional[datetime]]  # For deferred (quiet hours)
    attempts: Mapped[int]                    # Deferral count
    created_at: Mapped[datetime]
    sent_at: Mapped[Optional[datetime]]
```

**Key constraint:** `workflow_run_id` is UNIQUE → one notification per workflow run (idempotency).

### Deep Linking

Notification data payload contains routing info:
```json
{
  "kind": "coach_message",
  "workflow_run_id": 42,
  "message_id": 15,
  "student_id": 10
}
```

Mobile app handles this in `useNotificationHandler.ts`:
- `kind=coach_message` + `message_id` → `/message/{messageId}`
- `kind=coach_message` + `workflow_run_id` → `/message/workflow_run/{workflowRunId}`
- Fallback → `/(tabs)/inbox`

If user taps notification while logged out, the navigation is stored in `pendingNavigation` and replayed after login.

### Sending Task

```python
# backend/app/tasks.py — send_pending_notifications

@celery_app.task(name="send_pending_notifications")
def send_pending_notifications():
    # Query: status='pending' OR (status='deferred' AND next_attempt_at <= now)
    sendable = db.query(Notification).filter(
        or_(
            Notification.status == "pending",
            (Notification.status == "deferred") & (Notification.next_attempt_at <= utc_now),
        )
    ).limit(100).all()

    for notification in sendable:
        # 1. Re-check quiet hours at send time
        send_after = compute_quiet_hours_delay(db, notification.user_id)
        if send_after:
            defer_notification(db, notification, send_after)
            continue

        # 2. Find user's devices
        devices = db.query(Device).filter(Device.user_id == notification.user_id).all()

        # 3. Send via Expo Push API
        expo_response = send_expo_push_notification(
            expo_push_tokens=[d.expo_push_token for d in devices],
            title=notification.title,
            body=notification.body,
            data=notification.data
        )

        # 4. Process response (mark sent/failed, cleanup invalid tokens)
        process_expo_response(db, notification, expo_tokens, expo_response)
```

### Debug Queries

```sql
-- Recent notifications
SELECT id, user_id, type, status, title, created_at, sent_at
FROM notifications ORDER BY created_at DESC LIMIT 10;

-- Deferred notifications (quiet hours)
SELECT id, user_id, status, next_attempt_at, attempts
FROM notifications WHERE status = 'deferred';

-- Registered devices
SELECT id, user_id, platform, expo_push_token, last_active_at
FROM devices ORDER BY last_active_at DESC;
```

---

## Student Preferences & Personalization

### Overview

Each student has a `student_preferences` row that stores personalized settings. These preferences customize:
- Workflow task minutes (weekday vs weekend targets)
- Inactivity rescue recovery plans
- Quiet hours for notification gating
- Dashboard snapshot display

### Data Model

```python
# backend/app/models/preferences.py
class StudentPreferences(Base):
    __tablename__ = "student_preferences"
    id: Mapped[int]
    student_id: Mapped[int]                     # FK → student_profiles.id (UNIQUE)
    exam_date: Mapped[Optional[date]]           # Target exam date
    daily_target_minutes_weekday: Mapped[Optional[int]]   # e.g. 120
    daily_target_minutes_weekend: Mapped[Optional[int]]   # e.g. 60
    preferred_study_window_start: Mapped[Optional[time]]  # e.g. 09:00
    preferred_study_window_end: Mapped[Optional[time]]    # e.g. 18:00
    quiet_hours_start: Mapped[Optional[time]]   # e.g. 23:00
    quiet_hours_end: Mapped[Optional[time]]     # e.g. 07:00
    timezone: Mapped[str]                       # default "Europe/Istanbul"
    created_at: Mapped[datetime]
    updated_at: Mapped[Optional[datetime]]
```

**FK chain:** `student_preferences.student_id` → `student_profiles.id` → `student_profiles.user_id` → `users.id`

### API Endpoints

**GET /v1/students/me/preferences**
- Returns current preferences (auto-creates row with defaults on first call)
- Response type: `StudentPreferencesOut`

**PUT /v1/students/me/preferences**
- Partial update: only sent fields are changed (`model_dump(exclude_unset=True)`)
- Validation: minutes must be 5-600, timezone must not be empty
- Response: full updated object

**GET /v1/students/me/onboarding_status**
- Returns `{ exam_date_set: bool, daily_target_set: bool }`
- Used by mobile app to decide if onboarding screen should be shown

### How Workflows Use Preferences

**Daily Review:**
```python
def _resolve_target_minutes(db, student_id, target_date):
    prefs = get_preferences(db, user_id)
    is_weekend = target_date.weekday() >= 5

    if is_weekend and prefs.daily_target_minutes_weekend:
        total = prefs.daily_target_minutes_weekend
    elif not is_weekend and prefs.daily_target_minutes_weekday:
        total = prefs.daily_target_minutes_weekday
    else:
        total = DEFAULT_MINUTES  # 60 default

    # Split: review = 2/3, practice = 1/3
    return int(total * 2/3), int(total * 1/3)
```

**Inactivity Rescue:**
```python
def _resolve_recovery_minutes(db, student_id):
    prefs = get_preferences(db, user_id)
    targets = [prefs.daily_target_minutes_weekday, prefs.daily_target_minutes_weekend]
    targets = [t for t in targets if t]

    if targets:
        recovery = max(15, min(targets) // 2)  # Half of lowest target, min 15
    else:
        recovery = DEFAULT_RECOVERY_MINUTES  # 30

    return recovery
```

Both workflows store a `preference_snapshot` in `workflow_runs.context` for auditability.

### Debug Queries

```sql
-- View student preferences
SELECT sp.id, u.email, sp.exam_date, sp.daily_target_minutes_weekday,
       sp.daily_target_minutes_weekend, sp.quiet_hours_start, sp.quiet_hours_end
FROM student_preferences sp
JOIN student_profiles p ON sp.student_id = p.id
JOIN users u ON p.user_id = u.id;

-- Check if onboarding is complete
SELECT u.email,
       sp.exam_date IS NOT NULL AS exam_set,
       (sp.daily_target_minutes_weekday IS NOT NULL
        OR sp.daily_target_minutes_weekend IS NOT NULL) AS target_set
FROM student_preferences sp
JOIN student_profiles p ON sp.student_id = p.id
JOIN users u ON p.user_id = u.id;
```

---

## Quiet Hours

### Overview

Students can set quiet hours (e.g. 23:00-07:00) during which no push notifications are sent. The system defers notifications until the quiet window ends.

### How It Works

**At enqueue time:**
```python
def enqueue_notification(db, user_id, type, title, body, ...):
    send_after = compute_quiet_hours_delay(db, user_id)

    notification = Notification(
        status="deferred" if send_after else "pending",
        next_attempt_at=send_after,
        ...
    )
```

**At send time (double-check):**
```python
# In send_pending_notifications Celery task
for notification in sendable:
    send_after = compute_quiet_hours_delay(db, notification.user_id, now=utc_now)
    if send_after:
        defer_notification(db, notification, send_after)  # Defer again
        continue
    # ... proceed to send
```

### Overnight Range Handling

Quiet hours can span midnight (e.g. 23:00 → 07:00):
```python
def _is_within_quiet_hours(now_time, start, end):
    if start <= end:
        # Same-day: e.g. 14:00-18:00
        return start <= now_time < end
    else:
        # Overnight: e.g. 23:00-07:00
        return now_time >= start or now_time < end
```

### Timezone Conversion

Quiet hours are stored in student-local time. The system converts to UTC for comparison:

```python
def compute_quiet_hours_delay(db, user_id, now=None):
    qh_start, qh_end, tz_name = _get_quiet_hours(db, user_id)
    tz = ZoneInfo(tz_name)  # e.g. "Europe/Istanbul"

    local_now = now.astimezone(tz)
    local_time = local_now.time()

    if not _is_within_quiet_hours(local_time, qh_start, qh_end):
        return None  # Outside quiet hours → send now

    # Compute when quiet hours end, convert to UTC
    end_today = datetime.combine(local_now.date(), qh_end, tzinfo=tz)
    if end_today <= local_now:
        end_today += timedelta(days=1)  # End is tomorrow

    return end_today.astimezone(timezone.utc)
```

**Example:**
- Student timezone: Europe/Istanbul (UTC+3)
- Quiet hours: 23:00-07:00
- Current time: 01:00 Istanbul (22:00 UTC)
- Result: defer until 07:00 Istanbul = 04:00 UTC

### Debug Queries

```sql
-- Deferred notifications
SELECT n.id, u.email, n.status, n.next_attempt_at, n.attempts, n.created_at
FROM notifications n
JOIN users u ON n.user_id = u.id
WHERE n.status = 'deferred'
ORDER BY n.next_attempt_at;

-- Student quiet hours settings
SELECT u.email, sp.quiet_hours_start, sp.quiet_hours_end, sp.timezone
FROM student_preferences sp
JOIN student_profiles p ON sp.student_id = p.id
JOIN users u ON p.user_id = u.id
WHERE sp.quiet_hours_start IS NOT NULL;
```

---

## Onboarding Flow

### Overview

On first login, new users are routed to a 4-step onboarding wizard before they can access the main app. The onboarding collects essential preferences for personalized coaching.

### Flow

```
User logs in (first time)
    ↓
Root layout calls GET /students/me/onboarding_status
    ↓
Response: { exam_date_set: false, daily_target_set: false }
    ↓
Router redirects to /onboarding screen
    ↓
Step 1: Exam date picker (optional, skippable)
Step 2: Daily targets — weekday & weekend minutes (required)
Step 3: Study window — start/end times (optional, skippable)
Step 4: Quiet hours — toggle + times (optional, skippable)
    ↓
User taps "Finish" → PUT /students/me/preferences
    ↓
onboardingDone = true in Zustand store
    ↓
Router redirects to /(tabs) dashboard
```

### Routing Logic

In `app/_layout.tsx`:

```typescript
// Check onboarding status when authenticated
useEffect(() => {
  async function checkOnboarding() {
    if (!token || !user || onboardingDone) return;
    const status = await fetchOnboardingStatus();
    if (status.exam_date_set && status.daily_target_set) {
      setOnboardingDone(true);
    }
  }
  if (isReady && token && user) checkOnboarding();
}, [isReady, token, user]);

// Navigation guard
useEffect(() => {
  if (!isReady) return;
  const inAuthGroup = segments[0] === '(auth)';
  const inOnboarding = segments[0] === 'onboarding';

  if (!token && !inAuthGroup) {
    router.replace('/(auth)/login');
  } else if (token && inAuthGroup) {
    router.replace(!onboardingDone ? '/onboarding' : '/(tabs)');
  } else if (token && !onboardingDone && !inOnboarding && !inAuthGroup) {
    router.replace('/onboarding');
  } else if (token && onboardingDone && inOnboarding) {
    router.replace('/(tabs)');
  }
}, [token, segments, isReady, onboardingDone]);
```

### Editing Later

After onboarding, users can always edit preferences via **Settings > Study Preferences**. This opens `app/preferences.tsx`, which:
1. Loads current values via `GET /students/me/preferences`
2. Populates form fields with saved data
3. Saves changes via `PUT /students/me/preferences`

---

## Admin Debug Tools

### Admin Endpoints

All under `/v1/admin`, require authentication.

**⚠️ DEV ONLY - No role check yet!**

### 1. View Workflow Runs

📍 **WHERE TO RUN THIS:** Any Terminal (No specific directory required)

```bash
curl "http://localhost:8000/v1/admin/workflow_runs?limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Use cases:**
- Check if workflows are executing
- Verify workflow status
- See when workflows ran

**Response:**
```json
[
  {
    "id": 123,
    "student_id": 10,
    "workflow_name": "daily_review",
    "status": "completed",
    "created_at": "2026-02-06T10:30:00"
  },
  {
    "id": 122,
    "student_id": 10,
    "workflow_name": "exam_intervention",
    "status": "completed",
    "created_at": "2026-02-06T09:15:00"
  }
]
```

### 2. View Event Logs

📍 **WHERE TO RUN THIS:** Any Terminal (No specific directory required)

```bash
curl "http://localhost:8000/v1/admin/events?limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

**Use cases:**
- Check if events are being logged
- Verify events are being processed
- Debug workflow triggers

**Response:**
```json
[
  {
    "id": 456,
    "student_id": 10,
    "user_id": null,
    "event_type": "study_session_created",
    "created_at": "2026-02-06T10:00:00",
    "processed_at": "2026-02-06T10:02:00"
  },
  {
    "id": 455,
    "student_id": 10,
    "user_id": null,
    "event_type": "mock_exam_created",
    "created_at": "2026-02-06T09:00:00",
    "processed_at": "2026-02-06T09:00:30"
  }
]
```

**What to look for:**
- `processed_at` should be shortly after `created_at` (within 2 minutes)
- If `processed_at` is NULL → event not processed yet
- If many unprocessed events → Celery worker/beat might be down

### 3. View Plan Tasks

📍 **WHERE TO RUN THIS:** Any Terminal (No specific directory required)

```bash
curl "http://localhost:8000/v1/admin/plan_tasks?date=2026-02-06" \
  -H "Authorization: Bearer $TOKEN"
```

**Use cases:**
- Check if tasks were created for a date
- Verify task details
- Debug task creation issues

**Response:**
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
  },
  {
    "id": 790,
    "plan_id": 5,
    "date": "2026-02-06",
    "topic_id": 12,
    "task_type": "practice",
    "target_minutes": 30,
    "status": "completed",
    "created_at": "2026-02-05T21:30:00"
  }
]
```

### Using API Docs for Admin

1. Open http://localhost:8000/docs
2. Click "Authorize" button
3. Enter: `Bearer YOUR_TOKEN_HERE`
4. Scroll to "admin" section
5. Try out endpoints interactively

---

## Mobile App Features

### File Structure
```
mobile/app/
├── _layout.tsx          ← Root layout with auth guard + onboarding routing
├── onboarding.tsx       ← First-login wizard (4 steps)
├── preferences.tsx      ← Edit preferences screen
├── (auth)/
│   ├── login.tsx
│   └── register.tsx
├── (tabs)/
│   ├── _layout.tsx      ← Tab bar with unread badge
│   ├── index.tsx        ← Dashboard (snapshot + message + plan + session)
│   ├── plan.tsx         ← Daily plan with date navigation
│   ├── inbox.tsx        ← Message list
│   ├── progress.tsx     ← Weekly stats
│   └── settings.tsx     ← Preferences link + notifications + logout
└── message/
    ├── [id].tsx         ← Message detail by message ID
    └── [workflow_run_id].tsx ← Message detail by workflow run
```

### Onboarding Screen

**Location:** `mobile/app/onboarding.tsx`

**Shown:** Only on first login when onboarding is incomplete.

**Steps:**
1. **Exam Date** — Date picker (skippable)
2. **Daily Targets** — Weekday + weekend minute inputs (required, validated 5-600)
3. **Study Window** — Start/end time pickers (skippable)
4. **Quiet Hours** — Toggle + start/end time pickers (skippable)

**Components:**
- Progress dots at the top
- Back/Skip/Next navigation
- DateTimePicker from `@react-native-community/datetimepicker`
- Submits all data at once via `PUT /students/me/preferences`
- Sets `onboardingDone=true` in Zustand store → redirects to dashboard

### Dashboard Screen

**Location:** `mobile/app/(tabs)/index.tsx`

**Components:**
1. **Today's Snapshot Card** (new)
   - Exam date with days remaining countdown
   - Today's target minutes (weekday/weekend aware)
   - Preferred study window
   - "Edit" link → Preferences screen
   - Only shown when preferences are set

2. **Latest Coach Message Card**
   - Fetches latest message from backend
   - Shows subject and preview
   - Tap to view full message

3. **Today's Plan Card**
   - Lists today's tasks
   - Checkboxes to mark complete

4. **Quick Add Session Card**
   - Minutes input + optional notes
   - Submit button

**Queries:** `['message']`, `['plan']`, `['preferences']`

### Plan Screen

**Location:** `mobile/app/(tabs)/plan.tsx`

**Features:**
- Date navigation buttons (Yesterday, Today, Tomorrow)
- Task list for selected date
- Completion checkboxes
- Task details (type, duration, topic)

### Inbox Screen

**Location:** `mobile/app/(tabs)/inbox.tsx`

**Features:**
- Message list with previews (80 chars)
- NEW badges for unread messages
- Unread count badge on tab icon (refreshes every 30s)
- Indigo border for new messages
- Pull to refresh
- Tap to view full message

### Message Detail Screen

**Location:** `mobile/app/message/[id].tsx`

**Features:**
- Full message display
- Auto-marks as read via `POST /students/me/messages/{id}/read`
- Formatted date and metadata
- Shows workflow name and tone

### Progress Screen

**Location:** `mobile/app/(tabs)/progress.tsx`

**Features:**
- Weekly stats summary
- Streak counter with fire emoji
- Daily breakdown visualization
- Adherence percentage

### Settings Screen

**Location:** `mobile/app/(tabs)/settings.tsx`

**Sections:**
1. **Study Preferences** — Tap to open Preferences screen (chevron indicator)
2. **Push Notifications** — Status badge, push token, re-register button
3. **Logout** — Clears auth + notification stores

### Preferences Screen

**Location:** `mobile/app/preferences.tsx`

**Features:**
- Loads current values via `GET /students/me/preferences`
- Editable fields: exam date, weekday/weekend targets, study window, quiet hours toggle
- Saves via `PUT /students/me/preferences`
- Invalidates `['preferences']` query on success
- Back button returns to Settings

### State Management

**Auth Store** (`src/state/authStore.ts` — Zustand + SecureStore):
- `token`, `user`, `lastSeenWorkflowRunId`, `onboardingDone`
- `setAuth()`, `setOnboardingDone()`, `logout()` (clears all)

**Notification Store** (`src/state/notificationStore.ts` — Zustand + SecureStore):
- `expoPushToken`, `permissionStatus`, `lastRegisteredAt`, `pendingNavigation`

### API Client

**Client** (`src/api/client.ts`):
- Axios with `baseURL` from `EXPO_PUBLIC_API_BASE_URL` (default `http://127.0.0.1:8000/v1`)
- Request interceptor auto-attaches `Authorization: Bearer {token}`

**Endpoints** (`src/api/coach.ts`):
- Messages: `fetchLatestMessage`, `fetchMessagesHistory`, `fetchMessageById`, `markMessageRead`, `fetchUnreadCount`
- Plan: `fetchDailyPlan`, `completeTask`
- Sessions: `createSession`
- Stats: `fetchStats`
- Preferences: `fetchPreferences`, `updatePreferences`, `fetchOnboardingStatus`

---

## Troubleshooting Every Error

### 1. "Network request failed"

**Symptom:** Mobile app can't connect to backend.

**Cause:** Using 127.0.0.1 on physical device.

**Solution:**
📍 **WHERE TO RUN THIS:** Project Root (`/Users/burakozer/TusCoach`)

```bash
# Find your IP
ipconfig getifaddr en0

# Set in mobile
cd mobile
export EXPO_PUBLIC_API_BASE_URL=http://192.168.1.172:8000/v1
npm start
```

### 2. "401 Unauthorized"

**Symptom:** API returns 401 on authenticated requests.

**Causes:**
1. Token expired
2. Token not included in request
3. JWT_SECRET changed on backend

**Solutions:**
1. Log out and log back in
2. Check Axios interceptor adds token
3. Clear app data and re-authenticate

**Debug:**
📍 **WHERE TO RUN THIS:** Any Terminal (No specific directory required)

```bash
# Check token in mobile AsyncStorage/SecureStore
# iOS Simulator: Shake → Debug Menu → Show Element Inspector

# Check token is valid
curl http://localhost:8000/v1/students/me/messages \
  -H "Authorization: Bearer YOUR_TOKEN" -v
```

### 3. "Cannot connect to Redis"

**Symptom:** Celery worker fails to start.

**Error:**
```
ConnectionError: Error 61 connecting to localhost:6379. Connection refused.
```

**Solution:**
📍 **WHERE TO RUN THIS:** Any Terminal (No specific directory required)

```bash
# Check Redis is running
redis-cli ping

# If not running, start it
redis-server

# Or with Homebrew
brew services start redis
```

### 4. "Cannot connect to PostgreSQL"

**Symptom:** Backend fails to start or crashes.

**Error:**
```
could not connect to server: Connection refused
```

**Solution:**
📍 **WHERE TO RUN THIS:** Any Terminal (No specific directory required)

```bash
# Check PostgreSQL is running
PGPASSWORD=tuscoach123 psql -h localhost -p 5433 -U tuscoach -d tuscoach

# If Docker, check container
docker ps | grep postgres
```

### 5. "Permission denied: celerybeat-schedule.db"

**Symptom:** Celery Beat crashes on macOS.

**Error:**
```
PermissionError: [Errno 1] Operation not permitted: 'celerybeat-schedule.db'
```

**Solution:**
Use in-memory scheduler:
📍 **WHERE TO RUN THIS:** Check the context above for the correct directory

```bash
celery -A app.core.celery_app beat \
  --loglevel=info \
  --scheduler celery.beat:Scheduler
```

### 6. "Duplicate key violates unique constraint"

**Symptom:** Creating task fails with unique constraint error.

**Error:**
```
IntegrityError: duplicate key value violates unique constraint "uq_plan_task"
```

**Cause:** Trying to create task that already exists.

**Expected behavior:** This is handled by `ON CONFLICT DO NOTHING` in workflow code.

**If error persists:**
```sql
-- Check for duplicates
SELECT plan_id, date, topic_id, task_type, COUNT(*)
FROM plan_tasks
GROUP BY plan_id, date, topic_id, task_type
HAVING COUNT(*) > 1;

-- Delete duplicates (keep lowest id)
DELETE FROM plan_tasks a
USING plan_tasks b
WHERE a.id > b.id
  AND a.plan_id = b.plan_id
  AND a.date = b.date
  AND a.topic_id = b.topic_id
  AND a.task_type = b.task_type;
```

### 7. "Module not found"

**Symptom:** Import error in backend.

**Error:**
```
ModuleNotFoundError: No module named 'fastapi'
```

**Solution:**
📍 **WHERE TO RUN THIS:** Project Root (`/Users/burakozer/TusCoach`)

```bash
cd backend
../venv/bin/pip install -r requirements.txt
```

### 8. "Port 8000 already in use"

**Symptom:** Backend won't start.

**Error:**
```
OSError: [Errno 48] Address already in use
```

**Solution:**
📍 **WHERE TO RUN THIS:** Backend Directory (`/Users/burakozer/TusCoach/backend`)

```bash
# Kill process using port 8000
lsof -ti:8000 | xargs kill -9

# Or use dev.sh (does this automatically)
./dev.sh
```

### 9. Workflows not triggering

**Symptom:** Study sessions created but no messages appear.

**Debug steps:**

**1. Check events are logged:**
```sql
SELECT * FROM event_logs
WHERE event_type = 'study_session_created'
ORDER BY created_at DESC
LIMIT 5;
```

**2. Check events are processed:**
```sql
SELECT * FROM event_logs
WHERE processed_at IS NOT NULL
ORDER BY processed_at DESC
LIMIT 5;
```

If `processed_at` is NULL → Celery Beat or Worker not running.

**3. Check workflow runs:**
```sql
SELECT * FROM workflow_runs
ORDER BY created_at DESC
LIMIT 5;
```

If no workflow runs → Check rate limiting or workflow errors.

**4. Check Celery worker logs:**
Look for errors in the terminal where worker is running.

**5. Check Celery beat logs:**
Look for "Scheduler: Sending due task" messages.

### 10. Mobile app crashes on startup

**Symptom:** App crashes immediately after opening.

**Debug:**
1. Check Metro bundler logs for errors
2. Shake device → Show Dev Menu → Enable Debug Remote JS
3. Open Chrome DevTools
4. Check for JavaScript errors

**Common causes:**
- Syntax error in code
- Missing dependency
- Invalid API response breaking state

**Solution:**
📍 **WHERE TO RUN THIS:** Project Root (`/Users/burakozer/TusCoach`)

```bash
# Clear cache
cd mobile
npm start -- --clear

# Reinstall dependencies
rm -rf node_modules
npm install

# Reset Expo cache
npx expo start -c
```

---

## Final Tips

### Development Workflow

1. Always run backend, worker, and beat together
2. Check logs regularly for errors
3. Use admin endpoints to debug
4. Test on both simulator and real device
5. Clear caches when things don't make sense

### Best Practices

1. **Never commit secrets**
   - .env files are gitignored
   - Use .env.example as template

2. **Database migrations**
   - Always review migration files
   - Test migrations on test database first
   - Backup production before migrating

3. **API changes**
   - Update mobile app when backend changes
   - Test all affected endpoints
   - Update documentation

4. **Celery tasks**
   - Keep tasks idempotent (safe to run multiple times)
   - Add logging for debugging
   - Handle errors gracefully

5. **Mobile updates**
   - Test on slow networks
   - Handle loading states
   - Show helpful error messages

### Getting Help

1. Check logs first (backend, worker, beat, mobile)
2. Use admin endpoints to inspect data
3. Query database directly to verify state
4. Use debugger/console.log generously
5. Read error messages carefully

---

**End of Dummy Book**

You now have complete knowledge of every feature, every command, and every step to work with TusCoach! 🎉
