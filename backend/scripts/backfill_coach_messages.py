#!/usr/bin/env python3
"""
Backfill script to populate coach_messages table from historical workflow_runs.

This script scans workflow_runs where context contains student_message and creates
corresponding coach_messages entries. It's safe to rerun (idempotent) due to the
UNIQUE(user_id, workflow_run_id) constraint on coach_messages.

Usage:
    # Dry run (default) - shows what would be created
    python scripts/backfill_coach_messages.py

    # Actually perform the backfill
    python scripts/backfill_coach_messages.py --commit

    # Show more detailed output
    python scripts/backfill_coach_messages.py --commit --verbose

Author: TusCoach Team
Date: 2024-01-15
"""

import sys
import argparse
import logging
from pathlib import Path
from datetime import datetime
from sqlalchemy.exc import IntegrityError

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.db import SessionLocal
from app.models.workflow import WorkflowRun
from app.models.user import StudentProfile
from app.models.message import CoachMessage

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class BackfillStats:
    """Track statistics during backfill operation."""

    def __init__(self):
        self.total_workflow_runs = 0
        self.workflow_runs_with_messages = 0
        self.messages_created = 0
        self.messages_already_exist = 0
        self.messages_skipped_no_profile = 0
        self.messages_skipped_empty = 0
        self.errors = 0
        self.start_time = datetime.utcnow()

    def duration(self):
        """Calculate duration in seconds."""
        return (datetime.utcnow() - self.start_time).total_seconds()

    def print_summary(self, dry_run=False):
        """Print summary statistics."""
        mode = "DRY RUN" if dry_run else "COMMITTED"
        logger.info("=" * 60)
        logger.info(f"Backfill Complete ({mode})")
        logger.info("=" * 60)
        logger.info(f"Total workflow_runs scanned:     {self.total_workflow_runs:,}")
        logger.info(f"Workflow_runs with messages:     {self.workflow_runs_with_messages:,}")
        logger.info(f"Messages created:                {self.messages_created:,}")
        logger.info(f"Messages already existed:        {self.messages_already_exist:,}")
        logger.info(f"Messages skipped (no profile):   {self.messages_skipped_no_profile:,}")
        logger.info(f"Messages skipped (empty):        {self.messages_skipped_empty:,}")
        logger.info(f"Errors encountered:              {self.errors:,}")
        logger.info(f"Duration:                        {self.duration():.2f} seconds")
        logger.info("=" * 60)

        if dry_run:
            logger.info("⚠️  This was a DRY RUN - no changes were committed")
            logger.info("   Run with --commit to actually create messages")
        else:
            logger.info("✅ Changes have been committed to the database")


def get_workflow_runs_with_messages(db):
    """
    Query all workflow_runs that have student_message in context.

    Returns list of WorkflowRun objects.
    """
    logger.info("Querying workflow_runs with student_message in context...")

    # Get all workflow_runs (we need to filter in Python since JSON querying varies by DB)
    all_runs = db.query(WorkflowRun).order_by(WorkflowRun.created_at).all()

    # Filter to those with student_message
    runs_with_messages = [
        run for run in all_runs
        if run.context and 'student_message' in run.context
    ]

    logger.info(f"Found {len(all_runs):,} total workflow_runs")
    logger.info(f"Found {len(runs_with_messages):,} workflow_runs with student_message")

    return all_runs, runs_with_messages


def backfill_message(db, workflow_run, stats, dry_run=False, verbose=False):
    """
    Backfill a single coach_message from a workflow_run.

    Args:
        db: Database session
        workflow_run: WorkflowRun object
        stats: BackfillStats object
        dry_run: If True, don't commit changes
        verbose: If True, log detailed information

    Returns:
        bool: True if message was created, False otherwise
    """
    try:
        student_message = workflow_run.context.get('student_message', {})

        # Extract fields
        subject = student_message.get('subject', '')
        body = student_message.get('body', '')
        tone = student_message.get('tone')

        # Check if message has content
        has_content = bool(subject or body)
        if not has_content:
            stats.messages_skipped_empty += 1
            if verbose:
                logger.debug(f"Skipping workflow_run {workflow_run.id} - empty subject and body")
            return False

        # Get user_id from workflow_run.student_id
        # Note: workflow_runs.student_id is actually the user.id
        user_id = workflow_run.student_id

        # Get StudentProfile for this user
        profile = db.query(StudentProfile).filter(
            StudentProfile.user_id == user_id
        ).first()

        if not profile:
            stats.messages_skipped_no_profile += 1
            logger.warning(
                f"Skipping workflow_run {workflow_run.id} - "
                f"no StudentProfile found for user_id {user_id}"
            )
            return False

        # Create CoachMessage
        coach_message = CoachMessage(
            user_id=user_id,
            student_id=profile.id,
            workflow_run_id=workflow_run.id,
            subject=subject,
            body=body,
            tone=tone,
            # Preserve original creation time
            created_at=workflow_run.created_at
        )

        if dry_run:
            # Don't actually insert in dry run mode
            stats.messages_created += 1
            if verbose:
                logger.info(
                    f"[DRY RUN] Would create message for workflow_run {workflow_run.id}: "
                    f"subject='{subject[:50]}...'"
                )
            return True
        else:
            # Actually insert
            db.add(coach_message)
            try:
                db.commit()
                stats.messages_created += 1
                if verbose:
                    logger.info(
                        f"Created message for workflow_run {workflow_run.id}: "
                        f"subject='{subject[:50]}...'"
                    )
                return True

            except IntegrityError:
                # Message already exists (UNIQUE constraint violation)
                db.rollback()
                stats.messages_already_exist += 1
                if verbose:
                    logger.debug(
                        f"Message already exists for workflow_run {workflow_run.id} "
                        f"(user_id={user_id})"
                    )
                return False

    except Exception as e:
        db.rollback()
        stats.errors += 1
        logger.error(
            f"Error processing workflow_run {workflow_run.id}: {e}",
            exc_info=verbose
        )
        return False


def run_backfill(dry_run=True, verbose=False):
    """
    Main backfill function.

    Args:
        dry_run: If True, don't commit changes (default: True)
        verbose: If True, show detailed logging (default: False)
    """
    if verbose:
        logger.setLevel(logging.DEBUG)

    # Log mode
    mode = "DRY RUN MODE" if dry_run else "COMMIT MODE"
    logger.info("=" * 60)
    logger.info(f"Starting Coach Messages Backfill - {mode}")
    logger.info("=" * 60)

    if dry_run:
        logger.info("⚠️  Running in DRY RUN mode - no changes will be committed")
    else:
        logger.warning("⚠️  Running in COMMIT mode - changes will be written to database")

    # Initialize database session
    db = SessionLocal()
    stats = BackfillStats()

    try:
        # Get workflow_runs with messages
        all_runs, runs_with_messages = get_workflow_runs_with_messages(db)

        stats.total_workflow_runs = len(all_runs)
        stats.workflow_runs_with_messages = len(runs_with_messages)

        if not runs_with_messages:
            logger.info("No workflow_runs with student_message found - nothing to backfill")
            return stats

        # Process each workflow_run
        logger.info(f"Processing {len(runs_with_messages):,} workflow_runs...")
        logger.info("")

        for i, workflow_run in enumerate(runs_with_messages, 1):
            # Log progress every 10 items or in verbose mode
            if verbose or i % 10 == 0 or i == len(runs_with_messages):
                logger.info(
                    f"Progress: {i}/{len(runs_with_messages)} "
                    f"({i * 100 // len(runs_with_messages)}%) - "
                    f"Created: {stats.messages_created}, "
                    f"Existed: {stats.messages_already_exist}, "
                    f"Errors: {stats.errors}"
                )

            backfill_message(db, workflow_run, stats, dry_run, verbose)

        logger.info("")
        logger.info("Processing complete!")

    except KeyboardInterrupt:
        logger.warning("\nBackfill interrupted by user")
        db.rollback()

    except Exception as e:
        logger.error(f"Fatal error during backfill: {e}", exc_info=True)
        db.rollback()
        stats.errors += 1

    finally:
        db.close()

    # Print summary
    stats.print_summary(dry_run=dry_run)

    return stats


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Backfill coach_messages from historical workflow_runs',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run (see what would be created)
  python scripts/backfill_coach_messages.py

  # Actually perform the backfill
  python scripts/backfill_coach_messages.py --commit

  # Verbose output
  python scripts/backfill_coach_messages.py --commit --verbose
        """
    )

    parser.add_argument(
        '--commit',
        action='store_true',
        help='Actually commit changes (default is dry-run)'
    )

    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose output'
    )

    args = parser.parse_args()

    # Run backfill
    dry_run = not args.commit
    stats = run_backfill(dry_run=dry_run, verbose=args.verbose)

    # Exit with error code if there were errors
    if stats.errors > 0:
        logger.error(f"Backfill completed with {stats.errors} error(s)")
        sys.exit(1)
    else:
        logger.info("Backfill completed successfully")
        sys.exit(0)


if __name__ == '__main__':
    main()
