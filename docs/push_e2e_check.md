# Push Notification End-to-End Verification

Complete guide for testing the push notification system from workflow → notification → device delivery.

---

## Prerequisites

- Backend running (FastAPI server)
- PostgreSQL database (port 5433)
- Redis running (for Celery)
- Expo mobile app on physical device (notifications don't work on simulators)

---

## Step 1: Start Backend Services

### Terminal 1: FastAPI Backend

```bash
cd backend
source ../venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**Expected output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

### Terminal 2: Celery Worker

```bash
cd backend
source ../venv/bin/activate
celery -A app.core.celery_app worker --loglevel=info
```

**Expected output:**
```
[tasks]
  . inactivity_scan
  . nightly_daily_review
  . process_recent_events
  . send_pending_notifications

[celery@hostname] ready.
```

### Terminal 3: Celery Beat (Scheduler)

```bash
cd backend
source ../venv/bin/activate
celery -A app.core.celery_app beat --loglevel=info
```

**Expected output:**
```
Scheduler: Sending due task send_pending_notifications (send_pending_notifications)
```

**Note:** Celery Beat runs in-memory (no persistent scheduler). Tasks run at intervals:
- `send_pending_notifications`: Every 1 minute
- `process_recent_events`: Every 5 minutes
- `inactivity_scan`: Daily at 9 AM
- `nightly_daily_review`: Daily at 10 PM

---

## Step 2: Mobile App Setup

### Start Mobile App

```bash
cd mobile
npm start
```

Scan QR code on **physical device** (iOS or Android).

### Login & Register Device

1. **Login** with test user credentials
2. App automatically requests notification permissions
3. App registers device token with backend

**Verify in logs:**
```
[NotificationHandler] Permission granted
[API] Device registered: ExponentPushToken[...]
```

### Check Database - Device Registration

```sql
-- View registered devices
SELECT
    id,
    user_id,
    platform,
    substring(expo_push_token, 1, 30) as token_preview,
    created_at
FROM devices
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:**
```
 id | user_id | platform |       token_preview        |         created_at
----+---------+----------+----------------------------+----------------------------
  1 |       1 | ios      | ExponentPushToken[xxxxxx]  | 2024-01-15 10:30:00
```

---

## Step 3: Trigger Workflow (Creates Notification)

### Option A: Manual API Call (Daily Review)

```bash
# Trigger daily_review workflow for user 1
curl -X POST http://localhost:8000/admin/workflows/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": 1,
    "workflow_name": "daily_review"
  }'
```

### Option B: Create Study Session (Triggers Event)

```bash
# Login and get token first
TOKEN=$(curl -X POST http://localhost:8000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "testpass"}' \
  | jq -r '.access_token')

# Create study session
curl -X POST http://localhost:8000/v1/sessions/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2024-01-15",
    "minutes": 120,
    "notes": "TUS Biology chapter 3"
  }'
```

**Note:** Study sessions trigger `process_recent_events` task (every 5 min), which runs `daily_review` workflow (rate-limited to 6 hours).

### Option C: Insert Test Message + Notification Directly

```sql
-- Step 1: Insert test message in coach_messages table
INSERT INTO coach_messages (
    user_id,
    student_id,
    workflow_run_id,
    subject,
    body,
    tone,
    created_at
)
VALUES (
    1,      -- user_id
    1,      -- student_id (same as user for now)
    NULL,   -- workflow_run_id (manual test)
    'Test Push Notification',
    'This is a test notification. Tap to verify deep linking works!',
    'neutral',
    NOW()
)
RETURNING id;

-- Step 2: Insert notification (use the message ID from Step 1)
-- Replace <message_id> with the ID returned from Step 1
INSERT INTO notifications (
    user_id,
    workflow_run_id,
    type,
    title,
    body,
    data,
    status,
    created_at
)
VALUES (
    1,
    NULL,  -- No workflow run for manual test
    'coach_message',
    'Test Push Notification',
    'This is a test notification. Tap to verify deep linking works!',
    '{"kind": "coach_message", "message_id": <message_id>, "student_id": 1}'::jsonb,
    'pending',
    NOW()
)
RETURNING id, status, created_at;
```

**Note:** Normally, workflows handle creating both the message AND the notification automatically.

---

## Step 4: Verify Notification Created

### Check Notifications Table

```sql
-- View pending notifications
SELECT
    id,
    user_id,
    workflow_run_id,
    type,
    title,
    substring(body, 1, 50) as body_preview,
    status,
    created_at
FROM notifications
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:**
```
 id | user_id | workflow_run_id |     type      |        title         |              body_preview               | status  |         created_at
----+---------+-----------------+---------------+----------------------+-----------------------------------------+---------+----------------------------
  1 |       1 |              42 | coach_message | Daily Review Summary | Great progress today! You studied 120... | pending | 2024-01-15 10:35:00
```

### Check Coach Messages Table

```sql
-- Verify message was created in coach_messages table
SELECT
    id,
    user_id,
    workflow_run_id,
    subject,
    substring(body, 1, 50) as body_preview,
    tone,
    read_at,
    created_at
FROM coach_messages
WHERE user_id = 1
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:**
```
 id | user_id | workflow_run_id |      subject         |              body_preview               |    tone     | read_at |         created_at
----+---------+-----------------+----------------------+-----------------------------------------+-------------+---------+----------------------------
  1 |       1 |              42 | Daily Review Summary | Great progress today! You studied 120... | encouraging | NULL    | 2024-01-15 10:35:00
```

### Check Unread Count

```sql
-- Verify unread message count
SELECT COUNT(*) as unread_count
FROM coach_messages
WHERE user_id = 1
  AND read_at IS NULL;
```

**Expected:**
```
 unread_count
--------------
            1
```

---

## Step 5: Wait for Celery Task (Max 1 Minute)

The `send_pending_notifications` task runs **every 1 minute**.

### Monitor Celery Worker Logs

In **Terminal 2** (Celery Worker), watch for:

```
[2024-01-15 10:36:00] Task send_pending_notifications[...] received
[2024-01-15 10:36:00] Notification 1: Fetching devices for user 1
[2024-01-15 10:36:00] Notification 1: Found 1 device(s)
[2024-01-15 10:36:00] Sent 1 push notification(s) to Expo API
[2024-01-15 10:36:00] Notification 1: 1 sent, 0 failed, 0 device errors
[2024-01-15 10:36:00] Push notification batch complete: 1 attempted, 1 sent, 0 failed, 0 skipped | Devices: 1 success, 0 failed, 0 invalid
[2024-01-15 10:36:00] Task send_pending_notifications[...] succeeded in 0.8s
```

### Force Trigger (Optional)

If you don't want to wait, manually trigger the task:

```bash
cd backend
source ../venv/bin/activate
python -c "from app.tasks import send_pending_notifications; send_pending_notifications()"
```

---

## Step 6: Verify Notification Sent

### Check Notification Status

```sql
-- View sent notifications
SELECT
    id,
    user_id,
    type,
    title,
    status,
    error,
    sent_at,
    created_at
FROM notifications
WHERE user_id = 1
ORDER BY created_at DESC
LIMIT 5;
```

**Expected (Success):**
```
 id | user_id |     type      |        title         | status | error |         sent_at         |         created_at
----+---------+---------------+----------------------+--------+-------+-------------------------+----------------------------
  1 |       1 | coach_message | Daily Review Summary | sent   | NULL  | 2024-01-15 10:36:00     | 2024-01-15 10:35:00
```

**Failure Scenarios:**

**No devices:**
```
 id | user_id | status | error
----+---------+--------+----------------------
  1 |       1 | failed | No devices registered
```

**Invalid token:**
```sql
-- Device should be deleted from devices table
SELECT COUNT(*) FROM devices WHERE user_id = 1;
-- Expected: 0 (if DeviceNotRegistered error)
```

**All devices failed:**
```
 id | user_id | status | error
----+---------+--------+--------------------------------------------------
  1 |       1 | failed | Token 0: DeviceNotRegistered; Token 1: ...
```

### Notification Metrics Query

```sql
-- Aggregated metrics
SELECT
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM notifications
GROUP BY status;
```

**Expected:**
```
 status  | count | percentage
---------+-------+------------
 sent    |    15 |      75.00
 failed  |     3 |      15.00
 pending |     2 |      10.00
```

---

## Step 7: Verify Mobile App Receives Notification

### Check Physical Device

**Notification should appear in:**
1. **Notification center** (if app is backgrounded/killed)
2. **In-app banner** (if app is in foreground)

**Notification content:**
- **Title:** "Daily Review Summary" (or custom subject)
- **Body:** "Great progress today!..." (truncated to 120 chars)

### Tap Notification

**Expected behavior:**
1. App opens (if killed/backgrounded)
2. Navigates to `/message/[workflow_run_id]` (if workflow_run_id exists in data)
3. OR navigates to `/(tabs)/inbox` (fallback)
4. Message detail screen loads via API

### Verify Deep Linking Logs

In mobile app console (Expo logs):

```
[NotificationHandler] Notification tapped: {kind: "coach_message", workflow_run_id: 42}
[NotificationHandler] User logged in, navigating to: /message/42
[NotificationHandler] Navigated to: /message/42
```

### Test Logged-Out Flow

1. Logout from app
2. Send another test notification (repeat Step 3)
3. Tap notification
4. **Expected:** App navigates to login, then to inbox after login

### Test Read Status Tracking

**Mark message as read:**
```sql
-- Simulate marking message as read
UPDATE coach_messages
SET read_at = NOW()
WHERE id = 1 AND user_id = 1;

-- Verify unread count decreased
SELECT COUNT(*) as unread_count
FROM coach_messages
WHERE user_id = 1 AND read_at IS NULL;
```

**Via API:**
```bash
# Mark message as read via API
curl -X POST http://localhost:8000/v1/students/me/messages/1/read \
  -H "Authorization: Bearer $TOKEN"

# Get unread count
curl http://localhost:8000/v1/students/me/messages/unread_count \
  -H "Authorization: Bearer $TOKEN"
```

---

## Step 8: Check for Errors

### Common Issues

**1. No notification received:**
```sql
-- Check notification status
SELECT id, status, error FROM notifications WHERE id = 1;
```

**Solutions:**
- Verify Celery worker is running
- Check device is registered (`SELECT * FROM devices WHERE user_id = 1;`)
- Ensure notification status is "pending" before task runs

**2. Device token invalid:**
```sql
-- Check for DeviceNotRegistered errors
SELECT id, status, error
FROM notifications
WHERE error LIKE '%DeviceNotRegistered%'
ORDER BY created_at DESC
LIMIT 5;
```

**Solutions:**
- Re-login on mobile app (re-registers device)
- Check Settings screen shows "Status: Enabled"

**3. Notification marked "failed" but device exists:**
```sql
-- Debug: Check Expo API errors
SELECT id, error FROM notifications WHERE status = 'failed' AND error NOT LIKE '%No devices%';
```

**Possible causes:**
- Expo Push API rate limiting
- Invalid push token format
- Expo API downtime (check https://status.expo.dev)

**4. Workflow doesn't create message:**
```sql
-- Check if workflow ran
SELECT id, workflow_name, status
FROM workflow_runs
WHERE student_id = 1
ORDER BY created_at DESC
LIMIT 1;

-- Check if message was created
SELECT id, subject, workflow_run_id
FROM coach_messages
WHERE workflow_run_id = 42;
```

**Solutions:**
- Ensure workflow creates `CoachMessage` record
- Check workflow logic in `backend/app/workflows/`
- Verify workflow_engine calls message creation service

---

## Quick Verification Checklist

Use this checklist for rapid end-to-end verification:

- [ ] **Backend running** on port 8000
- [ ] **Celery worker** running and ready
- [ ] **Celery beat** running (scheduler)
- [ ] **Mobile app** on physical device
- [ ] **Login successful** + device registered
- [ ] **Device in DB**: `SELECT COUNT(*) FROM devices WHERE user_id = 1;` → 1
- [ ] **Trigger workflow** (daily_review or test message)
- [ ] **Message created**: `SELECT COUNT(*) FROM coach_messages WHERE user_id = 1 AND read_at IS NULL;` → ≥1
- [ ] **Notification created**: `SELECT COUNT(*) FROM notifications WHERE status = 'pending';` → ≥1
- [ ] **Wait 1 minute** for Celery task
- [ ] **Notification sent**: `SELECT status FROM notifications WHERE id = X;` → "sent"
- [ ] **Push received** on device
- [ ] **Tap notification** → navigates to message detail
- [ ] **Message loads** from API
- [ ] **Message marked read**: `SELECT read_at FROM coach_messages WHERE id = X;` → timestamp
- [ ] **Unread count**: `SELECT COUNT(*) FROM coach_messages WHERE user_id = 1 AND read_at IS NULL;` → decreased

---

## SQL Monitoring Queries

### Real-Time Monitoring Dashboard

```sql
-- Summary view
SELECT
    'Total Messages' as metric,
    COUNT(*)::text as value
FROM coach_messages
UNION ALL
SELECT
    'Unread Messages',
    COUNT(*)::text
FROM coach_messages
WHERE read_at IS NULL
UNION ALL
SELECT
    'Messages (Last Hour)',
    COUNT(*)::text
FROM coach_messages
WHERE created_at > NOW() - INTERVAL '1 hour'
UNION ALL
SELECT
    'Total Notifications',
    COUNT(*)::text
FROM notifications
UNION ALL
SELECT
    'Pending Notifications',
    COUNT(*)::text
FROM notifications
WHERE status = 'pending'
UNION ALL
SELECT
    'Sent (Last Hour)',
    COUNT(*)::text
FROM notifications
WHERE status = 'sent'
  AND sent_at > NOW() - INTERVAL '1 hour'
UNION ALL
SELECT
    'Failed (Last Hour)',
    COUNT(*)::text
FROM notifications
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '1 hour'
UNION ALL
SELECT
    'Registered Devices',
    COUNT(*)::text
FROM devices;
```

### Find Duplicate Notifications (Should be 0)

```sql
-- Check for duplicate notifications per workflow_run
SELECT
    workflow_run_id,
    COUNT(*) as notification_count
FROM notifications
WHERE workflow_run_id IS NOT NULL
GROUP BY workflow_run_id
HAVING COUNT(*) > 1;
```

**Expected:** 0 rows (unique constraint enforced)

### Performance Check

```sql
-- Average time from notification creation to sent
SELECT
    AVG(EXTRACT(EPOCH FROM (sent_at - created_at))) as avg_send_time_seconds
FROM notifications
WHERE status = 'sent'
  AND sent_at IS NOT NULL;
```

**Expected:** ~60 seconds (Celery task runs every minute)

---

## Troubleshooting

### Reset Everything

```bash
# Stop all services (Ctrl+C in each terminal)

# Clear notifications
psql -h localhost -p 5433 -U tuscoach -d tuscoach -c "DELETE FROM notifications;"

# Clear messages
psql -h localhost -p 5433 -U tuscoach -d tuscoach -c "DELETE FROM coach_messages;"

# Clear devices
psql -h localhost -p 5433 -U tuscoach -d tuscoach -c "DELETE FROM devices;"

# Restart services (repeat Step 1)
```

### View Full Celery Logs

```bash
# In Terminal 2 (Celery Worker)
# Logs show:
# - Notification processing
# - Expo API responses
# - Device errors
# - Success/failure counts
```

### Test Expo Push API Directly

```bash
# Send test push via Expo API
curl -X POST https://exp.host/--/api/v2/push/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "ExponentPushToken[YOUR_TOKEN_HERE]",
    "title": "Manual Test",
    "body": "Testing Expo API directly"
  }'
```

**Expected response:**
```json
{
  "data": [
    {"status": "ok", "id": "..."}
  ]
}
```

---

## Success Criteria

✅ **Complete E2E flow working when:**

1. Backend + Celery services running
2. Device registered in database
3. Workflow creates notification with `status = 'pending'`
4. Celery task processes notification within 1 minute
5. Notification status changes to `'sent'`
6. Push appears on physical device
7. Tapping notification navigates to message detail
8. Message loads from API (`GET /v1/students/me/messages/by-workflow-run/{id}`)

---

## Next Steps

- **Production deployment:** Configure Celery Beat with persistent scheduler (database-backed)
- **Monitoring:** Set up alerts for failed notifications
- **Analytics:** Track notification open rates
- **Optimization:** Batch notifications for multiple users

---

## Related Documentation

- [WORKFLOW_NOTIFICATIONS_SUMMARY.md](../WORKFLOW_NOTIFICATIONS_SUMMARY.md) - Implementation details
- [NOTIFICATION_DEEP_LINKING.md](../NOTIFICATION_DEEP_LINKING.md) - Mobile deep linking guide
- [Expo Push Notifications Docs](https://docs.expo.dev/push-notifications/sending-notifications/)
