# Coach Messages Backfill Guide

## Overview

This guide explains how to use the backfill script to populate the `coach_messages` table from historical `workflow_runs` data.

## When to Use

Use the backfill script in these scenarios:

1. **After deploying the coach_messages table** - Migrate historical messages from workflow_runs
2. **After importing historical data** - Ensure all messages are in the new table
3. **Data consistency verification** - Verify workflow_runs and coach_messages are in sync
4. **Recovery from data loss** - Restore coach_messages from workflow_runs backup

## Quick Start

### 1. Dry Run (Recommended First)

Always start with a dry run to see what would be created:

```bash
cd backend
python scripts/backfill_coach_messages.py
```

This will:
- ✅ Scan all workflow_runs
- ✅ Show what messages would be created
- ✅ Report statistics
- ⚠️ **NOT** commit any changes to the database

### 2. Review Output

Look for:
- Number of workflow_runs with messages
- How many messages would be created
- How many already exist
- Any errors or warnings

Example output:
```
============================================================
Starting Coach Messages Backfill - DRY RUN MODE
============================================================
⚠️  Running in DRY RUN mode - no changes will be committed
Querying workflow_runs with student_message in context...
Found 142 total workflow_runs
Found 37 workflow_runs with student_message
Processing 37 workflow_runs...

Progress: 37/37 (100%) - Created: 32, Existed: 5, Errors: 0

Processing complete!
============================================================
Backfill Complete (DRY RUN)
============================================================
Total workflow_runs scanned:     142
Workflow_runs with messages:     37
Messages created:                32
Messages already existed:        5
Messages skipped (no profile):   0
Messages skipped (empty):        0
Errors encountered:              0
Duration:                        1.23 seconds
============================================================
⚠️  This was a DRY RUN - no changes were committed
   Run with --commit to actually create messages
```

### 3. Perform Actual Backfill

If dry run looks good, run with `--commit`:

```bash
python scripts/backfill_coach_messages.py --commit
```

This will:
- ✅ Actually create coach_messages records
- ✅ Commit changes to the database
- ✅ Skip messages that already exist (idempotent)

### 4. Verify Results

After backfill, verify the results:

```sql
-- Check total messages created
SELECT COUNT(*) FROM coach_messages;

-- Check messages per user
SELECT user_id, COUNT(*) as message_count
FROM coach_messages
GROUP BY user_id
ORDER BY message_count DESC;

-- Check messages with workflow_run_id
SELECT COUNT(*) as count_with_workflow
FROM coach_messages
WHERE workflow_run_id IS NOT NULL;

-- Compare with workflow_runs
SELECT COUNT(*) as workflow_runs_with_messages
FROM workflow_runs
WHERE context::text LIKE '%student_message%';
```

## Advanced Usage

### Verbose Output

See detailed information about each message processed:

```bash
python scripts/backfill_coach_messages.py --commit --verbose
```

This shows:
- Each message being created
- Each message that already exists
- Detailed error messages if any issues occur

### Multiple Runs

The script is **idempotent** - safe to run multiple times:

```bash
# First run - creates messages
python scripts/backfill_coach_messages.py --commit

# Second run - skips existing messages
python scripts/backfill_coach_messages.py --commit

# Output will show:
# Messages created: 0
# Messages already existed: 32
```

## What the Script Does

### 1. Scans workflow_runs

```python
# Finds all workflow_runs with student_message in context
SELECT * FROM workflow_runs
WHERE context ? 'student_message'
ORDER BY created_at;
```

### 2. Extracts Message Data

For each workflow_run with student_message:

```python
student_message = workflow_run.context['student_message']
subject = student_message['subject']
body = student_message['body']
tone = student_message['tone']
```

### 3. Maps to User and Student

```python
user_id = workflow_run.student_id  # workflow_runs.student_id is actually user.id
student_id = StudentProfile.query.filter_by(user_id=user_id).first().id
```

### 4. Creates CoachMessage

```python
coach_message = CoachMessage(
    user_id=user_id,
    student_id=student_id,
    workflow_run_id=workflow_run.id,
    subject=subject,
    body=body,
    tone=tone,
    created_at=workflow_run.created_at  # Preserves original timestamp
)
```

### 5. Handles Duplicates

```python
try:
    db.add(coach_message)
    db.commit()
except IntegrityError:
    # Message already exists due to UNIQUE(user_id, workflow_run_id)
    db.rollback()
    stats.messages_already_exist += 1
```

## Safety Features

### Idempotency

The script is safe to rerun because:
- UNIQUE constraint on `(user_id, workflow_run_id)` prevents duplicates
- IntegrityError is caught and handled gracefully
- Already-existing messages are counted but not modified

### Dry Run by Default

- Default mode is **dry run** (no changes)
- Must explicitly use `--commit` to make changes
- Prevents accidental data modification

### Error Handling

- Errors are logged but don't stop the entire process
- Each message is processed independently
- Errors are reported in final statistics

### Timestamp Preservation

- Original `workflow_run.created_at` timestamp is preserved
- Ensures message chronology matches original workflow execution

## Scenarios

### Scenario 1: Fresh Migration

You've just deployed the `coach_messages` table:

```bash
# 1. Dry run to see what will be created
python scripts/backfill_coach_messages.py

# 2. Review output - should show many messages to create

# 3. Actually perform backfill
python scripts/backfill_coach_messages.py --commit

# 4. Verify results
psql -h localhost -p 5433 -U tuscoach -d tuscoach \
  -c "SELECT COUNT(*) FROM coach_messages;"
```

### Scenario 2: Incremental Backfill

New workflow_runs have been created since last backfill:

```bash
# Safe to rerun - will only create new messages
python scripts/backfill_coach_messages.py --commit

# Output will show:
# Messages created: 5 (only new ones)
# Messages already existed: 32 (from previous backfill)
```

### Scenario 3: Data Verification

Check if workflow_runs and coach_messages are in sync:

```bash
# Dry run to see if any messages are missing
python scripts/backfill_coach_messages.py

# If it shows "Messages created: 0", everything is in sync!
```

### Scenario 4: Recovery from Deletion

If `coach_messages` table was accidentally truncated:

```bash
# Truncated table (accidental)
TRUNCATE TABLE coach_messages;

# Restore from workflow_runs
python scripts/backfill_coach_messages.py --commit

# All messages are restored!
```

## Skipped Messages

The script skips messages in these cases:

### 1. Empty Messages

Messages with both empty subject and body:

```json
{
  "student_message": {
    "subject": "",
    "body": "",
    "tone": "neutral"
  }
}
```

**Why skipped:** No content to display to user

### 2. Missing StudentProfile

User doesn't have a StudentProfile:

```sql
SELECT * FROM users WHERE id = 123;
-- User exists

SELECT * FROM student_profiles WHERE user_id = 123;
-- No profile found
```

**Why skipped:** Can't determine `student_id` for foreign key

### 3. Already Exists

Message already exists for this workflow_run:

```sql
SELECT * FROM coach_messages
WHERE user_id = 1 AND workflow_run_id = 42;
-- Returns existing message
```

**Why skipped:** Prevented by UNIQUE constraint (idempotency)

## Troubleshooting

### No workflow_runs found

```
Found 0 workflow_runs with student_message
```

**Solution:** Verify workflow_runs table has data with student_message:

```sql
SELECT id, workflow_name, context
FROM workflow_runs
WHERE context::text LIKE '%student_message%'
LIMIT 5;
```

### All messages skipped (no profile)

```
Messages skipped (no profile): 37
```

**Solution:** Create StudentProfiles for users:

```sql
-- Check users without profiles
SELECT u.id, u.email
FROM users u
LEFT JOIN student_profiles sp ON u.id = sp.user_id
WHERE sp.id IS NULL;

-- Create missing profiles
INSERT INTO student_profiles (user_id)
SELECT u.id FROM users u
LEFT JOIN student_profiles sp ON u.id = sp.user_id
WHERE sp.id IS NULL;
```

### Import errors

```
ModuleNotFoundError: No module named 'app'
```

**Solution:** Run from backend directory:

```bash
cd backend  # Must be in backend directory
python scripts/backfill_coach_messages.py
```

## Testing

The backfill script has comprehensive tests:

```bash
cd backend
pytest tests/test_backfill_script.py -v
```

Tests verify:
- ✅ Messages are created from workflow_runs
- ✅ Empty messages are skipped
- ✅ Idempotency (running twice doesn't create duplicates)
- ✅ Dry run mode doesn't commit changes
- ✅ Original timestamps are preserved
- ✅ Users without profiles are skipped
- ✅ Filter logic correctly identifies messages

## Performance

**Typical performance:**
- 100 workflow_runs: ~1-2 seconds
- 1,000 workflow_runs: ~10-15 seconds
- 10,000 workflow_runs: ~2-3 minutes

**Optimization tips:**
- Script processes one message at a time (safe for large datasets)
- Progress is reported every 10 messages
- Database commits happen per message (prevents large rollbacks)

## Monitoring

### During Backfill

Watch for:
- Progress percentage
- Error count (should be 0)
- Skipped count (investigate if unexpectedly high)

### After Backfill

Verify consistency:

```sql
-- Messages should match workflow_runs with student_message
SELECT
  (SELECT COUNT(*) FROM coach_messages WHERE workflow_run_id IS NOT NULL) as messages_count,
  (SELECT COUNT(*) FROM workflow_runs WHERE context ? 'student_message') as workflow_runs_count;
```

Should be equal (accounting for skipped empty/no-profile cases).

## Related Documentation

- [Backend Scripts README](scripts/README.md) - All available scripts
- [Messages API Implementation](MESSAGES_API_IMPLEMENTATION.md) - API endpoints
- [Push Notification E2E Guide](../docs/push_e2e_check.md) - End-to-end testing

## Support

If you encounter issues:

1. Run with `--verbose` to see detailed output
2. Check the error messages in the output
3. Verify database connectivity
4. Check that StudentProfiles exist for all users
5. Review the test suite for examples
