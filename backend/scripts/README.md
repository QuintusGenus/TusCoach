# Backend Scripts

Utility scripts for database maintenance and operations.

## Available Scripts

### backfill_coach_messages.py

Backfills the `coach_messages` table from historical `workflow_runs` data.

**Purpose:**
- Populates `coach_messages` table from existing workflow_runs
- Useful when migrating from context-based message storage to dedicated table
- Safe to rerun (idempotent via UNIQUE constraint)

**Usage:**

```bash
cd backend

# Dry run (see what would be created, no changes made)
python scripts/backfill_coach_messages.py

# Actually perform the backfill
python scripts/backfill_coach_messages.py --commit

# Show detailed output
python scripts/backfill_coach_messages.py --commit --verbose
```

**Options:**
- `--commit` - Actually commit changes (default is dry-run mode)
- `--verbose` / `-v` - Show detailed output for each message processed

**What it does:**
1. Scans all `workflow_runs` where `context` contains `student_message`
2. Extracts `subject`, `body`, and `tone` from `context.student_message`
3. Maps `workflow_run.student_id` → `user_id`
4. Looks up `StudentProfile.id` for the user
5. Creates `CoachMessage` record with original `created_at` timestamp
6. Skips messages that already exist (via UNIQUE constraint on `user_id`, `workflow_run_id`)

**Safety:**
- ✅ Idempotent - safe to rerun multiple times
- ✅ Dry-run by default - must explicitly use `--commit`
- ✅ Handles duplicates gracefully (UNIQUE constraint)
- ✅ Preserves original timestamps from workflow_runs
- ✅ Logs all operations with detailed statistics

**Output Example:**

```
============================================================
Starting Coach Messages Backfill - DRY RUN MODE
============================================================
⚠️  Running in DRY RUN mode - no changes will be committed
Querying workflow_runs with student_message in context...
Found 142 total workflow_runs
Found 37 workflow_runs with student_message
Processing 37 workflow_runs...

Progress: 10/37 (27%) - Created: 10, Existed: 0, Errors: 0
Progress: 20/37 (54%) - Created: 18, Existed: 2, Errors: 0
Progress: 30/37 (81%) - Created: 26, Existed: 4, Errors: 0
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

**When to use:**
- After deploying the `coach_messages` table migration
- When migrating from old message storage system
- After importing historical data
- To verify data consistency between workflow_runs and coach_messages

**Exit codes:**
- `0` - Success
- `1` - Errors encountered during backfill

---

## Adding New Scripts

When adding new scripts:

1. Create script in `backend/scripts/`
2. Add shebang: `#!/usr/bin/env python3`
3. Add docstring with usage instructions
4. Make executable: `chmod +x scripts/your_script.py`
5. Document it in this README
6. Add proper argument parsing with `--help`
7. Include dry-run mode for destructive operations
